import { tractionMode } from './ecu.js';
import { compoundId, compoundSpec } from './tire-strategy.js';
import { aeroAccess, partModel, partTier } from './hardware.js';
export { compounds } from './tire-strategy.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const number = (value, fallback, low, high) => Number.isFinite(value) ? clamp(value, low, high) : fallback;

export const wings = [
  { id: 'touring', level: 1, name: ['Touring', 'Touring'], load: 26, drag: 0.52 },
  { id: 'swan', level: 2, name: ['Kuğu boynu', 'Swan neck'], load: 43, drag: 0.88 },
  { id: 'twin', level: 3, name: ['Çift katlı', 'Twin element'], load: 61, drag: 1.42 },
];

export const sponsors = [
  { id: 'delta', brand: 'DELTA', color: '#77ecce', unlock: 0, payout: 160 },
  { id: 'vertex', brand: 'VERTEX', color: '#ffe293', unlock: 1, payout: 280 },
  { id: 'nova', brand: 'NOVA FUEL', color: '#ffb0a2', unlock: 2, payout: 420 },
];

export const decalSlots = [
  { id: 'hood', name: ['Kaput', 'Hood'], view: 'front' },
  { id: 'doors', name: ['Kapılar', 'Doors'], view: 'side' },
  { id: 'rear', name: ['Arka tampon', 'Rear bumper'], view: 'rear' },
];

export const sliders = [
  { id: 'gearing', name: ['Dişli oranı', 'Final drive'], min: -2, max: 2, step: 1, suffix: '', help: ['Pozitif değer daha kısa oran ve daha iyi hızlanma sağlar.', 'Positive values shorten the gearing and improve acceleration.'] },
  { id: 'frontCamber', name: ['Ön kamber', 'Front camber'], min: -4, max: 0, step: 0.5, suffix: '°', help: ['Viraj girişindeki ön aks tepkisini değiştirir.', 'Changes how the front axle responds on turn-in.'] },
  { id: 'rearCamber', name: ['Arka kamber', 'Rear camber'], min: -4, max: 0, step: 0.5, suffix: '°', help: ['Arka aks tutuşunu ve düz çizgide çekişi etkiler.', 'Changes rear grip and straight-line traction.'] },
  { id: 'brakeBias', name: ['Ön fren dengesi', 'Front brake bias'], min: 52, max: 68, step: 1, suffix: '%', help: ['%60 etrafı en kısa fren mesafesini verir.', 'Around 60% gives the shortest braking distance.'] },
  { id: 'downforce', name: ['Kanat açısı', 'Wing angle'], min: 0, max: 10, step: 1, suffix: '°', help: ['Daha fazla yere basma kuvveti, biraz daha düşük son hız.', 'More downforce at the cost of some top speed.'] },
];

export const defaultSetup = {
  gearing: 0, frontCamber: -1.5, rearCamber: -1, brakeBias: 60,
  downforce: 4, compound: 'medium', wing: 'touring', wingColor: '#263039', tcMode: 'medium',
};

export function normalizeSetup(input, aeroLevel) {
  const setup = { ...defaultSetup };
  for (const { id, min, max, step } of sliders) {
    const value = number(input?.[id], defaultSetup[id], min, max);
    setup[id] = Math.round(value / step) * step;
  }
  setup.compound = compoundId(input?.compound);
  if (wings.some(wing => wing.id === input?.wing && wing.level <= aeroLevel)) setup.wing = input.wing;
  if (/^#[\da-f]{6}$/i.test(input?.wingColor ?? '')) setup.wingColor = input.wingColor;
  setup.tcMode = tractionMode(input?.tcMode);
  return setup;
}

export function activeWing(setup, level) {
  return wings.find(wing => wing.id === setup.wing && wing.level <= level);
}

export function vehicleStats(team, parts, input, models) {
  const aeroTier = partTier('aero', models?.aero);
  const aeroLevel = aeroAccess(parts.aero, models?.aero);
  const setup = normalizeSetup(input, aeroLevel);
  const wing = activeWing(setup, aeroLevel);
  const compound = compoundSpec(setup.compound);
  const load = wing ? wing.load + setup.downforce * (3.1 + aeroLevel * 0.25) + (aeroLevel - wing.level) * 7 + aeroTier * 16 : 0;
  const drag = wing ? wing.drag + setup.downforce * 0.16 + (aeroLevel - wing.level) * 0.20 + aeroTier * 0.26 : 0;
  const rearBalance = 1.18 - Math.abs(setup.rearCamber + 1.5) * 0.43;
  const engine = partModel('engine', models?.engine);
  const power = parts.engine + partTier('engine', models?.engine) * 2.1;
  const chassis = partTier('tires', models?.tires);
  return {
    topSpeed: 54 + power * 3.35 + team.power - setup.gearing * 1.75 - drag + compound.rolling,
    acceleration: 13 + power * 1.78 + team.power * 0.45 + setup.gearing * 0.68 + rearBalance * 0.29,
    redline: engine.redline + parts.engine * 75, engine,
    braking: 24 + parts.brakes * 4.5 + partTier('brakes', models?.brakes) * 6 - Math.abs(setup.brakeBias - 60) * 0.28,
    grip: 8.72 + parts.tires * 0.85 + chassis * 1.05 + team.grip + compound.grip + rearBalance * 0.32,
    turn: 1.026 + chassis * 0.018 - Math.abs(setup.frontCamber + 2) * 0.040,
    brakeStability: (setup.brakeBias - 60) * 0.09,
    load,
  };
}

export function carAppearance(loadout) {
  const { setup, upgrades, sponsor, decals, models } = loadout;
  const wing = activeWing(setup, aeroAccess(upgrades.aero, models?.aero));
  return { wing: wing?.id ?? 'stock', wingColor: setup.wingColor, wingAngle: setup.downforce,
    frontCamber: setup.frontCamber, rearCamber: setup.rearCamber, sponsor, decals, parts: upgrades, models, compound: setup.compound };
}
