import test from 'node:test';
import assert from 'node:assert/strict';
import { currentEvent, events, finishEvent, loadCareer, newCareer, repairQuote, repairVehicle, saveCareer, standings, teams } from '../src/career.js';
import { createTrack, createRace } from '../src/race.js';
import { applyImpact, damagePerformance, integrity, vehicleCondition } from '../src/vehicle-damage.js';

const car = () => ({ x: 0, z: 0, yaw: 0, ...vehicleCondition() });

test('collision velocity and contact point distinguish a direct hit from a sideswipe', () => {
  const direct = car();
  const scrape = car();
  const front = applyImpact(direct, { x: 0.03, z: 2, nx: 0, nz: 1, normalSpeed: 28, relativeSpeed: 28 });
  const left = applyImpact(scrape, { x: 1, z: 0.15, nx: 1, nz: 0, normalSpeed: 10, relativeSpeed: 28 });
  assert.equal(front.zone, 'frontDamage');
  assert.equal(left.zone, 'leftDamage');
  assert.ok(direct.frontDamage > direct.rearDamage);
  assert.ok(scrape.leftDamage > scrape.rightDamage);
  assert.ok(front.amount > left.amount * 10);
});

test('opposite nose impacts bend the hood in opposite directions and shatter each light state once', () => {
  for (const side of [-1, 1]) {
    const body = car();
    const impact = { x: side * 0.72, z: 2, nx: 0, nz: 1, normalSpeed: 32, relativeSpeed: 32 };
    const first = applyImpact(body, impact);
    assert.equal(first.zone, 'frontDamage');
    assert.ok(body.hoodBias * side > 0.5);
    assert.ok(first.parts.includes('headlight'));
    assert.equal(vehicleCondition(body).hoodBias, body.hoodBias);
    assert.ok(!applyImpact(body, impact).parts.includes('headlight'));
  }
});

test('moderate wear reduces speed and downforce before critical wear cuts power and pulls sideways', () => {
  const fresh = damagePerformance({ damage: 0 });
  assert.deepEqual(damagePerformance({ damage: 30 }), fresh);
  const moderate = damagePerformance({ damage: 55 });
  assert.equal(moderate.power, 1);
  assert.ok(moderate.aero < fresh.aero && moderate.speed < fresh.speed && moderate.drag > 0);
  const critical = damagePerformance({ damage: 82, leftDamage: 0.95 });
  assert.ok(critical.power < moderate.power && critical.grip < moderate.grip && critical.pull > 0);
  assert.equal(integrity({ damage: 99.8 }), 1);
  assert.equal(damagePerformance({ damage: 100 }).power, 0);
});

test('a mechanically disabled car is classified as retired and cannot drive away', () => {
  const race = createRace(createTrack(events[0]), teams[0], { engine: 0, tires: 0, brakes: 0, aero: 0 }, {}, {},
    { condition: { damage: 100 } });
  race.update(1 / 120, { gas: 1 });
  assert.equal(race.retired, true);
  assert.deepEqual(race.retiredDrivers, ['player']);
  assert.equal(race.order.at(-1), 'player');
  assert.equal(race.player.speed, 0);
  assert.equal(race.player.finishTime, undefined);
});

const order = ['deniz', 'selin', 'ece', 'mert', 'player'];

test('a finish carries panel wear into the career, next event, and persisted repair', () => {
  const storage = new Map();
  const store = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
  const first = { ...newCareer(), cash: 3400 };
  assert.deepEqual(loadCareer(store).condition, vehicleCondition());
  const condition = { damage: 52, frontDamage: 0.75, leftDamage: 0.42 };
  const finished = finishEvent(first, order, 60, 29, undefined, events[0], { difficulty: 'hard', condition });
  saveCareer(store, finished);
  const loaded = loadCareer(store);
  const next = createRace(createTrack(currentEvent(loaded)), teams[0], loaded.upgrades, loaded.setup, {}, { condition: loaded.condition });
  assert.deepEqual(vehicleCondition(next.player), vehicleCondition(condition));
  assert.equal(integrity(next.player), 48);
  const quote = repairQuote(loaded);
  const repaired = repairVehicle(loaded);
  assert.equal(repaired.cash, loaded.cash - quote.cost);
  assert.deepEqual(repaired.upgrades, loaded.upgrades);
  assert.equal(integrity(repaired.condition), 100);
  saveCareer(store, repaired);
  assert.equal(integrity(loadCareer(store).condition), 100);
});

test('DNF clears a saved race, pays no prize or points and allows essential repairs on credit', () => {
  const start = { ...newCareer(), activeRace: {}, sponsor: 'redline', decals: ['hood'] };
  const retired = finishEvent(start, order, 19, null, undefined, events[0], {
    difficulty: 'legend', retired: true, retiredDrivers: ['mert'], condition: { damage: 100, rearDamage: 1 },
  });
  const result = retired.results[0];
  assert.deepEqual([result.points, result.prize, result.bonus, retired.completed], [0, 0, 0, 0]);
  assert.equal(retired.activeRace, null);
  assert.equal(currentEvent(retired), events[1]);
  assert.equal(integrity(retired.condition), 0);
  assert.equal(standings(retired).find(driver => driver.id === 'player').points, 0);
  assert.equal(standings(retired).find(driver => driver.id === 'mert').points, 0);
  assert.equal(repairVehicle(retired), retired);
  const financed = repairVehicle(retired, true);
  assert.equal(financed.cash, 0);
  assert.equal(financed.repairDebt, repairQuote(retired).shortfall);
  assert.equal(integrity(financed.condition), 100);
  const recovered = finishEvent(financed, [...order].reverse(), 200, 49, undefined, events[1], { difficulty: 'easy' });
  assert.equal(recovered.results[1].repayment, financed.repairDebt);
  assert.equal(recovered.cash, recovered.results[1].racePrize - financed.repairDebt);
  assert.equal(recovered.repairDebt, 0);
  assert.equal(repairVehicle({ ...retired, activeRace: {} }, true).cash, retired.cash);
});
