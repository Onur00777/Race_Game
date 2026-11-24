import { velocity } from './contact.js';
import { damagePerformance } from './vehicle-damage.js';
import { regulateVehicle } from './ecu.js';

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const approach = (value, target, amount) => value + clamp(target - value, -amount, amount);
export const angleBetween = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export function advanceVehicle(car, controls, handling, dt, canReverse = false) {
  const actuation = regulateVehicle(car, controls, handling);
  car.actuation = actuation;
  const { gas, brake, brakeForce, driveGrip, vector } = actuation;
  const handbrake = Boolean(controls.handbrake);
  const draft = controls.draft ?? 0;
  const { topSpeed, acceleration, braking, surfaceGrip, grip, turn, brakeStability, load } = handling;
  const condition = damagePerformance(car);
  const maximum = topSpeed * condition.speed + draft * 2.4;
  const roadGrip = surfaceGrip * (car.tireGrip ?? 1);
  const effectiveBrake = braking * roadGrip * (1 - (car.tireSlip ?? 0) * 0.11);
  if (gas) {
    const force = car.speed < 0 ? effectiveBrake : acceleration * condition.power * (1.0 + draft * 0.097) *
      Math.max(0, 1 - Math.max(0, car.speed) / (maximum + 8));
    car.speed += gas * force * driveGrip * dt;
  } else if (brake) {
    if (car.speed > 0) car.speed = Math.max(0, car.speed - brakeForce * effectiveBrake * dt);
    else if (canReverse && car.speed > -8) car.speed = Math.max(-8, car.speed - brake * 7 * dt);
  }
  const limit = car.onRoad ? maximum : 12;
  if (car.speed > limit) car.speed = approach(car.speed, limit, (car.onRoad ? 13 : 32) * dt);
  if ((!gas && !brake) || handbrake) car.speed = approach(car.speed, 0, (handbrake ? 14 : 2.8) * dt);
  car.speed = approach(car.speed, 0, condition.drag * (car.speed / 34) ** 2 * dt);

  const speed = Math.abs(car.speed);
  car.steer += (clamp(controls.steering, -1, 1) - car.steer) * (1 - Math.exp(-dt * 8));
  const frontLock = (actuation.locks[1] + actuation.locks[3]) * 0.5;
  const steerRate = car.steer * turn * Math.min(speed / 5, 1) * (2.15 / (1 + speed * 0.027)) * (1 - frontLock * 0.41);
  const rotation = -steerRate * Math.sign(car.speed) * dt;
  car.yawRate = rotation * (handbrake ? 1.25 : 1) / dt + car.spin + vector - condition.pull * clamp(speed / 27, 0, 1);
  car.yaw += car.yawRate * dt;
  car.spin *= Math.exp(-(car.onRoad ? 4.3 : 2.65) * dt);
  car.lateral -= car.speed * Math.sin(rotation) * (handbrake ? 1.08 : 0.52);
  const aeroGrip = load * condition.aero * 0.021 * (speed / 42) ** 2;
  const damping = (grip + aeroGrip + brake * brakeStability) * condition.grip *
    (1 - (car.tireSlip ?? 0) * 0.12) * roadGrip;
  car.lateral *= Math.exp(-(handbrake ? 1.55 : damping) * (car.onRoad ? 1 : 0.56) * dt);
  const motion = velocity(car);
  car.x += motion.x * dt;
  car.z += motion.z * dt;
}
