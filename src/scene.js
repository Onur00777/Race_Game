import * as T from 'three';
import { gameName } from './career.js';

const vector = (x, y, z) => new T.Vector3(x, y, z);
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

function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function surface(renderer, base, variation) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(128, 128);
  const random = seeded(812);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const grain = (random() - 0.5) * variation;
    for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] = base[channel] + grain;
    pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
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
      uv.push(x / 5, z / 5);
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

const sunDirection = vector(0.12, 0.105, -1).normalize();

function backdrop(scene, event) {
  const [zenith, horizon, glow] = event.sky.map(color => new T.Color(color));
  const sky = new T.Mesh(new T.SphereGeometry(900, 24, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: {
      zenith: { value: zenith }, horizon: { value: horizon }, glow: { value: glow }, sun: { value: sunDirection },
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
    `,
    fragmentShader: `
      varying vec3 vDirection;
      uniform vec3 zenith, horizon, glow, sun;
      void main() {
        vec3 dir = normalize(vDirection);
        float elevation = max(dir.y, 0.);
        float ray = max(dot(dir, sun), 0.);
        vec3 shade = mix(horizon, zenith, smoothstep(0., .47, elevation));
        shade += glow * (pow(ray, 18.) * .34 + pow(ray, 180.) * .64 + smoothstep(.9994, .9996, ray) * 2.5);
        gl_FragColor = vec4(shade, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }));
  sky.renderOrder = -1;
  scene.add(sky);
  scene.fog = new T.Fog(event.sky[1], 125, 525);
  const sunlight = new T.DirectionalLight(event.accent, 2.9);
  sunlight.position.copy(sunDirection).multiplyScalar(100);
  const fill = new T.DirectionalLight('#bddaff', 1.1);
  fill.position.set(-3, 6, 9);
  scene.add(sunlight, fill, new T.HemisphereLight('#d5e5ff', '#69543f', 1.55));

  const random = seeded(117);
  for (const [radius, height, color] of [[470, 79, '#465465'], [350, 48, '#3d4a4d'], [255, 22, '#313b35']]) {
    const vertices = [];
    const count = 90;
    let previous = null;
    for (let i = 0; i <= count; i++) {
      const angle = i * Math.PI * 2 / count;
      const wave = 0.27 + 0.32 * Math.abs(Math.sin(angle * 7)) + random() * 0.42;
      const crest = [Math.cos(angle) * radius, height * wave, Math.sin(angle) * radius];
      if (previous) {
        vertices.push(...previous, ...crest, crest[0], -3, crest[2], ...previous, crest[0], -3, crest[2], previous[0], -3, previous[2]);
      }
      previous = crest;
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    scene.add(new T.Mesh(geometry, new T.MeshBasicMaterial({ color, side: T.DoubleSide })));
  }
}

function addTrees(scene, track) {
  const random = seeded(480);
  const trees = [];
  for (let i = 0; i < 1300 && trees.length < 330; i++) {
    const x = (random() - 0.5) * 420;
    const z = (random() - 0.5) * 440;
    if (track.project(x, z).distance < track.event.width / 2 + 8) continue;
    trees.push({ x, z, size: 0.6 + random() * 1.6, spin: random() * Math.PI });
  }
  const dummy = new T.Object3D();
  const trunk = new T.InstancedMesh(new T.CylinderGeometry(0.13, 0.24, 3.3, 5), standard('#473527'), trees.length);
  const foliage = new T.InstancedMesh(new T.ConeGeometry(1.35, 3.65, 6), standard('#ffffff'), trees.length * 2);
  const green = new T.Color();
  trees.forEach(({ x, z, size, spin }, i) => {
    dummy.position.set(x, size * 1.4, z);
    dummy.rotation.y = spin;
    dummy.scale.setScalar(size);
    dummy.updateMatrix();
    trunk.setMatrixAt(i, dummy.matrix);
    for (let layer = 0; layer < 2; layer++) {
      dummy.position.y = size * (2.6 + layer * 1.55);
      dummy.scale.setScalar(size * (1 - layer * 0.27));
      dummy.updateMatrix();
      foliage.setMatrixAt(i * 2 + layer, dummy.matrix);
      green.setHSL(0.26 + random() * 0.11, 0.19, 0.16 + random() * 0.09 + layer * 0.025);
      foliage.setColorAt(i * 2 + layer, green);
    }
  });
  scene.add(trunk, foliage);
}

function textPanel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b9371b';
  ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = '#fff3dc';
  ctx.font = 'bold 67px Bahnschrift, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toLocaleUpperCase('tr-TR'), 512, 67, 910);
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
    scene.add(new T.Mesh(geometry, railMaterial));
    for (let i = 0; i < count; i++) {
      const point = track.at(i * track.length / count, offset + side * 0.20);
      post.position.set(point.x, 0.39, point.z);
      post.rotation.y = point.yaw;
      post.updateMatrix();
      posts.setMatrixAt(sideIndex * count + i, post.matrix);
    }
  }
  scene.add(posts);
}

function addTrack(scene, renderer, track) {
  const half = track.event.width / 2;
  const grassMap = surface(renderer, [83, 92, 65], 32);
  grassMap.repeat.set(155, 155);
  const ground = new T.Mesh(new T.PlaneGeometry(820, 820), new T.MeshStandardMaterial({ map: grassMap, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.036;
  scene.add(ground);
  const asphalt = new T.MeshStandardMaterial({ map: surface(renderer, [55, 59, 63], 26), roughness: 0.89 });
  const runoff = standard('#8c8174');
  const paint = standard('#e9e4d2');
  const dark = standard('#2a3034');
  const red = standard('#ca3f32');
  scene.add(strip(track, -half - 1.2, half + 1.2, -0.016, runoff));
  scene.add(strip(track, -half, half, 0, asphalt));
  for (const sign of [-1, 1]) {
    const edge = (half - 0.32) * sign;
    scene.add(strip(track, edge - 0.085, edge + 0.085, 0.004, paint));
    const curb = half * sign;
    const segments = track.samples.length;
    for (let i = 10; i < segments - 9; i += 2) {
      const start = track.at(i * track.spacing).yaw;
      const end = track.at((i + 8) * track.spacing).yaw;
      if (Math.abs(Math.sin(end - start)) < 0.22) continue;
      scene.add(strip(track, curb - 0.29, curb + 0.29, 0.011, i % 4 ? paint : red, i, 2));
    }
  }

  const gantry = new T.Group();
  const gate = track.at(0);
  gantry.position.set(gate.x, 0, gate.z);
  gantry.rotation.y = gate.yaw;
  scene.add(gantry);
  const pillar = track.railOffset + 0.55;
  for (const side of [-1, 1]) {
    box(gantry, dark, 0.39, 5.5, 0.58, side * pillar, 2.75, 0);
    box(gantry, red, 0.74, 1.6, 0.77, side * pillar, 0.81, 0);
  }
  box(gantry, dark, pillar * 2 + 0.45, 1.02, 0.68, 0, 5.3, 0);
  const sign = new T.Mesh(new T.PlaneGeometry(half * 2 + 2.5, 0.89), textPanel(gameName + '     /     ' + track.event.name));
  sign.position.set(0, 5.31, -0.35);
  sign.rotation.y = Math.PI;
  gantry.add(sign);
  for (let column = 0; column < 16; column++) {
    for (let row = 0; row < 2; row++) {
      const width = half / 8;
      box(gantry, (row + column) % 2 ? dark : paint, width, 0.012, 0.44, -half + width * (column + 0.5), 0.011, 0.45 * row);
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
    box(post, metal, 0.13, 7, 0.13, 0, 3.5, 0);
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
    box(stand, dark, 29, 0.5 + step * 0.49, 1.2, 0, (0.5 + step * 0.49) / 2, -step);
    box(stand, step % 2 ? red : paint, 28.6, 0.16, 0.38, 0, 0.66 + step * 0.49, -step - 0.12);
  }
  box(stand, metal, 31, 0.17, 8.2, 0, 4.9, -3).rotation.x = -0.12;
  for (const x of [-14, -5, 5, 14]) box(stand, metal, 0.2, 4.8, 0.2, x, 2.4, -6.2);
}

export function createView(canvas) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  const camera = new T.PerspectiveCamera(48, 1, 0.1, 960);
  const aim = new T.Vector3();
  const cameraTarget = new T.Vector3();
  const target = new T.Vector3();
  let scene;
  let models;
  let cameraReady = false;
  let width = 0;
  let height = 0;

  function setTrack(track, cars) {
    if (scene) {
      const resources = new Set();
      const shared = new Set([boxGeometry, shadowPlane, shadowMaterial, wheelGeometry, rimGeometry, rubber, carbon, rims, glass, headlight, tailLight, brakeLight, stripe]);
      scene.traverse(object => {
        if (object.geometry) resources.add(object.geometry);
        if (object.isInstancedMesh) object.dispose();
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
    backdrop(scene, track.event);
    addTrack(scene, renderer, track);
    addTrees(scene, track);
    models = cars.map(car => {
      const model = carModel(car.color);
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
