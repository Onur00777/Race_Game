import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { gameName } from './career.js';
import { addTerrain, addTrees, circuitLamps, lightTrack, loadTrackAssets } from './environment.js';
import { createCarModel, createRollingWheel, createTrafficBatch, sharedCarResources, updateCarModel } from './car-model.js';
import { createRaceEffects } from './race-effects.js';
import { renderPose } from './race.js';
import { createStudio } from './studio.js';
import { createRenderPipeline, fitShadowResolution } from './render-pipeline.js';
import { qualityMode } from './graphics-settings.js';
import { createRacingLineView } from './racing-line-view.js';
import { addTrackDetails } from './track-details.js';
import { createSkidMarks } from './skid-marks.js';
import { loadCarAsset } from './car-asset.js';
import { addPitView } from './pit-view.js';
import { t } from './i18n.js';
import { addMarshalLights } from './track-marshal.js';
import { addStaticBoxes } from './static-boxes.js';

const standard = (color, roughness = 0.78, metalness = 0) => new T.MeshStandardMaterial({ color, roughness, metalness });
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
  const reflectors = new T.InstancedMesh(boxGeometry, new T.MeshBasicMaterial({ color: '#ffffff' }), Math.ceil(count / 5) * 2);
  const marker = new T.Object3D();
  const tint = new T.Color();
  let reflector = 0, postIndex = 0;
  marker.scale.set(0.08, 0.064, 0.18);
  const post = new T.Object3D();
  post.scale.set(0.14, 0.89, 0.15);
  for (const side of [-1, 1]) {
    const offset = station => side * track.railAt(station, side);
    const gap = station => side === track.pit.side && track.pit.garageAt(station);
    const vertices = [];
    const indices = [];
    const heights = [0.41, 0.50, 0.58, 0.69, 0.76];
    for (let i = 0; i <= track.samples.length; i++) {
      for (const [row, height] of heights.entries()) {
        const point = track.at(i * track.spacing, offset(i * track.spacing) + side * (row % 2 === 0 ? 0.12 : 0));
        vertices.push(point.x, height, point.z);
        if (i === 0 || row === 0 || gap((i - 0.5) * track.spacing)) continue;
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
      const station = i * track.length / count;
      if (gap(station)) continue;
      const point = track.at(station, offset(station) + side * 0.20);
      post.position.set(point.x, 0.39, point.z);
      post.rotation.y = point.yaw;
      post.updateMatrix();
      posts.setMatrixAt(postIndex++, post.matrix);
      if (i % 5 === 0) {
        const face = track.at(station, offset(station) - side * 0.032);
        marker.position.set(face.x, 0.603, face.z);
        marker.rotation.y = face.yaw;
        marker.updateMatrix();
        reflectors.setMatrixAt(reflector, marker.matrix);
        reflectors.setColorAt(reflector++, tint.set(side > 0 ? '#e5b979' : '#dde6f7'));
      }
    }
  }
  posts.count = postIndex;
  reflectors.count = reflector;
  posts.castShadow = true;
  scene.add(posts, reflectors);
}

