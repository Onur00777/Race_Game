import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptSponsor, buyUpgrade, currentEvent, currentTeam, finishEvent, loadCareer, newCareer, normalizeLoadout, saveCareer, saveProfile, toggleDecal } from '../src/career.js';
import { raceCheckpoint, restoreRace } from '../src/progress.js';
import { createRace, createTrack, raceStep, renderPose } from '../src/race.js';
import { vehicleStats } from '../src/setup.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: id => data.get(id), setItem: (id, value) => data.set(id, value) };
}

test('previous career saves retain rewards and make new garage fields available', () => {
  const storage = memoryStorage();
  const legacy = { cash: 2810, team: 'volt', upgrades: { engine: 1, tires: 2, brakes: 0 }, completed: 1, season: 2, results: [] };
  saveCareer(storage, legacy);
  const career = loadCareer(storage);
  assert.equal(career.cash, legacy.cash);
  assert.equal(career.team, legacy.team);
  assert.deepEqual(career.upgrades, { ...legacy.upgrades, aero: 0 });
  assert.equal(career.setup.frontCamber, -1.5);
});

test('race resumes with lap, damage, opponent positions and the original loadout', () => {
  const storage = memoryStorage();
  let career = saveProfile(newCareer(), '  Aylin Demir ', 'en', 'volt');
  career = toggleDecal(acceptSponsor(career, 'delta'), 'hood');
  const loadout = normalizeLoadout(career);
  const track = createTrack(currentEvent(career));
  const race = createRace(track, currentTeam(career), loadout.upgrades, loadout.setup, loadout.appearance);
  race.elapsed = 72.5;
  race.countdown = 0;
  Object.assign(race.player, track.at(track.length + 72), {
    lap: 1, station: track.length + 72, speed: 22, damage: 27, frontDamage: 0.31, lapStarted: 52, bestLap: 48.8,
  });
  race.opponents[0].finishTime = 68.75;
  career = { ...career, activeRace: raceCheckpoint(career, race, loadout, true), sponsor: null, decals: [] };
  saveCareer(storage, career);
  const restored = restoreRace(loadCareer(storage), track);
  assert.equal(restored.race.elapsed, 72.5);
  assert.equal(restored.race.player.damage, 27);
  assert.equal(restored.race.player.bestLap, 48.8);
  assert.equal(restored.race.opponents[0].finishTime, 68.75);
  assert.equal(restored.alternateCamera, true);
  assert.deepEqual(restored.loadout.appearance.decals, ['hood']);
  assert.equal(restored.race.player.x, renderPose(restored.race.player, restored.race.previousPoses[0], 0).x);
  const finished = finishEvent(career, ['player', 'deniz', 'selin', 'ece', 'mert'], 105, 48, restored.loadout);
  assert.equal(finished.results[0].bonus, 160);
  assert.equal(finished.activeRace, null);
  assert.equal(restoreRace(finished, track), null);
});

test('purchased aero trades top speed for downforce and clamps unavailable wing shapes', () => {
  let career = { ...newCareer(), cash: 3000 };
  const stock = vehicleStats(currentTeam(career), career.upgrades, career.setup);
  assert.equal(stock.load, 0);
  career = buyUpgrade(career, 'aero');
  const low = vehicleStats(currentTeam(career), career.upgrades, { ...career.setup, downforce: 0 });
  const high = vehicleStats(currentTeam(career), career.upgrades, { ...career.setup, downforce: 10 });
  assert(high.load > low.load && high.topSpeed < low.topSpeed);
  assert.equal(normalizeLoadout({ ...career, setup: { ...career.setup, wing: 'twin' } }).appearance.wing, 'touring');
});

test('regular steering keeps the rear settled while the handbrake permits more slip', () => {
  const career = newCareer();
  const track = createTrack(currentEvent(career));
  const testTurn = handbrake => {
    const race = createRace(track, currentTeam(career), career.upgrades);
    race.countdown = 0;
    Object.assign(race.player, track.at(145), { station: 145, speed: 32 });
    for (let i = 0; i < 40; i++) race.update(raceStep, { gas: true, brake: false, steering: 0.85, handbrake });
    return Math.abs(race.player.lateral);
  };
  const normalSlip = testTurn(false);
  assert(normalSlip < 2.6 && testTurn(true) > normalSlip * 2);
});
