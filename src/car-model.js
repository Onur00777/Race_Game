import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { sponsors } from './setup.js';

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
const headlight = new T.MeshStandardMaterial({ color: '#a9bdc8', emissive: '#d6ecff', emissiveIntensity: 2.75, roughness: 0.34 });
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
  const uv = [];
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
      uv.push(j / sides, (z - stations[0][0]) / Math.max(0.01, stations.at(-1)[0] - stations[0][0]));
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
const grillPanel = panel([[-0.61, 0.30], [0.61, 0.30], [0.71, 0.39], [0.58, 0.445], [-0.58, 0.445], [-0.71, 0.39]]);
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
for (let i = 0; i < 7; i++) {
  const angle = i * 2 * Math.PI / 7;
  spokeParts.push(new T.BoxGeometry(0.022, 0.204, 0.032).translate(0, 0.137, 0).rotateX(angle));
}
const spokes = mergeGeometries(spokeParts);
spokeParts.forEach(part => part.dispose());

export const sharedCarResources = new Set([box, rubber, carbon, inset, aluminum, rotor, caliper, mirror,
  glass, headlight, tailLight, brakeLight, lensHousing, tire, rimLip, brakeDisc, center, tailPipe, intake, shadowPlane, shadowMaterial,
  bodyShape, cabinShape, wingShape, diffuserPanel, grillPanel, tailHousing, tailStrip, headStrip, spokes,
  splitterShape, sidewall, rotorFace, exhaustTube, flameShape, flameMaterial, flameCore]);

const stockParts = { tires: 0, brakes: 0, aero: 0, engine: 0 };
const defaultAppearance = { wing: 'touring', wingColor: '#21272d', wingAngle: 3, frontCamber: -1, rearCamber: -1, decals: [], parts: stockParts };
const projector = new T.Mesh(bodyShape, carbon);
const decalMounts = [
  ['hood', [0, 0.66, 1.46], [-Math.PI / 2, 0, 0], [0.77, 0.32, 0.32]],
  ['doors', [0.89, 0.46, 0.02], [0, Math.PI / 2, 0], [0.76, 0.23, 0.33]],
  ['doors', [-0.89, 0.46, 0.02], [0, -Math.PI / 2, 0], [0.76, 0.23, 0.33]],
  ['rear', [0.37, 0.46, -2.13], [0, Math.PI, 0], [0.43, 0.12, 0.13]],
].map(([slot, center, rotation, size]) => {
  const geometry = new DecalGeometry(projector, new T.Vector3(...center), new T.Euler(...rotation), new T.Vector3(...size));
  sharedCarResources.add(geometry);
  return { slot, geometry };
});

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
  const composite = new T.MeshPhysicalMaterial({ color: '#363e47', map: weave, roughness: 0.38, metalness: 0.42,
    clearcoat: 0.52, side: T.DoubleSide });
  const lettering = new T.MeshStandardMaterial({ map: tirePrint, transparent: true, depthWrite: false, roughness: 0.88 });
  const steel = new T.MeshStandardMaterial({ map: drilling, metalness: 0.70, roughness: 0.37 });
  finish = { weave, composite, lettering, steel };
  for (const material of [composite, lettering, steel]) sharedCarResources.add(material);
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

