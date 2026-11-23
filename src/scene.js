import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { gameName } from './career.js';
import { addTerrain, addTrees, lightTrack, loadTrackAssets } from './environment.js';

const standard = (color, roughness = 0.78, metalness = 0) => new T.MeshStandardMaterial({ color, roughness, metalness });
const basic = color => new T.MeshBasicMaterial({ color });
const boxGeometry = new T.BoxGeometry(1, 1, 1);

function box(parent, material, width, height, depth, x, y, z) {
  const mesh = new T.Mesh(boxGeometry, material);
  mesh.scale.set(width, height, depth);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function strip(track, left, right, height, material, start = 0, count = track.samples.length) {
  const positions = [];
  const uv = [];
  const indices = [];
  const geometry = new T.BufferGeometry();
  for (let i = 0; i <= count; i++) {
    const distance = (start + i) * track.spacing;
    for (const offset of [left, right]) {
      const { x, z } = track.at(distance, offset);
      positions.push(x, height, z);
      uv.push(x / 2.8, -z / 2.8);
    }
    if (i === count) break;
    const vertex = i * 2;
    indices.push(vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2);
  }
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new T.Mesh(geometry, material);
}

function profile(material, rings) {
  const vertices = [];
  const indices = [];
  for (const [z, width, shoulder, crown, bottom] of rings) {
    vertices.push(-width, bottom, z, -width, shoulder, z, -width * 0.73, crown, z, width * 0.73, crown, z, width, shoulder, z, width, bottom, z);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let side = 0; side < 6; side++) {
      const a = i * 6 + side;
      const b = i * 6 + (side + 1) % 6;
      indices.push(a, a + 6, b, b, a + 6, b + 6);
    }
  }
  const end = (rings.length - 1) * 6;
  for (let i = 1; i < 5; i++) indices.push(0, i, i + 1, end, end + i + 1, end + i);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  const faceted = geometry.toNonIndexed();
  geometry.dispose();
  faceted.computeVertexNormals();
  return new T.Mesh(faceted, material);
}

const shadowMaterial = new T.ShaderMaterial({
  transparent: true, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: 'varying vec2 vUv; void main() { float a = 1. - smoothstep(.16, .5, length(vUv - .5)); gl_FragColor = vec4(0.015, 0.01, 0.013, a * .74); }',
});
const shadowPlane = new T.PlaneGeometry(1, 1);
const wheelGeometry = new T.CylinderGeometry(0.37, 0.37, 0.32, 20).rotateZ(Math.PI / 2);
const rimGeometry = new T.CylinderGeometry(0.245, 0.245, 0.334, 16).rotateZ(Math.PI / 2);
const rubber = standard('#141619');
const carbon = standard('#222528', 0.51, 0.24);
const rims = standard('#626e73', 0.36, 0.54);
const glass = standard('#152437', 0.18, 0.26);
const headlight = basic('#d9f2ff');
const tailLight = basic('#ff301a');
const brakeLight = basic('#ff8b66');
const stripe = standard('#f8e6c5');

