const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const engineWarning = 110;
export const enginePowerFactor = car => 1 - 0.24 * clamp(((car.engineTemperature ?? 86) - engineWarning) / 27, 0, 1);

export function restoreEngineTemperature(car, value) {
  car.engineTemperature = Number.isFinite(value) ? clamp(value, 30, 158) : 86;
}

export function updateEngineTemperature(car, draft, wetness, dt) {
  const speed = Math.max(0, car.speed);
  const throttle = car.actuation?.gas ?? 0;
  const rpm = clamp(speed / 41 + throttle * 0.25, 0, 1);
  const radiator = clamp((car.frontDamage ?? 0) * 0.87 + (car.damage ?? 0) * 0.002, 0, 0.88);
  const air = clamp(speed / 36, 0, 1);
  const load = (14 + 16 * rpm) * throttle;
  const target = 86 + load + radiator * (13 + throttle * 21) + draft * 13 - air * (7 - draft * 5) - wetness * 5;
  const rate = (0.034 + air * 0.038) * (1 - radiator * 0.43) * (target < car.engineTemperature ? 1.15 : 1);
  car.engineTemperature += (target - car.engineTemperature) * -Math.expm1(-rate * dt);
}
