import test from 'node:test';
import assert from 'node:assert/strict';
import { currentTeam, events, finishEvent, newCareer, normalizeLoadout } from '../src/career.js';
import { difficulties, purseFor } from '../src/difficulty.js';
import { eventDifficulty, raceCheckpoint, restoreRace } from '../src/progress.js';
import { createRace, createTrack, raceStep } from '../src/race.js';
import { wakeFactor } from '../src/race-ai.js';

const order = ['player', 'deniz', 'selin', 'ece', 'mert'];

test('difficulty applies a placement multiplier without multiplying a fixed sponsor bonus', () => {
  const career = { ...newCareer(), sponsor: 'delta', decals: ['hood'] };
  for (const [difficulty, { multiplier }] of Object.entries(difficulties)) {
    const result = finishEvent(career, order, 100, 45, normalizeLoadout(career), events[0], { difficulty }).results[0];
    assert.equal(result.racePrize, purseFor(events[0].prizes, difficulty)[0]);
    assert.equal(result.prize, Math.round(1800 * multiplier) + 160);
  }
});

test('a started race keeps its challenge and legacy checkpoints keep their original purse', () => {
  const career = { ...newCareer(), difficulty: 'legend' };
  const track = createTrack(events[0]);
  const loadout = normalizeLoadout(career);
  const race = createRace(track, currentTeam(career), loadout.upgrades, loadout.setup, loadout.appearance, { difficulty: 'hard' });
  const activeRace = raceCheckpoint(career, race, loadout, false);
  const pausedCareer = { ...career, activeRace };
  assert.equal(eventDifficulty(pausedCareer), 'hard');
  assert.equal(restoreRace(pausedCareer, track).race.difficulty, 'hard');
  assert.equal(eventDifficulty({ ...career, activeRace: { ...activeRace, version: 2, difficulty: undefined } }), 'easy');
});

test('all four packs complete their laps without rejoining, with progressively quicker pace', () => {
  const track = createTrack(events[0]);
  const career = newCareer();
  const idle = { gas: 0, brake: 0, steering: 0 };
  const times = [];
  for (const difficulty of Object.keys(difficulties)) {
    const race = createRace(track, currentTeam(career), career.upgrades, career.setup, undefined, { difficulty });
    const offset = track.railOffset - 1.4;
    Object.assign(race.player, track.at(-25, offset), { station: -25, offset, onRoad: false });
    for (let i = 0; i < 90 / raceStep && race.opponents.some(car => car.finishTime == null); i++) race.update(raceStep, idle);
    assert(race.opponents.every(car => Number.isFinite(car.finishTime) && !car.rejoins), difficulty);
    times.push(race.opponents.reduce((sum, car) => sum + car.finishTime, 0) / race.opponents.length);
  }
  assert(times.every((time, index) => index === 0 || time < times[index - 1] - 1));
});

test('drafting depends on the physical wake and never on race position', () => {
  const track = createTrack(events[0]);
  const at = station => ({ ...track.at(station), station, onRoad: true, speed: 32, offset: 0 });
  const behind = at(26);
  const ahead = at(38);
  const gap = (a, b) => a - b;
  assert(wakeFactor(track, behind, [behind, ahead], gap) > 0);
  assert.equal(wakeFactor(track, ahead, [behind, ahead], gap), 0);
  ahead.offset = 3.5;
  assert.equal(wakeFactor(track, behind, [behind, ahead], gap), 0);
});
