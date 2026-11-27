export const electronics = [
  { id: 'launch', cost: 680, label: 'launchControl', detail: 'launchDetail' },
  { id: 'traction', cost: 820, label: 'tractionControl', detail: 'tractionDetail' },
  { id: 'abs', cost: 750, label: 'absControl', detail: 'absDetail' },
  { id: 'diff', cost: 940, label: 'diffControl', detail: 'diffDetail' },
];
export const tractionModes = ['off', 'low', 'medium', 'high'];
export const normalizeElectronics = input => Object.fromEntries(electronics.map(({ id }) =>
  [id, Number.isInteger(input?.[id]) ? Math.max(0, Math.min(3, input[id])) : 0]));
export const tractionMode = value => tractionModes.includes(value) ? value : 'medium';

const bound = (value, min, max) => Math.min(max, Math.max(min, value));
const limits = { off: Infinity, low: 0.235, medium: 0.17, high: 0.12 };

export function launchRPM(level, gas, brake) {
  return level > 0 && gas && !brake ? 3850 + level * 460 : 0;
}
const drivenSlip = wheel => wheel ? Math.max(0, -wheel.ratio, Math.abs(wheel.angle) * 0.75) : 0;

export function regulateVehicle(car, controls, handling) {
  const brake = bound(Number(controls.brake) || 0, 0, 1);
  const gas = brake ? 0 : bound(Number(controls.gas) || 0, 0, 1);
  const available = handling.ecu;
  const speed = Math.max(0, car.speed);
  const throttleMap = available?.traction ? limits[controls.tcMode ?? handling.tcMode] ?? limits.medium : Infinity;
  const rpm = controls.launch && speed < 18 ? launchRPM(available?.launch ?? 0, gas, brake) : 0;
  const tyreGrip = (car.tireGrip ?? 1) * handling.surfaceGrip;
  const rearSlip = Math.max(drivenSlip(car.wheels?.[0]), drivenSlip(car.wheels?.[2]));
  const steering = Math.max(Math.abs(car.steer), Math.abs(controls.steering || 0) * 0.65);
  const demand = handling.acceleration * gas * Math.max(0, 1 - speed / (handling.topSpeed + 8));
  const capacity = (11.4 + (handling.grip - 8.8) * 0.44 + Math.min(5, speed * 0.135)) *
    tyreGrip * (car.onRoad ? 1 : 0.63) * (1 - steering * Math.min(0.50, speed / 85));
  const slipDemand = bound((demand / Math.max(2.4, capacity) - 0.87) * 0.74, 0, 0.85);
  const limit = rpm ? Math.max(0.095, 0.19 - available.launch * 0.026) : throttleMap;
  const controlled = Math.max(slipDemand, rearSlip);
  const driveCut = gas && controlled > limit && speed > -0.1 ?
    bound((controlled - limit) * (rpm ? 0.31 + available.launch * 0.057 : 0.43 + available.traction * 0.12), 0, 0.35) : 0;
  const spin = Math.max(0, slipDemand - driveCut * (rpm ? 1.26 + available.launch * 0.20 : 1.4));
  const driveGrip = 1 - Math.max(0, spin - 0.11) * (rpm ? 1.17 - available.launch * 0.19 : 1.18);
  const bias = 0.60 + handling.brakeStability / 9;
  let abs = false;
  let brakeForce = 0;
  const pressure = [0, 0, 0, 0];
  const locks = [0, 0, 0, 0];
  if (brake > 0 && speed > 0) {
    for (let index = 0; index < 4; index++) {
      const wheel = car.wheels?.[index];
      const front = index % 2 === 1;
      const transfer = front ? bias * 1.55 : (1 - bias) * 2.18;
      const grip = (wheel?.grip ?? car.tireGrip ?? 1) * handling.surfaceGrip * (0.92 + (handling.grip - 8.8) * 0.026);
      const limit = Math.max(0.28, 0.79 * grip * (wheel?.onRoad || !wheel?.speed ? 1 : 0.57) -
        (Math.abs(wheel?.angle ?? 0) * 0.48));
      const requested = brake * transfer;
      const ceiling = limit + (available?.abs ? Math.max(0.012, 0.055 - available.abs * 0.013) : 1);
      pressure[index] = available?.abs && speed > 3.1 ? Math.min(requested, ceiling) : requested;
      locks[index] = bound((pressure[index] - limit) * 2.17, 0, 0.89);
      if (pressure[index] + 0.006 < requested) abs = true;
      const sliding = 1 - locks[index] * 0.78;
      brakeForce += pressure[index] / transfer * sliding * (front ? bias : 1 - bias) * 0.5;
    }
  }
  const diff = available?.diff ?? 0;
  const requestedYaw = -car.steer * handling.turn * (2.15 / (1 + speed * 0.027));
  const alignmentError = requestedYaw - (car.yawRate ?? requestedYaw);
  const vector = diff * Math.min(1, speed / 18) * (0.15 * gas + 0.07 * brake) *
    bound(alignmentError * 0.9 + requestedYaw * 0.36 - car.lateral * 0.04, -1, 1);
  return { gas: gas * (1 - driveCut), brake, brakeForce, brakePressure: pressure, driveGrip, spin: gas ? spin : 0, locks,
    vector: controls.handbrake ? 0 : vector, abs, tc: !rpm && driveCut > 0.018, rpm };
}
