import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { sponsors } from './setup.js';
import { axles, wheelRadius, wheelTrack } from './tires.js';
import { carSurfaceMaps } from './car-materials.js';
import { compoundId, compounds } from './tire-strategy.js';

const box = new T.BoxGeometry(1, 1, 1);
const rubber = new T.MeshStandardMaterial({ color: '#141515', roughness: 0.86 });
const wetRubber = rubber.clone();
const stripe = new T.RingGeometry(0.321, 0.330, 72);
const sidewallColors = Object.fromEntries(compounds.map(({ id, color }) =>
  [id, new T.MeshStandardMaterial({ color, roughness: 0.77 })]));
const carbon = new T.MeshStandardMaterial({ color: '#191d23', roughness: 0.62, metalness: 0.36 });
const inset = new T.MeshStandardMaterial({ color: '#090c10', roughness: 0.88 });
const aluminum = new T.MeshStandardMaterial({ color: '#9da7b1', roughness: 0.30, metalness: 0.84 });
const rotor = new T.MeshStandardMaterial({ color: '#9da09f', roughness: 0.61, metalness: 0.78 });
const caliper = new T.MeshStandardMaterial({ color: '#9e2920', roughness: 0.37, metalness: 0.26 });
const mirror = new T.MeshStandardMaterial({ color: '#bac4d1', roughness: 0.12, metalness: 0.92 });
const glass = new T.MeshPhysicalMaterial({ color: '#263e4a', roughness: 0.13, metalness: 0.18, clearcoat: 1,
  clearcoatRoughness: 0.075, transparent: true, opacity: 0.68, depthWrite: false });
const upholstery = new T.MeshStandardMaterial({ color: '#252931', roughness: 0.93 });
const harness = new T.MeshStandardMaterial({ color: '#bd3b27', roughness: 0.81 });
const headlight = new T.MeshStandardMaterial({ color: '#a9bdc8', emissive: '#d6ecff', emissiveIntensity: 2.75, roughness: 0.34 });
const brokenLamp = new T.MeshStandardMaterial({ color: '#57626a', emissive: '#acc2ce', emissiveIntensity: 0.12, roughness: 0.55 });
const crackedLens = new T.LineBasicMaterial({ color: '#d0dbe2', transparent: true, opacity: 0.72 });
const cracks = new T.BufferGeometry().setFromPoints([
  [-.065,.018],[-.022,.008], [-.022,.008],[0,-.003], [0,-.003],[.022,.010], [.022,.010],[.055,.024],
  [0,-.003],[.009,-.021], [.009,-.021],[.047,-.026], [0,-.003],[-.043,-.019], [.022,.010],[.044,.002],
].map(([x, y]) => new T.Vector3(x, y, 0)));
const tailLight = new T.MeshStandardMaterial({ color: '#8f0d0a', emissive: '#f92010', emissiveIntensity: 1.86, roughness: 0.31 });
const brakeLight = new T.MeshStandardMaterial({ color: '#b62117', emissive: '#ff3622', emissiveIntensity: 5.8, roughness: 0.29 });
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

function contour(station, arch) {
  const [z, width, floor, shoulder, crown] = station;
  const upper = Math.max(shoulder, arch + 0.022);
  const edge = Math.max(floor, arch);
  const fade = Math.sin(Math.PI * T.MathUtils.clamp((z + 2.14) / 4.28, 0, 1));
  const left = [[0, floor], [-width * 0.61, floor], [-width * 0.86, edge + 0.009],
    [-width * 0.948, edge + 0.014], [-width, edge + (upper - edge) * 0.43],
    [-width * 0.996, upper - 0.016], [-width * 0.94, upper + 0.007],
    [-width * 0.82, T.MathUtils.lerp(upper, crown, 0.46)], [-width * 0.65, crown - 0.036 * fade],
    [-width * 0.48, crown - 0.015 * fade], [-width * 0.25, crown + 0.005 * fade]];
  const shape = [...left, [0, crown], ...left.slice(1).reverse().map(([x, y]) => [-x, y])];
  return new T.CatmullRomCurve3(shape.map(([x, y]) => new T.Vector3(x, y, z)), true);
}

function smoothStations(keys, spacing) {
  return keys.slice(0, -1).flatMap((first, index) => {
    const next = keys[index + 1];
    const before = keys[index - 1] ?? first;
    const after = keys[index + 2] ?? next;
    const span = next[0] - first[0];
    const count = Math.ceil(span / spacing);
    return Array.from({ length: count }, (_, step) => {
      const t = step / count, t2 = t * t, t3 = t2 * t;
      return [first[0] + t * span, ...first.slice(1).map((a, i) => {
        const col = i + 1;
        const b = next[col];
        const tangentA = span * (b - before[col]) / (next[0] - before[0]);
        const tangentB = span * (after[col] - a) / (after[0] - first[0]);
        return (2 * t3 - 3 * t2 + 1) * a + (t3 - 2 * t2 + t) * tangentA +
          (-2 * t3 + 3 * t2) * b + (t3 - t2) * tangentB;
      })];
    });
  }).concat([keys.at(-1)]);
}

