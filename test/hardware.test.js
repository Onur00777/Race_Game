import test from 'node:test';
import assert from 'node:assert/strict';
import { buyElectronics, buyUpgrade, currentTeam, newCareer, newHardware, normalizeLoadout } from '../src/career.js';
import { fitPart, stages } from '../src/hardware.js';
import { vehicleStats } from '../src/setup.js';

test('engine models unlock by round and keep independent five-stage tuning', () => {
  const fresh = { ...newCareer(), cash: 50000 };
  assert.equal(fitPart(fresh, 'engine', 'v6'), fresh);
  const roundThree = { ...fresh, results: [{}, {}] };
  const tuned = buyUpgrade(roundThree, 'engine');
  let fitted = fitPart(tuned, 'engine', 'v6');
  assert.equal(fitted.upgrades.engine, 0);
  for (let stage = 0; stage < stages; stage++) fitted = buyUpgrade(fitted, 'engine');
  assert.equal(fitted.upgrades.engine, 5);
  assert.equal(buyUpgrade(fitted, 'engine'), fitted);
  const swapped = fitPart(fitted, 'engine', 'i4');
  assert.equal(swapped.upgrades.engine, 1);
  const refitted = fitPart(swapped, 'engine', 'v6');
  assert.equal(refitted.cash, fitted.cash);
  assert.equal(refitted.upgrades.engine, 5);
  const stock = vehicleStats(currentTeam(fresh), fresh.upgrades, fresh.setup);
  const loadout = normalizeLoadout(refitted);
  const tunedV6 = vehicleStats(currentTeam(refitted), loadout.upgrades, loadout.setup, loadout.models);
  assert.ok(tunedV6.topSpeed > stock.topSpeed && tunedV6.redline > stock.redline);
});

test('season two kits alter handling at stage zero and unlock the fifth ECU stage', () => {
  const first = { ...newCareer(), cash: 50000, electronics: { launch: 4 } };
  assert.equal(buyElectronics(first, 'launch'), first);
  assert.equal(fitPart(first, 'aero', 'prototype'), first);
  const second = { ...first, season: 2, results: [{}, {}] };
  const tuned = buyElectronics(second, 'launch');
  assert.equal(normalizeLoadout(tuned).electronics.launch, 5);
  const fitted = fitPart(fitPart(fitPart(second, 'aero', 'prototype'), 'brakes', 'carbon'), 'tires', 'endurance');
  const base = vehicleStats(currentTeam(first), first.upgrades, first.setup);
  const loadout = normalizeLoadout(fitted);
  const stats = vehicleStats(currentTeam(fitted), loadout.upgrades, loadout.setup, loadout.models);
  assert.equal(loadout.appearance.wing, 'twin');
  assert.ok(stats.load > base.load && stats.braking > base.braking && stats.grip > base.grip);
});

test('new hardware notifications identify the exact round and season transitions', () => {
  const career = newCareer();
  const roundTwo = { ...career, results: [{}] };
  assert.deepEqual(newHardware(career, roundTwo), ['Clubsport Kit', 'Slotted Performance']);
  const finish = { ...career, results: Array(6).fill({}) };
  assert.deepEqual(newHardware(finish, { ...finish, season: 2, results: [] }),
    ['Hybrid V12 Hyper-Unit', 'Prototype Ground-Effect Kit', 'AURORA']);
});