function addGrandstand(scene, track, metal) {
  const side = -track.pit.side;
  const pose = track.at(30, side * (track.railOffset + 4.7));
  const stand = new T.Group();
  stand.position.set(pose.x, 0, pose.z);
  stand.rotation.y = pose.yaw + side * Math.PI / 2;
  scene.add(stand);

  const concrete = standard('#76716a');
  const steel = standard('#454b4b', 0.66, 0.40);
  const nosing = standard('#b3a17c', 0.86);
  const sections = [-10, 0, 10];
  const rows = 6;
  const columns = 16;
  const seatParts = [
    new T.BoxGeometry(0.44, 0.065, 0.36).translate(0, 0.12, 0.018),
    new T.BoxGeometry(0.44, 0.29, 0.05).rotateX(-0.11).translate(0, 0.245, -0.145),
    new T.BoxGeometry(0.056, 0.13, 0.17).translate(0, 0.059, 0),
  ];
  const seats = new T.InstancedMesh(mergeGeometries(seatParts), standard('#ffffff', 0.72), rows * columns * sections.length);
  seatParts.forEach(part => part.dispose());
  const transform = new T.Matrix4();
  const color = new T.Color();
  const plastic = ['#854139', '#a3463b', '#b85547', '#9c9488', '#aba295'];
  const figures = [
    new T.CylinderGeometry(0.155, 0.18, 0.38, 6).translate(0, 0.43, 0.04),
    new T.BoxGeometry(0.25, 0.13, 0.36).translate(0, 0.24, 0.13),
    new T.SphereGeometry(0.091, 6, 4).translate(0, 0.69, 0.052),
  ];
  const crowd = new T.InstancedMesh(mergeGeometries(figures), standard('#ffffff', 0.93), seats.count);
  crowd.count = 0;
  figures.forEach(part => part.dispose());
  const jerseys = ['#8ab4b4', '#e2ba70', '#777981', '#a74455', '#536a9b', '#c5c8bb', '#78a061'];
  let i = 0;
  for (let row = 0; row < rows; row++) {
    const height = 0.32 + row * 0.44;
    const z = -0.58 - row * 0.94;
    box(stand, concrete, 29, height, 1.03, 0, height / 2, z).receiveShadow = true;
    for (const x of [-14.33, -5, 5, 14.33]) {
      box(stand, nosing, 0.83, 0.026, 0.052, x, height + 0.016, z + 0.47).receiveShadow = true;
    }
    for (const [section, center] of sections.entries()) {
      for (let column = 0; column < columns; column++) {
        transform.makeTranslation(center + (column - (columns - 1) / 2) * 0.51, height - 0.006, z);
        seats.setMatrixAt(i, transform);
        seats.setColorAt(i++, color.set(plastic[(column * 29 + row * 13 + section * 17) % plastic.length]));
        if ((column * 13 + row * 19 + section * 31) % 10 < 7) {
          crowd.setMatrixAt(crowd.count, transform);
          crowd.setColorAt(crowd.count++, color.set(jerseys[(row * 13 + column * 31 + section) % jerseys.length]));
        }
      }
    }
  }
  seats.receiveShadow = true;
  stand.add(seats, crowd);

  const roof = box(stand, metal, 31, 0.14, 8.0, 0, 4.93, -2.85);
  roof.castShadow = true;
  roof.rotation.x = -0.11;
  box(stand, steel, 30.8, 0.25, 0.16, 0, 4.46, 1.13).castShadow = true;
  box(stand, steel, 30.1, 0.23, 0.18, 0, 5.13, -6.1).castShadow = true;
  for (const x of [-14.25, -5, 5, 14.25]) {
    box(stand, steel, 0.20, 5, 0.19, x, 2.5, -6.13).castShadow = true;
    box(stand, steel, 0.16, 0.27, 7.43, x, 4.72, -2.58).rotation.x = -0.10;
    box(stand, steel, 0.10, 0.13, 2.45, x, 4.15, -5.20).rotation.x = -0.46;
  }
}

function addTimingTower(scene, track, metal, dark) {
  const side = -track.pit.side;
  const point = track.at(16, side * (track.railAt(16, side) + 2.2));
  const tower = new T.Group();
  tower.position.set(point.x, 0, point.z);
  tower.rotation.y = point.yaw + Math.PI;
  scene.add(tower);
  box(tower, metal, 2.8, 0.18, 1.45, 0, 0.09, 0);
  box(tower, dark, 0.66, 7.2, 0.65, 0, 3.62, 0);
  box(tower, dark, 2.12, 4.05, 0.45, 0, 5.3, 0);
  const canvas = document.createElement('canvas');
  canvas.width = 208;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  const face = new T.Mesh(new T.PlaneGeometry(1.92, 3.84), new T.MeshBasicMaterial({ map }));
  face.position.set(0, 5.29, 0.23);
  tower.add(face);
  let signature = '';
  return race => {
    const order = [...race.cars].sort((a, b) => b.station - a.station);
    const lap = Math.min(race.player.lap + 1, track.event.laps);
    const status = race.control.flag;
    const next = order.map(car => car.id).join('|') + lap + status;
    if (signature === next) return;
    signature = next;
    ctx.fillStyle = '#101820';
    ctx.fillRect(0, 0, 208, 400);
    ctx.fillStyle = status === 'red' ? '#fa685f' : status === 'yellow' ? '#ffd66d' : '#9de2d0';
    ctx.fillRect(0, 0, 208, 9);
    ctx.font = 'bold 29px monospace';
    ctx.fillText('VIN VIN', 15, 45);
    ctx.fillStyle = '#e7edf1';
    ctx.font = 'bold 19px monospace';
    ctx.fillText(`${lap} / ${track.event.laps}`, 15, 78);
    order.forEach((car, index) => {
      const y = 97 + index * 58;
      ctx.fillStyle = index % 2 ? '#263341' : '#1b2936';
      ctx.fillRect(8, y, 192, 54);
      ctx.fillStyle = car.color;
      ctx.fillRect(8, y, 7, 54);
      ctx.font = 'bold 30px monospace';
      ctx.fillText(String(index + 1), 22, y + 37);
      ctx.fillStyle = '#e7edf1';
      ctx.fillText(car.id === 'player' ? 'P1' : car.name.slice(0, 3).toUpperCase(), 76, y + 37);
    });
    map.needsUpdate = true;
  };
}