function loft(keys, wheelArches = false) {
  const sides = wheelArches ? 88 : 56;
  const stations = keys.length > 8 ? smoothStations(keys, wheelArches ? 0.047 : 0.065) : keys;
  const contours = stations.map(station => {
    const distance = Math.min(...axles.map(axle => Math.abs(station[0] - axle)));
    const radius = wheelRadius + 0.049;
    const arch = wheelArches ? (wheelRadius + Math.sqrt(Math.max(0, radius ** 2 - distance ** 2))) *
      (1 - T.MathUtils.smoothstep(distance, radius - 0.02, radius + 0.032)) : 0;
    return contour(station, arch);
  });
  const positions = [];
  const uv = [];
  const indices = [];
  for (let i = 0; i < stations.length; i++) {
    for (let j = 0; j < sides; j++) {
      const { x, y, z } = contours[i].getPoint(j / sides);
      positions.push(x, y, z);
      uv.push(j / sides, (z - stations[0][0]) / (stations.at(-1)[0] - stations[0][0]));
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
  uv.push(0.5, 0, 0.5, 1);
  for (let side = 0; side < sides; side++) {
    const next = (side + 1) % sides;
    const n = (stations.length - 1) * sides;
    indices.push(tail, side, next, tail + 1, n + next, n + side);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const bodyShape = loft([
  [-2.12, 0.78, 0.30, 0.56, 0.62], [-2.04, 0.87, 0.26, 0.62, 0.68], [-1.90, 0.92, 0.24, 0.69, 0.73],
  [-1.65, 0.96, 0.22, 0.72, 0.76], [-1.49, 0.98, 0.20, 0.74, 0.78], [-1.29, 0.99, 0.18, 0.78, 0.80],
  [-1.10, 0.97, 0.19, 0.74, 0.78], [-0.90, 0.92, 0.20, 0.69, 0.74], [-0.66, 0.89, 0.21, 0.66, 0.73],
  [-0.29, 0.85, 0.21, 0.63, 0.72], [0.13, 0.85, 0.21, 0.63, 0.71], [0.56, 0.89, 0.21, 0.65, 0.70],
  [0.92, 0.95, 0.21, 0.68, 0.71], [1.13, 0.98, 0.21, 0.71, 0.72], [1.34, 0.99, 0.20, 0.76, 0.77],
  [1.53, 0.98, 0.20, 0.74, 0.74], [1.69, 0.96, 0.20, 0.69, 0.66], [1.89, 0.92, 0.22, 0.56, 0.59],
  [2.04, 0.85, 0.24, 0.47, 0.52], [2.14, 0.76, 0.26, 0.43, 0.47],
], true);
const cabinShape = loft([
  [-1.63, 0.62, 0.706, 0.748, 0.773], [-1.43, 0.655, 0.71, 0.79, 0.854],
  [-1.15, 0.65, 0.72, 0.84, 0.984], [-0.85, 0.608, 0.73, 0.94, 1.132],
  [-0.57, 0.576, 0.72, 1.034, 1.192], [-0.31, 0.573, 0.72, 1.06, 1.208],
  [0.02, 0.559, 0.70, 1.043, 1.179], [0.27, 0.58, 0.69, 0.94, 1.065],
  [0.51, 0.619, 0.68, 0.81, 0.916], [0.79, 0.651, 0.68, 0.70, 0.758], [0.89, 0.64, 0.68, 0.691, 0.711],
]);
function separateRoof(geometry) {
  const windows = [], roof = [];
  const index = geometry.index.array;
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < index.length; i += 3) {
    const triangle = [index[i], index[i + 1], index[i + 2]];
    const z = triangle.reduce((sum, vertex) => sum + positions.getZ(vertex), 0) / 3;
    const y = triangle.reduce((sum, vertex) => sum + positions.getY(vertex), 0) / 3;
    const x = triangle.reduce((sum, vertex) => sum + Math.abs(positions.getX(vertex)), 0) / 3;
    const painted = z >= -0.83 && z <= 0.19 && y >= 1.08 && x < 0.37;
    (painted ? roof : windows).push(...triangle);
  }
  geometry.setIndex([...windows, ...roof]);
  geometry.addGroup(0, windows.length, 0);
  geometry.addGroup(windows.length, roof.length, 1);
}
separateRoof(cabinShape);
const wingShape = loft([
  [-2.04, 0.99, 1.01, 1.02, 1.037], [-1.97, 1.01, 0.993, 1.018, 1.046],
  [-1.84, 1.01, 0.975, 1.022, 1.052], [-1.71, 1.0, 0.975, 1.01, 1.033], [-1.66, 0.96, 0.99, 0.999, 1.012],
]).translate(0, -1.0, 1.84);

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
const mouth = [[-0.48, 0.252], [0.48, 0.252], [0.57, 0.362], [0.44, 0.407], [-0.44, 0.407], [-0.57, 0.362]];
const grillPanel = panel(mouth);
const fascia = frontIntake();
const tailHousing = panel([[0, 0.015], [0.45, 0.002], [0.60, 0.04], [0.59, 0.085], [0.06, 0.080]]);
const tailStrip = panel([[0.02, 0.051], [0.46, 0.032], [0.574, 0.057], [0.57, 0.070], [0.025, 0.066]]);
const headStrip = panel([[0, 0.006], [0.36, 0.055], [0.45, 0.105], [0.45, 0.128], [0.36, 0.086], [0, 0.028]]);
const splitterShape = panel([[-0.97, -0.13], [-0.89, -0.35], [-0.70, -0.43], [0.70, -0.43],
  [0.89, -0.35], [0.97, -0.13], [0.93, 0.24], [0.63, 0.32], [-0.63, 0.32], [-0.93, 0.24]]).rotateX(-Math.PI / 2);
const sidewall = new T.RingGeometry(0.263, 0.345, 64);
const rotorFace = new T.RingGeometry(0.077, 0.195, 48);
const exhaustTube = new T.CylinderGeometry(0.064, 0.056, 0.13, 18, 1, true).rotateX(Math.PI / 2);
const flameShape = new T.ConeGeometry(0.070, 0.40, 12, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.20);
const flameMaterial = new T.MeshBasicMaterial({ color: new T.Color(6, 1.15, 0.055), transparent: true, opacity: 0.6,
  blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
const flameCore = new T.MeshBasicMaterial({ color: new T.Color(2.7, 3.1, 4.5), transparent: true, opacity: 0.69,
  blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
const spokeParts = [];
for (let i = 0; i < 10; i++) {
  const angle = i * Math.PI / 5;
  const arm = new T.ExtrudeGeometry(new T.Shape([[0.055, -0.023], [0.132, -0.020], [0.228, 0.024],
    [0.229, 0.043], [0.127, 0.008], [0.055, 0.019]].map(([y, z]) => new T.Vector2(z, y))),
  { depth: 0.013, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 });
  arm.rotateY(Math.PI / 2).rotateX(angle);
  spokeParts.push(arm);
}
const spokes = mergeGeometries(spokeParts);
spokeParts.forEach(part => part.dispose());

function frontIntake() {
  const rim = [[-0.58, 0.221], [0.58, 0.221], [0.67, 0.374], [0.49, 0.448], [-0.49, 0.448], [-0.67, 0.374]];
  const shape = new T.Shape(rim.map(([x, y]) => new T.Vector2(x, y)));
  shape.holes.push(new T.Path(mouth.map(([x, y]) => new T.Vector2(x, y))));
  return new T.ExtrudeGeometry(shape, { depth: 0.064, bevelSize: 0.008, bevelThickness: 0.009, bevelSegments: 3 });
}

const seat = loft([[0, 0.184, 0, 0.11, 0.15], [0.11, 0.178, 0, 0.10, 0.13], [0.32, 0.164, 0, 0.038, 0.071]]);
const bucket = loft([[0, 0.168, 0, 0.12, 0.14], [0.19, 0.181, 0, 0.09, 0.106],
  [0.32, 0.12, 0, 0.067, 0.081], [0.41, 0.103, 0, 0.07, 0.082]]);
const rimBarrel = new T.LatheGeometry([[0.224, -0.142], [0.235, -0.12], [0.245, -0.081], [0.244, 0.03],
  [0.247, 0.126], [0.252, 0.139], [0.244, 0.147]].map(point => new T.Vector2(...point)), 64).rotateZ(Math.PI / 2);
const cage = new T.TubeGeometry(new T.CatmullRomCurve3([
  [-0.50, 0.69, -0.66], [-0.44, 0.98, -0.65], [-0.30, 1.11, -0.65], [0.30, 1.11, -0.65],
  [0.44, 0.98, -0.65], [0.50, 0.69, -0.66],
].map(point => new T.Vector3(...point))), 24, 0.021, 8);

export const sharedCarResources = new Set([box, rubber, carbon, inset, aluminum, rotor, caliper, mirror,
  glass, headlight, tailLight, brakeLight, lensHousing, tire, rimLip, brakeDisc, center, tailPipe, intake, shadowPlane, shadowMaterial,
  bodyShape, cabinShape, wingShape, diffuserPanel, grillPanel, tailHousing, tailStrip, headStrip, spokes,
  splitterShape, sidewall, rotorFace, exhaustTube, flameShape, flameMaterial, flameCore, brokenLamp, crackedLens, cracks,
  fascia, seat, bucket, cage, rimBarrel, upholstery, harness, wetRubber, stripe, ...Object.values(sidewallColors)]);

const stockParts = { tires: 0, brakes: 0, aero: 0, engine: 0 };
const defaultAppearance = { wing: 'touring', wingColor: '#21272d', wingAngle: 3, frontCamber: -1, rearCamber: -1, decals: [], parts: stockParts };
const projectDecal = (projector, center, rotation, size) =>
  new DecalGeometry(projector, new T.Vector3(...center), new T.Euler(...rotation), new T.Vector3(...size));
const projectedDecals = new WeakMap();
const decalMounts = [
  ['hood', [0, 0.66, 1.46], [-Math.PI / 2, 0, 0], [0.77, 0.32, 0.32]],
  ['doors', [0.89, 0.46, 0.02], [0, Math.PI / 2, 0], [0.76, 0.23, 0.33]],
  ['doors', [-0.89, 0.46, 0.02], [0, -Math.PI / 2, 0], [0.76, 0.23, 0.33]],
  ['rear', [0.37, 0.46, -2.13], [0, Math.PI, 0], [0.43, 0.12, 0.13]],
];
const scuffMounts = [
  ['frontDamage', [0.34, 0.59, 1.79], [-Math.PI / 2, 0, 0], [0.89, 0.60, 0.67]],
  ['rearDamage', [-0.43, 0.52, -1.86], [-Math.PI / 2, 0, 0], [0.72, 0.52, 0.55]],
  ['leftDamage', [0.89, 0.43, 0.20], [0, Math.PI / 2, 0], [1.32, 0.44, 0.54]],
  ['rightDamage', [-0.89, 0.43, -0.21], [0, -Math.PI / 2, 0], [1.32, 0.44, 0.54]],
];

function bodyDecals(body) {
  if (!projectedDecals.has(body)) {
    const projector = new T.Mesh(body, carbon);
    const project = layouts => layouts.map(([slot, center, rotation, size]) =>
      ({ slot, geometry: projectDecal(projector, center, rotation, size) }));
    projectedDecals.set(body, { sponsors: project(decalMounts), scuffs: project(scuffMounts) });
  }
  return projectedDecals.get(body);
}

const logos = new Map();
let finish;

function finishTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'));
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  sharedCarResources.add(texture);
  return texture;
}

let scuffTexture;
function scuffMeshes(parent, projections) {
  scuffTexture ??= finishTexture(128, ctx => {
    for (let i = 0; i < 25; i++) {
      const x = 10 + (i * 47) % 91;
      const y = 22 + (i * 23) % 83;
      const length = 8 + (i * 13) % 25;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + length * 0.38, y - length * 0.29);
      ctx.lineTo(x + length, y - length * 0.44);
      ctx.strokeStyle = i % 4 === 0 ? 'rgba(20,18,17,.66)' : 'rgba(207,198,178,.74)';
      ctx.lineWidth = i % 5 === 0 ? 2.4 : 0.9;
      ctx.stroke();
    }
  });
  return projections.map(({ slot: zone, geometry }) => {
    const material = new T.MeshBasicMaterial({ map: scuffTexture, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, opacity: 0 });
    const mesh = mount(parent, geometry.clone(), material);
    mesh.visible = false;
    return { zone, mesh, base: geometry.attributes.position.array };
  });
}

function finishMaterials() {
  if (finish) return finish;
  const weave = finishTexture(128, ctx => {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const x0 = x * 16, y0 = y * 16;
        const horizontal = ((x + y * 2) % 4) < 2;
        const g = horizontal ? ctx.createLinearGradient(x0, y0, x0, y0 + 16) : ctx.createLinearGradient(x0, y0, x0 + 16, y0);
        g.addColorStop(0, '#828791');
        g.addColorStop(0.32, horizontal ? '#cbd1da' : '#a8b0bb');
        g.addColorStop(1, '#5d626d');
        ctx.fillStyle = g;
        ctx.fillRect(x0, y0, 16, 16);
      }
    }
  });
  weave.wrapS = weave.wrapT = T.RepeatWrapping;
  weave.repeat.set(5, 4);
  const tirePrint = finishTexture(256, ctx => {
    ctx.translate(128, 128);
    ctx.font = 'bold 17px Rajdhani, Arial, sans-serif';
    ctx.fillStyle = '#e0e4dc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [word, base] of [['KIRMIZI SPORT', -0.75], ['COMPETITION', 2.48]]) {
      [...word].forEach((letter, index) => {
        ctx.save();
        ctx.rotate(base + index * 0.092);
        ctx.fillText(letter, 0, -109);
        ctx.restore();
      });
    }
    ctx.strokeStyle = '#aab6ff';
    ctx.lineWidth = 3;
    for (const a of [1.22, 4.37]) {
      ctx.beginPath();
      ctx.arc(0, 0, 110, a, a + 0.29);
      ctx.stroke();
    }
  });
  const drilling = finishTexture(256, ctx => {
    const gradient = ctx.createRadialGradient(128, 128, 25, 128, 128, 126);
    gradient.addColorStop(0, '#555b62');
    gradient.addColorStop(0.68, '#d7dfe2');
    gradient.addColorStop(0.92, '#777e84');
    gradient.addColorStop(1, '#b2b7b8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 12; i++) {
      for (const radius of [73, 89, 106]) {
        const angle = i * Math.PI / 6 + radius * 0.013;
        ctx.beginPath();
        ctx.arc(128 + Math.cos(angle) * radius, 128 + Math.sin(angle) * radius, 3.7, 0, Math.PI * 2);
        ctx.fillStyle = '#23272c';
        ctx.fill();
      }
    }
  });
  const detail = carSurfaceMaps();
  const composite = new T.MeshPhysicalMaterial({ ...detail.carbon, color: '#333943', map: weave, roughness: 0.54, metalness: 0.47,
    clearcoat: 0.58, clearcoatRoughness: 0.15, side: T.DoubleSide });
  Object.assign(rubber, detail.rubber);
  Object.assign(wetRubber, detail.rain);
  const lettering = new T.MeshStandardMaterial({ map: tirePrint, transparent: true, depthWrite: false, roughness: 0.88 });
  const steel = new T.MeshStandardMaterial({ map: drilling, metalness: 0.70, roughness: 0.37 });
  finish = { weave, detail, composite, lettering, steel };
  for (const material of [composite, lettering, steel]) sharedCarResources.add(material);
  for (const pair of Object.values(detail)) for (const map of Object.values(pair)) sharedCarResources.add(map);
  return finish;
}
function sponsorMaterial(id) {
  if (logos.has(id)) return logos.get(id);
  const sponsor = sponsors.find(item => item.id === id);
  if (!sponsor) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#12171d';
  ctx.beginPath();
  ctx.moveTo(32, 9); ctx.lineTo(380, 9); ctx.lineTo(352, 118); ctx.lineTo(4, 118);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = sponsor.color;
  ctx.fillRect(38, 19, 273, 5);
  ctx.font = 'italic 800 61px Bahnschrift, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sponsor.brand, 188, 68, 302);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 4;
  const material = new T.MeshBasicMaterial({ map, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  logos.set(id, material);
  sharedCarResources.add(material);
  sharedCarResources.add(map);
  return material;
}

function addWing(shell, mountPoint) {
  const { weave, detail } = finishMaterials();
  const paint = new T.MeshPhysicalMaterial({ ...detail.carbon, color: defaultAppearance.wingColor, map: weave,
    roughness: 0.32, metalness: 0.36, clearcoat: 0.78 });
  const options = {};
  for (const [id, height, width, depth] of [
    ['stock', 0.745, 0.83, 0.50], ['touring', 0.98, 0.92, 0.88], ['swan', 1.13, 1.0, 1.12], ['twin', 1.20, 1.04, 1.03],
  ]) {
    const frame = new T.Group();
    frame.position.set(0, height, -1.84);
    if (mountPoint) frame.position.set(mountPoint.x, frame.position.y + mountPoint.y - 0.74, mountPoint.z);
    shell.add(frame);
    const blade = new T.Group();
    frame.add(blade);
    const material = id === 'stock' ? carbon : paint;
    mount(blade, wingShape, material).scale.set(width, id === 'stock' ? 0.6 : 1, depth);
    if (id === 'twin') mount(blade, wingShape, paint, 0, 0.14, 0.05).scale.set(0.98, 0.75, 0.66);
    if (id !== 'stock') {
      for (const side of [-1, 1]) {
        block(blade, material, 0.031, id === 'twin' ? 0.26 : 0.12, depth * 0.40, side * width, id === 'twin' ? 0.08 : 0.012, 0);
        const base = 0.72 - height;
        if (id === 'swan') {
          const bend = new T.CatmullRomCurve3([[side * 0.55, base, 0.15], [side * 0.55, 0.10, 0.14],
            [side * 0.55, 0.13, -0.055], [side * 0.55, 0.019, -0.11]].map(point => new T.Vector3(...point)));
          mount(frame, new T.TubeGeometry(bend, 10, 0.024, 6, false), carbon);
        } else {
          block(frame, carbon, 0.076, -base, 0.13, side * 0.59, base * 0.48, 0.028).rotation.x = -0.14;
        }
      }
    }
    options[id] = { frame, blade };
  }
  return { options, paint };
}

function addWheels(root) {
  const wheels = [];
  const { lettering, steel } = finishMaterials();
  const performanceCaliper = caliper.clone();
  for (const side of [-1, 1]) {
    for (const axle of axles) {
      const holder = new T.Group();
      holder.position.set(side * wheelTrack, wheelRadius, axle);
      root.add(holder);
      const wheel = new T.Group();
      holder.add(wheel);
      const tyre = mount(wheel, tire, rubber);
      mount(wheel, rimBarrel, aluminum).scale.x = side;
      mount(wheel, rimLip, aluminum, side * 0.14);
      mount(wheel, spokes, aluminum, side * 0.128);
      mount(wheel, center, aluminum, side * 0.141);
      const print = mount(wheel, sidewall, lettering);
      print.rotation.y = side * Math.PI / 2;
      const compoundRing = mount(wheel, stripe, sidewallColors.medium);
      compoundRing.rotation.y = side * Math.PI / 2;
      const disk = mount(wheel, brakeDisc, rotor.clone(), side * 0.089);
      const face = mount(wheel, rotorFace, steel.clone(), side * 0.103);
      disk.material.emissive.set('#fa4614');
      face.material.emissive.set('#ff4b14');
      disk.material.emissiveIntensity = face.material.emissiveIntensity = 0;
      face.rotation.y = side * Math.PI / 2;
      const calliper = block(holder, performanceCaliper, 0.044, 0.113, 0.094, side * 0.108, 0.057, -0.16);
      calliper.rotation.x = 0.34;
      wheels.push({ holder, wheel, side, steering: axle > 0, tyre, print, compoundRing, disk, face, calliper });
    }
  }
  return wheels;
}

function addInterior(shell) {
  mount(shell, cage, aluminum);
  for (const side of [-1, 1]) {
    mount(shell, seat, upholstery, side * 0.24, 0.714, -0.43);
    mount(shell, bucket, upholstery, side * 0.24, 0.735, -0.48).rotation.x = -1.82;
    const belt = block(shell, harness, 0.034, 0.26, 0.012, side * 0.24 - 0.063, 0.914, -0.452);
    belt.rotation.x = -0.29;
  }
  block(shell, carbon, 1.17, 0.115, 0.24, 0, 0.755, 0.49);
  mount(shell, rimLip, inset, 0.27, 0.863, 0.22).rotation.set(-0.24, Math.PI / 2, 0);
}

export function createCarModel(color, asset) {
  const root = new T.Group();
  const shadow = mount(root, shadowPlane, shadowMaterial, 0, 0.025, 0);
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(3.2, 5.6, 1);
  const shell = new T.Group();
  root.add(shell);
  const { detail } = finishMaterials();
  const paint = new T.MeshPhysicalMaterial({ ...detail.paint, color, metalness: 0.49, roughness: 0.33,
    clearcoat: 1, clearcoatRoughness: 0.085, envMapIntensity: 1.12 });
  paint.normalScale.set(0.31, 0.31);
  const bodyTemplate = asset?.body ?? bodyShape;
  const projections = bodyDecals(bodyTemplate);
  const body = mount(shell, bodyTemplate.clone(), paint);
  let enclosure;
  if (asset?.cabin) {
    enclosure = asset.cabin.clone(true);
    enclosure.traverse(node => {
      if (!node.isMesh) return;
      sharedCarResources.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        sharedCarResources.add(material);
        for (const property of Object.values(material)) if (property?.isTexture) sharedCarResources.add(property);
      }
    });
    shell.add(enclosure);
  } else {
    addInterior(shell);
    enclosure = mount(shell, cabinShape, [glass, paint]);
  }
  const wing = addWing(shell, asset?.sockets.WingMount);
  const decals = projections.sponsors.map(({ slot, geometry }) => {
    const mesh = mount(shell, geometry.clone(), inset);
    mesh.visible = false;
    mesh.renderOrder = 2;
    return { slot, mesh, base: geometry.attributes.position.array };
  });
  const rear = new T.Group();
  const nose = new T.Group();
  const noseBase = asset?.sockets.FrontMount?.clone() ?? new T.Vector3(0, 0, 2.14);
  const rearBase = asset?.sockets.RearMount?.clone() ?? new T.Vector3(0, 0, -2.14);
  noseBase.z -= 2.14;
  rearBase.z += 2.14;
  nose.position.copy(noseBase);
  rear.position.copy(rearBase);
  shell.add(rear, nose);
  const { composite } = finishMaterials();
  const diffuser = new T.Group();
  diffuser.position.set(0, 0.23, -2.08);
  rear.add(diffuser);
  mount(diffuser, diffuserPanel, composite, 0, -0.23, -0.05).rotation.y = Math.PI;
  const fins = [-0.62, -0.36, -0.12, 0.12, 0.36, 0.62].map(x => {
    const fin = block(diffuser, composite, 0.036, 0.095, 0.31, x, 0.017, 0.055);
    fin.rotation.x = -0.19;
    return fin;
  });
  mount(nose, fascia, paint, 0, 0, 2.109);
  mount(nose, grillPanel, inset, 0, 0, 2.141);
  for (let row = 0; row < 3; row++) {
    block(nose, carbon, 0.91 + (row === 1 ? 0.13 : 0), 0.012, 0.021, 0, 0.28 + row * 0.047, 2.154);
  }
  const splitter = new T.Group();
  splitter.position.set(0, 0.224, 1.86);
  nose.add(splitter);
  mount(splitter, splitterShape, composite);
  block(splitter, carbon, 1.43, 0.036, 0.051, 0, -0.015, 0.36);
  const lights = [];
  const headlights = [];
  const exhausts = [];
  const flames = [];
  const skirts = [];
  for (const side of [-1, 1]) {
    skirts.push(block(shell, composite, 0.115, 0.072, 1.54, side * 0.884, 0.213, -0.02));
    block(shell, inset, 0.012, 0.097, 0.28, side * 0.873, 0.421, -0.44).rotation.y = side * 0.14;
    for (let slot = 0; slot < 4; slot++) {
      block(nose, inset, 0.18 - slot * 0.009, 0.009, 0.026, side * 0.29, 0.622 + slot * 0.011, 1.69 - slot * 0.058);
    }
    block(shell, carbon, 0.194, 0.033, 0.059, side * 0.727, 0.808, 0.364);
    block(shell, paint, 0.172, 0.073, 0.122, side * 0.833, 0.842, 0.365).rotation.y = side * 0.12;
    block(shell, mirror, 0.128, 0.044, 0.005, side * 0.834, 0.844, 0.302);
    block(shell, carbon, 0.035, 0.285, 0.048, side * 0.571, 0.899, -0.31).rotation.z = -side * 0.19;
    const exhaust = new T.Group();
    exhaust.position.set(side * 0.58, 0.324, -2.139);
    rear.add(exhaust);
    mount(exhaust, exhaustTube, aluminum, 0, 0, 0.046);
    mount(exhaust, tailPipe, aluminum);
    mount(exhaust, intake, inset, 0, 0, 0.014).rotation.y = Math.PI;
    exhausts.push(exhaust);
    const flame = new T.Group();
    flame.position.z = -0.016;
    exhaust.add(flame);
    mount(flame, flameShape, flameMaterial);
    mount(flame, flameShape, flameCore).scale.set(0.62, 0.65, 0.48);
    flame.visible = false;
    flames.push(flame);
    const tail = new T.Group();
    tail.position.set(side * 0.167, 0.521, -2.139);
    tail.scale.x = -side;
    tail.rotation.y = Math.PI;
    rear.add(tail);
    mount(tail, tailHousing, lensHousing);
    lights.push(mount(tail, tailStrip, tailLight, 0, 0, 0.004));
    for (let diode = 0; diode < 3; diode++) {
      lights.push(block(tail, tailLight, 0.025, 0.007, 0.006, 0.17 + diode * 0.076, 0.026, 0.006));
    }
    const head = mount(nose, headStrip, headlight, side * 0.307, 0.448, 2.156);
    head.scale.x = side;
    head.rotation.y = side * 0.31;
    const lamps = [head];
    for (let diode = 0; diode < 3; diode++) {
      lamps.push(block(nose, headlight, 0.052, 0.012, 0.009, side * (0.395 + diode * 0.074), 0.438 + diode * 0.012, 2.145 - diode * 0.011));
    }
    const crack = new T.LineSegments(cracks, crackedLens);
    crack.position.set(side * 0.47, 0.451, 2.160);
    crack.rotation.y = side * 0.22;
    nose.add(crack);
    headlights.push({ side, lamps, crack });
  }
  block(rear, lensHousing, 0.27, 0.035, 0.02, 0, 0.669, -2.025);
  block(rear, aluminum, 0.22, 0.067, 0.018, 0, 0.444, -2.123);
  const wheels = addWheels(root);
  root.traverse(object => {
    if (object.isMesh && object !== shadow) object.castShadow = object.receiveShadow = true;
  });
  enclosure.castShadow = false;
  for (const { mesh } of decals) mesh.castShadow = mesh.receiveShadow = false;
  for (const { print, face, compoundRing } of wheels) print.castShadow = face.castShadow = compoundRing.castShadow = false;
  for (const flame of flames) flame.traverse(object => { object.castShadow = object.receiveShadow = false; });
  const scuffs = scuffMeshes(shell, projections.scuffs);
  return { root, shell, paint, body, rear, nose, wheels, lights, wing, decals, splitter, diffuser, fins, skirts, exhausts,
    flames, headlights, scuffs, noseBase, rearBase, bodyTemplate, lightClock: 0, brakeHeat: 0,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'), damage: [0, 0, 0, 0, 0] };
}

function applyAppearance(model, appearance) {
  if (model.appearance === appearance) return;
  model.appearance = appearance;
  const { aero, engine, tires, brakes } = appearance.parts ?? stockParts;
  model.wing.paint.color.set(appearance.wingColor);
  for (const [id, { frame, blade }] of Object.entries(model.wing.options)) {
    frame.visible = appearance.wing === id;
    frame.scale.set(1 + aero * 0.039, 1 + aero * 0.026, 1 + aero * 0.122);
    blade.rotation.x = T.MathUtils.degToRad(appearance.wingAngle);
  }
  model.splitter.scale.set(0.89 + aero * 0.063, 1, 0.78 + aero * 0.17);
  model.diffuser.scale.set(0.92 + aero * 0.041, 1 + aero * 0.21, 0.62 + aero * 0.18);
  for (const [index, fin] of model.fins.entries()) fin.visible = aero >= 2 || index === 1 || index === 4;
  model.skirts.forEach(skirt => { skirt.scale.x = 0.09 + aero * 0.021; });
  model.exhausts.forEach(pipe => { pipe.scale.set(1 + engine * 0.18, 1 + engine * 0.18, 1 + engine * 0.21); });
  const logo = sponsorMaterial(appearance.sponsor);
  for (const { slot, mesh } of model.decals) {
    mesh.visible = Boolean(logo && appearance.decals.includes(slot));
    if (logo) mesh.material = logo;
  }
  for (const { holder, side, steering, tyre, print, compoundRing, disk, face, calliper } of model.wheels) {
    holder.rotation.z = -side * T.MathUtils.degToRad(steering ? appearance.frontCamber : appearance.rearCamber);
    tyre.scale.x = 1 + tires * 0.095;
    tyre.position.x = -side * tires * 0.007;
    print.position.x = side * (0.150 + tires * 0.007);
    compoundRing.position.x = side * (0.1495 + tires * 0.007);
    print.visible = tires > 0;
    disk.scale.set(1, 0.87 + brakes * 0.076, 0.87 + brakes * 0.076);
    face.scale.setScalar(0.87 + brakes * 0.076);
    calliper.material.color.set(['#5e6870', '#e23c29', '#fbb63e', '#ffc750'][brakes]);
    calliper.position.z = -0.137 - brakes * 0.013;
    calliper.scale.y = 0.093 + brakes * 0.018;
  }
}

function deformSurface(geometry, original, front, rear, left, right) {
  const mesh = geometry.attributes.position;
  for (let i = 0, j = 0; i < mesh.count; i++, j += 3) {
    const x = original[j], y = original[j + 1], z = original[j + 2];
    const noseWeight = T.MathUtils.smoothstep(z, 1.0, 2.14) * front;
    const tailWeight = T.MathUtils.smoothstep(-z, 0.94, 2.12) * rear;
    const flank = (x > 0 ? left : right) * T.MathUtils.smoothstep(Math.abs(x), 0.51, 0.93) *
      (1 - T.MathUtils.smoothstep(Math.abs(z), 0.57, 1.66)) * (0.82 + 0.18 * Math.sin(z * 10));
    mesh.setXYZ(i, x * (1 - (noseWeight + tailWeight) * 0.075 - flank * 0.16),
      y - (noseWeight * 0.13 + tailWeight * 0.082 + flank * 0.044) * (0.5 + y * 0.5),
      z - noseWeight * 0.29 + tailWeight * 0.23);
  }
  mesh.needsUpdate = true;
}

function deformBody(model, car) {
  const damage = [car.frontDamage ?? 0, car.rearDamage ?? 0, car.leftDamage ?? 0, car.rightDamage ?? 0, car.damage ?? 0];
  if (damage.every((value, index) => value === model.damage[index])) return;
  model.damage = damage;
  const [front, rear, left, right, total] = damage;
  deformSurface(model.body.geometry, model.bodyTemplate.attributes.position.array, front, rear, left, right);
  model.body.geometry.computeVertexNormals();
  for (const { mesh, base } of model.decals) deformSurface(mesh.geometry, base, front, rear, left, right);
  for (const { zone, mesh, base } of model.scuffs) {
    const opacity = Math.min(1, (car[zone] ?? 0) * 1.35 + Math.max(0, total - 28) * 0.003);
    mesh.visible = opacity > 0.025;
    if (mesh.visible) {
      mesh.material.opacity = opacity;
      deformSurface(mesh.geometry, base, front, rear, left, right);
    }
  }
  model.nose.position.copy(model.noseBase);
  model.nose.position.y -= front * 0.115;
  model.nose.position.z -= front * 0.28;
  model.rear.position.copy(model.rearBase);
  model.rear.position.y -= rear * 0.072;
  model.rear.position.z += rear * 0.22;
}

export function updateCarModel(model, car, dt, braking, fire = 0) {
  applyAppearance(model, car.appearance ?? defaultAppearance);
  const compound = compoundId(car.compound ?? car.appearance?.compound);
  if (compound !== model.compound) {
    model.compound = compound;
    for (const { compoundRing, tyre } of model.wheels) {
      compoundRing.material = sidewallColors[compound];
      tyre.material = compound === 'rain' ? wetRubber : rubber;
    }
  }
  model.root.position.set(car.x, 0, car.z);
  model.root.rotation.y = car.yaw;
  model.paint.color.set(car.color);
  const roll = car.steer * Math.min(Math.abs(car.speed) / 1050, 0.026);
  model.shell.rotation.z += (roll - model.shell.rotation.z) * (1 - Math.exp(-9 * dt));
  for (const light of model.lights) light.material = braking ? brakeLight : tailLight;
  model.lightClock += dt;
  let litLamps = 0;
  for (const { side, lamps, crack } of model.headlights) {
    const strength = (car.frontDamage ?? 0) + (side > 0 ? (car.leftDamage ?? 0) : (car.rightDamage ?? 0)) * 0.24;
    crack.visible = strength > 0.51;
    const t = model.lightClock * (side > 0 ? 17 : 13);
    const flicker = !model.reducedMotion.matches && Math.sin(t) * Math.sin(t * 0.47 + side) > 0.34;
    lamps.forEach((lamp, index) => {
      const failed = (strength > 0.88 && index > 1) || (strength > 0.63 && flicker);
      lamp.material = failed ? brokenLamp : headlight;
      if (!failed) litLamps++;
    });
  }
  model.headlightOutput = 0.14 + litLamps / 8 * 0.86;
  for (const [index, flame] of model.flames.entries()) {
    flame.visible = fire > 0;
    if (flame.visible) flame.scale.setScalar(fire * (index ? 0.84 : 1));
  }
  const speed = Math.max(0, car.speed);
  const deceleration = Math.max(0, ((model.brakeSpeed ?? speed) - speed) / Math.max(0.001, dt));
  model.brakeSpeed = speed;
  const brakeEnergy = braking ? T.MathUtils.clamp(deceleration / 26, 0, 1) * speed / 33 : 0;
  model.brakeHeat = Math.min(1.6, model.brakeHeat * Math.exp(-dt * 0.22) + brakeEnergy * dt * 0.93);
  const glow = T.MathUtils.smoothstep(model.brakeHeat, 0.26, 1.32) * 1.85;
  for (const [index, { holder, wheel, steering, disk, face }] of model.wheels.entries()) {
    if (steering) holder.rotation.y = -car.steer * 0.30;
    wheel.rotation.x -= (car.wheels?.[index].rolling ?? car.speed) * dt / wheelRadius;
    face.material.emissiveIntensity = glow * (steering ? 1 : 0.68);
    disk.material.emissiveIntensity = face.material.emissiveIntensity * 0.48;
  }
  deformBody(model, car);
}
