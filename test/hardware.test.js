import test from 'node:test';
import assert from 'node:assert/strict';
import { buyUpgrade, currentTeam, newCareer, normalizeLoadout } from '../src/career.js';
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
