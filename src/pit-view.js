import * as T from 'three';

function ribbon(track, start, end, offset, width, height, material) {
  const count = Math.max(1, Math.ceil((end - start) / 1.25));
  const positions = [], uv = [], triangles = [];
  for (let i = 0; i <= count; i++) {
    const station = T.MathUtils.lerp(start, end, i / count);
    for (const side of [-1, 1]) {
      const position = track.at(station, offset(station) + side * width / 2);
      positions.push(position.x, height, position.z);
      uv.push((side + 1) / 2 * width / 4, station / 4);
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

function pitSign(scene, track, station, offset, text, color) {
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
  sign.position.set(point.x, 1.54, point.z);
  sign.rotation.y = point.yaw + Math.PI;
  scene.add(sign);
}

export function addPitView(scene, track, assets, label) {
  const lane = track.pit;
  const pavement = new T.MeshStandardMaterial({ color: '#62666c', map: assets.asphalt, roughness: 0.90, side: T.DoubleSide });
  const blue = new T.MeshStandardMaterial({ color: '#46dff1', roughness: 0.72, side: T.DoubleSide });
  const white = new T.MeshStandardMaterial({ color: '#f0e1bf', roughness: 0.82, side: T.DoubleSide });
  const boxColor = new T.MeshStandardMaterial({ color: '#ffc157', roughness: 0.72, side: T.DoubleSide });
  const outside = station => lane.offsetAt(station) + lane.side * (lane.halfWidth - 0.04);
  const inside = station => lane.offsetAt(station) - lane.side * (lane.halfWidth - 0.04);
  scene.add(ribbon(track, lane.entry, lane.exit, lane.offsetAt, lane.halfWidth * 2, 0.010, pavement));
  scene.add(ribbon(track, lane.entry, lane.exit, outside, 0.115, 0.021, blue));
  for (let s = lane.entry; s < lane.exit - 2.1; s += 4.9) scene.add(ribbon(track, s, s + 2.10, inside, 0.10, 0.021, white));
  for (const stall of [lane.box - 12, lane.box - 6, lane.box, lane.box + 6, lane.box + 12]) {
    const material = stall === lane.box ? boxColor : white;
    for (const shift of [-1.08, 1.08]) scene.add(ribbon(track, stall - 2.6, stall + 2.6, () => lane.center + shift, 0.082, 0.024, material));
    for (const tip of [-2.6, 2.6]) scene.add(ribbon(track, stall + tip, stall + tip + 0.09, () => lane.center, 2.22, 0.024, material));
  }
  const rail = lane.side * (track.railOffset - 0.25);
  pitSign(scene, track, lane.laneStart - 2, rail, label('pitEntry') + ' · 80', '#66e0ee');
  pitSign(scene, track, lane.box + 2, rail, label('pitBox'), '#ffcb74');
  pitSign(scene, track, lane.exit - 9, rail, label('pitExit'), '#66e0ee');
  return wetness => {
    pavement.roughness = 0.88 - wetness * 0.64;
    pavement.envMapIntensity = 1 + wetness;
  };
}
