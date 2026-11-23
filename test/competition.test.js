import test from 'node:test';
import assert from 'node:assert/strict';
import { currentTeam, events, finishEvent, newCareer, normalizeLoadout } from '../src/career.js';
import { difficulties, purseFor } from '../src/difficulty.js';
import { eventDifficulty, raceCheckpoint, restoreRace } from '../src/progress.js';
import { createRace, createTrack } from '../src/race.js';

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
