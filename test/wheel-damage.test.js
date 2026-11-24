import test from 'node:test';
import assert from 'node:assert/strict';
import { currentTeam, events, newCareer, normalizeLoadout } from '../src/career.js';
import { raceCheckpoint, restoreRace } from '../src/progress.js';
import { createRace, createTrack, raceStep } from '../src/race.js';
import { vehicleCondition, applyImpact, damagePerformance } from '../src/vehicle-damage.js';
import { inspectWheelImpact, suspensionEffects, wheelGripFactor } from '../src/wheel-damage.js';

const career = newCareer();
const loadout = normalizeLoadout(career);
const fresh = () => ({ x: 0, z: 0, yaw: 0, tireLife: [1, 1, 1, 1], ...vehicleCondition() });

test('a centered rear hit removes the wing without puncturing a tire and zeroes aero load', () => {
  const car = fresh();
  const contact = { x: 0, z: -2.1, nx: 0, nz: -1, normalSpeed: 33, relativeSpeed: 33 };
  assert.ok(applyImpact(car, contact).parts.includes('wing'));
  assert.equal(inspectWheelImpact(car, contact, false), null);
  assert.equal(car.wingDamage, 1);
  assert.equal(damagePerformance(car).aero, 0);
});

test('a front-left side impact damages only that suspension and a heavier hit punctures it', () => {
  const car = fresh();
  const contact = { x: 0.94, z: 1.31, nx: 1, nz: 0, normalSpeed: 20 };
  const incident = inspectWheelImpact(car, contact, false);
  assert.equal(incident.index, 3);
  assert.ok(car.corners[3].damage > 0.3 && car.corners[3].damage < 0.66);
  assert.ok(!incident.flat && suspensionEffects(car.corners).pull > 0);
  assert.ok(inspectWheelImpact(car, { ...contact, normalSpeed: 25 }, false).flat);
  assert.equal(car.tireLife[3], 0);
  assert.ok(car.corners.slice(0, 3).every(corner => corner.damage === 0 && !corner.punctured));
  assert.ok(wheelGripFactor(car.corners[3]) < 0.25);
  assert.ok(suspensionEffects(car.corners).speedLimit < 18);
});

test('a worn tire emits a single blowout, restores from checkpoint and is replaced without repairing the suspension', () => {
  const track = createTrack(events[0]);
  const race = createRace(track, currentTeam(career), career.upgrades, career.setup);
  race.countdown = 0;
  Object.assign(race.player, track.at(51), { station: 51, speed: 30 });
  race.player.corners[1].damage = 0.54;
  race.player.tireLife[1] = 0;
  race.update(raceStep, { gas: 1, steering: 0 });
  race.update(raceStep, { gas: 1, steering: 0 });
  assert.equal(race.wheelEvents.length, 1);
  assert.equal(race.wheelEvents[0].index, 1);
  const activeRace = JSON.parse(JSON.stringify(raceCheckpoint(career, race, loadout, false)));
  const { race: restored } = restoreRace({ ...career, activeRace }, track);
  assert.deepEqual(restored.player.corners[1], { damage: 0.54, punctured: true, detached: false });
  restored.fitTires(restored.player, 'hard');
  assert.equal(restored.player.tireLife[1], 1);
  assert.deepEqual(restored.player.corners[1], { damage: 0.54, punctured: false, detached: false });
});
