import test from 'node:test';
import assert from 'node:assert/strict';
import { events, currentTeam, newCareer } from '../src/career.js';
import { createRace, createTrack, raceStep } from '../src/race.js';
import { brakingRisk, makeRacingLine } from '../src/racing-line.js';

test('the recommended line stays on track, wraps and brakes in advance of tight corners', () => {
  for (const event of events) {
    const career = newCareer();
    const track = createTrack(event);
    const { handling } = createRace(track, currentTeam(career), career.upgrades);
    const line = makeRacingLine(track, handling);
    let limits = [];
    for (let s = 0; s < track.length; s += 2) {
      const point = line.sample(s);
      const projection = track.project(point.x, point.z);
      assert(projection.distance < event.width / 2);
      assert(point.targetSpeed <= handling.topSpeed + 0.0001 && point.targetSpeed > 0);
      limits.push(point.targetSpeed);
    }
    assert(Math.min(...limits) < handling.topSpeed * 0.55);
    assert(Math.abs(line.sample(-4).targetSpeed - line.sample(track.length - 4).targetSpeed) < 0.00001);
  }
});

test('driver speed changes the same upcoming corner from green to lift to hard braking', () => {
  const low = brakingRisk(12, 22, 18, 54);
  const medium = brakingRisk(26, 22, 18, 54);
  const high = brakingRisk(42, 22, 18, 54);
  assert.equal(low, 0);
  assert(medium > 0.31 && medium < 0.66);
  assert.equal(high, 1);
  assert(brakingRisk(27, 22, 35, 54) < brakingRisk(27, 22, 5, 54));
  assert.equal(brakingRisk(54, 54, 2, 54), 0);
});

test('backfire is generated when an upgraded engine lifts at speed and stays quiet in a stock car', () => {
  const career = newCareer();
  const throttle = { gas: true, brake: false, steering: 0, handbrake: false };
  for (const engine of [0, 2]) {
    const track = createTrack(events[0]);
    const race = createRace(track, currentTeam(career), { ...career.upgrades, engine });
    race.countdown = 0;
    Object.assign(race.player, track.at(85), { speed: 22, station: 85 });
    race.update(raceStep, throttle);
    race.update(raceStep, { ...throttle, gas: false });
    assert.equal(Boolean(race.backfire), engine > 0);
    const release = race.backfire;
    race.update(raceStep, throttle);
    race.update(raceStep, { ...throttle, gas: false });
    assert.equal(race.backfire, release);
  }
});
