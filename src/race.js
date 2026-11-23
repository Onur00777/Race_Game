import { CatmullRomCurve3, Vector3 } from 'three';
import { rivals } from './career.js';
import { railRunoff, resolveBarrierContact, resolveVehicleContact, velocity } from './contact.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, period) => ((value % period) + period) % period;
const approach = (value, target, amount) => value + clamp(target - value, -amount, amount);
const angleBetween = (a, b) => wrap(b - a + Math.PI, 2 * Math.PI) - Math.PI;
export const raceStep = 1 / 120;

const visualPose = ({ x, z, yaw, speed, steer }) => ({ x, z, yaw, speed, steer });

export function renderPose(car, previous, fraction) {
  if (!previous) return car;
  return {
    ...car,
    x: previous.x + (car.x - previous.x) * fraction,
    z: previous.z + (car.z - previous.z) * fraction,
    yaw: previous.yaw + angleBetween(previous.yaw, car.yaw) * fraction,
    speed: previous.speed + (car.speed - previous.speed) * fraction,
    steer: previous.steer + (car.steer - previous.steer) * fraction,
  };
}

export function createTrack(event) {
  const curve = new CatmullRomCurve3(event.points.map(([x, z]) => new Vector3(x, 0, z)), true);
  curve.arcLengthDivisions = 1600;
  const count = 480;
  const length = curve.getLength();
  const spacing = length / count;
  const railOffset = event.width / 2 + railRunoff;
  const samples = Array.from({ length: count }, (_, index) => {
    const point = curve.getPointAt(index / count);
    const tangent = curve.getTangentAt(index / count);
    return { x: point.x, z: point.z, dx: tangent.x, dz: tangent.z };
  });

  function at(distance, offset = 0) {
    const index = wrap(distance, length) / spacing;
    const start = Math.floor(index);
    const a = samples[start];
    const b = samples[(start + 1) % count];
    const mix = index - start;
    const dx = a.dx + (b.dx - a.dx) * mix;
    const dz = a.dz + (b.dz - a.dz) * mix;
    return {
      x: a.x + (b.x - a.x) * mix - dz * offset,
      z: a.z + (b.z - a.z) * mix + dx * offset,
      dx,
      dz,
      yaw: Math.atan2(dx, dz),
    };
  }

  function project(x, z) {
    let nearest = Infinity;
    let station = 0;
    let offset = 0;
    let dx = 0;
    let dz = 0;
    for (let index = 0; index < count; index++) {
      const a = samples[index];
      const b = samples[(index + 1) % count];
      const sx = b.x - a.x;
      const sz = b.z - a.z;
      const segmentLengthSquared = sx * sx + sz * sz;
      const along = clamp(((x - a.x) * sx + (z - a.z) * sz) / segmentLengthSquared, 0, 1);
      const ox = x - a.x - sx * along;
      const oz = z - a.z - sz * along;
      const distance = ox * ox + oz * oz;
      if (distance < nearest) {
        nearest = distance;
        station = (index + along) * spacing;
        const segmentLength = Math.sqrt(segmentLengthSquared);
        dx = sx / segmentLength;
        dz = sz / segmentLength;
        offset = -dz * ox + dx * oz;
      }
    }
    return { station, distance: Math.sqrt(nearest), offset, dx, dz };
  }

  return { event, length, spacing, railOffset, samples, at, project };
}

const bodyState = () => ({ speed: 0, lateral: 0, spin: 0, steer: 0, damage: 0, frontDamage: 0, rearDamage: 0 });

