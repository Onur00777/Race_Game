import * as T from 'three';
import { addPitEquipment } from './pit-equipment.js';

const surface = (color, roughness = 0.7, metalness = 0) => new T.MeshStandardMaterial({ color, roughness, metalness });

function baySigns(scene, track, bays, face, label) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = bays.length * 96;
  const ctx = canvas.getContext('2d');
  const { side } = track.pit;
  bays.forEach(({ name, color, player }, index) => {
    const y = index * 96;
    ctx.fillStyle = '#121b26';
    ctx.fillRect(0, y, 768, 96);
    ctx.fillStyle = color;
    ctx.fillRect(0, y + 86, 768, 10);
    ctx.font = 'bold 66px Rajdhani, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1).padStart(2, '0'), 27, y + 46);
    ctx.fillStyle = '#f4f6f6';
    ctx.font = 'bold 49px Rajdhani, sans-serif';
    ctx.fillText(player ? label('pitYourBay') : name.toLocaleUpperCase('tr'), 151, y + 48, 540);
    ctx.fillStyle = color;
    for (let stripe = 0; stripe < 3; stripe++) {
      const x = 704 + stripe * 17;
      ctx.beginPath();
      ctx.moveTo(x, y + 30);
      ctx.lineTo(x + 8, y + 30);
      ctx.lineTo(x - 7, y + 63);
      ctx.lineTo(x - 15, y + 63);
      ctx.fill();
    }
  });
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new T.MeshBasicMaterial({ map: texture });
  bays.forEach(({ station }, index) => {
    const geometry = new T.PlaneGeometry(4.72, 0.59);
    const uv = geometry.attributes.uv;
    const top = (canvas.height - index * 96 - 1) / canvas.height;
    const bottom = (canvas.height - (index + 1) * 96 + 1) / canvas.height;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) ? top : bottom);
    const board = new T.Mesh(geometry, material);
    const point = track.at(station, face - side * 0.16);
    board.position.set(point.x, 3.52, point.z);
    board.rotation.y = point.yaw + side * Math.PI / 2;
    scene.add(board);
  });
}

function addGarageLighting(scene, track, bays) {
  const { side, garageFace } = track.pit;
  const night = track.event.weather === 'night';
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, '#e2eeff');
  gradient.addColorStop(0.55, '#d6e7ff96');
  gradient.addColorStop(1, '#d6e7ff00');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const pool = new T.InstancedMesh(new T.PlaneGeometry(5.15, 4.5).rotateX(-Math.PI / 2),
    new T.MeshBasicMaterial({ map: texture, transparent: true, opacity: night ? 0.38 : 0.13,
      blending: T.AdditiveBlending, depthWrite: false }), bays.length);
  const pose = new T.Object3D();
  bays.forEach(({ station, player }, index) => {
    const point = track.at(station, garageFace + side * 0.4);
    pose.position.set(point.x, 0.032, point.z);
    pose.rotation.y = point.yaw;
    pose.updateMatrix();
    pool.setMatrixAt(index, pose.matrix);
    if (night && (player || index === 0 || index === bays.length - 1)) {
      const workLight = new T.PointLight('#d0e0ff', 32, 11, 2);
      workLight.position.set(point.x, 2.86, point.z);
      scene.add(workLight);
    }
  });
  scene.add(pool);
}

