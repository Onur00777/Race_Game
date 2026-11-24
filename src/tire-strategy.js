import { wheelMounts } from './tires.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export const compounds = [
  { id: 'soft', name: ['Yumuşak', 'Soft'], color: '#ff5758', grip: 0.83, rolling: -1.05, wear: 0.000170, wetLoss: 0.56, lifeLoss: 0.45, heat: 0.7 },
  { id: 'medium', name: ['Orta', 'Medium'], color: '#f0cd47', grip: 0, rolling: 0, wear: 0.000101, wetLoss: 0.51, lifeLoss: 0.40, heat: 0.48 },
  { id: 'hard', name: ['Sert', 'Hard'], color: '#edf2f6', grip: -0.61, rolling: 1.12, wear: 0.000055, wetLoss: 0.55, lifeLoss: 0.35, heat: 0.35 },
  { id: 'rain', name: ['Yağmur', 'Rain'], color: '#5bbaff', grip: -1.35, rolling: -0.85, wear: 0.000092, wetLoss: -0.14, lifeLoss: 0.46, heat: 1.32 },
];
export const compoundSpec = id => compounds.find(compound => compound.id === id) ?? compounds[1];
export const compoundId = id => compoundSpec(id).id;
export const tireTemperatureWindow = id => id === 'rain' ? [49, 76] :
  id === 'soft' ? [72, 103] : id === 'hard' ? [79, 112] : [74, 107];

export function fitTires(car, id, life, temperature) {
  car.compound = compoundId(id);
  car.tireSpeedDelta = compoundSpec(id).rolling;
  car.tireLife = Array.from({ length: 4 }, (_, index) => Number.isFinite(life?.[index]) ? clamp(life[index], 0, 1) : 1);
  const initial = car.compound === 'rain' ? 45 : 65;
  car.tireTemperatures = Array.from({ length: 4 }, (_, index) => Number.isFinite(temperature?.[index]) ?
    clamp(temperature[index], 12, 180) : Number.isFinite(temperature) ? initial + clamp(temperature, 0, 1) * 62 : initial);
  return car;
}

export const tireHealth = car => car.tireLife ? car.tireLife.reduce((sum, wheel) => sum + wheel, 0) / 4 : 1;

export function tireGripFactor(spec, life, wetness, temperature) {
  const wear = 1 - clamp(life, 0, 1);
  const falloff = spec.lifeLoss * wear ** 2.7;
  const dryHeat = spec.id === 'rain' ? temperature * (1 - wetness) * 0.18 : temperature * 0.05;
  return (1 - falloff) * (1 - spec.wetLoss * wetness) * (1 - dryHeat);
}

export function applyTireGrip(car, wetness) {
  const spec = compoundSpec(car.compound);
  const [cold, hot] = tireTemperatureWindow(spec.id);
  let grip = 0;
  for (const [index, wheel] of car.wheels.entries()) {
    const temp = car.tireTemperatures[index];
    const thermalGrip = 1 - Math.min(0.049, Math.max(0, cold - temp) * 0.0015) -
      Math.min(0.12, Math.max(0, temp - hot) * 0.0031);
    const heat = clamp((temp - 55) / 92, 0, 1);
    wheel.grip = (1 + spec.grip / 11) * tireGripFactor(spec, car.tireLife[index], wetness, heat) * thermalGrip;
    grip += wheel.grip;
  }
  car.tireGrip = grip / 4;
}

export function wearTires(car, wetness, dt) {
  const spec = compoundSpec(car.compound);
  const speed = Math.abs(car.speed);
  const cornerLoad = clamp(Math.abs(car.yawRate ?? 0) * speed / 9.81, 0, 3);
  const wetPenalty = spec.id === 'rain' ? (1 - wetness) ** 2 * 2.9 : 0;
  const ambient = 29 - wetness * 13;
  const [, hot] = tireTemperatureWindow(spec.id);
  const braking = car.actuation?.brakeForce ?? 0;
  for (const [index, wheel] of car.wheels.entries()) {
    const mount = wheelMounts[index];
    const distance = wheel.speed * dt;
    const contact = wheel.onRoad ? 1 : 0.43;
    const scrub = Math.abs(wheel.ratio) * 1.8 + Math.sin(Math.abs(wheel.angle)) * 1.3;
    const outside = clamp(-(car.yawRate ?? 0) * Math.sign(mount.x) * speed / 18, -0.36, 0.46);
    const rolling = clamp(wheel.speed / 29, 0, 1.22);
    const load = 43 * rolling + cornerLoad * 12 * (1 + outside);
    const brakeHeat = 25 * braking * rolling * (mount.front ? 1.25 : 0.74);
    const slipHeat = (wheel.slip ?? Math.abs(wheel.ratio)) * 37 + Math.max(0, -wheel.ratio) * 11;
    const target = ambient + (load + brakeHeat + slipHeat) * (spec.id === 'rain' ? 1.12 : 0.95 + spec.heat * 0.13) *
      contact * (1 - wetness * 0.23);
    const rate = target > car.tireTemperatures[index] ? 0.115 : 0.065 + wetness * 0.16 + rolling * 0.018;
    const temperature = clamp(car.tireTemperatures[index] + (target - car.tireTemperatures[index]) * -Math.expm1(-dt * rate), 12, 180);
    car.tireTemperatures[index] = temperature;
    const heat = Math.min(1.2, Math.max(0, temperature - hot) * (spec.id === 'rain' ? 0.028 : 0.017));
    const wear = distance * spec.wear * contact * (1 + cornerLoad * 0.23 + scrub + heat + wetPenalty);
    car.tireLife[index] = Math.max(0, car.tireLife[index] - wear);
  }
}

export function weatherTarget(event, lap) {
  let amount = event.wetness ?? 0;
  for (const change of event.forecast ?? []) {
    if (change.lap > lap) break;
    amount = change.wetness;
  }
  return clamp(amount, 0, 1);
}

export function recommendedCompound(wetness, laps) {
  if (wetness >= 0.37) return 'rain';
  if (laps >= 8) return 'hard';
  return laps >= 4 ? 'medium' : 'soft';
}
