import * as T from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

export function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function loadTrackAssets(renderer) {
  const directory = import.meta.env.BASE_URL + 'track/';
  const loader = new T.TextureLoader();
  const shared = new Set();
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  function surface(name, color = true) {
    const texture = loader.load(directory + name + '.webp');
    texture.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.anisotropy = anisotropy;
    shared.add(texture);
    return texture;
  }

  const sky = loader.loadAsync(directory + 'sky.webp').then(texture => {
    texture.colorSpace = T.SRGBColorSpace;
    texture.mapping = T.EquirectangularReflectionMapping;
    return texture;
  }).catch(() => null);

  const reflections = new HDRLoader().loadAsync(directory + 'sky.hdr').then(texture => {
    texture.mapping = T.EquirectangularReflectionMapping;
    return texture;
  }).catch(() => null);

  return {
    sky, reflections, shared,
    asphalt: surface('asphalt'),
    asphaltNormal: surface('asphalt-normal', false),
    asphaltRoughness: surface('asphalt-rough', false),
    meadow: surface('meadow'),
    gravel: surface('gravel'),
  };
}

export function lightTrack(scene, event, assets) {
  scene.background = new T.Color(event.sky[0]);
  scene.fog = new T.FogExp2(event.sky[1], 0.0037);
  scene.backgroundRotation.y = event.skyYaw;
  scene.environmentRotation.y = event.skyYaw;
  scene.environmentIntensity = 0.71;
  assets.sky.then(texture => { if (texture) scene.background = texture; });
  assets.reflections.then(texture => { if (texture) scene.environment = texture; });

  const direction = new T.Vector3(0.63, 0.42, 0.78).normalize().applyAxisAngle(new T.Vector3(0, 1, 0), event.skyYaw);
  const sun = new T.DirectionalLight(event.accent, 1.95);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.normalBias = 0.028;
  sun.shadow.bias = -0.00008;
  sun.shadow.radius = 2.2;
  Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 130 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target, new T.HemisphereLight('#cadcf4', '#615940', 0.52));

  return (x, z) => {
    sun.target.position.set(x, 0, z);
    sun.position.copy(sun.target.position).addScaledVector(direction, 66);
  };
}

function terrainHeight(track, x, z) {
  const distance = track.project(x, z).distance;
  const rise = T.MathUtils.smoothstep(distance, track.railOffset + 1, track.railOffset + 32);
  const wave = Math.sin(x * 0.029 + z * 0.016) * Math.cos(z * 0.039) * 2.8
    + Math.sin(x * 0.088 - z * 0.063) * 0.7;
  return -0.045 + rise * wave;
}

export function addTerrain(scene, track, assets) {
  const geometry = new T.PlaneGeometry(785, 785, 144, 144).rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const colors = [];
  const color = new T.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    positions.setY(i, terrainHeight(track, x, z));
    uv.setXY(i, x / 3.5, -z / 3.5);
    const shade = 0.66 + 0.18 * Math.sin(x * 0.074 + Math.cos(z * 0.09)) * Math.sin(z * 0.047 - x * 0.012);
    color.setRGB(shade * 0.79, shade, shade * 0.68);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const ground = new T.Mesh(geometry, new T.MeshStandardMaterial({ map: assets.meadow, roughness: 0.98, vertexColors: true }));
  ground.receiveShadow = true;
  scene.add(ground);
}

function pineCrown(seed) {
  const random = seeded(seed);
  const vertices = [];
  const colors = [];
  const color = new T.Color();
  function triangle(a, b, c, value) {
    vertices.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) {
      color.setHSL(0.24 + random() * 0.045, 0.33 + random() * 0.19, value * 0.63 + random() * 0.057);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let level = 0; level < 9; level++) {
    const y = 1.45 + level * 0.55;
    const radius = (1 - level / 10) ** 0.78 * (1.52 + random() * 0.27);
    const branches = 7 - Math.floor(level / 3);
    const phase = random() * Math.PI * 2;
    for (let b = 0; b < branches; b++) {
      const angle = phase + b * Math.PI * 2 / branches;
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      const span = radius * (0.72 + random() * 0.49);
      const point = (reach, side, rise) => [dx * span * reach - dz * span * side, y + rise, dz * span * reach + dx * span * side];
      const root = point(0.02, 0, 0.39);
      const spine = point(0.48, 0, 0.13);
      const tip = point(1, (random() - 0.5) * 0.22, -0.19 + random() * 0.23);
      const left = point(0.53, 0.28, -0.24);
      const right = point(0.43, -0.24, -0.21);
      triangle(root, left, spine, 0.21);
      triangle(root, spine, right, 0.23);
      triangle(spine, left, tip, 0.21);
      triangle(spine, tip, right, 0.24);
      triangle(left, right, tip, 0.13);
      triangle(left, point(0.8, 0.31, -0.32), spine, 0.22);
      triangle(right, spine, point(0.73, -0.29, -0.26), 0.22);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function addTrees(scene, track) {
  const random = seeded(480);
  const stands = [[], [], []];
  const minimum = track.railOffset + 3.7;
  for (let i = 0; i < 760; i++) {
    const x = (random() - 0.5) * 510;
    const z = (random() - 0.5) * 520;
    const distance = track.project(x, z).distance;
    const cluster = Math.sin(x * 0.041 - z * 0.016) * Math.sin(z * 0.035);
    if (distance < minimum || (cluster < 0.04 && random() > 0.20)) continue;
    const stand = stands[i % stands.length];
    if (stand.length >= 100) continue;
    stand.push({ x, z, size: 0.67 + random() * 1.80, spin: random() * Math.PI * 2 });
  }
  const dummy = new T.Object3D();
  const tint = new T.Color();
  const trunkGeometry = new T.CylinderGeometry(0.066, 0.19, 4.6, 7).translate(0, 2.3, 0);
  const bark = new T.MeshStandardMaterial({ color: '#483f32', roughness: 0.93 });
  const needles = new T.MeshStandardMaterial({ roughness: 0.98, side: T.DoubleSide, vertexColors: true });
  stands.forEach((trees, variant) => {
    const trunk = new T.InstancedMesh(trunkGeometry, bark, trees.length);
    const foliage = new T.InstancedMesh(pineCrown(173 + 107 * variant), needles, trees.length);
    trees.forEach(({ x, z, size, spin }, i) => {
      dummy.position.set(x, terrainHeight(track, x, z) - 0.07, z);
      dummy.rotation.set((random() - 0.5) * 0.12, spin, (random() - 0.5) * 0.1);
      dummy.scale.set(size * (0.77 + random() * 0.24), size, size * (0.76 + random() * 0.23));
      dummy.updateMatrix();
      trunk.setMatrixAt(i, dummy.matrix);
      foliage.setMatrixAt(i, dummy.matrix);
      const brightness = 0.64 + random() * 0.28;
      foliage.setColorAt(i, tint.setRGB(brightness, brightness, brightness * 0.94));
    });
    trunk.castShadow = foliage.castShadow = true;
    foliage.receiveShadow = true;
    scene.add(trunk, foliage);
  });
}
