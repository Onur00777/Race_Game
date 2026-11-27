import test from 'node:test';
import assert from 'node:assert/strict';
import { currentTeam, events, newCareer, normalizeLoadout } from '../src/career.js';
import { pitSpeed } from '../src/pit-lane.js';
import { raceCheckpoint, restoreRace } from '../src/progress.js';
import { createRace, createTrack, raceStep } from '../src/race.js';
import { tireHealth } from '../src/tire-strategy.js';
import { originalEvents } from '../src/events.js';
import { carWidth } from '../src/contact.js';

const career = newCareer();
const loadout = normalizeLoadout(career);
const tick = (race, seconds, input = { gas: 0, brake: 0, steering: 0 }) => {
  for (let step = 0; step < seconds / raceStep; step++) race.update(raceStep, input);
};

test('a stopped car and two passing car widths fit across the new pit bays', () => {
  for (const event of [events[0], events.at(-1)]) {
    const { pit } = createTrack(event);
    assert.ok(Math.abs(pit.stallCenter - pit.fastCenter) > carWidth * 2);
    for (const offset of [pit.stallCenter, pit.fastCenter, (pit.stallCenter + pit.fastCenter) / 2]) {
      assert.ok(pit.contains(pit.box, offset));
    }
  }
});

test('the long pit entrance joins the main road before a dedicated speed-limit line', () => {
  for (const event of [events[0], events.at(-1)]) {
    const { pit } = createTrack(event);
    assert.ok(pit.speedLine - pit.entry >= 60);
    assert.ok(Math.abs(pit.offsetAt(pit.entry)) < pit.edge);
    assert.ok(!pit.speedLimited(pit.speedLine - 0.1, pit.offsetAt(pit.speedLine - 0.1)));
    assert.ok(pit.speedLimited(pit.speedLine + 0.1, pit.offsetAt(pit.speedLine + 0.1)));
    assert.ok(!pit.speedLimited(pit.speedLine + 0.1, pit.side * (pit.edge - 0.5)));
  }
});

test('the continuous pit wall keeps a car on its original side and produces a concrete impact', () => {
  const track = createTrack(events[0]);
  const race = createRace(track, currentTeam(career), career.upgrades, career.setup);
  race.countdown = 0;
  const { wallOffset, side, wallAt, entry, exit } = track.pit;
  assert.ok(!wallAt(entry) && !wallAt(exit));
  const offset = wallOffset - side * 2.85;
  const position = track.at(39, offset);
  Object.assign(race.player, position, { station: 39, offset, speed: 22, yaw: position.yaw - side * Math.PI / 2 });
  tick(race, 0.13);
  assert.equal(race.impact?.surface, 'concrete');
  assert.ok(race.player.damage > 5);
  assert.ok((race.player.offset - wallOffset) * side < 0);
  assert.equal(race.player.pit.lane, false);
});

test('the extended exit cannot skip the limiter through the wall, apron or track reset', () => {
  for (const event of [events[0], events.at(-1)]) {
    const track = createTrack(event);
    const race = createRace(track, currentTeam(career), career.upgrades, career.setup);
    race.countdown = 0;
    const { pit } = track;
    const station = 95;
    const offset = pit.wallOffset + pit.side * 2.5;
    const pose = track.at(station, offset);
    Object.assign(race.player, pose, { station, offset, speed: pitSpeed, yaw: pose.yaw + pit.side * Math.PI / 2 });
    tick(race, 0.17);
    assert.equal(race.impact?.surface, 'concrete');
    assert.ok(pit.speedLimited(race.player.station, race.player.offset));
    assert.ok(pit.speedLimited(station, pit.garageFace));
    assert.ok(!pit.speedLimited(station, 0));
    race.reset();
    assert.ok(pit.speedLimited(race.player.station, race.player.offset));
    assert.ok(pit.exit - pit.speedEnd >= 55);
    assert.ok(!pit.speedLimited(pit.speedEnd + 0.2, pit.fastCenter));
  }
});

test('legacy pit checkpoints migrate the serviced car to its new garage bay', () => {
  const track = createTrack(events[0]);
  const race = createRace(track, currentTeam(career), career.upgrades, career.setup);
  Object.assign(race.player, track.at(18, -(track.event.width / 2 + 3.38)), { station: 18, offset: -(track.event.width / 2 + 3.38) });
  Object.assign(race.player.pit, { lane: true, remaining: 1.1, duration: 2.25, service: { compound: 'hard', repair: false } });
  const activeRace = JSON.parse(JSON.stringify(raceCheckpoint(career, race, loadout, false)));
  delete activeRace.pitLayout;
  const { race: restored } = restoreRace({ ...career, activeRace }, track);
  assert.ok(restored.player.pit.lane);
  assert.equal(restored.player.offset, track.pit.stallCenter);
  assert.equal(restored.player.pit.remaining, 1.1);
});

test('limiter activates on pit pavement and a saved pit stop restores tires and body', () => {
  const track = createTrack(events[0]);
  const race = createRace(track, currentTeam(career), career.upgrades, career.setup);
  race.countdown = 0;
  const { center, box, stallCenter } = track.pit;
  Object.assign(race.player, track.at(box - 17, center), { station: box - 17, speed: 35 });
  tick(race, 0.55, { gas: 1, brake: 0, steering: 0 });
  assert.ok(race.player.pit.lane);
  assert.ok(race.player.speed <= pitSpeed + 0.1);
  race.pit.plan = { compound: 'hard', repair: true };
  Object.assign(race.player, track.at(box, stallCenter), { station: box, speed: 0, tireLife: [0.22, 0.25, 0.24, 0.22],
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
  for (let step = 0; step < 320 / raceStep && race.opponents.some(car => car.finishTime == null); step++) {
    race.update(raceStep, { gas: 0, brake: 0, steering: 0 });
  }
  for (const car of race.opponents) {
    assert.ok(car.pit.stops >= 1, car.id);
    assert.ok(Number.isFinite(car.finishTime), car.id);
  }
});

test('Legend rivals complete the long wet-to-dry stint without getting stuck in the pit lane', () => {
  const track = createTrack(originalEvents.find(event => event.id === 'strait'));
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
