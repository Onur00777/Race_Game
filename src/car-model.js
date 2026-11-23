import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const wheelRadius = 0.365;
const axles = [-1.29, 1.34];
const box = new T.BoxGeometry(1, 1, 1);
const rubber = new T.MeshStandardMaterial({ color: '#141515', roughness: 0.86 });
const carbon = new T.MeshStandardMaterial({ color: '#191d23', roughness: 0.62, metalness: 0.36 });
const inset = new T.MeshStandardMaterial({ color: '#090c10', roughness: 0.88 });
const aluminum = new T.MeshStandardMaterial({ color: '#9da7b1', roughness: 0.30, metalness: 0.84 });
const rotor = new T.MeshStandardMaterial({ color: '#9da09f', roughness: 0.61, metalness: 0.78 });
const caliper = new T.MeshStandardMaterial({ color: '#9e2920', roughness: 0.37, metalness: 0.26 });
const mirror = new T.MeshStandardMaterial({ color: '#bac4d1', roughness: 0.12, metalness: 0.92 });
const glass = new T.MeshPhysicalMaterial({ color: '#18212b', roughness: 0.18, metalness: 0.19, clearcoat: 0.85, clearcoatRoughness: 0.11 });
const headlight = new T.MeshStandardMaterial({ color: '#a9bdc8', emissive: '#c8e5ed', emissiveIntensity: 0.78, roughness: 0.34 });
const tailLight = new T.MeshStandardMaterial({ color: '#8f0d0a', emissive: '#ff2713', emissiveIntensity: 1.14, roughness: 0.31 });
const brakeLight = new T.MeshStandardMaterial({ color: '#b62117', emissive: '#ff4131', emissiveIntensity: 2.8, roughness: 0.29 });
const lensHousing = new T.MeshPhysicalMaterial({ color: '#330e14', roughness: 0.20, clearcoat: 1, metalness: 0.14 });
const tireProfile = [[0.249, -0.149], [0.309, -0.149], [0.337, -0.143], [0.355, -0.12],
  [wheelRadius, -0.088], [wheelRadius, 0.088], [0.355, 0.12], [0.337, 0.143], [0.309, 0.149], [0.249, 0.149]];
const tire = new T.LatheGeometry(tireProfile.map(([r, depth]) => new T.Vector2(r, depth)), 40).rotateZ(Math.PI / 2);
const rimLip = new T.TorusGeometry(0.238, 0.014, 8, 40).rotateY(Math.PI / 2);
const brakeDisc = new T.CylinderGeometry(0.198, 0.198, 0.023, 32).rotateZ(Math.PI / 2);
const center = new T.CylinderGeometry(0.069, 0.085, 0.023, 12).rotateZ(Math.PI / 2);
const tailPipe = new T.TorusGeometry(0.063, 0.010, 8, 22);
const intake = new T.CircleGeometry(0.057, 24);
const shadowPlane = new T.PlaneGeometry(1, 1);
const shadowMaterial = new T.ShaderMaterial({
  transparent: true, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: 'varying vec2 vUv; void main() { vec2 p = (vUv - 0.5) * vec2(1., .85); gl_FragColor = vec4(0.013, 0.011, 0.009, (1. - smoothstep(.16, .50, length(p))) * .53); }',
});

