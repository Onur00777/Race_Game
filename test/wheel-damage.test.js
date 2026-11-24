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

function pitWallCrash(race, car, speed) {
  const { pit } = race.track;
  const offset = pit.wallOffset - pit.side * 2.60;
  const pose = race.track.at(40, offset);
  Object.assign(car, pose, { station: 40, offset, speed, yaw: pose.yaw - pit.side * 0.84 });
  race.countdown = 0;
  race.elapsed = 14;
  for (let i = 0; i < 24 && !race.looseWheels.length; i++) race.update(raceStep, { gas: 0, steering: 0 });
}

test('a high-energy pit wall strike detaches a wheel, causes DNF and leaves a bouncing rigid body', () => {
  const track = createTrack(events[0]);
  const race = createRace(track, currentTeam(career), career.upgrades, career.setup);
  pitWallCrash(race, race.player, 55);
  assert.equal(race.retired, true);
  assert.equal(race.order.at(-1), 'player');
  assert.equal(race.wheelEvents[0].type, 'detached');
  const corner = race.wheelEvents[0].index;
  assert.equal(race.player.corners[corner].detached, true);
  assert.equal(race.player.damage, 100);
  const wheel = race.looseWheels[0];
  const initial = { x: wheel.x, y: wheel.y, z: wheel.z };
  const time = race.elapsed;
  let high = initial.y;
  for (let i = 0; i < 140; i++) {
    race.updateAftermath(1 / 60);
    high = Math.max(high, wheel.y);
  }
  assert.equal(race.elapsed, time);
  assert.ok(high > initial.y + 0.6);
  assert.ok(Math.hypot(wheel.x - initial.x, wheel.z - initial.z) > 3);
  assert.ok(wheel.bounces >= 1 && wheel.roll !== 0);
});

test('an AI wheel detachment opens a yellow sector and restores the obstacle from a saved race', () => {
  const track = createTrack(events[0]);
  const race = createRace(track, currentTeam(career), career.upgrades, career.setup);
  pitWallCrash(race, race.opponents[0], 55);
  assert.equal(race.control.flag, 'yellow');
  assert.ok(race.control.hazards.includes(race.opponents[0].id));
  assert.equal(race.retired, false);
  const activeRace = JSON.parse(JSON.stringify(raceCheckpoint(career, race, loadout, false)));
  const { race: restored } = restoreRace({ ...career, activeRace }, track);
  assert.equal(restored.control.flag, 'yellow');
  assert.equal(restored.looseWheels[0].id, race.looseWheels[0].id);
  assert.ok(restored.opponents[0].corners.some(wheel => wheel.detached));
});