export function addPitGarages(scene, track, bays, { block, part, label }) {
  const { side, garageFace: face } = track.pit;
  const panel = surface('#677580', 0.59, 0.35);
  const joint = surface('#303b44', 0.65, 0.35);
  const frame = surface('#28343e', 0.5, 0.54);
  const trim = surface('#acc0ca', 0.51, 0.38);
  const back = surface('#56616b', 0.86);
  const roof = surface('#323d48', 0.85);
  const glass = surface('#263e50', 0.2, 0.48);
  const drains = surface('#343a40', 0.87);
  const paint = surface('#d8cdb0', 0.77);
  const hazard = surface('#d4a04e', 0.73);
  const led = new T.MeshBasicMaterial({ color: new T.Color(1.44, 1.74, 1.92) });
  const bayLamp = new T.MeshBasicMaterial({ color: new T.Color(2.0, 1.40, 0.52) });
  const equipment = addPitEquipment({ block, part, side });
  bays.forEach(({ color, station, player }, index) => {
    const accent = surface(color, 0.51, 0.23);
    const build = (material, z, x, ...dimensions) => block(material, station + z, face + side * x, ...dimensions);
    build(back, 0, 3.55, 1.62, 0.18, 3.24, 6.8);
    for (const edgeZ of [-2.96, 2.96]) {
      build(joint, edgeZ, 1.84, 1.59, 3.71, 3.20, 0.15);
      build(frame, edgeZ, 0.04, 1.66, 0.44, 3.32, 0.28);
      build(trim, edgeZ, -0.20, 1.67, 0.065, 3.30, 0.11);
      build(hazard, edgeZ, -0.24, 0.57, 0.09, 0.25, 0.21);
      build(frame, edgeZ, -0.55, 3.04, 1.5, 0.14, 0.17);
    }
    build(roof, 0, 0.91, 3.51, 5.43, 0.20, 6.08);
    build(frame, 0, -1.89, 3.53, 0.18, 0.68, 6.07);
    build(trim, 0, -2.00, 3.87, 0.065, 0.064, 6.06);
    build(panel, 0, 0, 3.19, 0.27, 0.67, 5.96);
    build(accent, 0, -0.14, 2.87, 0.08, 0.075, 5.73);
    build(joint, 0, 0.26, 2.79, 0.16, 0.10, 5.20);
    for (let z = -2.40; z <= 2.41; z += 0.16) build(trim, z, 0.18, 2.78, 0.025, 0.042, 0.047);
    for (const x of [-0.73, 1.27, 2.66]) {
      build(frame, 0, x, 3.17, 0.17, 0.14, 5.48);
      for (const z of [-1.39, 1.39]) build(led, z, x, 3.08, 0.12, 0.045, 2.38);
    }
    build(panel, 0, 2.05, 4.32, 3.25, 1.57, 6.03);
    build(roof, 0, 1.90, 5.14, 3.68, 0.15, 6.06);
    build(glass, 0, 0.37, 4.47, 0.18, 0.94, 5.69);
    for (const z of [-2.87, -1.46, 0, 1.46, 2.87]) build(trim, z, 0.26, 4.47, 0.075, 0.99, 0.065);
    build(trim, 0, 0.26, 4.10, 0.079, 0.068, 5.76);
    build(led, 0, 0.41, 4.81, 0.035, 0.040, 5.46);
    if (player) {
      const arm = Math.abs(face - track.pit.stallCenter);
      build(frame, 0.52, -0.24, 1.54, 0.15, 3.07, 0.17);
      build(frame, 0.52, -arm / 2, 2.91, arm + 0.29, 0.12, 0.18);
      build(frame, 0.52, -arm, 2.79, 0.72, 0.21, 0.27);
      for (const shift of [-0.21, 0, 0.21]) {
        build(bayLamp, 0.37, -arm + shift, 2.79, 0.12, 0.087, 0.037);
      }
    }
    build(drains, 0, -0.58, 0.022, 0.17, 0.013, 5.75);
    for (let z = -2.70; z <= 2.71; z += 0.18) build(trim, z, -0.58, 0.032, 0.126, 0.008, 0.026);
    for (const z of [-2.48, 2.48]) build(paint, z, -0.62, 0.027, 1.24, 0.012, 0.055);
    equipment.garage(station, face, accent, index % 2 ? 1 : -1);
    equipment.timingStand(station + 0.12, track.pit.wallOffset + side * 0.39);
  });
  baySigns(scene, track, bays, face - side * 1.89, label);
  addGarageLighting(scene, track, bays);
}