function addWing(shell) {
  const paint = new T.MeshPhysicalMaterial({ color: defaultAppearance.wingColor, map: finishMaterials().weave,
    roughness: 0.32, metalness: 0.36, clearcoat: 0.78 });
  const options = {};
  for (const [id, height, width, depth] of [
    ['stock', 0.745, 0.83, 0.50], ['touring', 0.98, 0.92, 0.88], ['swan', 1.13, 1.0, 1.12], ['twin', 1.20, 1.04, 1.03],
  ]) {
    const frame = new T.Group();
    frame.position.set(0, height, -1.84);
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
      holder.position.set(side * 0.828, wheelRadius, axle);
      root.add(holder);
      const wheel = new T.Group();
      holder.add(wheel);
      const tyre = mount(wheel, tire, rubber);
      mount(wheel, rimLip, aluminum, side * 0.14);
      mount(wheel, spokes, aluminum, side * 0.128);
      mount(wheel, center, aluminum, side * 0.141);
      const print = mount(wheel, sidewall, lettering);
      print.rotation.y = side * Math.PI / 2;
      const disk = mount(wheel, brakeDisc, rotor, side * 0.089);
      const face = mount(wheel, rotorFace, steel, side * 0.103);
      face.rotation.y = side * Math.PI / 2;
      const calliper = block(holder, performanceCaliper, 0.044, 0.113, 0.094, side * 0.108, 0.057, -0.16);
      calliper.rotation.x = 0.34;
      wheels.push({ holder, wheel, side, steering: axle > 0, tyre, print, disk, face, calliper });
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
  mount(shell, cabinShape, [glass, paint]);
  const wing = addWing(shell);
  const decals = decalMounts.map(({ slot, geometry }) => {
    const mesh = mount(shell, geometry, inset);
    mesh.visible = false;
    mesh.renderOrder = 2;
    return { slot, mesh };
  });
  const rear = new T.Group();
  const nose = new T.Group();
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
  mount(nose, grillPanel, inset, 0, 0, 2.151);
  const splitter = new T.Group();
  splitter.position.set(0, 0.224, 1.86);
  nose.add(splitter);
  mount(splitter, splitterShape, composite);
  block(splitter, carbon, 1.43, 0.036, 0.051, 0, -0.015, 0.36);
  const lights = [];
  const exhausts = [];
  const flames = [];
  const skirts = [];
  for (const side of [-1, 1]) {
    skirts.push(block(shell, composite, 0.115, 0.072, 1.54, side * 0.884, 0.213, -0.02));
    block(shell, inset, 0.009, 0.10, 0.26, side * 0.901, 0.364, -0.57).rotation.y = side * 0.13;
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
    for (let diode = 0; diode < 3; diode++) {
      block(nose, headlight, 0.052, 0.012, 0.009, side * (0.395 + diode * 0.074), 0.438 + diode * 0.012, 2.145 - diode * 0.011);
    }
  }
  block(rear, lensHousing, 0.27, 0.035, 0.02, 0, 0.669, -2.025);
  block(rear, aluminum, 0.22, 0.067, 0.018, 0, 0.444, -2.123);
  const wheels = addWheels(root);
  root.traverse(object => {
    if (object.isMesh && object !== shadow) object.castShadow = object.receiveShadow = true;
  });
  for (const { mesh } of decals) mesh.castShadow = mesh.receiveShadow = false;
  for (const { print, face } of wheels) print.castShadow = face.castShadow = false;
  for (const flame of flames) flame.traverse(object => { object.castShadow = object.receiveShadow = false; });
  return { root, shell, paint, body, rear, nose, wheels, lights, wing, decals, splitter, diffuser, fins, skirts, exhausts,
    flames, frontDamage: 0, rearDamage: 0 };
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
  for (const { holder, side, steering, tyre, print, disk, face, calliper } of model.wheels) {
    holder.rotation.z = -side * T.MathUtils.degToRad(steering ? appearance.frontCamber : appearance.rearCamber);
    tyre.scale.x = 1 + tires * 0.095;
    tyre.position.x = -side * tires * 0.007;
    print.position.x = side * (0.150 + tires * 0.007);
    print.visible = tires > 0;
    disk.scale.set(1, 0.87 + brakes * 0.076, 0.87 + brakes * 0.076);
    face.scale.setScalar(0.87 + brakes * 0.076);
    face.visible = brakes > 0;
    calliper.material.color.set(['#5e6870', '#e23c29', '#fbb63e', '#ffc750'][brakes]);
    calliper.position.z = -0.137 - brakes * 0.013;
    calliper.scale.y = 0.093 + brakes * 0.018;
  }
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

export function updateCarModel(model, car, dt, braking, fire = 0) {
  applyAppearance(model, car.appearance ?? defaultAppearance);
  model.root.position.set(car.x, 0, car.z);
  model.root.rotation.y = car.yaw;
  model.paint.color.set(car.color);
  const roll = car.steer * Math.min(Math.abs(car.speed) / 1050, 0.026);
  model.shell.rotation.z += (roll - model.shell.rotation.z) * (1 - Math.exp(-9 * dt));
  for (const light of model.lights) light.material = braking ? brakeLight : tailLight;
  for (const [index, flame] of model.flames.entries()) {
    flame.visible = fire > 0;
    if (flame.visible) flame.scale.setScalar(fire * (index ? 0.84 : 1));
  }
  for (const { holder, wheel, steering } of model.wheels) {
    if (steering) holder.rotation.y = -car.steer * 0.30;
    wheel.rotation.x -= car.speed * dt / wheelRadius;
  }
  deformBody(model, car.frontDamage, car.rearDamage);
}