function mount(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function block(parent, material, sx, sy, sz, x, y, z) {
  const mesh = mount(parent, box, material, x, y, z);
  mesh.scale.set(sx, sy, sz);
  return mesh;
}

function contour(station) {
  const [z, width, floor, shoulder, crown] = station;
  const left = [[0, floor], [-width * 0.83, floor], [-width * 0.965, floor + 0.043],
    [-width, shoulder - (shoulder - floor) * 0.28], [-width * 0.96, shoulder],
    [-width * 0.77, crown - (crown - shoulder) * 0.21], [-width * 0.46, crown - 0.004]];
  const shape = [...left, [0, crown], ...left.slice(1).reverse().map(([x, y]) => [-x, y])];
  return new T.CatmullRomCurve3(shape.map(([x, y]) => new T.Vector3(x, y, z)), true);
}

function loft(stations, wheelArches = false) {
  const sides = 48;
  const contours = stations.map(contour);
  const positions = [];
  const indices = [];
  for (let i = 0; i < stations.length; i++) {
    for (let j = 0; j < sides; j++) {
      const { x, y, z } = contours[i].getPoint(j / sides);
      let height = y;
      if (wheelArches) {
        const distance = Math.min(...axles.map(axle => Math.abs(z - axle)));
        const archRadius = 0.402;
        if (distance < archRadius && Math.abs(x) > 0.57) {
          const arch = wheelRadius + Math.sqrt(archRadius ** 2 - distance ** 2);
          const sidewall = T.MathUtils.smoothstep(Math.abs(x), 0.57, 0.86);
          height += Math.max(0, arch - height) * sidewall;
        }
      }
      positions.push(x, height, z);
      if (i === 0) continue;
      const a = (i - 1) * sides + j;
      const b = (i - 1) * sides + (j + 1) % sides;
      indices.push(a, a + sides, b, b, a + sides, b + sides);
    }
  }
  const tail = positions.length / 3;
  const end = stations.at(-1);
  const start = stations[0];
  positions.push(0, (start[2] + start[4]) / 2, start[0], 0, (end[2] + end[4]) / 2, end[0]);
  for (let side = 0; side < sides; side++) {
    const next = (side + 1) % sides;
    const n = (stations.length - 1) * sides;
    indices.push(tail, side, next, tail + 1, n + next, n + side);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const bodyShape = loft([
  [-2.12, 0.78, 0.30, 0.56, 0.62], [-2.04, 0.87, 0.26, 0.62, 0.68], [-1.90, 0.92, 0.24, 0.69, 0.73],
  [-1.65, 0.96, 0.22, 0.72, 0.76], [-1.49, 0.98, 0.20, 0.74, 0.78], [-1.29, 0.99, 0.18, 0.78, 0.80],
  [-1.10, 0.97, 0.19, 0.74, 0.78], [-0.90, 0.92, 0.20, 0.69, 0.74], [-0.66, 0.89, 0.21, 0.66, 0.73],
  [-0.29, 0.88, 0.21, 0.65, 0.72], [0.13, 0.89, 0.21, 0.65, 0.71], [0.56, 0.91, 0.21, 0.65, 0.70],
  [0.92, 0.95, 0.21, 0.68, 0.71], [1.13, 0.98, 0.21, 0.71, 0.72], [1.34, 0.99, 0.20, 0.76, 0.77],
  [1.53, 0.98, 0.20, 0.70, 0.72], [1.69, 0.94, 0.20, 0.63, 0.65], [1.89, 0.90, 0.22, 0.56, 0.59],
  [2.04, 0.85, 0.24, 0.47, 0.52], [2.14, 0.76, 0.26, 0.43, 0.47],
], true);
const cabinShape = loft([
  [-1.63, 0.62, 0.706, 0.748, 0.773], [-1.43, 0.655, 0.71, 0.79, 0.854],
  [-1.15, 0.65, 0.72, 0.84, 0.984], [-0.85, 0.608, 0.73, 0.94, 1.132],
  [-0.57, 0.576, 0.72, 1.034, 1.192], [-0.31, 0.573, 0.72, 1.06, 1.208],
  [0.02, 0.559, 0.70, 1.043, 1.179], [0.27, 0.58, 0.69, 0.94, 1.065],
  [0.51, 0.619, 0.68, 0.81, 0.916], [0.79, 0.651, 0.68, 0.70, 0.758], [0.89, 0.64, 0.68, 0.691, 0.711],
]);
const roofShape = loft([
  [-0.83, 0.43, 1.09, 1.10, 1.134], [-0.63, 0.469, 1.13, 1.15, 1.194],
  [-0.39, 0.48, 1.146, 1.167, 1.217], [-0.12, 0.478, 1.144, 1.162, 1.205],
  [0.08, 0.43, 1.107, 1.121, 1.168], [0.19, 0.38, 1.078, 1.091, 1.123],
]);
const wingShape = loft([
  [-2.04, 0.99, 1.01, 1.02, 1.037], [-1.97, 1.01, 0.993, 1.018, 1.046],
  [-1.84, 1.01, 0.975, 1.022, 1.052], [-1.71, 1.0, 0.975, 1.01, 1.033], [-1.66, 0.96, 0.99, 0.999, 1.012],
]);

function panel(points) {
  const shape = new T.Shape();
  points.forEach(([x, y], i) => {
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return new T.ShapeGeometry(shape);
}

const diffuserPanel = panel([[-0.84, 0.29], [-0.73, 0.20], [0.73, 0.20], [0.84, 0.29], [0.79, 0.40], [-0.79, 0.40]]);
const grillPanel = panel([[-0.61, 0.30], [0.61, 0.30], [0.71, 0.39], [0.58, 0.445], [-0.58, 0.445], [-0.71, 0.39]]);
const tailHousing = panel([[0, 0.015], [0.45, 0.002], [0.60, 0.04], [0.59, 0.085], [0.06, 0.080]]);
const tailStrip = panel([[0.02, 0.051], [0.46, 0.032], [0.574, 0.057], [0.57, 0.070], [0.025, 0.066]]);
const headStrip = panel([[0, 0.006], [0.36, 0.055], [0.45, 0.105], [0.45, 0.128], [0.36, 0.086], [0, 0.028]]);
const spokeParts = [];
for (let i = 0; i < 7; i++) {
  const angle = i * 2 * Math.PI / 7;
  spokeParts.push(new T.BoxGeometry(0.022, 0.204, 0.032).translate(0, 0.137, 0).rotateX(angle));
}
const spokes = mergeGeometries(spokeParts);
spokeParts.forEach(part => part.dispose());

export const sharedCarResources = new Set([box, rubber, carbon, inset, aluminum, rotor, caliper, mirror,
  glass, headlight, tailLight, brakeLight, lensHousing, tire, rimLip, brakeDisc, center, tailPipe, intake, shadowPlane, shadowMaterial,
  bodyShape, cabinShape, roofShape, wingShape, diffuserPanel, grillPanel, tailHousing, tailStrip, headStrip, spokes]);

function addWheels(root) {
  const wheels = [];
  for (const side of [-1, 1]) {
    for (const axle of axles) {
      const holder = new T.Group();
      holder.position.set(side * 0.828, wheelRadius, axle);
      root.add(holder);
      const wheel = new T.Group();
      holder.add(wheel);
      mount(wheel, tire, rubber);
      mount(wheel, rimLip, aluminum, side * 0.14);
      mount(wheel, spokes, aluminum, side * 0.128);
      mount(wheel, center, aluminum, side * 0.141);
      mount(holder, brakeDisc, rotor, side * 0.089);
      block(holder, caliper, 0.035, 0.103, 0.088, side * 0.109, 0.057, -0.158).rotation.x = 0.34;
      wheels.push({ holder, wheel, steering: axle > 0 });
    }
  }
  return wheels;
}

export function createCarModel(color) {
  const root = new T.Group();
  const shadow = mount(root, shadowPlane, shadowMaterial, 0, 0.025, 0);
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(3.2, 5.6, 1);
  const shell = new T.Group();
  root.add(shell);
  const paint = new T.MeshPhysicalMaterial({ color, metalness: 0.27, roughness: 0.34,
    clearcoat: 0.92, clearcoatRoughness: 0.15, envMapIntensity: 1.35 });
  const body = mount(shell, bodyShape.clone(), paint);
  mount(shell, cabinShape, glass);
  mount(shell, roofShape, paint);
  mount(shell, wingShape, carbon);
  const rear = new T.Group();
  const nose = new T.Group();
  shell.add(rear, nose);
  mount(rear, diffuserPanel, carbon, 0, 0, -2.128).rotation.y = Math.PI;
  mount(nose, grillPanel, inset, 0, 0, 2.151);
  block(nose, carbon, 1.62, 0.045, 0.29, 0, 0.235, 2.00);
  const lights = [];
  for (const side of [-1, 1]) {
    block(shell, carbon, 0.092, 0.083, 1.49, side * 0.883, 0.215, -0.02);
    block(shell, carbon, 0.075, 0.30, 0.12, side * 0.615, 0.883, -1.827).rotation.x = -0.16;
    block(shell, carbon, 0.027, 0.103, 0.358, side * 0.994, 1.024, -1.847).rotation.x = -0.13;
    block(shell, carbon, 0.194, 0.033, 0.059, side * 0.727, 0.808, 0.364);
    block(shell, paint, 0.172, 0.073, 0.122, side * 0.833, 0.842, 0.365).rotation.y = side * 0.12;
    block(shell, mirror, 0.128, 0.044, 0.005, side * 0.834, 0.844, 0.302);
    block(shell, carbon, 0.035, 0.285, 0.048, side * 0.571, 0.899, -0.31).rotation.z = -side * 0.19;
    block(rear, carbon, 0.03, 0.10, 0.23, side * 0.42, 0.224, -2.02);
    mount(rear, tailPipe, aluminum, side * 0.58, 0.324, -2.128);
    mount(rear, intake, inset, side * 0.58, 0.324, -2.121).rotation.y = Math.PI;
    const tail = new T.Group();
    tail.position.set(side * 0.167, 0.521, -2.139);
    tail.scale.x = -side;
    tail.rotation.y = Math.PI;
    rear.add(tail);
    mount(tail, tailHousing, lensHousing);
    lights.push(mount(tail, tailStrip, tailLight, 0, 0, 0.004));
    const head = mount(nose, headStrip, headlight, side * 0.307, 0.450, 2.112);
    head.scale.x = side;
    head.rotation.y = side * 0.23;
  }
  block(rear, lensHousing, 0.27, 0.035, 0.02, 0, 0.669, -2.025);
  block(rear, aluminum, 0.22, 0.067, 0.018, 0, 0.444, -2.123);
  const wheels = addWheels(root);
  root.traverse(object => {
    if (object.isMesh && object !== shadow) object.castShadow = object.receiveShadow = true;
  });
  return { root, shell, paint, body, rear, nose, wheels, lights, frontDamage: 0, rearDamage: 0 };
}

function deformBody(model, front, rear) {
  if (model.frontDamage === front && model.rearDamage === rear) return;
  model.frontDamage = front;
  model.rearDamage = rear;
  const original = bodyShape.getAttribute('position');
  const mesh = model.body.geometry.getAttribute('position');
  for (let i = 0; i < mesh.count; i++) {
    const x = original.getX(i);
    const y = original.getY(i);
    const z = original.getZ(i);
    const noseWeight = T.MathUtils.smoothstep(z, 1.0, 2.14) * front;
    const tailWeight = T.MathUtils.smoothstep(-z, 0.94, 2.12) * rear;
    mesh.setXYZ(i, x * (1 - (noseWeight + tailWeight) * 0.075),
      y - (noseWeight * 0.13 + tailWeight * 0.082) * (0.5 + y * 0.5),
      z - noseWeight * 0.29 + tailWeight * 0.23);
  }
  mesh.needsUpdate = true;
  model.body.geometry.computeVertexNormals();
  model.nose.position.set(0, -front * 0.115, -front * 0.28);
  model.rear.position.set(0, -rear * 0.072, rear * 0.22);
}

export function updateCarModel(model, car, dt, braking) {
  model.root.position.set(car.x, 0, car.z);
  model.root.rotation.y = car.yaw;
  model.paint.color.set(car.color);
  model.shell.rotation.z = car.steer * Math.min(Math.abs(car.speed) / 620, 0.049);
  for (const light of model.lights) light.material = braking ? brakeLight : tailLight;
  for (const { holder, wheel, steering } of model.wheels) {
    if (steering) holder.rotation.y = -car.steer * 0.30;
    wheel.rotation.x -= car.speed * dt / wheelRadius;
  }
  deformBody(model, car.frontDamage, car.rearDamage);
}
