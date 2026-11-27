import { velocity } from './contact.js';
import { wheelRadius } from './tires.js';
import { cornerContact } from './wheel-damage.js';
import { compoundId } from './tire-strategy.js';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const tau = Math.PI * 2;
const wrapAngle = value => value % tau;
const life = 19;

export function launchWheel(car, index, impact) {
  const { x, z, nx, nz } = cornerContact(car, index);
  const motion = velocity(car);
  const strength = impact.normalSpeed;
  const release = clamp(strength * 0.22, 4, 10);
  const vx = motion.x * 0.68 + nx * release - impact.nx * strength * 0.12;
  const vz = motion.z * 0.68 + nz * release - impact.nz * strength * 0.12;
  const groundSpeed = Math.hypot(vx, vz);
  return {
    id: `${car.id}-${index}`, compound: car.compound, x, y: wheelRadius + 0.12, z,
    vx, vy: clamp(1.5 + strength * 0.071, 2, 5.2), vz, yaw: Math.atan2(vx, vz), roll: 0,
    lean: nx * 0.19, tumble: Math.sign(nx || nz) * (1.4 + strength * 0.041),
    omega: groundSpeed / wheelRadius * 1.17, age: 0, bounces: 0,
  };
}

export function restoreLooseWheels(value, carIds) {
  if (!Array.isArray(value)) return [];
  const result = new Map();
  const dimensions = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'roll', 'lean', 'tumble', 'omega', 'age'];
  const ids = new Set(carIds.flatMap(id => [0, 1, 2, 3].map(index => `${id}-${index}`)));
  for (const wheel of value.slice(0, ids.size)) {
    if (!ids.has(wheel?.id) || !dimensions.every(key => Number.isFinite(wheel[key])) ||
        wheel.age < 0 || wheel.age >= life) continue;
    const entry = Object.fromEntries(dimensions.map(name => [name, clamp(wheel[name], -1400, 1400)]));
    result.set(wheel.id, { ...entry, id: wheel.id, compound: compoundId(wheel.compound),
      bounces: Number.isFinite(wheel.bounces) ? Math.max(0, Math.min(200, Math.floor(wheel.bounces))) : 0 });
  }
  return [...result.values()];
}

function barrier(wheel, track, road, radius, previousX, previousZ) {
  const lateralX = -road.dz, lateralZ = road.dx;
  const pit = track.pit;
  const wall = pit.wallAt(road.station) && wheel.y - radius < 0.99;
  const prior = road.offset - ((wheel.x - previousX) * lateralX + (wheel.z - previousZ) * lateralZ);
  const side = prior < pit.wallOffset ? 1 : -1;
  const axisAcrossRail = Math.abs(Math.cos(wheel.yaw) * lateralX - Math.sin(wheel.yaw) * lateralZ);
  const reach = 0.16 * axisAcrossRail + radius * Math.sqrt(Math.max(0, 1 - axisAcrossRail ** 2));
  const wallDepth = (road.offset - pit.wallOffset) * side + reach + pit.wallWidth * 0.5;
  const railSide = Math.sign(road.offset);
  const railDepth = Math.abs(road.offset) + reach - track.railAt(road.station, railSide);
  const depth = wall && wallDepth > 0 ? wallDepth : railDepth;
  const facing = wall && wallDepth > 0 ? side : railSide;
  if (depth <= 0) return;
  const nx = lateralX * facing, nz = lateralZ * facing;
  wheel.x -= nx * depth;
  wheel.z -= nz * depth;
  const normalSpeed = wheel.vx * nx + wheel.vz * nz;
  if (normalSpeed > 0) {
    wheel.vx -= nx * normalSpeed * 1.39;
    wheel.vz -= nz * normalSpeed * 1.39;
    wheel.tumble += facing * normalSpeed * 0.18;
  }
}

export function advanceLooseWheels(wheels, track, dt) {
  let active = 0;
  for (const wheel of wheels) {
    wheel.age += dt;
    if (wheel.age >= life) continue;
    const priorX = wheel.x, priorZ = wheel.z;
    wheel.x += wheel.vx * dt;
    wheel.z += wheel.vz * dt;
    wheel.vy -= 9.81 * dt;
    wheel.y += wheel.vy * dt;
    const radius = 0.19 + 0.175 * Math.abs(Math.cos(wheel.lean));
    const road = track.project(wheel.x, wheel.z);
    const asphalt = road.distance <= track.event.width / 2 || track.pit.pavedAt(road.station, road.offset);
    const speed = Math.hypot(wheel.vx, wheel.vz);
    if (wheel.y <= radius) {
      wheel.y = radius;
      if (wheel.vy < -1.1) {
        wheel.bounces++;
        wheel.vy = -wheel.vy * (asphalt ? 0.47 : 0.29);
        wheel.tumble += Math.sin(wheel.roll + wheel.lean) * wheel.vy * 0.58;
      } else wheel.vy = 0;
      const upright = Math.abs(Math.cos(wheel.lean));
      const friction = (asphalt ? 0.74 : 1.62) + (1 - upright) * 1.98;
      const drag = Math.exp(-dt * friction);
      wheel.vx *= drag;
      wheel.vz *= drag;
      wheel.omega += (speed / wheelRadius - wheel.omega) * Math.min(1, dt * 6);
      wheel.tumble *= Math.exp(-dt * 1.1);
    } else {
      wheel.vx *= Math.exp(-dt * 0.12);
      wheel.vz *= Math.exp(-dt * 0.12);
    }
    if (wheel.y - radius < 1.2) barrier(wheel, track, road, radius, priorX, priorZ);
    if (speed > 0.4) {
      const direction = Math.atan2(wheel.vx, wheel.vz);
      const difference = Math.atan2(Math.sin(direction - wheel.yaw), Math.cos(direction - wheel.yaw));
      wheel.yaw = wrapAngle(wheel.yaw + difference * Math.min(1, dt * 5.4));
    }
    wheel.lean = wrapAngle(wheel.lean + wheel.tumble * dt);
    wheel.roll = wrapAngle(wheel.roll + wheel.omega * dt);
    wheels[active++] = wheel;
  }
  wheels.length = active;
}
