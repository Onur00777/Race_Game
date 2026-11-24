import * as T from 'three';
import { createCarModel, updateCarModel } from './car-model.js';
import { fitShadowResolution } from './render-pipeline.js';
import { createStudioHDR } from './car-materials.js';

export function createStudio(shadowSize, carAsset) {
  const scene = new T.Scene();
  scene.background = new T.Color('#11171d');
  scene.fog = new T.Fog('#11171d', 9, 23);
  scene.environmentIntensity = 0.84;
  scene.environment = createStudioHDR();
  const stageMaterial = new T.MeshStandardMaterial({ color: '#252c37', roughness: 0.43, metalness: 0.39 });
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

  const key = new T.DirectionalLight('#fff0dc', 2.2);
  key.position.set(2.5, 6, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(Math.min(2048, shadowSize), Math.min(2048, shadowSize));
  Object.assign(key.shadow.camera, { left: -4.4, right: 4.4, top: 4.4, bottom: -4.4, near: 0.1, far: 17 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.normalBias = 0.014;
  key.shadow.bias = -0.00012;
  key.shadow.radius = 2;
  const fill = new T.DirectionalLight('#b7defe', 1.55);
  fill.position.set(-5, 3, -2);
  const rim = new T.DirectionalLight('#ffe0bd', 1.5);
  rim.position.set(3, 3.5, -4);
  scene.add(key, fill, rim, new T.HemisphereLight('#cfdeee', '#443632', 0.66));
  const model = createCarModel('#f04b32', carAsset);
  scene.add(model.root);
  const camera = new T.PerspectiveCamera(40, 1, 0.08, 55);
  const target = new T.Vector3();
  let displayed;

  function draw(render, car, orbit, aspect, dt) {
    if (camera.aspect !== aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    displayed ??= { ...orbit };
    const blend = 1 - Math.exp(-dt * 13);
    const delta = Math.atan2(Math.sin(orbit.azimuth - displayed.azimuth), Math.cos(orbit.azimuth - displayed.azimuth));
    displayed.azimuth += delta * blend;
    displayed.elevation = T.MathUtils.lerp(displayed.elevation, orbit.elevation, blend);
    displayed.zoom = T.MathUtils.lerp(displayed.zoom, orbit.zoom, blend);
    const distance = Math.max(6.05, 5.7 / Math.min(1, aspect)) / displayed.zoom;
    const flat = Math.cos(displayed.elevation) * distance;
    camera.position.set(Math.sin(displayed.azimuth) * flat, 0.53 + Math.sin(displayed.elevation) * distance, Math.cos(displayed.azimuth) * flat);
    target.set(0, 0.56, 0);
    camera.lookAt(target);
    updateCarModel(model, car, dt, false);
    render(scene, camera, dt, 0.8);
  }

  return { draw, setShadowSize: size => fitShadowResolution(scene, Math.min(2048, size)) };
}
