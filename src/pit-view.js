import * as T from 'three';
import { pitStall } from './pit-lane.js';
import { addPitGarages } from './pit-garage.js';
import { addPitCrew } from './pit-crew.js';

function ribbon(track, start, end, offset, width, height, material) {
  const count = Math.max(1, Math.ceil((end - start) / 1.25));
  const positions = [], uv = [], triangles = [];
  for (let i = 0; i <= count; i++) {
    const station = T.MathUtils.lerp(start, end, i / count);
    const span = typeof width === 'function' ? width(station) : width;
    for (const side of [-1, 1]) {
      const position = track.at(station, offset(station) + side * span / 2);
      positions.push(position.x, height, position.z);
      uv.push((side + 1) / 2 * span / 4, station / 4);
    }
    const vertex = i * 2;
    if (i) triangles.push(vertex - 2, vertex, vertex - 1, vertex - 1, vertex, vertex + 1);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(triangles);
  geometry.computeVertexNormals();
  const mesh = new T.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function pitSign(scene, track, station, offset, text, color, height = 1.54, angle = Math.PI) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#12202b';
  ctx.fillRect(0, 0, 320, 96);
  ctx.fillStyle = color;
  ctx.fillRect(0, 83, 320, 13);
  ctx.font = '900 46px Rajdhani, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 160, 45, 302);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  const sign = new T.Mesh(new T.PlaneGeometry(2.35, 0.70), new T.MeshBasicMaterial({ map: texture }));
  const point = track.at(station, offset);
  sign.position.set(point.x, height, point.z);
  sign.rotation.y = point.yaw + angle;
  scene.add(sign);
}

function wallAndFence(scene, track, block, steel) {
  const { wallStart, wallEnd, wallOffset, wallWidth } = track.pit;
  const concrete = new T.MeshStandardMaterial({ color: '#a2a29e', roughness: 0.96, side: T.DoubleSide });
  const outlines = [[-wallWidth / 2, 0], [-wallWidth / 2, 0.66], [-0.18, 0.98], [0.18, 0.98], [wallWidth / 2, 0.66], [wallWidth / 2, 0]];
  const verts = [], faces = [], wires = [];
  const count = Math.ceil((wallEnd - wallStart) / 0.75);
  for (let i = 0; i <= count; i++) {
    const station = T.MathUtils.lerp(wallStart, wallEnd, i / count);
    for (const [shift, height] of outlines) {
      const point = track.at(station, wallOffset + shift);
      verts.push(point.x, height, point.z);
    }
    for (let j = 1; i > 0 && j < outlines.length; j++) {
      const a = (i - 1) * outlines.length + j - 1, b = a + outlines.length;
      faces.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const point = track.at(station, wallOffset);
    wires.push(point.x, 1.01, point.z, point.x, 2.31, point.z);
    if (i > 0) {
      const prev = track.at(T.MathUtils.lerp(wallStart, wallEnd, (i - 1) / count), wallOffset);
      for (const y of [1.13, 1.39, 1.66, 1.91, 2.16, 2.31]) wires.push(prev.x, y, prev.z, point.x, y, point.z);
    }
    if (i % 6 === 0 || i === count) block(steel, station, wallOffset, 1.66, 0.074, 1.34, 0.09);
  }
  faces.push(0, 1, 5, 1, 2, 5, 2, 3, 5, 3, 4, 5);
  const tail = count * outlines.length;
  faces.push(tail, tail + 5, tail + 1, tail + 1, tail + 5, tail + 2, tail + 2, tail + 5, tail + 3, tail + 3, tail + 5, tail + 4);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  const wall = new T.Mesh(geometry, concrete);
  wall.castShadow = wall.receiveShadow = true;
  const fence = new T.BufferGeometry();
  fence.setAttribute('position', new T.Float32BufferAttribute(wires, 3));
  scene.add(wall, new T.LineSegments(fence, new T.LineBasicMaterial({ color: '#b4c2c9', transparent: true, opacity: 0.43 })));
}

export function addPitView(scene, track, assets, label, cars) {
  const lane = track.pit;
  const pavement = new T.MeshStandardMaterial({ color: '#62666c', map: assets.asphalt, roughness: 0.90, side: T.DoubleSide });
  const blue = new T.MeshStandardMaterial({ color: '#46dff1', roughness: 0.72, side: T.DoubleSide });
  const white = new T.MeshStandardMaterial({ color: '#f0e1bf', roughness: 0.82, side: T.DoubleSide });
  const boxColor = new T.MeshStandardMaterial({ color: '#ffc157', emissive: '#ffae46', emissiveIntensity: 0.37, roughness: 0.72, side: T.DoubleSide });
  const steel = new T.MeshStandardMaterial({ color: '#66747c', roughness: 0.68, metalness: 0.48 });
  const post = new T.MeshStandardMaterial({ color: '#f27536', roughness: 0.78 });
  const concrete = new T.MeshStandardMaterial({ color: '#999995', map: assets.asphalt, roughness: 0.87, side: T.DoubleSide });
  const boxGeometry = new T.BoxGeometry(1, 1, 1);
  const batches = new Map();
  const blockTransform = new T.Object3D();
  function part(geometry, material, station, offset, height, width, size, depth, rotation = 0, shadow = true) {
    const point = track.at(station, offset);
    blockTransform.position.set(point.x, height, point.z);
    blockTransform.rotation.y = point.yaw + rotation;
    blockTransform.scale.set(width, size, depth);
    blockTransform.updateMatrix();
    if (!batches.has(geometry)) batches.set(geometry, new Map());
    const materials = batches.get(geometry);
    if (!materials.has(material)) materials.set(material, [[], []]);
    materials.get(material)[Number(shadow)].push(blockTransform.matrix.clone());
  }
  function block(material, station, offset, height, width, size, depth, rotation = 0) {
    part(boxGeometry, material, station, offset, height, width, size, depth, rotation, depth > 0.08 && height > 0.08);
  }
  const outside = station => lane.offsetAt(station) + lane.side * (lane.widthAt(station) - 0.04);
  const inside = station => lane.offsetAt(station) - lane.side * (lane.widthAt(station) - 0.04);
  scene.add(ribbon(track, lane.entry, lane.exit, lane.offsetAt, station => lane.widthAt(station) * 2, 0.010, pavement));
  scene.add(ribbon(track, lane.box - 15.1, lane.box + 15.1, () => lane.garageFace + lane.side * 1.60, 6.0, 0.013, concrete));
  scene.add(ribbon(track, lane.entry, lane.exit, outside, 0.115, 0.021, blue));
  scene.add(ribbon(track, lane.laneEnd, lane.exit + 9, inside, 0.13, 0.023, white));
  for (let s = lane.entry + 4; s < lane.wallStart - 4; s += 4.9) {
    const stripeOffset = inside(s) - lane.side * 0.43;
    block(white, s, stripeOffset, 0.022, 0.10, 0.016, 2.25, lane.side * 0.55);
    block(white, s + 0.9, stripeOffset + lane.side * 0.80, 0.022, 0.10, 0.016, 2.25, -lane.side * 0.55);
    if (s < lane.speedLine) block(post, s, outside(s) + lane.side * 0.18, 0.31, 0.105, 0.61, 0.13);
  }
  const divider = () => (lane.fastCenter + lane.stallCenter) / 2;
  for (let s = lane.laneStart; s < lane.laneEnd - 1; s += 5) scene.add(ribbon(track, s, s + 2.1, divider, 0.12, 0.022, white));
  scene.add(ribbon(track, lane.speedLine, lane.speedLine + 0.26, lane.offsetAt, s => lane.widthAt(s) * 2, 0.023, white));
  const bays = cars.map(({ name, color }, index) => ({
    name, index, station: pitStall(lane, index - 1), player: index === 0, color: index === 0 ? '#f27855' : color,
  }))
    .sort((a, b) => a.station - b.station);
  for (const { station: stall, player } of bays) {
    const material = player ? boxColor : white;
    const stallPath = station => lane.stallCenter + lane.side * (station - stall) * 0.20;
    for (const shift of [-1.08, 1.08]) scene.add(ribbon(track, stall - 2.6, stall + 2.6, station => stallPath(station) + shift, 0.082, 0.024, material));
    for (const tip of [-2.6, 2.6]) scene.add(ribbon(track, stall + tip, stall + tip + 0.09, stallPath, 2.22, 0.024, material));
  }
  wallAndFence(scene, track, block, steel);
  addPitGarages(scene, track, bays, { block, part, label });
  const updateCrew = addPitCrew(scene, track, bays);
  pitSign(scene, track, lane.entry + 3, outside(lane.entry + 3) + lane.side * 0.25, label('pitEntry'), '#66e0ee');
  pitSign(scene, track, lane.speedLine, outside(lane.speedLine) + lane.side * 0.38, '80 km/h', '#66e0ee');
  const serviceSign = lane.box + 2.65;
  const signOffset = outside(serviceSign) + lane.side * 0.41;
  block(steel, serviceSign + 0.075, signOffset, 1.13, 0.08, 2.26, 0.095);
  pitSign(scene, track, serviceSign, signOffset, label('pitBox'), '#ffcb74', 2.18);
  pitSign(scene, track, lane.exit - 9, outside(lane.exit - 9) + lane.side * 0.38, label('pitExit'), '#66e0ee');
  for (const [geometry, materials] of batches) {
    for (const [material, groups] of materials) for (const [shadow, matrices] of groups.entries()) {
      if (!matrices.length) continue;
      const mesh = new T.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.castShadow = Boolean(shadow);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
  return (race, reducedMotion) => {
    const { wetness } = race;
    pavement.roughness = 0.88 - wetness * 0.64;
    pavement.envMapIntensity = 1 + wetness;
    concrete.roughness = 0.87 - wetness * 0.25;
    updateCrew(race, reducedMotion);
  };
}
