import * as T from 'three';

function timingScreens() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0b1822';
  ctx.fillRect(0, 0, 256, 144);
  ctx.fillStyle = '#78cbea';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('S1   S2   S3', 12, 27);
  ctx.fillStyle = '#b8d9da';
  ctx.font = '14px monospace';
  for (const [row, channel] of ['01  ▪▪▪▪▪▪', '02  ▪▪▪▪▪', '03  ▪▪▪▪'].entries()) {
    ctx.fillText(channel, 12, 61 + row * 28);
  }
  for (const [row, color] of ['#579dba', '#67bba8', '#dbb172'].entries()) {
    ctx.fillStyle = color;
    ctx.fillRect(151, 51 + row * 28, 91 - row * 13, 9);
  }
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  return new T.MeshBasicMaterial({ map });
}

export function addPitEquipment({ block, part, side }) {
  const metal = new T.MeshStandardMaterial({ color: '#a7b1b3', metalness: 0.69, roughness: 0.45 });
  const frame = new T.MeshStandardMaterial({ color: '#344450', metalness: 0.44, roughness: 0.62 });
  const casing = new T.MeshStandardMaterial({ color: '#282e35', roughness: 0.77 });
  const rubber = new T.MeshStandardMaterial({ color: '#181a1c', roughness: 0.96 });
  const extinguisher = new T.MeshStandardMaterial({ color: '#d14032', roughness: 0.48 });
  const gas = new T.MeshStandardMaterial({ color: '#3c9b9e', metalness: 0.25, roughness: 0.51 });
  const compounds = ['#f0d9a6', '#dda331', '#c84644', '#68a4d1']
    .map(color => new T.MeshStandardMaterial({ color, roughness: 0.74, side: T.DoubleSide }));
  const glow = timingScreens();
  const tire = new T.LatheGeometry([[0.213, -0.127], [0.286, -0.127], [0.323, -0.110],
    [0.346, -0.073], [0.348, 0.073], [0.323, 0.112], [0.286, 0.127], [0.213, 0.127]]
    .map(([radius, height]) => new T.Vector2(radius, height)), 20);
  const band = new T.RingGeometry(0.288, 0.303, 20).rotateX(-Math.PI / 2);
  const cylinder = new T.CylinderGeometry(0.5, 0.5, 1, 12);
  const tireUpright = tire.clone().rotateZ(Math.PI / 2);
  const bandUpright = band.clone().rotateZ(Math.PI / 2);
  const rim = new T.TorusGeometry(0.217, 0.023, 6, 18).rotateY(Math.PI / 2);
  const hub = new T.CylinderGeometry(0.071, 0.071, 0.22, 8).rotateZ(Math.PI / 2);
  const caster = cylinder.clone().rotateX(Math.PI / 2);
  const screen = new T.PlaneGeometry(1, 1).rotateY(side * Math.PI / 2);

  function garage(station, face, accent, layout) {
    const box = (material, z, x, ...dimensions) => block(material, station + z, face + side * x, ...dimensions);
    const shape = (geometry, material, z, x, ...dimensions) =>
      part(geometry, material, station + z, face + side * x, ...dimensions);

    const cart = 1.98 * layout;
    box(frame, cart, -0.67, 0.19, 0.83, 0.13, 1.48);
    box(accent, cart, -0.67, 0.263, 0.78, 0.028, 1.39);
    for (const z of [cart - 0.57, cart + 0.57]) {
      for (const x of [-0.99, -0.35]) shape(caster, rubber, z, x, 0.10, 0.19, 0.19, 0.075);
    }
    box(frame, cart, -0.28, 0.56, 0.075, 0.70, 0.078);
    box(metal, cart, -0.28, 0.92, 0.08, 0.048, 1.38);
    for (const z of [cart - 0.36, cart + 0.36]) for (let row = 0; row < 3; row++) {
      const height = 0.405 + row * 0.239;
      shape(tire, rubber, z, -0.70, height, 1, 1, 1);
      shape(band, compounds[(row + (layout > 0 ? 1 : 0)) % compounds.length],
        z, -0.70, height + 0.119, 1, 1, 1, 0, false);
    }

    const rack = -1.62 * layout;
    for (const z of [rack - 0.96, rack + 0.96]) {
      for (const x of [0.82, 1.41]) box(frame, z, x, 0.83, 0.055, 1.64, 0.056);
    }
    for (const level of [0.27, 1.02]) {
      for (const x of [0.83, 1.4]) box(metal, rack, x, level, 0.063, 0.06, 1.99);
      for (const z of [rack - 0.66, rack, rack + 0.66]) {
        const height = level + 0.34;
        shape(tireUpright, rubber, z, 1.10, height, 1, 1, 1);
        shape(bandUpright, compounds[level > 1 ? 3 : 1], z, 0.981, height, 1, 1, 1, 0, false);
        shape(rim, metal, z, 0.989, height, 1, 1, 1);
        shape(hub, casing, z, 1.071, height, 1, 1, 1);
      }
    }

    const cabinet = 1.47 * layout;
    box(accent, cabinet, 2.70, 0.57, 0.58, 1.04, 1.61);
    box(casing, cabinet, 2.70, 1.11, 0.65, 0.085, 1.73);
    for (const y of [0.25, 0.45, 0.65, 0.85]) {
      box(frame, cabinet, 2.39, y, 0.056, 0.17, 1.51);
      box(metal, cabinet, 2.34, y + 0.045, 0.044, 0.025, 0.68);
    }
    box(casing, cabinet, 2.76, 1.46, 0.11, 0.55, 1.03);
    shape(screen, glow, cabinet, 2.70, 1.46, 1, 0.49, 0.96, 0, false);
    box(frame, 0, 2.96, 1.30, 0.58, 0.10, 1.16);
    box(metal, 0, 2.99, 0.85, 0.08, 0.85, 0.08);
    box(casing, 0, 3.40, 1.99, 0.045, 0.88, 1.52);
    for (const z of [-0.55, -0.31, 0.22, 0.46]) box(metal, z, 3.35, 1.97 + z * 0.25, 0.035, 0.32, 0.071);

    for (const [z, x, tankHeight, material] of [[-2.53 * layout, -0.18, 0.76, extinguisher],
      [2.55 * layout, 1.04, 1.11, gas], [2.23 * layout, 1.04, 1.11, gas]]) {
      shape(cylinder, material, z, x, tankHeight / 2 + 0.04, 0.224, tankHeight, 0.224);
      shape(cylinder, metal, z, x, tankHeight + 0.06, 0.108, 0.086, 0.108);
      box(casing, z, x, tankHeight + 0.133, 0.15, 0.041, 0.055);
    }
    box(casing, -0.06 * layout, 1.0, 0.071, 0.43, 0.12, 0.89);
    box(extinguisher, -0.06 * layout, 1.0, 0.13, 0.31, 0.09, 0.58);
    box(metal, -0.39 * layout, 1.0, 0.23, 0.05, 0.35, 0.06);
  }

  function timingStand(station, offset) {
    block(frame, station, offset, 1.13, 0.64, 0.32, 2.40);
    block(metal, station, offset + side * 0.04, 1.32, 0.63, 0.062, 2.44);
    for (const z of [-1.13, 1.13]) block(frame, station + z, offset, 1.68, 0.072, 1.20, 0.07);
    block(frame, station, offset + side * 0.08, 2.28, 0.80, 0.12, 2.63);
    for (const z of [-0.70, 0, 0.70]) {
      block(casing, station + z, offset, 1.61, 0.14, 0.37, 0.62);
      part(screen, glow, station + z, offset + side * 0.072, 1.61, 1, 0.30, 0.55, Math.PI, false);
    }
  }

  return { garage, timingStand };
}
