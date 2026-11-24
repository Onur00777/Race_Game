import test from 'node:test';
import assert from 'node:assert/strict';
import { buyElectronics, currentTeam, events, newCareer, normalizeLoadout } from '../src/career.js';
import { regulateVehicle } from '../src/ecu.js';
import { raceCheckpoint, restoreRace } from '../src/progress.js';
import { createRace, createTrack, raceStep } from '../src/race.js';
import { vehicleStats } from '../src/setup.js';
import { estimateStints } from '../src/telemetry.js';
import { createTires } from '../src/tires.js';
import { vehicleCondition } from '../src/vehicle-damage.js';

const career = newCareer();
const team = currentTeam(career);
const performance = { ...vehicleStats(team, { ...career.upgrades, engine: 3 }), surfaceGrip: 1 };

test('launch control reduces a tuned car’s 0–100 time and ABS shortens its measured stop', () => {
  const stock = estimateStints(performance, vehicleCondition());
  const overlaid = estimateStints({ ...performance, ecu: { launch: 3, abs: 2, diff: 2 } }, vehicleCondition());
  assert.ok(overlaid.acceleration < stock.acceleration - 0.12);
  assert.ok(overlaid.stopping < stock.stopping - 2);
  assert.ok(overlaid.rotation > stock.rotation);
});

test('traction setting changes torque in response to measured rear slip and ABS modulates individual wheels', () => {
  const car = { speed: 20, steer: 0.34, lateral: 2, onRoad: true, wheels: createTires() };
  Object.assign(car.wheels[0], { ratio: -0.49, angle: 0.25, onRoad: true, speed: 20 });
  Object.assign(car.wheels[1], { angle: 0.4, onRoad: true, speed: 20 });
  Object.assign(car.wheels[3], { angle: 0, onRoad: true, speed: 20 });
  const handling = { ...performance, ecu: { traction: 3, abs: 3 } };
  const open = regulateVehicle(car, { gas: 1, tcMode: 'off' }, handling);
  const contained = regulateVehicle(car, { gas: 1, tcMode: 'high' }, handling);
  assert.ok(!open.tc && contained.tc && contained.gas < open.gas);
  const braking = regulateVehicle(car, { brake: 1 }, handling);
  assert.ok(braking.abs && braking.locks[1] < 0.05);
  assert.ok(braking.brakeForce > regulateVehicle(car, { brake: 1 }, performance).brakeForce);
});

test('ECU purchases and in-race mode survive the active checkpoint', () => {
  let save = { ...career, cash: 5000 };
  save = buyElectronics(buyElectronics(save, 'traction'), 'launch');
  const loadout = normalizeLoadout(save);
  const track = createTrack(events[0]);
  const race = createRace(track, team, loadout.upgrades, loadout.setup, loadout.appearance, { electronics: loadout.electronics });
  race.update(raceStep, { gas: 1 });
  assert.ok(race.launchHold > 4200);
  race.rotateTC();
  assert.equal(race.tcMode, 'high');
  save = { ...save, activeRace: raceCheckpoint(save, race, loadout, false) };
  assert.equal(restoreRace(save, track).race.tcMode, 'high');
  assert.equal(restoreRace(save, track).race.electronics.launch, 1);
});
