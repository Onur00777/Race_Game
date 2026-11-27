import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded, terrainHeight } from './environment.js';
import { sponsors } from './setup.js';

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

function gravelPatch(track, station, side) {
  const vertices = [], uv = [], triangles = [];
  for (let i = 0; i <= 16; i++) {
    const progress = i / 16;
    for (const edge of [0, 1]) {
      const distance = station - 11 + progress * 34;
      const point = track.at(distance, side * (track.railAt(distance, side) + 0.75 + edge * (1.1 + Math.sin(progress * Math.PI) * 6.5)));
      vertices.push(point.x, terrainHeight(track, point.x, point.z) + 0.12, point.z);
      uv.push(edge * 1.8, progress * 9);
    }
    const v = i * 2;
    if (i) triangles.push(v - 2, v - 1, v, v - 1, v + 1, v);
  }
  return panelGeometry(vertices, uv, triangles);
}

function addTrackFurniture(scene, track, corners) {
  const tireGeometry = new T.TorusGeometry(0.27, 0.104, 6, 12).rotateX(Math.PI / 2);
  const tireWalls = new T.InstancedMesh(tireGeometry, new T.MeshStandardMaterial({ roughness: 0.96 }), corners.length * 24);
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 64 * (sponsors.length + 3);
  const ctx = canvas.getContext('2d');
  const signs = [...sponsors.map(({ brand, color }) => [brand, color]), ...[150, 100, 50].map(distance => [distance + ' m', '#f6f4df'])];
  const paint = new T.Color();
  const local = new T.Object3D();
  const panels = [];
  const board = (station, offset, width, height, top, index, angle) => {
    const point = track.at(station, offset);
    const geometry = new T.PlaneGeometry(width, height, 1, 1);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setY(i, 1 - (index * 64 + (uv.getY(i) ? 1 : 63)) / canvas.height);
    }
    geometry.rotateY(point.yaw + angle).translate(point.x, top, point.z);
    panels.push(geometry);
  };
  signs.forEach(([name, color], index) => {
    const y = index * 64;
    ctx.fillStyle = index < sponsors.length ? '#122431' : '#eeeedd';
    ctx.fillRect(0, y, 384, 64);
    ctx.fillStyle = index < sponsors.length ? color : '#121c26';
    ctx.fillRect(0, y + 58, 384, 6);
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(name, 192, y + 47);
  });
  let tire = 0;
  corners.forEach(({ station, side }, index) => {
    for (let column = 0; column < 12; column++) {
      const at = station + 3 + column * 0.70;
      const point = track.at(at, side * (track.railAt(at, side) + 0.32));
      for (const row of [0, 1]) {
        local.position.set(point.x, 0.082 + row * 0.18, point.z);
        local.updateMatrix();
        tireWalls.setMatrixAt(tire, local.matrix);
        tireWalls.setColorAt(tire++, paint.set(column % 4 < 2 ? '#b53b37' : '#e4dfce'));
      }
    }
    const sponsorStation = station + 18;
    board(sponsorStation, side * (track.railAt(sponsorStation, side) + 0.45), 5.6, 0.94, 1.17, index % sponsors.length, side * Math.PI / 2);
    for (const [i, metres] of [150, 100, 50].entries()) {
      const braking = station - metres;
      if (track.pit.garageAt(braking) && side === track.pit.side) continue;
      board(braking, side * (track.railAt(braking, side) + 0.12), 1.72, 0.50, 0.91, sponsors.length + i, Math.PI);
    }
  });
  scene.add(tireWalls);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  addMergedSurface(scene, panels, new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide }));
}

export function addTrackDetails(scene, track, assets) {
  const kerbs = [[], []];
  const tireMarks = [];
  const corners = [];
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
      const side = -sign;
      const local = track.pit.wrap(station);
      if ((side !== track.pit.side || local < track.pit.entry - 25 || local > track.pit.exit + 25) &&
          (!corners.length || station - corners.at(-1).station > 82)) corners.push({ station, side });
      for (const lane of [-0.69, 0.69]) tireMarks.push(rubberTrace(track, station - 17, 25 + strength * 7, sign, lane, 0.21));
      if (strength > 0.62) tireMarks.push(rubberTrace(track, station - 13, 18, sign, 0.31, 0.16));
    }
  }
  const [red, white] = ['#bb382e', '#e4ddd1'].map(color => new T.MeshStandardMaterial({ color, roughness: 0.73 }));
  addMergedSurface(scene, kerbs[0], red);
  addMergedSurface(scene, kerbs[1], white);
  if (corners.length) {
    addMergedSurface(scene, corners.map(({ station, side }) => gravelPatch(track, station, side)),
      new T.MeshStandardMaterial({ map: assets.gravel, color: '#b4a18a', roughness: 1, side: T.DoubleSide }));
    addTrackFurniture(scene, track, corners);
  }
  if (tireMarks.length) {
    addMergedSurface(scene, tireMarks, new T.MeshStandardMaterial({ color: '#141518', alphaMap: rubberTexture(),
      roughness: 0.71, transparent: true, opacity: 0.68, depthWrite: false }));
  }
}
