import test from 'node:test';
import assert from 'node:assert/strict';
import { currentTeam, events, newCareer, normalizeLoadout } from '../src/career.js';
import { pitSpeed } from '../src/pit-lane.js';
import { raceCheckpoint, restoreRace } from '../src/progress.js';
import { createRace, createTrack, raceStep } from '../src/race.js';
import { tireHealth } from '../src/tire-strategy.js';

const career = newCareer();
const loadout = normalizeLoadout(career);
const tick = (race, seconds, input = { gas: 0, brake: 0, steering: 0 }) => {
  for (let step = 0; step < seconds / raceStep; step++) race.update(raceStep, input);
};

test('limiter activates on pit pavement and a saved pit stop restores tires and body', () => {
  const track = createTrack(events[0]);
  const race = createRace(track, currentTeam(career), career.upgrades, career.setup);
  race.countdown = 0;
  const { center, box } = track.pit;
  Object.assign(race.player, track.at(box - 17, center), { station: box - 17, speed: 35 });
  tick(race, 0.55, { gas: 1, brake: 0, steering: 0 });
  assert.ok(race.player.pit.lane);
  assert.ok(race.player.speed <= pitSpeed + 0.1);
  race.pit.plan = { compound: 'hard', repair: true };
  Object.assign(race.player, track.at(box, center), { station: box, speed: 0, tireLife: [0.22, 0.25, 0.24, 0.22],
    damage: 34, frontDamage: 0.8 });
  tick(race, 1);
  assert.ok(race.player.pit.remaining > 2);
  const activeRace = JSON.parse(JSON.stringify(raceCheckpoint(career, race, loadout, false)));
  const restored = restoreRace({ ...career, activeRace }, track).race;
  assert.deepEqual(restored.pit.plan, { compound: 'hard', repair: true });
  tick(restored, 3.1);
  assert.equal(restored.player.pit.stops, 1);
  assert.equal(restored.player.compound, 'hard');
  assert.equal(tireHealth(restored.player), 1);
  assert.equal(restored.player.damage, 0);
});

test('the Summit pack calls at least one pit stop per car when rain arrives', () => {
  const track = createTrack(events[2]);
  const race = createRace(track, currentTeam(career), career.upgrades, career.setup, undefined, { difficulty: 'hard' });
  Object.assign(race.player, track.at(120, track.railOffset - 1.4), { station: 120, offset: track.railOffset - 1.4, onRoad: false });
  for (let step = 0; step < 230 / raceStep && race.opponents.some(car => car.finishTime == null); step++) {
    race.update(raceStep, { gas: 0, brake: 0, steering: 0 });
  }
  for (const car of race.opponents) {
    assert.ok(car.pit.stops >= 1, car.id);
    assert.ok(Number.isFinite(car.finishTime), car.id);
  }
});

test('Legend rivals complete the long wet-to-dry stint without getting stuck in the pit lane', () => {
  const track = createTrack(events.find(event => event.id === 'strait'));
  assert.equal(track.event.laps, 15);
  const race = createRace(track, currentTeam(career), career.upgrades, career.setup, undefined, { difficulty: 'legend' });
  const outside = track.pit.side * (track.railOffset - 1.34);
  Object.assign(race.player, track.at(125, outside), { station: 125, offset: outside, onRoad: false });
  for (let step = 0; step < 560 / raceStep && race.opponents.some(car => car.finishTime == null); step++) {
    race.update(raceStep, { gas: 0, brake: 0, steering: 0 });
  }
  assert.equal(race.control.flag, 'green');
  for (const car of race.opponents) {
    assert.ok(car.pit.stops >= 2, car.id);
    assert.ok(Number.isFinite(car.finishTime) && !car.rejoins, car.id);
  }
});
