import test from 'node:test';
import assert from 'node:assert/strict';
import { currentTeam, events, newCareer, normalizeLoadout } from '../src/career.js';
import { raceCheckpoint, restoreRace } from '../src/progress.js';
import { createRace, createTrack, raceStep } from '../src/race.js';
import { createTires } from '../src/tires.js';
import { applyTireGrip, fitTires, tireHealth, wearTires } from '../src/tire-strategy.js';

function rolling(id, water, slip) {
  const car = fitTires({ speed: 31, yawRate: 0.45, tireSlip: slip, wheels: createTires() }, id);
  for (const wheel of car.wheels) Object.assign(wheel, { speed: 31, ratio: slip, angle: 0.19, onRoad: true });
  for (let i = 0; i < 400; i++) wearTires(car, water, 0.1);
  applyTireGrip(car, water);
  return car;
}

test('tire compounds trade peak grip, dry life and rain performance', () => {
  const soft = rolling('soft', 0, 0.07);
  const medium = rolling('medium', 0, 0.07);
  const hard = rolling('hard', 0, 0.07);
  const dryRain = rolling('rain', 0, 0.07);
  const wetRain = rolling('rain', 0.8, 0.07);
  const wetMedium = rolling('medium', 0.8, 0.07);
  assert.ok(tireHealth(hard) > tireHealth(medium) && tireHealth(medium) > tireHealth(soft));
  assert.ok(tireHealth(dryRain) < tireHealth(wetRain) - 0.25);
  assert.ok(wetRain.tireGrip > wetMedium.tireGrip + 0.30);
  assert.ok(tireHealth(rolling('medium', 0, 0.50)) < tireHealth(medium) - 0.05);
});

test('forecast wets the race by lap and the compound, individual wear and surface survive a checkpoint', () => {
  const career = { ...newCareer(), results: [{}, {}], setup: { compound: 'rain' } };
  const loadout = normalizeLoadout(career);
  const track = createTrack(events[2]);
  const race = createRace(track, currentTeam(career), loadout.upgrades, loadout.setup);
  const station = track.length * 2 + 4;
  Object.assign(race.player, track.at(station, 1), { station, lap: 2, speed: 21 });
  race.countdown = 0;
  race.update(raceStep, { gas: 1, steering: 0 });
  assert.ok(race.wetness > 0);
  assert.notDeepEqual(race.player.tireLife, [1, 1, 1, 1]);
  const save = raceCheckpoint(career, race, loadout, false);
  const restored = restoreRace({ ...career, activeRace: JSON.parse(JSON.stringify(save)) }, track).race;
  assert.equal(restored.wetness, race.wetness);
  assert.equal(restored.player.compound, 'rain');
  assert.deepEqual(restored.player.tireLife, race.player.tireLife);
  restored.fitTires(restored.player, 'hard');
  assert.equal(tireHealth(restored.player), 1);
});
