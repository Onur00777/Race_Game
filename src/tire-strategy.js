const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export const compounds = [
  { id: 'soft', name: ['Yumuşak', 'Soft'], color: '#ff5758', grip: 0.83, rolling: -1.05, wear: 0.000170, wetLoss: 0.56, lifeLoss: 0.45, heat: 0.7 },
  { id: 'medium', name: ['Orta', 'Medium'], color: '#f0cd47', grip: 0, rolling: 0, wear: 0.000101, wetLoss: 0.51, lifeLoss: 0.40, heat: 0.48 },
  { id: 'hard', name: ['Sert', 'Hard'], color: '#edf2f6', grip: -0.61, rolling: 1.12, wear: 0.000055, wetLoss: 0.55, lifeLoss: 0.35, heat: 0.35 },
  { id: 'rain', name: ['Yağmur', 'Rain'], color: '#5bbaff', grip: -1.35, rolling: -0.85, wear: 0.000092, wetLoss: -0.14, lifeLoss: 0.46, heat: 1.32 },
];
export const compoundSpec = id => compounds.find(compound => compound.id === id) ?? compounds[1];
export const compoundId = id => compoundSpec(id).id;

export function fitTires(car, id, life, temperature) {
  car.compound = compoundId(id);
  car.tireSpeedDelta = compoundSpec(id).rolling;
  car.tireLife = Array.from({ length: 4 }, (_, index) => Number.isFinite(life?.[index]) ? clamp(life[index], 0, 1) : 1);
  car.tireTemperature = Number.isFinite(temperature) ? clamp(temperature, 0, 1) : 0;
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
  let grip = 0;
  for (const [index, wheel] of car.wheels.entries()) {
    wheel.grip = (1 + spec.grip / 11) * tireGripFactor(spec, car.tireLife[index], wetness, car.tireTemperature);
    grip += wheel.grip;
  }
  car.tireGrip = grip / 4;
}

export function wearTires(car, wetness, dt) {
  const spec = compoundSpec(car.compound);
  const speed = Math.abs(car.speed);
  const cornerLoad = clamp(Math.abs(car.yawRate ?? 0) * speed / 9.81, 0, 3);
  const slipHeat = Math.max(0, car.tireSlip ?? 0);
  const wetPenalty = spec.id === 'rain' ? (1 - wetness) ** 2 * 2.9 : 0;
  const targetHeat = clamp((speed / 39 * 0.50 + slipHeat * 0.46 + cornerLoad * 0.12) * spec.heat - wetness * 0.41, 0, 1);
  car.tireTemperature += (targetHeat - car.tireTemperature) * (1 - Math.exp(-dt * (targetHeat > car.tireTemperature ? 0.10 : 0.065)));
  for (const [index, wheel] of car.wheels.entries()) {
    const distance = wheel.speed * dt;
    const contact = wheel.onRoad ? 1 : 0.43;
    const scrub = Math.abs(wheel.ratio) * 1.8 + Math.sin(Math.abs(wheel.angle)) * 1.3;
    const heat = car.tireTemperature ** 2 * (spec.id === 'rain' ? 2.1 : 0.65);
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
