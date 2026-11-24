export const wheelRadius = 0.365;
export const wheelTrack = 0.828;
export const axles = [-1.29, 1.34];
export const wheelMounts = [-1, 1].flatMap(side => axles.map(axle => ({
  x: side * wheelTrack, z: axle, front: axle > 0,
})));

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const ramp = (value, low, high) => {
  const x = clamp((value - low) / (high - low), 0, 1);
  return x * x * (3 - 2 * x);
};

export function createTires() {
  return wheelMounts.map(() => ({ x: 0, z: 0, vx: 0, vz: 0, speed: 0, rolling: null, ratio: 0, angle: 0, slip: 0, onRoad: false }));
}

export function updateTires(car, controls, handling, road, halfWidth, dt) {
  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  const brake = clamp(Number(controls.brake) || 0, 0, 1);
  const frontBias = 0.60 + handling.brakeStability / 9;
  const treadGrip = Math.max(0.28, (car.tireGrip ?? 1) * handling.surfaceGrip * (0.92 + (handling.grip - 8.8) * 0.026));
  const yawRate = car.yawRate ?? 0;

  for (const [index, mount] of wheelMounts.entries()) {
    const wheel = car.wheels[index];
    const armX = fx * mount.z + fz * mount.x;
    const armZ = fz * mount.z - fx * mount.x;
    wheel.x = car.x + armX;
    wheel.z = car.z + armZ;
    wheel.onRoad = Math.abs(road.offset - road.dz * armX + road.dx * armZ) <= halfWidth + 0.08;
    const longitudinal = car.speed - yawRate * mount.x;
    const sideways = car.lateral + yawRate * mount.z;
    wheel.vx = fx * longitudinal + fz * sideways;
    wheel.vz = fz * longitudinal - fx * sideways;
    wheel.speed = Math.hypot(longitudinal, sideways);
    const angle = mount.front ? -car.steer * 0.30 : 0;
    const across = sideways * Math.cos(angle) - longitudinal * Math.sin(angle);
    const along = longitudinal * Math.cos(angle) + sideways * Math.sin(angle);
    const slipAngle = Math.atan2(across, Math.max(2.5, Math.abs(along)));
    const transfer = mount.front ? frontBias * 1.55 : (1 - frontBias) * 2.18;
    const localGrip = treadGrip * (wheel.onRoad ? 1 : 0.57);
    const capacity = Math.max(0.40, 0.79 * localGrip - Math.abs(slipAngle) * 0.48);
    const brakeLock = car.actuation?.locks[index] ?? clamp((brake * transfer - capacity) * 2.17, 0, 0.89);
    const lock = controls.handbrake && !mount.front ? 0.98 : brakeLock;
    const wheelspin = !mount.front && !controls.handbrake ? car.actuation?.spin ?? 0 : 0;
    const target = along * (1 - lock) + Math.max(5, along) * wheelspin;
    wheel.rolling = (wheel.rolling ?? along) + (target - (wheel.rolling ?? along)) *
      (1 - Math.exp(-dt * (lock > 0.1 ? 31 : 42)));
    wheel.ratio = (along - wheel.rolling) / Math.max(5, Math.abs(along));
    wheel.angle = slipAngle;
    const scrub = Math.max(ramp(Math.abs(wheel.ratio), 0.08, 0.51), ramp(Math.abs(slipAngle), 0.103, 0.30));
    wheel.slip = scrub * ramp(wheel.speed, 4.4, 11);
  }
  car.tireSlip = Math.max(...car.wheels.map(wheel => wheel.slip));
}
