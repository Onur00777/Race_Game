import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptSponsor, buyUpgrade, currentEvent, currentTeam, events, finishEvent, loadCareer, newCareer, normalizeLoadout, saveCareer, saveProfile, toggleDecal } from '../src/career.js';
import { eventForResume, raceCheckpoint, restoreRace } from '../src/progress.js';
import { legacyEvents, originalEvents } from '../src/events.js';
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
  assert.equal(career.condition.damage, 0);
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
    lap: 1, station: track.length + 72, speed: 22, damage: 27, frontDamage: 0.31, rightDamage: 0.41, lapStarted: 52, bestLap: 48.8,
  });
  race.opponents[0].finishTime = 68.75;
  career = { ...career, activeRace: raceCheckpoint(career, race, loadout, true), sponsor: null, decals: [] };
  saveCareer(storage, career);
  const restored = restoreRace(loadCareer(storage), track);
  assert.equal(restored.race.elapsed, 72.5);
  assert.equal(restored.race.player.damage, 27);
  assert.equal(restored.race.player.rightDamage, 0.41);
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

test('previous Bay Curves snapshots retain their scheduled two laps and original prize table', () => {
  const order = ['player', 'deniz', 'selin', 'ece', 'mert'];
  const career = finishEvent(newCareer(), order, 60, 27);
  const track = createTrack(legacyEvents[1]);
  const race = createRace(track, currentTeam(career), career.upgrades, career.setup);
  Object.assign(race.player, { lap: 1, station: track.length + 22, damage: 11 });
  const snapshot = raceCheckpoint(career, race, normalizeLoadout(career), false);
  const olderCareer = { ...career, activeRace: { ...snapshot, version: 1, event: undefined, legacy: undefined } };
  const event = eventForResume(olderCareer);
  assert.equal(events[1].laps, 4);
  assert.equal(event.laps, 2);
  const resumed = restoreRace(olderCareer, createTrack(event));
  assert.equal(resumed.race.player.damage, 11);
  assert.equal(finishEvent(olderCareer, order, 70, 31, resumed.loadout, event).results.at(-1).prize, 1800);
});

test('saved races keep their original straight and a fresh attempt uses the extended track', () => {
  const career = newCareer();
  const track = createTrack(originalEvents[0]);
  const race = createRace(track, currentTeam(career), career.upgrades, career.setup);
  Object.assign(race.player, track.at(track.length + 72), { lap: 1, station: track.length + 72 });
  const activeRace = raceCheckpoint(career, race, normalizeLoadout(career), false);
  delete activeRace.trackLayout;
  const saved = { ...career, activeRace };
  const resumed = restoreRace(saved, createTrack(eventForResume(saved))).race;
  assert.equal(resumed.player.x, race.player.x);
  assert.equal(resumed.player.station, race.player.station);
  assert.equal(eventForResume(saved, true), events[0]);
  for (const event of events) {
    const next = createTrack(event);
    const heading = next.at(0).yaw;
    for (let station = -115; station <= 165; station += 5) {
      assert.ok(Math.abs(Math.sin(next.at(station).yaw - heading)) < 0.17, event.id + ' at ' + station);
    }
  }
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

test('opponents clear the Bay Curves hairpin instead of blocking the second lap', () => {
  const career = newCareer();
  const track = createTrack(events[1]);
  const race = createRace(track, currentTeam(career), career.upgrades, career.setup);
  const angle = n => Math.atan2(Math.sin(n), Math.cos(n));
  for (let tick = 0; tick < 250 * 120 && !race.order; tick++) {
    const car = race.player;
    const look = 6 + Math.abs(car.speed) * 0.55;
    const target = track.at(car.station + look, Math.sin(car.station * 0.011) * 1.4);
    const desired = Math.atan2(target.x - car.x, target.z - car.z);
    const bend = Math.abs(angle(track.at(car.station).yaw - track.at(car.station + look * 1.45).yaw));
    const speed = 33 / (1 + bend * 1.55);
    race.update(raceStep, {
      gas: car.speed < speed,
      brake: car.speed > speed + 3,
      steering: Math.max(-1, Math.min(1, angle(car.yaw - desired) * 4)),
      handbrake: false,
    });
  }
  assert.equal(race.player.lap, events[1].laps);
  assert.equal(race.order?.length, 5);
});
