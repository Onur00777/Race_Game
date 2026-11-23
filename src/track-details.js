import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded } from './environment.js';

function turnAt(track, station, span) {
  const delta = track.at(station - span).yaw - track.at(station + span).yaw;
  return Math.atan2(Math.sin(delta), Math.cos(delta));
}

function panelGeometry(vertices, uv, indices) {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function kerb(track, station, length, side) {
  const edge = track.event.width * 0.5;
  const profile = [[-0.18, 0.010], [-0.045, 0.037], [0.21, 0.073], [0.52, 0.025]];
  if (side < 0) profile.reverse();
  const vertices = [], uv = [], indices = [];
  const rows = 7;
  for (let row = 0; row <= rows; row++) {
    const distance = station + row * length / rows;
    for (const [index, [along, height]] of profile.entries()) {
      const point = track.at(distance, side * (edge + along));
      const top = row === 0 || row === rows ? height * 0.28 : height * (row % 2 === 0 ? 0.83 : 1);
      vertices.push(point.x, top, point.z);
      uv.push(index / (profile.length - 1), row / rows);
      if (!row || !index) continue;
      const c = row * profile.length + index;
      const a = c - profile.length - 1;
      indices.push(a, a + 1, c - 1, a + 1, c, c - 1);
    }
  }
  return panelGeometry(vertices, uv, indices);
}

function addMergedSurface(scene, geometries, material) {
  if (!geometries.length) return;
  const mesh = new T.Mesh(mergeGeometries(geometries), material);
  mesh.receiveShadow = true;
  scene.add(mesh);
  geometries.forEach(geometry => geometry.dispose());
}

function rubberTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 80;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(canvas.width, canvas.height);
  const random = seeded(282);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const lateral = (x + 0.5) / canvas.width - 0.5;
      const progress = y / (canvas.height - 1);
      const falloff = Math.sin(Math.PI * progress) ** 0.64 * Math.max(0, 1 - (Math.abs(lateral) * 2) ** 1.2);
      const value = falloff * (0.43 + 0.25 * Math.sin(x * 0.49) ** 4 + random() * 0.32) * 255;
      const index = (y * canvas.width + x) * 4;
      pixels.data.set([value, value, value, 255], index);
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return new T.CanvasTexture(canvas);
}

function rubberTrace(track, station, length, turn, lane, width) {
  const vertices = [], uv = [], indices = [];
  const count = Math.ceil(length / 1.1);
  for (let i = 0; i <= count; i++) {
    const time = i / count;
    const center = turn * (0.45 - 2.1 * Math.cos(time * Math.PI * 0.85)) + lane;
    for (const side of [-1, 1]) {
      const pose = track.at(station + length * time, center + side * width);
      vertices.push(pose.x, 0.0105, pose.z);
      uv.push((side + 1) / 2, time);
    }
    if (i) {
      const a = (i - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  return panelGeometry(vertices, uv, indices);
}

export function addTrackDetails(scene, track) {
  const kerbs = [[], []];
  const tireMarks = [];
  let lastMark = -Infinity;
  for (let i = 2; i < track.samples.length - 1; i += 2) {
    const station = i * track.spacing;
    const bend = turnAt(track, station, 11);
    if (Math.abs(bend) > 0.23) {
      for (const side of [-1, 1]) {
        const phase = i / 2 + (side > 0 ? 1 : 0);
        kerbs[phase % 2].push(kerb(track, station + 0.035, track.spacing * 2 - 0.070, side));
      }
    }
    if (Math.abs(bend) > 0.47 && station - lastMark > 26) {
      lastMark = station;
      const strength = Math.abs(bend);
      const sign = Math.sign(bend);
      for (const lane of [-0.69, 0.69]) tireMarks.push(rubberTrace(track, station - 17, 25 + strength * 7, sign, lane, 0.21));
      if (strength > 0.62) tireMarks.push(rubberTrace(track, station - 13, 18, sign, 0.31, 0.16));
    }
  }
  const [red, white] = ['#bb382e', '#e4ddd1'].map(color => new T.MeshStandardMaterial({ color, roughness: 0.73 }));
  addMergedSurface(scene, kerbs[0], red);
  addMergedSurface(scene, kerbs[1], white);
  if (tireMarks.length) {
    addMergedSurface(scene, tireMarks, new T.MeshStandardMaterial({ color: '#141518', alphaMap: rubberTexture(),
      roughness: 0.71, transparent: true, opacity: 0.68, depthWrite: false }));
  }
}