export function createRace(track, team, upgrades) {
  const finish = track.length * track.event.laps;
  const player = {
    id: 'player', color: team.color, station: -18, ...track.at(-18, 2.5), ...bodyState(),
    onRoad: true, lap: 0, lapStarted: 0, bestLap: null,
  };
  const opponents = rivals.map((rival, index) => {
    const station = -2 - Math.floor(index / 2) * 8;
    const lane = index % 2 ? 2.5 : -2.5;
    const offset = lane + Math.sin(station * 0.028) * 0.85;
    return { ...rival, pace: rival.pace * track.event.rivalPace[index], station, lane, offset,
      ...track.at(station, offset), ...bodyState(), finishTime: null };
  });
  const cars = [player, ...opponents];
  const race = { track, player, opponents, cars, previousPoses: cars.map(visualPose),
    elapsed: 0, countdown: 3, order: null, impact: null };
  const topSpeed = 54 + upgrades.engine * 3 + team.power;
  const acceleration = 13 + upgrades.engine * 1.7 + team.power * 0.45;
  const braking = 24 + upgrades.brakes * 4.5;
  const grip = 8.8 + upgrades.tires * 0.85 + team.grip;

  function relativeStation(station, reference) {
    return wrap(station - reference + track.length / 2, track.length) - track.length / 2;
  }

  function reset() {
    const nearby = opponents.filter(car => Math.abs(relativeStation(car.station, player.station)) < 5);
    const offset = [0, -4.2, 4.2].find(lane => nearby.every(car => Math.abs(car.offset - lane) > 2.2)) ?? 0;
    Object.assign(player, track.at(player.station, offset), { speed: 0, lateral: 0, spin: 0, steer: 0, onRoad: true });
    race.previousPoses[0] = visualPose(player);
  }

  function damageAt(car, impact) {
    if (!car || impact.impulse <= 2.6) return;
    const amount = (impact.impulse - 2.6) * 1.65;
    const along = (impact.x - car.x) * Math.sin(car.yaw) + (impact.z - car.z) * Math.cos(car.yaw);
    car.damage = Math.min(100, car.damage + amount);
    car.frontDamage = Math.min(1, car.frontDamage + amount * clamp(0.5 + along * 0.3, 0, 1) / 66);
    car.rearDamage = Math.min(1, car.rearDamage + amount * clamp(0.5 - along * 0.3, 0, 1) / 66);
  }

  function reportImpact(impact, first, second) {
    if (!impact) return;
    damageAt(first, impact);
    damageAt(second, impact);
    if (impact.impulse > 1.1 && (first === player || second === player)) {
      race.impact = { ...impact, kind: second ? 'vehicle' : 'rail', time: race.elapsed };
    }
  }

  function settleOpponent(car, projection) {
    car.offset = projection.offset;
    const advance = relativeStation(projection.station, car.station);
    if (Math.abs(advance) < 4 && car.finishTime === null) car.station = Math.min(finish - 0.001, car.station + advance);
  }

  function moveOpponent(car, dt, elapsed) {
    if (car.finishTime !== null) {
      car.speed = Math.max(0, car.speed - dt * 6.5);
      car.station += car.speed * dt;
      car.offset = approach(car.offset, Math.sign(car.lane) * (track.event.width / 2 + 2.5), dt * 2.3);
      Object.assign(car, track.at(car.station, car.offset));
      return;
    }
    const direction = track.at(car.station);
    const ahead = clamp(car.speed * 0.48, 9, 23);
    const bend = Math.abs(angleBetween(direction.yaw, track.at(car.station + ahead).yaw));
    const surfaceLimit = Math.abs(car.offset) > track.event.width / 2 + 0.6 ? 15 : 47;
    const target = car.pace * (1 - car.damage * 0.0015) * Math.min(surfaceLimit, 43 / (1 + bend * 1.7));
    car.speed = approach(car.speed, target, (car.speed < target ? 9.5 : 21) * dt);
    const motion = velocity(car);
    const previous = car.station;
    const forwardSpeed = motion.x * direction.dx + motion.z * direction.dz;
    car.station = Math.min(finish, car.station + forwardSpeed * dt);
    const desired = car.lane + Math.sin(car.station * 0.028) * 0.85;
    car.offset += (-motion.x * direction.dz + motion.z * direction.dx + (desired - car.offset) * 2.1) * dt;
    const pose = track.at(car.station, car.offset);
    const deviation = angleBetween(direction.yaw, car.yaw) * Math.exp(-4 * dt) + car.spin * dt;
    car.steer = clamp(-angleBetween(car.yaw, pose.yaw) * 7, -1, 1);
    car.lateral *= Math.exp(-4.2 * dt);
    car.spin *= Math.exp(-4.5 * dt);
    Object.assign(car, pose);
    car.yaw += deviation;
    if (car.station >= finish) car.finishTime = elapsed - dt + (finish - previous) / forwardSpeed;
  }

  function update(dt, input) {
    if (race.order) return;
    if (race.countdown > 0) {
      race.countdown = Math.max(0, race.countdown - dt);
      return;
    }
    race.previousPoses = cars.map(visualPose);
    race.elapsed += dt;
    const { gas, brake, handbrake, steering } = input;
    const newHeading = Number(gas) - Number(brake);
    const power = 1 - player.damage * 0.0028;
    const damagedTopSpeed = topSpeed * (1 - player.damage * 0.002);
    if (gas && !brake) {
      player.speed += (player.speed < 0 ? braking : acceleration * power * (1 - Math.max(0, player.speed) / (damagedTopSpeed + 8))) * dt;
    } else if (brake) {
      if (player.speed > 0) player.speed = Math.max(0, player.speed - braking * dt);
      else if (player.speed > -8) player.speed = Math.max(-8, player.speed - 7 * dt);
    }
    const limit = player.onRoad ? damagedTopSpeed : 12;
    if (player.speed > limit) player.speed = approach(player.speed, limit, (player.onRoad ? 13 : 32) * dt);
    if (!newHeading || handbrake) player.speed = approach(player.speed, 0, (handbrake ? 14 : 2.8) * dt);

    const speed = Math.abs(player.speed);
    player.steer += (steering - player.steer) * (1 - Math.exp(-dt * 8));
    const turn = player.steer * Math.min(speed / 5, 1) * (2.15 / (1 + speed * 0.027));
    const rotation = -turn * Math.sign(player.speed) * dt;
    player.yaw += rotation * (handbrake ? 1.25 : 1) + player.spin * dt;
    player.spin *= Math.exp(-(player.onRoad ? 4.3 : 2.65) * dt);
    player.lateral -= player.speed * Math.sin(rotation) * (handbrake ? 1.08 : 0.52);
    player.lateral *= Math.exp(-(handbrake ? 1.55 : grip * (1 - player.damage * 0.0019)) * (player.onRoad ? 1 : 0.56) * dt);
    const motion = velocity(player);
    player.x += motion.x * dt;
    player.z += motion.z * dt;

    for (const car of opponents) moveOpponent(car, dt, race.elapsed);
    const active = race.cars.filter(car => car.finishTime == null || car.speed > 1);
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];
        const previousX = b.x;
        const previousZ = b.z;
        const ax = a.x;
        const az = a.z;
        reportImpact(resolveVehicleContact(a, b), a, b);
        if (a !== player && (ax !== a.x || az !== a.z)) settleOpponent(a, track.project(a.x, a.z));
        if (previousX !== b.x || previousZ !== b.z) settleOpponent(b, track.project(b.x, b.z));
      }
    }

    for (const car of active) {
      const projection = track.project(car.x, car.z);
      if (car === player && projection.distance > track.railOffset + 8) {
        reset();
        continue;
      }
      const x = car.x;
      const z = car.z;
      reportImpact(resolveBarrierContact(car, projection, track.railOffset), car);
      if (car !== player && (x !== car.x || z !== car.z)) settleOpponent(car, track.project(car.x, car.z));
    }

    const projection = track.project(player.x, player.z);
    player.onRoad = projection.distance <= track.event.width / 2 + 0.6;
    const advance = relativeStation(projection.station, player.station);
    const previous = player.station;
    // Preserve progress through runoff, but ignore jumps to a nearby hairpin.
    if (Math.abs(advance) < 6) player.station += advance;

    const lap = Math.floor(player.station / track.length);
    if (lap >= player.lap && player.station >= 0 && (previous < 0 || lap > player.lap)) {
      if (lap > player.lap) {
        const lapTime = race.elapsed - player.lapStarted;
        player.bestLap = Math.min(player.bestLap ?? Infinity, lapTime);
      }
      player.lap = lap;
      player.lapStarted = race.elapsed;
    }

    if (player.station >= finish) {
      player.finishTime = race.elapsed - dt + dt * (finish - previous) / advance;
      // Let the remaining drivers take the flag for the championship standings.
      for (const car of opponents) {
        if (car.finishTime !== null) continue;
        const prediction = { ...car };
        for (let elapsed = race.elapsed + 0.1; prediction.finishTime === null; elapsed += 0.1) {
          moveOpponent(prediction, 0.1, elapsed);
        }
        car.finishTime = prediction.finishTime;
      }
      race.elapsed = player.finishTime;
      race.order = [...race.cars].sort((a, b) => a.finishTime - b.finishTime).map(car => car.id);
    }
  }

  race.reset = reset;
  race.update = update;
  race.position = () => race.order ? race.order.indexOf(player.id) + 1
    : 1 + opponents.filter(car => car.station > player.station).length;
  return race;
}
