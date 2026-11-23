import * as T from 'three';
import { createCarModel, updateCarModel } from './car-model.js';

export const defaultOrbit = { azimuth: 0.96, elevation: 0.36, zoom: 1 };
export const garageAngles = { front: 0.80, side: 1.57, rear: 2.58 };

export function createStudio(assets) {
  const scene = new T.Scene();
  scene.background = new T.Color('#11171d');
  scene.fog = new T.Fog('#11171d', 9, 23);
  scene.environmentIntensity = 0.52;
  assets.reflections.then(texture => { if (texture) scene.environment = texture; });
  const stageMaterial = new T.MeshStandardMaterial({ color: '#323943', roughness: 0.65, metalness: 0.24 });
  const floorMaterial = new T.MeshStandardMaterial({ color: '#202730', roughness: 0.8 });
  const floor = new T.Mesh(new T.PlaneGeometry(72, 72), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.15;
  floor.receiveShadow = true;
  scene.add(floor);
  const podium = new T.Mesh(new T.CylinderGeometry(3.12, 3.22, 0.14, 100), stageMaterial);
  podium.position.y = -0.081;
  podium.receiveShadow = true;
  scene.add(podium);
  const ring = new T.Mesh(new T.RingGeometry(2.98, 3.012, 100), new T.MeshBasicMaterial({ color: '#b16149' }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.006;
  scene.add(ring);
  const grid = new T.GridHelper(68, 68, '#343f4a', '#282f39');
  grid.position.y = -0.14;
  scene.add(grid);

  const key = new T.DirectionalLight('#fff0dc', 3.05);
  key.position.set(2.5, 6, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -4.4, right: 4.4, top: 4.4, bottom: -4.4, near: 0.1, far: 17 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.normalBias = 0.022;
  key.shadow.bias = -0.00012;
  key.shadow.radius = 2;
  const fill = new T.DirectionalLight('#b7defe', 2.05);
  fill.position.set(-5, 3, -2);
  const rim = new T.DirectionalLight('#ffe0bd', 1.4);
  rim.position.set(3, 3.5, -4);
  scene.add(key, fill, rim, new T.HemisphereLight('#cfdeee', '#443632', 0.66));
  const model = createCarModel('#f04b32');
  scene.add(model.root);
  const camera = new T.PerspectiveCamera(40, 1, 0.08, 55);
  const target = new T.Vector3();
  const position = new T.Vector3();
  let ready = false;

  function draw(renderer, car, orbit, aspect, dt) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const distance = Math.max(6.05, 5.7 / Math.min(1, aspect)) / orbit.zoom;
    const flat = Math.cos(orbit.elevation) * distance;
    position.set(Math.sin(orbit.azimuth) * flat, 0.53 + Math.sin(orbit.elevation) * distance, Math.cos(orbit.azimuth) * flat);
    if (ready) camera.position.lerp(position, 1 - Math.exp(-dt * 13));
    else camera.position.copy(position);
    ready = true;
    target.set(0, 0.56, 0);
    camera.lookAt(target);
    updateCarModel(model, car, dt, false);
    renderer.render(scene, camera);
  }

  return { draw };
}
