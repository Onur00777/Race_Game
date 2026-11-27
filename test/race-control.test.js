import test from 'node:test';
import assert from 'node:assert/strict';
import { currentTeam, events, newCareer, normalizeLoadout } from '../src/career.js';
import { raceCheckpoint, restoreRace } from '../src/progress.js';
import { createRace, createTrack, raceStep } from '../src/race.js';
import { tireHealth } from '../src/tire-strategy.js';

const career = newCareer();
const loadout = normalizeLoadout(career);
const inputs = { gas: 0, brake: 0, steering: 0 };

function put(race, car, station, offset, speed, reverse = false) {
  Object.assign(car, race.track.at(station, offset), { station, offset, speed });
  if (reverse) car.yaw += Math.PI;
}

function atSpeed() {
  const track = createTrack(events[0]);
  const race = createRace(track, currentTeam(career), career.upgrades, career.setup);
  race.elapsed = 32;
  race.countdown = 0;
  return race;
}

test('a stalled, damaged rival invokes a sector caution and an illegal pass is recorded once', () => {
  const race = atSpeed();
  put(race, race.opponents[0], 48, 0, 0);
  put(race, race.opponents[1], 34, -1.7, 19);
  put(race, race.player, 27, 2.3, 30);
  Object.assign(race.opponents[0], { damage: 83, frontDamage: 1 });
  race.update(raceStep, inputs);
  assert.equal(race.control.flag, 'yellow');
  assert.ok(race.control.hazards.includes(race.opponents[0].id));
  put(race, race.player, 37, 2.9, 16);
  race.update(raceStep, inputs);
  assert.equal(race.player.timePenalty, 3);
  race.update(raceStep, inputs);
  assert.equal(race.player.timePenalty, 3);
  put(race, race.opponents[0], 48, race.track.railOffset - 1.3, 16);
  race.opponents[0].onRoad = false;
  put(race, race.player, 36, race.track.railOffset - 1.3, 0);
  race.player.onRoad = false;
  for (let step = 0; step < 7 / raceStep && race.control.flag === 'yellow'; step++) race.update(raceStep, inputs);
  assert.equal(race.control.flag, 'green');
});

test('a physical pile-up suspends the race and a saved red flag restarts on a standing grid', () => {
  const race = atSpeed();
  const lap = race.track.length;
  put(race, race.player, lap + 38, 0, 33);
  race.player.lap = 1;
  put(race, race.opponents[0], lap + 42.35, 0, 3);
  put(race, race.opponents[1], lap + 46.60, 0, 24, true);
  race.update(raceStep, inputs);
  assert.equal(race.control.flag, 'red');
  const time = race.elapsed;
  const station = race.player.station;
  const damage = race.player.damage;
  race.update(1, { gas: 1, steering: 1 });
  assert.equal(race.elapsed, time);
  assert.equal(race.player.station, station);
  const activeRace = JSON.parse(JSON.stringify(raceCheckpoint(career, race, loadout, false)));
  const restored = restoreRace({ ...career, activeRace }, race.track).race;
  assert.equal(restored.control.flag, 'red');
  assert.ok(restored.restartAfterRed({ compound: 'hard', repair: true }));
  assert.equal(restored.control.flag, 'green');
  assert.equal(restored.countdown, 3);
  assert.equal(restored.elapsed, time);
  assert.equal(restored.player.lap, 1);
  assert.equal(restored.player.speed, 0);
  assert.equal(restored.player.compound, 'hard');
  assert.equal(tireHealth(restored.player), 1);
  assert.ok(Math.abs(restored.player.damage - (damage - 18)) < 0.001);
  assert.ok(new Set(restored.cars.map(car => `${car.x.toFixed(2)};${car.z.toFixed(2)}`)).size === 5);
});

test('race classification waits for rivals to finish within a yellow flag penalty window', () => {
  const race = atSpeed();
  const finish = race.track.length * race.track.event.laps;
  race.player.lap = 1;
  race.player.timePenalty = 3;
  put(race, race.player, finish - 1, 2.5, 33);
  put(race, race.opponents[0], finish - 16, -2.5, 35);
  while (race.player.finishTime == null) race.update(raceStep, inputs);
  assert.equal(race.order, null);
  for (let tick = 0; tick < 4 / raceStep && !race.order; tick++) race.update(raceStep, inputs);
  assert.ok(race.order.indexOf('deniz') < race.order.indexOf('player'));
});

test('Summit classifies at the sixth crossing, including from a saved final lap', () => {
  const track = createTrack(events[2]);
  const race = createRace(track, currentTeam(career), career.upgrades, career.setup);
  race.countdown = 0;
  race.elapsed = 240;
  race.player.lap = 5;
  race.player.lapStarted = 200;
  put(race, race.player, track.length * 6 - 0.25, 2.5, 34);
  const summitCareer = { ...career, results: [{}, {}] };
  summitCareer.activeRace = raceCheckpoint(summitCareer, race, loadout, false);
  const restored = restoreRace(summitCareer, track).race;
  restored.update(raceStep, inputs);
  assert.equal(restored.player.lap, 6);
  assert.ok(restored.player.finishTime > 240 && restored.player.finishTime < 240 + raceStep);
  assert.equal(restored.order[0], 'player');
});

test('a checkpoint exactly on the finish line still classifies at zero speed', () => {
  const race = atSpeed();
  race.player.lap = 2;
  put(race, race.player, race.track.length * 2, 0, 0);
  const activeRace = raceCheckpoint(career, race, loadout, false);
  const restored = restoreRace({ ...career, activeRace }, race.track).race;
  restored.update(raceStep, inputs);
  assert.ok(Number.isFinite(restored.player.finishTime));
  assert.ok(restored.order);
});
