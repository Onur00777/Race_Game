import { velocity } from './contact.js';

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const approach = (value, target, amount) => value + clamp(target - value, -amount, amount);
export const angleBetween = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export function advanceVehicle(car, controls, handling, dt, canReverse = false) {
  const brake = clamp(Number(controls.brake) || 0, 0, 1);
  const gas = brake ? 0 : clamp(Number(controls.gas) || 0, 0, 1);
  const handbrake = Boolean(controls.handbrake);
  const draft = controls.draft ?? 0;
  const { topSpeed, acceleration, braking, surfaceGrip, grip, turn, brakeStability, load } = handling;
  const power = 1 - car.damage * 0.0028;
  const maximum = topSpeed * (1 - car.damage * 0.002) + draft * 2.4;
  const effectiveBrake = braking * surfaceGrip;
  if (gas) {
    const force = car.speed < 0 ? effectiveBrake : acceleration * power * (1.0 + draft * 0.097) *
      Math.max(0, 1 - Math.max(0, car.speed) / (maximum + 8));
    car.speed += gas * force * dt;
  } else if (brake) {
    if (car.speed > 0) car.speed = Math.max(0, car.speed - brake * effectiveBrake * dt);
    else if (canReverse && car.speed > -8) car.speed = Math.max(-8, car.speed - brake * 7 * dt);
  }
  const limit = car.onRoad ? maximum : 12;
  if (car.speed > limit) car.speed = approach(car.speed, limit, (car.onRoad ? 13 : 32) * dt);
  if ((!gas && !brake) || handbrake) car.speed = approach(car.speed, 0, (handbrake ? 14 : 2.8) * dt);

  const speed = Math.abs(car.speed);
  car.steer += (clamp(controls.steering, -1, 1) - car.steer) * (1 - Math.exp(-dt * 8));
  const steerRate = car.steer * turn * Math.min(speed / 5, 1) * (2.15 / (1 + speed * 0.027));
  const rotation = -steerRate * Math.sign(car.speed) * dt;
  car.yawRate = rotation * (handbrake ? 1.25 : 1) / dt + car.spin;
  car.yaw += car.yawRate * dt;
  car.spin *= Math.exp(-(car.onRoad ? 4.3 : 2.65) * dt);
  car.lateral -= car.speed * Math.sin(rotation) * (handbrake ? 1.08 : 0.52);
  const aeroGrip = load * 0.021 * (speed / 42) ** 2;
  const damping = (grip + aeroGrip + brake * brakeStability) * (1 - car.damage * 0.0019) * surfaceGrip;
  car.lateral *= Math.exp(-(handbrake ? 1.55 : damping) * (car.onRoad ? 1 : 0.56) * dt);
  const motion = velocity(car);
  car.x += motion.x * dt;
  car.z += motion.z * dt;
}