function addTrack(scene, track, assets, label) {
  const half = track.event.width / 2;
  const asphalt = new T.MeshStandardMaterial({
    color: '#a1a3a8',
    map: assets.asphalt,
    normalMap: assets.asphaltNormal,
    normalScale: new T.Vector2(0.56, 0.56),
    roughnessMap: assets.asphaltRoughness,
    roughness: track.event.weather === 'cloud' ? 0.85 : 0.94,
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
  for (const sign of [-1, 1]) {
    const edge = (half - 0.32) * sign;
    addSurface(strip(track, edge - 0.065, edge + 0.065, 0.006, paint));
  }
  addTrackDetails(scene, track, assets);

  const gantry = new T.Group();
  const gate = track.at(0);
  gantry.position.set(gate.x, 0, gate.z);
  gantry.rotation.y = gate.yaw;
  scene.add(gantry);
  const left = track.railAt(0, 1) + 0.55, right = track.railAt(0, -1) + 0.55;
  const span = left + right, middle = (right - left) / 2;
  for (const side of [-1, 1]) {
    const x = side < 0 ? -left : right;
    box(gantry, dark, 0.39, 5.5, 0.58, x, 2.75, 0).castShadow = true;
    box(gantry, red, 0.74, 1.6, 0.77, x, 0.81, 0).castShadow = true;
  }
  box(gantry, dark, span + 0.45, 1.02, 0.68, middle, 5.3, 0).castShadow = true;
  const sign = new T.Mesh(new T.PlaneGeometry(track.event.width + 1.4, 0.89), textPanel(gameName + '     /     ' + label));
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
  const night = track.event.weather === 'night';
  const bulb = new T.MeshBasicMaterial({ color: night ? new T.Color(3.5, 4.2, 5.3) : '#fff5d7' });
  for (const { point, side, height } of circuitLamps(track)) {
    const post = new T.Group();
    post.rotation.y = point.yaw;
    post.position.set(point.x, 0, point.z);
    box(post, metal, 0.13, height, 0.13, 0, height / 2, 0);
    box(post, dark, night ? 2.16 : 1.7, 0.20, night ? 0.48 : 0.23, -side * 0.78, height - 0.06, 0);
    const lamp = box(post, bulb, night ? 1.35 : 0.66, 0.070, night ? 0.46 : 0.26, -side * 1.34, height - 0.16, 0);
    lamp.rotation.z = side * 0.13;
    scene.add(post);
  }

  addGuardrails(scene, track, metal);
  addGrandstand(scene, track, metal);
  const updateTower = addTimingTower(scene, track, metal, dark);
  addStaticBoxes(scene, boxGeometry);
  let lastTowerUpdate = -Infinity;
  let lastRace;
  return race => {
    const wetness = race.wetness;
    if (race !== lastRace || race.elapsed - lastTowerUpdate >= 0.5) {
      updateTower(race);
      lastTowerUpdate = race.elapsed;
      lastRace = race;
    }
    asphalt.color.setRGB(0.36 - wetness * 0.20, 0.37 - wetness * 0.197, 0.39 - wetness * 0.183);
    asphalt.roughness = 0.94 - wetness * 0.70;
    asphalt.normalScale.setScalar(0.56 - wetness * 0.36);
    asphalt.envMapIntensity = 1 + wetness * 1.2;
  };
}

export async function createView(canvas, quality) {
  const carAsset = await loadCarAsset(import.meta.env.BASE_URL);
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const pipeline = createRenderPipeline(renderer, quality);
  const assets = loadTrackAssets(renderer);
  const camera = new T.PerspectiveCamera(48, 1, 0.1, 960);
  const aim = new T.Vector3();
  const cameraBase = new T.Vector3();
  const cameraTarget = new T.Vector3();
  const target = new T.Vector3();
  const poses = [];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let scene;
  let models;
  let rollingWheels;
  let traffic;
  let updateLight;
  let effects;
  let drawnRace;
  let lastImpact;
  let lastSparkSerial = 0;
  let lastWheelSerial = 0;
  let shake = 0;
  let shakePhase = 0;
  let cameraReady = false;
  let width = 0;
  let height = 0;
  let studio;
  let setWetAsphalt;
  let updatePitView;
  let setMarshalLights;
  let marshalClock = 0;
  let racingLine;
  let skidMarks;

  function setTrack(track, cars, label = track.event.name) {
    if (scene) {
      const resources = new Set();
      const shared = new Set([...assets.shared, ...sharedCarResources, boxGeometry]);
      scene.traverse(object => {
        if (object.geometry) resources.add(object.geometry);
        if (object.isInstancedMesh) object.dispose();
        if (object.shadow) object.shadow.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!material) continue;
          resources.add(material);
          for (const texture of [material.map, material.alphaMap, material.normalMap, material.roughnessMap]) {
            if (texture) resources.add(texture);
          }
        }
      });
      for (const item of resources) if (!shared.has(item)) item.dispose();
    }
    scene = new T.Scene();
    traffic = createTrafficBatch(scene, cars.length - 1, carAsset);
    rollingWheels = new Map();
    updateLight = lightTrack(scene, track, assets);
    fitShadowResolution(scene, pipeline.shadowSize());
    addTerrain(scene, track, assets);
    setWetAsphalt = addTrack(scene, track, assets, label);
    updatePitView = addPitView(scene, track, assets, t, cars);
    setMarshalLights = addMarshalLights(scene, track);
    addTrees(scene, track);
    effects = createRaceEffects(scene);
    racingLine = createRacingLineView();
    skidMarks = createSkidMarks();
    scene.add(racingLine.mesh, skidMarks.mesh);
    models = cars.map(car => {
      const model = createCarModel(car.color, carAsset);
      model.root.traverse(mesh => { if (mesh.isMesh) mesh.castShadow = false; });
      model.body.castShadow = true;
      scene.add(model.root);
      return model;
    });
    cameraReady = false;
  }

  function snap() {
    cameraReady = false;
  }

  function resize() {
    if (width !== canvas.clientWidth || height !== canvas.clientHeight) {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      if (width < 1 || height < 1) return false;
      pipeline.resize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    return width > 0 && height > 0;
  }

  function drawGarage(car, orbit, dt) {
    if (!resize()) return;
    if (!studio) studio = createStudio(pipeline.shadowSize(), carAsset);
    studio.draw(pipeline.render, car, orbit, width / height, dt);
  }

  function setQuality(next) {
    if (qualityMode(next) === qualityMode(quality)) return;
    quality = next;
    pipeline.setQuality(next);
    fitShadowResolution(scene, pipeline.shadowSize());
    studio?.setShadowSize(pipeline.shadowSize());
    width = height = 0;
  }

  function draw(race, mode, dt, braking, alternateCamera, paused, fraction = 1, guide = false) {
    if (!resize()) return;
    setWetAsphalt(race);
    updatePitView(race, reduceMotion.matches);
    if (drawnRace !== race) {
      drawnRace = race;
      lastImpact = null;
      lastSparkSerial = 0;
      lastWheelSerial = 0;
      shake = 0;
      effects.reset();
    }
    const onCircuit = mode === 'race' || mode === 'result';
    for (const model of rollingWheels.values()) model.root.visible = false;
    if (onCircuit) for (const part of race.looseWheels) {
      if (!rollingWheels.has(part.id)) {
        const model = createRollingWheel(part.compound);
        scene.add(model.root);
        rollingWheels.set(part.id, model);
      }
      const { root, hub } = rollingWheels.get(part.id);
      root.visible = true;
      root.position.set(part.x, part.y, part.z);
      root.rotation.set(0, part.yaw, part.lean, 'YXZ');
      hub.rotation.x = -part.roll;
    }
    if (onCircuit) for (const impact of race.impacts) {
      if (impact.serial <= lastSparkSerial) continue;
      effects.hit(impact);
      lastSparkSerial = impact.serial;
    }
    if (onCircuit) for (const event of race.wheelEvents) {
      if (event.serial <= lastWheelSerial) continue;
      effects.wheelFailure(event);
      lastWheelSerial = event.serial;
    }
    if (race.impact && race.impact !== lastImpact && onCircuit) {
      lastImpact = race.impact;
      if (!reduceMotion.matches && lastImpact.impulse > 4.2 && lastImpact.normalSpeed > 4) {
        shake = Math.max(shake, Math.min(0.35, lastImpact.impulse * 0.006 + lastImpact.loss * 0.0024));
        shakePhase = 0;
      }
    }
    const driving = mode === 'race' && !paused && race.control.flag !== 'red';
    marshalClock += dt;
    setMarshalLights(race.control, race.elapsed, marshalClock, reduceMotion.matches);
    effects.update(dt, driving || mode === 'result' ? race : null, canvas.height, driving, mode === 'result');
    skidMarks.update(race, mode === 'race' && !paused, mode === 'race' || mode === 'result');
    const player = renderPose(race.player, race.previousPoses[0], fraction, poses[0] ??= {});
    racingLine.update(race, player, mode === 'race' && guide && !race.player.pit.lane);
    const burstAge = mode === 'race' && !paused && race.backfire ? race.elapsed - race.backfire.time : Infinity;
    const fire = burstAge < 0.15 ? race.backfire.intensity * (1 - burstAge / 0.15) * (0.90 + 0.2 * Math.sin(burstAge * 120)) : 0;
    const preset = qualityMode(quality);
    const detailDistance = preset === 'ultra' ? 30 : preset === 'high' ? 13 : 0;
    traffic.begin();
    for (let i = 0; i < race.cars.length; i++) {
      const car = i === 0 ? player : renderPose(race.cars[i], race.previousPoses[i], fraction, poses[i] ??= {});
      const model = models[i];
      const isBraking = i === 0 ? braking : (model.lastSpeed ?? car.speed) - car.speed > dt * 4;
      const distance = i === 0 ? 0 : Math.hypot(car.x - player.x, car.z - player.z);
      const detailed = i === 0 || mode !== 'menu' && distance < detailDistance;
      model.root.visible = model.root.matrixWorldAutoUpdate = detailed;
      if (detailed) updateCarModel(model, car, dt, isBraking, i === 0 ? fire : 0);
      else if (mode !== 'menu' && distance < 165) traffic.add(car, isBraking);
      model.lastSpeed = car.speed;
    }
    traffic.end();
    const { x, z, yaw } = player;
    updateLight(x, z, yaw, models[0].headlightOutput);
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
    cameraBase.lerp(cameraTarget, blend);
    camera.position.copy(cameraBase);
    aim.lerp(target, blend);
    if (shake > 0.002 && lastImpact) {
      if (!reduceMotion.matches) {
        const wave = -Math.cos(shakePhase);
        camera.position.x += wave * shake * lastImpact.nx;
        camera.position.y += Math.cos(shakePhase * 0.74) * shake * 0.42;
        camera.position.z += wave * shake * lastImpact.nz;
      }
      shakePhase += dt * 46;
      shake *= Math.exp(-dt * 13);
    }
    camera.lookAt(aim);
    cameraReady = true;
    pipeline.render(scene, camera, dt, race.track.event.weather === 'night' ? 1.18 : 1);
  }

  return {
    setTrack, draw, drawGarage, snap, setQuality,
    captureSkids: runId => skidMarks.capture(runId),
    restoreSkids: (runId, data) => skidMarks.restore(runId, data),
  };
}
