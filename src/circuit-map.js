export function circuitMap(track, width, height, padding = 14) {
  const xs = track.samples.map(point => point.x);
  const zs = track.samples.map(point => point.z);
  const minX = Math.min(...xs);
  const minZ = Math.min(...zs);
  const spanX = Math.max(...xs) - minX;
  const spanZ = Math.max(...zs) - minZ;
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanZ);
  const dx = (width - spanX * scale) / 2;
  const dz = (height - spanZ * scale) / 2;
  const point = ({ x, z }) => [dx + (x - minX) * scale, dz + (z - minZ) * scale];
  const path = new Path2D();
  track.samples.forEach((sample, i) => i ? path.lineTo(...point(sample)) : path.moveTo(...point(sample)));
  path.closePath();
  return { path, point };
}

export function drawBriefingMap(canvas, track) {
  const { width, height } = canvas;
  const { path, point } = circuitMap(track, width, height, 24);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.lineJoin = ctx.lineCap = 'round';
  ctx.strokeStyle = '#5c718968';
  ctx.lineWidth = 10;
  ctx.stroke(path);
  ctx.strokeStyle = '#c4d5e5';
  ctx.lineWidth = 3.2;
  ctx.stroke(path);
  ctx.fillStyle = '#ff8b62';
  ctx.shadowColor = '#ff7043';
  ctx.shadowBlur = 9;
  ctx.beginPath();
  ctx.arc(...point(track.at(0)), 5, 0, 2 * Math.PI);
  ctx.fill();
}
