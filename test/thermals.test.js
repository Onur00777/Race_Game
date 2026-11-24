import test from 'node:test';
import assert from 'node:assert/strict';
import { fitTires, applyTireGrip, wearTires } from '../src/tire-strategy.js';
import { restoreEngineTemperature, updateEngineTemperature, enginePowerFactor } from '../src/thermals.js';
import { createTires } from '../src/tires.js';

test('braking and corner load heat the tires independently, while rain cools them', () => {
  const car = fitTires({ speed: 39, yawRate: 0.48, actuation: { brakeForce: 0.8 }, wheels: createTires() }, 'soft');
  for (const wheel of car.wheels) Object.assign(wheel, { speed: 39, slip: 0.36, ratio: 0.2, angle: 0.17, onRoad: true });
  for (let i = 0; i < 300; i++) wearTires(car, 0, 0.05);
  const dry = [...car.tireTemperatures];
  assert.ok(dry[1] > dry[0] && dry[1] > dry[3]);
  const life = [...car.tireLife];
  car.yawRate = 0;
  car.actuation = null;
  for (const wheel of car.wheels) Object.assign(wheel, { slip: 0, ratio: 0, angle: 0 });
  for (let i = 0; i < 300; i++) wearTires(car, 0.9, 0.05);
  assert.ok(car.tireTemperatures.every((temperature, i) => temperature < dry[i] - 12));
  assert.ok(car.tireLife.every((remaining, i) => remaining < life[i]));
  applyTireGrip(car, 0.9);
  assert.ok(car.wheels.every(wheel => Number.isFinite(wheel.grip)));
});

test('radiator damage and dirty air cause derating that clears when the driver lifts', () => {
  const healthy = { speed: 44, actuation: { gas: 1 }, damage: 0, frontDamage: 0 };
  const damaged = { ...healthy, damage: 28, frontDamage: 0.86 };
  for (const car of [healthy, damaged]) restoreEngineTemperature(car);
  for (let i = 0; i < 600; i++) {
    updateEngineTemperature(healthy, 0, 0, 0.1);
    updateEngineTemperature(damaged, 0.9, 0, 0.1);
  }
  assert.ok(damaged.engineTemperature > healthy.engineTemperature + 15 && enginePowerFactor(damaged) < 0.88);
  damaged.actuation = null;
  for (let i = 0; i < 600; i++) updateEngineTemperature(damaged, 0, 0, 0.1);
  assert.equal(enginePowerFactor(damaged), 1);
});

test('old normalized tire heat and new per-wheel degrees both restore', () => {
  const newCar = fitTires({}, 'medium', [0.5, 0.6, 0.7, 0.8], [79, 81, 86, 91]);
  assert.deepEqual(newCar.tireTemperatures, [79, 81, 86, 91]);
  assert.deepEqual(fitTires({}, 'medium', null, 0.5).tireTemperatures, [96, 96, 96, 96]);
});
