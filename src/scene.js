import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { gameName } from './career.js';
import { addTerrain, addTrees, circuitLamps, lightTrack, loadTrackAssets } from './environment.js';
import { createCarModel, sharedCarResources, updateCarModel } from './car-model.js';
import { createRaceEffects } from './race-effects.js';
import { renderPose } from './race.js';
import { createStudio } from './studio.js';
import { createRenderPipeline, fitShadowResolution } from './render-pipeline.js';
import { qualityMode } from './graphics-settings.js';
import { createRacingLineView } from './racing-line-view.js';
import { addTrackDetails } from './track-details.js';
import { createSkidMarks } from './skid-marks.js';
import { loadCarAsset } from './car-asset.js';

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
  let reflector = 0;
  marker.scale.set(0.08, 0.064, 0.18);
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
      if (i % 5 === 0) {
        const face = track.at(i * track.length / count, offset - side * 0.032);
        marker.position.set(face.x, 0.603, face.z);
        marker.rotation.y = face.yaw;
        marker.updateMatrix();
        reflectors.setMatrixAt(reflector, marker.matrix);
        reflectors.setColorAt(reflector++, tint.set(side > 0 ? '#e5b979' : '#dde6f7'));
      }
    }
  }
  posts.castShadow = true;
  scene.add(posts, reflectors);
}

function addGrandstand(scene, track, metal) {
  const pose = track.at(30, track.railOffset + 4.7);
  const stand = new T.Group();
  stand.position.set(pose.x, 0, pose.z);
  stand.rotation.y = pose.yaw + Math.PI / 2;
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
      }
    }
  }
  seats.receiveShadow = true;
  stand.add(seats);

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
  addTrackDetails(scene, track);

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
  const sign = new T.Mesh(new T.PlaneGeometry(pillar * 2 - 0.8, 0.89), textPanel(gameName + '     /     ' + label));
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
    box(post, metal, 0.13, height, 0.13, 0, height / 2, 0).castShadow = true;
    box(post, dark, night ? 2.16 : 1.7, 0.20, night ? 0.48 : 0.23, -side * 0.78, height - 0.06, 0);
    const lamp = box(post, bulb, night ? 1.35 : 0.66, 0.070, night ? 0.46 : 0.26, -side * 1.34, height - 0.16, 0);
    lamp.rotation.z = side * 0.13;
    scene.add(post);
  }

  addGuardrails(scene, track, metal);
  addGrandstand(scene, track, metal);
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
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let scene;
  let models;
  let updateLight;
  let effects;
  let drawnRace;
  let lastImpact;
  let lastSparkSerial = 0;
  let shake = 0;
  let shakePhase = 0;
  let cameraReady = false;
  let width = 0;
  let height = 0;
  let studio;
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
    updateLight = lightTrack(scene, track, assets);
    fitShadowResolution(scene, pipeline.shadowSize());
    addTerrain(scene, track, assets);
    addTrack(scene, track, assets, label);
    addTrees(scene, track);
    effects = createRaceEffects(scene);
    racingLine = createRacingLineView();
    skidMarks = createSkidMarks();
    scene.add(racingLine.mesh, skidMarks.mesh);
    models = cars.map(car => {
      const model = createCarModel(car.color, carAsset);
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
    if (drawnRace !== race) {
      drawnRace = race;
      lastImpact = null;
      lastSparkSerial = 0;
      shake = 0;
      effects.reset();
    }
    const onCircuit = mode === 'race' || mode === 'result';
    if (onCircuit) for (const impact of race.impacts) {
      if (impact.serial <= lastSparkSerial) continue;
      effects.hit(impact);
      lastSparkSerial = impact.serial;
    }
    if (race.impact && race.impact !== lastImpact && onCircuit) {
      lastImpact = race.impact;
      if (!reduceMotion.matches && lastImpact.impulse > 4.2 && lastImpact.normalSpeed > 4) {
        shake = Math.max(shake, Math.min(0.24, lastImpact.impulse * 0.005 + lastImpact.loss * 0.0015));
        shakePhase = 0;
      }
    }
    const driving = mode === 'race' && !paused;
    effects.update(dt, driving || mode === 'result' ? race : null, canvas.height, driving);
    skidMarks.update(race, mode === 'race' && !paused, mode === 'race' || mode === 'result');
    const cars = race.cars.map((car, index) => renderPose(car, race.previousPoses[index], fraction));
    racingLine.update(race, cars[0], mode === 'race' && guide);
    const burstAge = mode === 'race' && !paused && race.backfire ? race.elapsed - race.backfire.time : Infinity;
    const fire = burstAge < 0.15 ? race.backfire.intensity * (1 - burstAge / 0.15) * (0.90 + 0.2 * Math.sin(burstAge * 120)) : 0;
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      const model = models[i];
      model.root.visible = mode !== 'menu' || i === 0;
      const isBraking = i === 0 ? braking : (model.lastSpeed ?? car.speed) - car.speed > dt * 4;
      updateCarModel(model, car, dt, isBraking, i === 0 ? fire : 0);
      model.lastSpeed = car.speed;
    }
    const { x, z, yaw } = cars[0];
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
