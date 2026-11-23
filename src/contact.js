export const carWidth = 1.98;
export const carLength = 4.28;
export const railRunoff = 5.5;

const halfWidth = carWidth / 2;
const halfLength = carLength / 2;
const inverseInertia = 12 / (carWidth ** 2 + carLength ** 2);
const dot = (a, b) => a.x * b.x + a.z * b.z;
const moment = (arm, vector) => arm.z * vector.x - arm.x * vector.z;
const direction = car => ({ x: Math.sin(car.yaw), z: Math.cos(car.yaw) });
const across = forward => ({ x: forward.z, z: -forward.x });

export function velocity(car) {
  const forward = direction(car);
  return { x: forward.x * car.speed + forward.z * car.lateral, z: forward.z * car.speed - forward.x * car.lateral };
}

function velocityAt(car, arm) {
  if (!car) return { x: 0, z: 0 };
  const motion = velocity(car);
  return { x: motion.x + arm.z * car.spin, z: motion.z - arm.x * car.spin };
}

function addImpulse(car, arm, axis, amount) {
  if (!car) return;
  const forward = direction(car);
  car.speed += dot(forward, axis) * amount;
  car.lateral += dot(across(forward), axis) * amount;
  car.spin += moment(arm, axis) * amount * inverseInertia;
}

function collide(a, b, normal, point, depth, restitution, friction) {
  const split = b ? 0.5 : 1;
  const correction = Math.max(0, depth - 0.005) * split;
  a.x -= normal.x * correction;
  a.z -= normal.z * correction;
  if (b) {
    b.x += normal.x * correction;
    b.z += normal.z * correction;
  }

  const armA = { x: point.x - a.x, z: point.z - a.z };
  const armB = b ? { x: point.x - b.x, z: point.z - b.z } : { x: 0, z: 0 };
  function relativeVelocity(axis) {
    return dot(velocityAt(a, armA), axis) - dot(velocityAt(b, armB), axis);
  }
  function effectiveMass(axis) {
    return (b ? 2 : 1) + (moment(armA, axis) ** 2 + moment(armB, axis) ** 2) * inverseInertia;
  }
  function apply(axis, amount) {
    addImpulse(a, armA, axis, -amount);
    addImpulse(b, armB, axis, amount);
  }

  const closingSpeed = relativeVelocity(normal);
  if (closingSpeed <= 0) return null;
  const bounce = closingSpeed > 2 ? restitution : 0;
  const impulse = (1 + bounce) * closingSpeed / effectiveMass(normal);
  apply(normal, impulse);
  const tangent = across(normal);
  const sliding = relativeVelocity(tangent);
  const maxFriction = impulse * friction;
  apply(tangent, Math.max(-maxFriction, Math.min(maxFriction, sliding / effectiveMass(tangent))));
  return { ...point, nx: normal.x, nz: normal.z, impulse, sliding };
}

function extent(forward, side, axis) {
  return Math.abs(dot(forward, axis)) * halfLength + Math.abs(dot(side, axis)) * halfWidth;
}

export function resolveVehicleContact(a, b) {
  const separation = { x: b.x - a.x, z: b.z - a.z };
  if (dot(separation, separation) > carLength ** 2 + carWidth ** 2) return null;
  const forwardA = direction(a);
  const forwardB = direction(b);
  const sideA = across(forwardA);
  const sideB = across(forwardB);
  let depth = Infinity;
  let normal;
  for (const axis of [forwardA, sideA, forwardB, sideB]) {
    const distance = dot(separation, axis);
    const overlap = extent(forwardA, sideA, axis) + extent(forwardB, sideB, axis) - Math.abs(distance);
    if (overlap <= 0) return null;
    if (overlap < depth) {
      depth = overlap;
      normal = distance >= 0 ? axis : { x: -axis.x, z: -axis.z };
    }
  }

  const tangent = across(normal);
  const widthA = extent(forwardA, sideA, tangent);
  const widthB = extent(forwardB, sideB, tangent);
  const side = dot(separation, tangent);
  const along = (Math.max(-widthA, side - widthB) + Math.min(widthA, side + widthB)) / 2;
  const outward = extent(forwardA, sideA, normal) - depth / 2;
  const point = { x: a.x + normal.x * outward + tangent.x * along, z: a.z + normal.z * outward + tangent.z * along };
  return collide(a, b, normal, point, depth, 0.13, 0.31);
}

export function resolveBarrierContact(car, projection, railOffset) {
  if (Math.abs(projection.offset) + Math.hypot(halfLength, halfWidth) < railOffset) return null;
  const forward = direction(car);
  const side = across(forward);
  const wallSide = Math.sign(projection.offset);
  const normal = { x: -projection.dz * wallSide, z: projection.dx * wallSide };
  const depth = Math.abs(projection.offset) + extent(forward, side, normal) - railOffset;
  if (depth <= 0) return null;
  const contactEdge = axis => Math.abs(dot(axis, normal)) < 0.1 ? 0 : Math.sign(dot(axis, normal));
  const along = halfLength * contactEdge(forward);
  const lateral = halfWidth * contactEdge(side);
  const point = {
    x: car.x + forward.x * along + side.x * lateral - normal.x * depth,
    z: car.z + forward.z * along + side.z * lateral - normal.z * depth,
  };
  return collide(car, null, normal, point, depth, 0.24, 0.43);
}
