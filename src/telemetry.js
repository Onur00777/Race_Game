import { advanceVehicle } from './vehicle-physics.js';
import { createTires, updateTires } from './tires.js';

const step = 1 / 120;
const target = 100 / 3.6;
const road = { offset: 0, dx: 0, dz: 1 };

export function estimateStints(handling, condition) {
  const makeCar = speed => ({ ...condition, x: 0, z: 0, steer: 0, yaw: 0, lateral: 0, spin: 0, speed, onRoad: true, wheels: createTires() });
  const run = (car, controls) => {
    advanceVehicle(car, controls, handling, step, false);
    updateTires(car, controls, handling, road, 20, step);
  };
  const accelCar = makeCar(0);
  let time = 0;
  for (; time < 16 && accelCar.speed < target; time += step) run(accelCar, { gas: 1, steering: 0, launch: time < 3.6 });
  const acceleration = accelCar.speed >= target ? time : Infinity;
  const brakeCar = makeCar(target);
  for (let i = 0; i < 700 && brakeCar.speed > 0.05; i++) run(brakeCar, { gas: 0, brake: 1, steering: 0 });
  const corner = makeCar(26);
  let rotation = 0;
  for (let i = 0; i < 100; i++) {
    run(corner, { gas: 0.58, steering: 0.34 });
    if (i > 38) rotation += Math.abs(corner.yawRate);
  }
  return { acceleration, stopping: brakeCar.z, rotation: rotation / 61 };
}
