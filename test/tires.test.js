import assert from 'node:assert/strict';
import test from 'node:test';
import { createTires, updateTires, wheelMounts } from '../src/tires.js';
import { createSkidMarks } from '../src/skid-marks.js';

const road = { offset: 0, dx: 0, dz: 1 };
const handling = { surfaceGrip: 1, brakeStability: 0, grip: 8.9 };
const car = () => ({ x: 0, z: 0, speed: 31, lateral: 0, steer: 0, yaw: 0, yawRate: 0, wheels: createTires() });

test('handbrake locks the rear axle while the fronts continue rolling', () => {
  const moving = car();
  for (let i = 0; i < 22; i++) updateTires(moving, { handbrake: true }, handling, road, 7, 1 / 120);
  for (const [i, mount] of wheelMounts.entries()) {
    assert(mount.front ? moving.wheels[i].slip < 0.01 : moving.wheels[i].ratio > 0.9);
  }
});

test('hard braking and sideways scrub register slip and each tire reports its own surface', () => {
  const moving = car();
  for (let i = 0; i < 18; i++) updateTires(moving, { brake: 1 }, handling, road, 7, 1 / 120);
  assert(moving.tireSlip > 0.5);
  moving.lateral = 10;
  updateTires(moving, {}, handling, { ...road, offset: 6.8 }, 7, 1 / 120);
  assert(moving.wheels.some(wheel => wheel.onRoad));
  assert(moving.wheels.some(wheel => !wheel.onRoad));
  assert(moving.wheels.every(wheel => Math.abs(wheel.angle) > 0.3));
});

test('rubber marks remain while paused and recycling bounds the pool without crossing gravel or resets', () => {
  const marks = createSkidMarks(3);
  const wheel = { x: 0, z: 0, onRoad: true, slip: 0.9, speed: 25 };
  const race = { runId: 'first', cars: [{ id: 'rival', wheels: [wheel] }] };
  marks.update(race, true, true);
  wheel.x = 1;
  marks.update(race, true, true);
  assert.equal(marks.mesh.geometry.drawRange.count, 6);
  wheel.onRoad = false;
  wheel.x = 2;
  marks.update(race, true, true);
  assert.equal(marks.mesh.geometry.drawRange.count, 6);
  wheel.onRoad = true;
  wheel.x = 19; // Rejoin elsewhere on track.
  marks.update(race, true, true);
  assert.equal(marks.mesh.geometry.drawRange.count, 6);
  for (let i = 0; i < 10; i++) {
    wheel.x += 1;
    marks.update(race, true, true);
  }
  assert.equal(marks.mesh.geometry.drawRange.count, 18);
  marks.update(race, false, false);
  marks.update({ ...race }, false, true);
  assert.equal(marks.mesh.geometry.drawRange.count, 18);
  marks.update({ ...race, runId: 'new' }, false, true);
  assert.equal(marks.mesh.geometry.drawRange.count, 0);
});