function carModel(color) {
  const root = new T.Group();
  const shadow = new T.Mesh(shadowPlane, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(3.6, 5.8, 1);
  shadow.position.y = 0.022;
  root.add(shadow);
  const shell = new T.Group();
  root.add(shell);
  const paint = standard(color, 0.27, 0.24);
  const body = profile(paint, [[-2.02, 0.93, 0.64, 0.73, 0.28], [-1.53, 1, 0.72, 0.8, 0.23], [-0.67, 0.96, 0.7, 0.81, 0.23], [0.94, 0.94, 0.66, 0.71, 0.23], [1.62, 1, 0.61, 0.65, 0.26], [2.12, 0.85, 0.43, 0.5, 0.27]]);
  shell.add(body);
  shell.add(profile(glass, [[-1.43, 0.68, 0.77, 0.8, 0.68], [-0.66, 0.68, 1.07, 1.23, 0.77], [0.24, 0.63, 1.06, 1.19, 0.72], [0.86, 0.67, 0.68, 0.73, 0.66]]));
  const roof = box(shell, paint, 0.97, 0.055, 0.78, 0, 1.23, -0.22);
  roof.rotation.x = 0.043;
  box(shell, carbon, 1.88, 0.11, 0.47, 0, 0.29, 1.98);
  box(shell, carbon, 1.83, 0.23, 0.11, 0, 0.35, -2.02);
  box(shell, carbon, 2.24, 0.11, 0.36, 0, 1.02, -1.86);
  const lights = [];
  const wheels = [];
  for (const side of [-1, 1]) {
    box(shell, carbon, 0.10, 0.36, 0.15, side * 0.64, 0.86, -1.83);
    box(shell, paint, 0.08, 0.19, 0.42, side * 1.12, 1.04, -1.85);
    box(shell, carbon, 0.14, 0.13, 2.4, side * 0.93, 0.29, 0.06);
    box(shell, paint, 0.27, 0.10, 0.20, side * 0.94, 0.87, 0.55);
    box(shell, headlight, 0.47, 0.065, 0.035, side * 0.57, 0.447, 2.127);
    lights.push(box(shell, tailLight, 0.61, 0.067, 0.04, side * 0.55, 0.57, -2.029));
    box(shell, stripe, 0.06, 0.012, 0.48, side * 0.15, 0.769, -1.77).rotation.x = -0.13;
    for (const z of [-1.3, 1.36]) {
      const holder = new T.Group();
      holder.position.set(side * 0.92, 0.37, z);
      const wheel = new T.Group();
      wheel.add(new T.Mesh(wheelGeometry, rubber), new T.Mesh(rimGeometry, rims));
      box(wheel, carbon, 0.343, 0.035, 0.40, 0, 0, 0);
      box(wheel, carbon, 0.344, 0.40, 0.035, 0, 0, 0);
      holder.add(wheel);
      root.add(holder);
      wheels.push({ holder, wheel, front: z > 0 });
    }
  }
  return { root, paint, shell, lights, wheels };
}

function textPanel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1d2228';
  ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = '#c73225';
  ctx.fillRect(0, 104, 1024, 13);
  ctx.fillStyle = '#fff3dc';
  ctx.font = '700 58px Bahnschrift, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toLocaleUpperCase('tr-TR'), 512, 54, 910);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  return new T.MeshBasicMaterial({ map });
}

