import assert from 'node:assert/strict';
import test from 'node:test';
import { carLength, carWidth, resolveBarrierContact, resolveVehicleContact } from '../src/contact.js';
import { createRace, createTrack } from '../src/race.js';
import { currentTeam, events, newCareer } from '../src/career.js';

const body = overrides => ({ x: 0, z: 0, yaw: 0, speed: 0, lateral: 0, spin: 0, ...overrides });

test('a centered rear-end hit transfers momentum without artificial sideways push or spin', () => {
  const rear = body({ speed: 24 });
  const front = body({ z: carLength - 0.08, speed: 10 });
  const hit = resolveVehicleContact(rear, front);
  assert(hit.impulse > 6);
  assert(rear.speed < 24 && front.speed > 10);
  assert(Math.abs(rear.speed + front.speed - 34) < 1e-9);
  assert.equal(rear.spin, 0);
  assert.equal(front.spin, 0);
  assert(front.z - rear.z >= carLength - 0.006);
});

test('a corner hit turns both cars, while parallel clear cars never collide', () => {
  const moving = body({ speed: 25 });
  const target = body({ x: 1.2, z: carLength - 0.06 });
  assert(resolveVehicleContact(moving, target));
  assert(Math.abs(moving.spin) > 0.5 && Math.abs(target.spin) > 0.5);
  assert.equal(resolveVehicleContact(body(), body({ x: carWidth + 0.02, speed: 40 })), null);
});

test('a guardrail sends the car back inside and preserves some speed during a glancing hit', () => {
  const car = body({ x: -12, yaw: -0.18, speed: 30 });
  const hit = resolveBarrierContact(car, { dx: 0, dz: 1, offset: 12 }, 13);
  assert(hit && hit.impulse > 1);
  assert(car.x > -12);
  assert(car.speed > 20);
  assert(Math.abs(car.spin) > 0.1);
});

test('the race reports hard crashes and resetting preserves damage until the next race', () => {
  const career = newCareer();
  const track = createTrack(events[0]);
  const team = currentTeam(career);
  const race = createRace(track, team, career.upgrades);
  const station = 34;
  const pose = track.at(station, track.railOffset - 2.23);
  Object.assign(race.player, pose, { station, yaw: pose.yaw - Math.PI / 2, speed: 40, onRoad: false });
  race.countdown = 0;
  race.update(1 / 120, { gas: false, brake: false, steering: 0, handbrake: false });
  assert.equal(race.impact?.kind, 'rail');
  assert(race.player.damage > 35 && race.player.frontDamage > race.player.rearDamage);
  const damage = race.player.damage;
  race.reset();
  assert.equal(race.player.damage, damage);
  assert.equal(race.player.speed, 0);
  assert.equal(race.player.spin, 0);
  assert.equal(createRace(track, team, career.upgrades).player.damage, 0);
});

test('reverse gear limits engine speed without discarding recoil momentum', () => {
  const career = newCareer();
  const race = createRace(createTrack(events[0]), currentTeam(career), career.upgrades);
  const brake = { gas: false, brake: true, steering: 0, handbrake: false };
  race.countdown = 0;
  race.player.speed = -15;
  race.update(1 / 120, brake);
  assert(race.player.speed < -14);

  race.player.speed = -7.99;
  race.update(1 / 120, brake);
  assert.equal(race.player.speed, -8);
});
