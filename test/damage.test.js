import test from 'node:test';
import assert from 'node:assert/strict';
import { events, teams } from '../src/career.js';
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