function addGuardrails(scene, track, material) {
  const railMaterial = material.clone();
  railMaterial.side = T.DoubleSide;
  const spacing = 3.3;
  const count = Math.ceil(track.length / spacing);
  const posts = new T.InstancedMesh(boxGeometry, material, count * 2);
  const post = new T.Object3D();
  post.scale.set(0.14, 0.89, 0.15);
  for (const [sideIndex, side] of [-1, 1].entries()) {
    const offset = side * track.railOffset;
    const vertices = [];
    const indices = [];
    const heights = [0.41, 0.50, 0.58, 0.69, 0.76];
    for (let i = 0; i <= track.samples.length; i++) {
      for (const [row, height] of heights.entries()) {
        const point = track.at(i * track.spacing, offset + side * (row % 2 === 0 ? 0.12 : 0));
        vertices.push(point.x, height, point.z);
        if (i === 0 || row === 0) continue;
        const vertex = i * heights.length + row;
        indices.push(vertex, vertex - 1, vertex - heights.length, vertex - 1, vertex - heights.length - 1, vertex - heights.length);
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const rail = new T.Mesh(geometry, railMaterial);
    rail.castShadow = rail.receiveShadow = true;
    scene.add(rail);
    for (let i = 0; i < count; i++) {
      const point = track.at(i * track.length / count, offset + side * 0.20);
      post.position.set(point.x, 0.39, point.z);
      post.rotation.y = point.yaw;
      post.updateMatrix();
      posts.setMatrixAt(sideIndex * count + i, post.matrix);
    }
  }
  posts.castShadow = true;
  scene.add(posts);
}

function addTrack(scene, track, assets) {
  const half = track.event.width / 2;
  const asphalt = new T.MeshStandardMaterial({
    color: '#a1a3a8',
    map: assets.asphalt,
    normalMap: assets.asphaltNormal,
    normalScale: new T.Vector2(0.56, 0.56),
    roughnessMap: assets.asphaltRoughness,
    roughness: 0.94,
  });
  const runoff = new T.MeshStandardMaterial({ map: assets.gravel, color: '#9c9384', roughness: 1 });
  const paint = standard('#e9e4d2');
  const dark = standard('#2a3034');
  const red = standard('#ca3f32');
  const addSurface = mesh => {
    mesh.receiveShadow = true;
    scene.add(mesh);
  };
  const gravelWidth = track.railOffset - 0.65;
  addSurface(strip(track, -gravelWidth, gravelWidth, -0.015, runoff));
  addSurface(strip(track, -half, half, 0, asphalt));
  const curbs = [[], []];
  for (const sign of [-1, 1]) {
    const edge = (half - 0.32) * sign;
    addSurface(strip(track, edge - 0.065, edge + 0.065, 0.006, paint));
    const curb = half * sign;
    const segments = track.samples.length;
    for (let i = 10; i < segments - 9; i += 2) {
      const start = track.at(i * track.spacing).yaw;
      const end = track.at((i + 8) * track.spacing).yaw;
      if (Math.abs(Math.sin(end - start)) < 0.22) continue;
      const inner = curb - sign * 0.22;
      const outer = curb + sign * 0.46;
      curbs[(i / 2) % 2].push(strip(track, Math.min(inner, outer), Math.max(inner, outer), 0.018, paint, i, 2).geometry);
    }
  }
  curbs.forEach((group, index) => {
    if (!group.length) return;
    addSurface(new T.Mesh(mergeGeometries(group), index ? paint : red));
    group.forEach(geometry => geometry.dispose());
  });

  const gantry = new T.Group();
  const gate = track.at(0);
  gantry.position.set(gate.x, 0, gate.z);
  gantry.rotation.y = gate.yaw;
  scene.add(gantry);
  const pillar = track.railOffset + 0.55;
  for (const side of [-1, 1]) {
    box(gantry, dark, 0.39, 5.5, 0.58, side * pillar, 2.75, 0).castShadow = true;
    box(gantry, red, 0.74, 1.6, 0.77, side * pillar, 0.81, 0).castShadow = true;
  }
  box(gantry, dark, pillar * 2 + 0.45, 1.02, 0.68, 0, 5.3, 0).castShadow = true;
  const sign = new T.Mesh(new T.PlaneGeometry(pillar * 2 - 0.8, 0.89), textPanel(gameName + '     /     ' + track.event.name));
  sign.position.set(0, 5.31, -0.35);
  sign.rotation.y = Math.PI;
  gantry.add(sign);
  for (let column = 0; column < 16; column++) {
    for (let row = 0; row < 2; row++) {
      const width = half / 8;
      const square = box(gantry, (row + column) % 2 ? asphalt : paint, width, 0.009, 0.44, -half + width * (column + 0.5), 0.007, 0.45 * row);
      square.receiveShadow = true;
    }
  }
  for (let row = 0; row < 3; row++) {
    for (const side of [-1, 1]) {
      const grid = track.at(-3.4 - row * 8.0, side * 2.5);
      const slot = new T.Group();
      slot.position.set(grid.x, 0.017, grid.z);
      slot.rotation.y = grid.yaw;
      box(slot, paint, 1.98, 0.003, 0.08, 0, 0, 1.5).receiveShadow = true;
      box(slot, paint, 0.08, 0.003, 0.65, -0.96, 0, 1.19).receiveShadow = true;
      box(slot, paint, 0.08, 0.003, 0.65, 0.96, 0, 1.19).receiveShadow = true;
      scene.add(slot);
    }
  }

  const metal = standard('#899197', 0.53, 0.34);
  const bulb = new T.MeshBasicMaterial({ color: '#fff5d7' });
  for (let i = 0; i < track.length; i += 33) {
    const side = Math.round(i / 33) % 2 ? 1 : -1;
    const point = track.at(i + 12, side * (track.railOffset + 0.9));
    const post = new T.Group();
    post.rotation.y = point.yaw;
    post.position.set(point.x, 0, point.z);
    box(post, metal, 0.13, 7, 0.13, 0, 3.5, 0).castShadow = true;
    box(post, dark, 1.7, 0.14, 0.23, side * 0.78, 6.94, 0);
    box(post, bulb, 0.66, 0.068, 0.26, side * 1.37, 6.86, 0);
    scene.add(post);
  }

  addGuardrails(scene, track, metal);

  const stand = new T.Group();
  const standPose = track.at(30, track.railOffset + 4.7);
  stand.position.set(standPose.x, 0, standPose.z);
  stand.rotation.y = standPose.yaw + Math.PI / 2;
  scene.add(stand);
  for (let step = 0; step < 6; step++) {
    box(stand, dark, 29, 0.5 + step * 0.49, 1.2, 0, (0.5 + step * 0.49) / 2, -step).receiveShadow = true;
    box(stand, step % 2 ? red : paint, 28.6, 0.16, 0.38, 0, 0.66 + step * 0.49, -step - 0.12).receiveShadow = true;
  }
  const roof = box(stand, metal, 31, 0.17, 8.2, 0, 4.9, -3);
  roof.castShadow = true;
  roof.rotation.x = -0.12;
  for (const x of [-14, -5, 5, 14]) box(stand, metal, 0.2, 4.8, 0.2, x, 2.4, -6.2);
}

export function createView(canvas) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  const assets = loadTrackAssets(renderer);
  const camera = new T.PerspectiveCamera(48, 1, 0.1, 960);
  const aim = new T.Vector3();
  const cameraTarget = new T.Vector3();
  const target = new T.Vector3();
  let scene;
  let models;
  let updateLight;
  let cameraReady = false;
  let width = 0;
  let height = 0;

  function setTrack(track, cars) {
    if (scene) {
      const resources = new Set();
      const shared = new Set([...assets.shared, boxGeometry, shadowPlane, shadowMaterial, wheelGeometry, rimGeometry, rubber, carbon, rims, glass, headlight, tailLight, brakeLight, stripe]);
      scene.traverse(object => {
        if (object.geometry) resources.add(object.geometry);
        if (object.isInstancedMesh) object.dispose();
        if (object.shadow) object.shadow.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!material) continue;
          resources.add(material);
          if (material.map) resources.add(material.map);
        }
      });
      for (const item of resources) if (!shared.has(item)) item.dispose();
    }
    scene = new T.Scene();
    updateLight = lightTrack(scene, track.event, assets);
    addTerrain(scene, track, assets);
    addTrack(scene, track, assets);
    addTrees(scene, track);
    models = cars.map(car => {
      const model = carModel(car.color);
      model.root.traverse(object => {
        if (object.isMesh && object.geometry !== shadowPlane) object.castShadow = object.receiveShadow = true;
      });
      scene.add(model.root);
      return model;
    });
    cameraReady = false;
  }

  function snap() {
    cameraReady = false;
  }

  function draw(race, mode, dt, braking, alternateCamera) {
    if (width !== canvas.clientWidth || height !== canvas.clientHeight) {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      if (width < 1 || height < 1) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    for (let i = 0; i < race.cars.length; i++) {
      const car = race.cars[i];
      const model = models[i];
      model.root.visible = mode !== 'menu' || i === 0;
      model.root.position.set(car.x, 0, car.z);
      model.root.rotation.y = car.yaw;
      model.shell.rotation.z = car.steer * Math.min(Math.abs(car.speed) / 650, 0.055);
      if (i === 0) {
        model.paint.color.set(car.color);
        for (const light of model.lights) light.material = braking ? brakeLight : tailLight;
      }
      for (const { holder, wheel, front } of model.wheels) {
        if (front) holder.rotation.y = -car.steer * 0.3;
        wheel.rotation.x -= car.speed * dt / 0.37;
      }
    }
    const { x, z, yaw } = race.player;
    updateLight(x, z);
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    if (mode === 'menu') {
      const side = width < 715 ? -3.4 : -8.1;
      cameraTarget.set(x - fx * 8 - fz * side, 2.85, z - fz * 8 + fx * side);
      const lead = width < 715 ? 0.15 : 0.5;
      target.set(x + fx * 5 + fz * lead, width < 715 ? -1.6 : 0.25, z + fz * 5 - fx * lead);
    } else {
      const distance = alternateCamera ? 5.4 : 9.6;
      cameraTarget.set(x - fx * distance, alternateCamera ? 2.1 : 4.4, z - fz * distance);
      target.set(x + fx * 7.2, 0.85, z + fz * 7.2);
    }
    const blend = cameraReady ? 1 - Math.exp(-dt * 8.5) : 1;
    camera.position.lerp(cameraTarget, blend);
    aim.lerp(target, blend);
    camera.lookAt(aim);
    cameraReady = true;
    renderer.render(scene, camera);
  }

  return { setTrack, draw, snap };
}
