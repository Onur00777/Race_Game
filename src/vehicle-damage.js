import { carLength, carWidth } from './contact.js';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const portion = (value, maximum) => Number.isFinite(value) ? clamp(value, 0, maximum) : 0;

export const damageZones = ['frontDamage', 'rearDamage', 'leftDamage', 'rightDamage'];

export function vehicleCondition(value) {
  return {
    damage: portion(value?.damage, 100),
    ...Object.fromEntries(damageZones.map(zone => [zone, portion(value?.[zone], 1)])),
    hoodDamage: portion(value?.hoodDamage ?? (value?.frontDamage ?? 0) * 0.53, 1),
    splitterDamage: portion(value?.splitterDamage, 1),
    wingDamage: portion(value?.wingDamage, 1),
  };
}

export function integrity(car) {
  const wear = portion(car?.damage, 100);
  return wear === 100 ? 0 : Math.max(1, Math.floor(100 - wear));
}
const exposure = { frontDamage: 1.07, rearDamage: 0.91, leftDamage: 1.0, rightDamage: 1.0 };

export function applyImpact(car, impact, flipped = false, anotherCar = false) {
  if (impact.normalSpeed < 3.7 || car.damage >= 100) return null;
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  const dx = impact.x - car.x, dz = impact.z - car.z;
  const sign = flipped ? -1 : 1;
  const along = (fx * dx + fz * dz) / (carLength / 2);
  const side = (fz * dx - fx * dz) / (carWidth / 2);
  const nose = along * 0.59 + (impact.nx * fx + impact.nz * fz) * sign * 0.41;
  const flank = side * 0.59 + (impact.nx * fz - impact.nz * fx) * sign * 0.41;
  const longitudinal = nose >= 0 ? 'frontDamage' : 'rearDamage';
  const lateral = flank >= 0 ? 'leftDamage' : 'rightDamage';
  const zone = Math.abs(nose) >= Math.abs(flank) ? longitudinal : lateral;
  const adjacent = zone === longitudinal ? lateral : longitudinal;
  const secondary = Math.min(Math.abs(nose), Math.abs(flank)) / Math.max(Math.max(Math.abs(nose), Math.abs(flank)), 0.001);
  const alignment = impact.normalSpeed / Math.max(impact.relativeSpeed, impact.normalSpeed);
  const energy = (impact.normalSpeed - 3.7) ** 2 * (anotherCar ? 0.040 : 0.057);
  const amount = Math.min(100 - car.damage, energy * (0.64 + alignment * 0.36) * exposure[zone]);
  if (amount < 0.12) return null;
  car.damage += amount;
  car[zone] = Math.min(1, (car[zone] ?? 0) + amount * (1 - secondary * 0.30) / 48);
  car[adjacent] = Math.min(1, (car[adjacent] ?? 0) + amount * secondary * 0.32 / 55);
  const parts = [];
  if (zone === 'frontDamage') {
    car.hoodDamage = Math.min(1, (car.hoodDamage ?? 0) + amount * 0.024);
    const prior = car.splitterDamage ?? 0;
    car.splitterDamage = Math.min(1, prior + amount * (0.012 + alignment * 0.015));
    if (prior < 1 && car.splitterDamage === 1) parts.push('splitter');
  } else if (zone === 'rearDamage') {
    const prior = car.wingDamage ?? 0;
    car.wingDamage = Math.min(1, prior + amount * (0.008 + alignment * 0.024));
    if (prior < 1 && car.wingDamage === 1) parts.push('wing');
  }
  return { zone, amount, alignment, parts };
}

const fresh = { power: 1, speed: 1, grip: 1, aero: 1, drag: 0, pull: 0 };

export function damagePerformance(car) {
  const wear = portion(car.damage, 100);
  const wing = portion(car.wingDamage, 1);
  const splitter = portion(car.splitterDamage, 1);
  const hardware = wing === 1 ? 0 : (1 - wing * 0.45) * (1 - splitter * 0.23);
  if (wear <= 30) return hardware === 1 ? fresh : { ...fresh, aero: hardware };
  if (wear <= 60) {
    const affected = (wear - 30) / 30;
    return { power: 1, speed: 1 - affected * 0.126, grip: 1 - affected * 0.14,
      aero: hardware * (1 - affected * 0.18), drag: affected * 0.63, pull: 0 };
  }
  const critical = (wear - 60) / 40;
  const imbalance = (car.leftDamage ?? 0) - (car.rightDamage ?? 0);
  const asymmetry = Math.abs(imbalance) > 0.035 ? imbalance : 0;
  return {
    power: wear >= 100 ? 0 : 0.82 - critical * 0.49,
    speed: 0.874 - critical * 0.28,
    grip: 0.86 - critical * 0.26,
    aero: hardware * (0.82 - critical * 0.61),
    drag: 0.63 + critical * 1.38,
    pull: asymmetry * (0.045 + critical * 0.096),
  };
}
