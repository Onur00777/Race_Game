import { wheelMounts } from './tires.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smooth = (value, lo, hi) => { const t = clamp((value - lo) / (hi - lo), 0, 1); return t * t * (3 - 2 * t); };
const cornerNames = ['RR', 'FR', 'RL', 'FL'];
export const wheelLabel = index => cornerNames[index];

export function normalizeCorners(raw) {
  return wheelMounts.map((_, index) => {
    const corner = raw?.[index];
    const detached = corner?.detached === true;
    return { damage: detached ? 1 : Number.isFinite(corner?.damage) ? clamp(corner.damage, 0, 1) : 0,
      punctured: detached || corner?.punctured === true, detached };
  });
}

export function cornerContact(car, index) {
  const mount = wheelMounts[index];
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  return { x: car.x + fx * mount.z + fz * mount.x, z: car.z + fz * mount.z - fx * mount.x,
    nx: fz * Math.sign(mount.x), nz: -fx * Math.sign(mount.x) };
}

export function puncture(car, index) {
  const corner = car.corners[index];
  if (corner.punctured || corner.detached) return false;
  corner.punctured = true;
  car.tireLife[index] = 0;
  return true;
}

export function inspectWheelImpact(car, impact, anotherCar) {
  if (impact.normalSpeed < 7) return null;
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  const dx = impact.x - car.x, dz = impact.z - car.z;
  const x = fz * dx - fx * dz;
  const z = fx * dx + fz * dz;
  let index = -1;
  let influence = 0;
  for (const [i, wheel] of wheelMounts.entries()) {
    const distance = Math.hypot((x - wheel.x) * 0.92, (z - wheel.z) * 0.96);
    const proximity = (1 - smooth(distance, 0.31, 1.27)) * smooth(Math.abs(x), 0.29, 0.78);
    if (proximity > influence) { influence = proximity; index = i; }
  }
  if (index < 0 || influence < 0.09 || car.corners[index].detached) return null;
  const sideContact = Math.abs(impact.nx * fz - impact.nz * fx);
  const load = influence * (0.72 + sideContact * 0.28);
  const force = (impact.normalSpeed - 5.5) ** 2 * (anotherCar ? 0.00108 : 0.00172) * load;
  if (force < 0.015) return null;
  const corner = car.corners[index];
  corner.damage = clamp(corner.damage + force, 0, 1);
  const flat = (force >= (anotherCar ? 0.53 : 0.47) || corner.damage >= 0.70 && force >= 0.07) && puncture(car, index);
  return { index, flat, load, force };
}

export function wheelGripFactor(corner) {
  if (corner?.detached) return 0.04;
  if (corner?.punctured) return 0.18;
  return 1 - clamp(((corner?.damage ?? 0) - 0.30) * 0.43, 0, 0.31);
}

export function suspensionEffects(corners) {
  let pull = 0;
  let flats = 0;
  for (let i = 0; i < 4; i++) {
    const wheel = corners?.[i];
    if (!wheel) continue;
    const flat = wheel.punctured || wheel.detached;
    if (flat) flats++;
    const load = Math.max(0, wheel.damage - 0.30) * 0.14 + (flat ? 0.15 : 0);
    pull += Math.sign(wheelMounts[i].x) * load * (wheelMounts[i].front ? 1 : 0.66);
  }
  return { pull, speedLimit: !flats ? Infinity : Math.max(9, 17.2 - (flats - 1) * 3.6) };
}
