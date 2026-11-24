import * as T from 'three';

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
  const sign = new T.Mesh(new T.PlaneGeometry(2.35, 0.70), new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide }));
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

function pitBuildings(scene, track, block, steel, label) {
  const lane = track.pit;
  const outer = lane.side * (lane.edge + 12.55);
  const doorFace = outer - lane.side * 1.14;
  const fascia = new T.MeshStandardMaterial({ color: '#535d68', roughness: 0.71, metalness: 0.31 });
  const bayDark = new T.MeshStandardMaterial({ color: '#1a272f', roughness: 0.75 });
  const lamps = new T.MeshBasicMaterial({ color: new T.Color(1.8, 2.2, 2.4) });
  const tireMaterial = new T.MeshStandardMaterial({ color: '#171a1c', roughness: 0.96 });
  const tires = new T.TorusGeometry(0.265, 0.111, 6, 14).rotateX(Math.PI / 2);
  const stacks = new T.InstancedMesh(tires, tireMaterial, 25);
  const wheel = new T.Object3D();
  const stalls = [-12, -6, 0, 6, 12];
  stalls.forEach((shift, index) => {
    const station = lane.box + shift;
    const accentColor = ['#5bd1b8', '#4ebfff', '#ffc160', '#df9388', '#c8a2ed'][index];
    const stripe = new T.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.32 });
    block(fascia, station, outer + lane.side * 2.25, 1.75, 0.16, 3.55, 5.9);
    block(fascia, station - 2.92, outer + lane.side * 0.36, 1.68, 4.2, 3.42, 0.135);
    block(fascia, station + 2.92, outer + lane.side * 0.36, 1.68, 4.2, 3.42, 0.135);
    block(steel, station, outer - lane.side * 0.47, 3.40, 5.28, 0.22, 6.06);
    block(fascia, station, doorFace, 3.04, 0.24, 0.76, 5.84);
    block(stripe, station, doorFace - lane.side * 0.13, 3.13, 0.10, 0.18, 5.62);
    block(bayDark, station, outer + lane.side * 1.94, 1.34, 0.16, 2.52, 5.60);
    block(lamps, station, doorFace + lane.side * 0.18, 3.02, 0.12, 0.075, 4.30);
    block(lamps, station, lane.stallCenter + lane.side * 1.65, 2.68, 0.08, 0.12, 1.1);
    block(steel, station + 0.52, lane.stallCenter + lane.side * 2.07, 1.36, 0.14, 2.72, 0.12);
    block(steel, station, lane.stallCenter + lane.side * 1.60, 2.65, 1.08, 0.14, 0.16);
    pitSign(scene, track, station, doorFace - lane.side * 0.18, shift === 0 ? label('pitYourBay') : String(index + 1).padStart(2, '0'),
      accentColor, 3.17, lane.side * Math.PI / 2);
    const stack = track.at(station + 1.8, doorFace - lane.side * 0.72);
    for (let row = 0; row < 5; row++) {
      wheel.position.set(stack.x, 0.115 + row * 0.192, stack.z);
      wheel.updateMatrix();
      stacks.setMatrixAt(index * 5 + row, wheel.matrix);
    }
    if (index % 2 === 0) {
      const monitor = lane.wallOffset + lane.side * 0.39;
      block(bayDark, station - 1, monitor, 1.26, 0.54, 0.40, 2.12);
      block(steel, station - 1, monitor, 2.10, 0.84, 0.10, 2.36);
      block(steel, station - 1.98, monitor, 1.65, 0.09, 0.86, 0.08);
      block(steel, station - 0.02, monitor, 1.65, 0.09, 0.86, 0.08);
    }
  });
  stacks.castShadow = true;
  scene.add(stacks);
}

export function addPitView(scene, track, assets, label) {
  const lane = track.pit;
  const pavement = new T.MeshStandardMaterial({ color: '#62666c', map: assets.asphalt, roughness: 0.90, side: T.DoubleSide });
  const blue = new T.MeshStandardMaterial({ color: '#46dff1', roughness: 0.72, side: T.DoubleSide });
  const white = new T.MeshStandardMaterial({ color: '#f0e1bf', roughness: 0.82, side: T.DoubleSide });
  const boxColor = new T.MeshStandardMaterial({ color: '#ffc157', emissive: '#ffae46', emissiveIntensity: 0.37, roughness: 0.72, side: T.DoubleSide });
  const steel = new T.MeshStandardMaterial({ color: '#66747c', roughness: 0.68, metalness: 0.48 });
  const post = new T.MeshStandardMaterial({ color: '#f27536', roughness: 0.78 });
  const boxGeometry = new T.BoxGeometry(1, 1, 1);
  function block(material, station, offset, height, width, size, depth, rotation = 0) {
    const point = track.at(station, offset);
    const mesh = new T.Mesh(boxGeometry, material);
    mesh.position.set(point.x, height, point.z);
    mesh.rotation.y = point.yaw + rotation;
    mesh.scale.set(width, size, depth);
    mesh.castShadow = depth > 0.08 && height > 0.08;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  const outside = station => lane.offsetAt(station) + lane.side * (lane.widthAt(station) - 0.04);
  const inside = station => lane.offsetAt(station) - lane.side * (lane.widthAt(station) - 0.04);
  scene.add(ribbon(track, lane.entry, lane.exit, lane.offsetAt, station => lane.widthAt(station) * 2, 0.010, pavement));
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
  for (const stall of [lane.box - 12, lane.box - 6, lane.box, lane.box + 6, lane.box + 12]) {
    const material = stall === lane.box ? boxColor : white;
    const stallPath = station => lane.stallCenter + lane.side * (station - stall) * 0.20;
    for (const shift of [-1.08, 1.08]) scene.add(ribbon(track, stall - 2.6, stall + 2.6, station => stallPath(station) + shift, 0.082, 0.024, material));
    for (const tip of [-2.6, 2.6]) scene.add(ribbon(track, stall + tip, stall + tip + 0.09, stallPath, 2.22, 0.024, material));
  }
  wallAndFence(scene, track, block, steel);
  pitBuildings(scene, track, block, steel, label);
  pitSign(scene, track, lane.entry + 3, outside(lane.entry + 3) + lane.side * 0.25, label('pitEntry'), '#66e0ee');
  pitSign(scene, track, lane.speedLine, outside(lane.speedLine) + lane.side * 0.38, '80 km/h', '#66e0ee');
  pitSign(scene, track, lane.box + 2, lane.stallCenter + lane.side * 2.03, label('pitBox'), '#ffcb74');
  pitSign(scene, track, lane.exit - 9, outside(lane.exit - 9) + lane.side * 0.38, label('pitExit'), '#66e0ee');
  return wetness => {
    pavement.roughness = 0.88 - wetness * 0.64;
    pavement.envMapIntensity = 1 + wetness;
  };
}
