import { CatmullRomCurve3, Vector3 } from 'three';
import { rivals } from './career.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, period) => ((value % period) + period) % period;
const approach = (value, target, amount) => value + clamp(target - value, -amount, amount);
const angleBetween = (a, b) => wrap(b - a + Math.PI, 2 * Math.PI) - Math.PI;

export function createTrack(event) {
  const curve = new CatmullRomCurve3(event.points.map(([x, z]) => new Vector3(x, 0, z)), true);
  curve.arcLengthDivisions = 1600;
  const count = 480;
  const length = curve.getLength();
  const spacing = length / count;
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
    for (let index = 0; index < count; index++) {
      const a = samples[index];
      const b = samples[(index + 1) % count];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const along = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
      const distance = (x - a.x - dx * along) ** 2 + (z - a.z - dz * along) ** 2;
      if (distance < nearest) {
        nearest = distance;
        station = (index + along) * spacing;
      }
    }
    return { station, distance: Math.sqrt(nearest) };
  }

  return { event, length, spacing, samples, at, project };
}

export function createRace(track, team, upgrades) {
  const finish = track.length * track.event.laps;
  const player = {
    id: 'player', color: team.color, station: -18, ...track.at(-18, 2.5), speed: 0,
    lateral: 0, steer: 0, onRoad: true, lap: 0, lapStarted: 0, bestLap: null,
  };
  const opponents = rivals.map((rival, index) => {
    const station = -2 - Math.floor(index / 2) * 8;
    const lane = index % 2 ? 2.5 : -2.5;
    return { ...rival, pace: rival.pace * track.event.rivalPace[index], station, lane,
      ...track.at(station, lane), speed: 0, steer: 0, finishTime: null };
  });
  const race = { track, player, opponents, cars: [player, ...opponents], elapsed: 0, countdown: 3, order: null };
  const topSpeed = 54 + upgrades.engine * 3 + team.power;
  const acceleration = 13 + upgrades.engine * 1.7 + team.power * 0.45;
  const braking = 24 + upgrades.brakes * 4.5;
  const grip = 4.6 + upgrades.tires * 0.85 + team.grip;

  function reset() {
    Object.assign(player, track.at(player.station), { speed: 0, lateral: 0, steer: 0, onRoad: true });
  }

  function moveOpponent(car, dt, elapsed) {
    if (car.finishTime !== null) return;
    const ahead = clamp(car.speed * 0.48, 9, 23);
    const bend = Math.abs(angleBetween(track.at(car.station).yaw, track.at(car.station + ahead).yaw));
    const target = car.pace * Math.min(47, 43 / (1 + bend * 1.7));
    car.speed = approach(car.speed, target, (car.speed < target ? 9.5 : 21) * dt);
    const previous = car.station;
    car.station = Math.min(finish, car.station + car.speed * dt);
    const pose = track.at(car.station, car.lane + Math.sin(car.station * 0.028) * 0.85);
    car.steer = -angleBetween(car.yaw, pose.yaw) * 4;
    Object.assign(car, pose);
    if (car.station >= finish) car.finishTime = elapsed - dt + (finish - previous) / car.speed;
  }

  function update(dt, input) {
    if (race.order) return;
    if (race.countdown > 0) {
      race.countdown = Math.max(0, race.countdown - dt);
      return;
    }
    race.elapsed += dt;
    const { gas, brake, handbrake, steering } = input;
    const newHeading = Number(gas) - Number(brake);
    if (gas && !brake) {
      player.speed += (player.speed < 0 ? braking : acceleration * (1 - Math.max(0, player.speed) / (topSpeed + 8))) * dt;
    } else if (brake) {
      player.speed = player.speed > 0 ? Math.max(0, player.speed - braking * dt) : player.speed - 7 * dt;
    }
    const limit = player.onRoad ? topSpeed : 12;
    if (player.speed > limit) player.speed = approach(player.speed, limit, (player.onRoad ? 13 : 32) * dt);
    if (!newHeading || handbrake) player.speed = approach(player.speed, 0, (handbrake ? 14 : 2.8) * dt);
    player.speed = Math.max(-8, player.speed);

    const speed = Math.abs(player.speed);
    player.steer = approach(player.steer, steering, dt * 5.5);
    const turn = player.steer * Math.min(speed / 5, 1) * (2.35 / (1 + speed * 0.024));
    const rotation = -turn * Math.sign(player.speed) * dt;
    player.yaw += rotation * (handbrake ? 1.25 : 1);
    player.lateral -= player.speed * Math.sin(rotation);
    player.lateral *= Math.exp(-(handbrake ? 1.4 : grip) * (player.onRoad ? 1 : 0.5) * dt);
    player.x += (Math.sin(player.yaw) * player.speed + Math.cos(player.yaw) * player.lateral) * dt;
    player.z += (Math.cos(player.yaw) * player.speed - Math.sin(player.yaw) * player.lateral) * dt;

    for (const car of opponents) {
      moveOpponent(car, dt, race.elapsed);
      if (car.finishTime !== null) continue;
      const dx = player.x - car.x;
      const dz = player.z - car.z;
      const longitudinal = dx * car.dx + dz * car.dz;
      const side = dx * -car.dz + dz * car.dx;
      if (Math.abs(longitudinal) < 3.65 && Math.abs(side) < 1.82) {
        const direction = Math.sign(side) || 1;
        const separation = (1.82 - Math.abs(side)) * direction;
        player.x -= car.dz * separation;
        player.z += car.dx * separation;
        player.speed *= 0.84;
      }
    }

    const projection = track.project(player.x, player.z);
    player.onRoad = projection.distance <= track.event.width / 2 + 0.6;
    const delta = projection.station - wrap(player.station, track.length);
    const advance = wrap(delta + track.length / 2, track.length) - track.length / 2;
    if (projection.distance > track.event.width / 2 + 23) reset();
    const previous = player.station;
    // Ignore jumps between nearby sections, while allowing a normal curb cut.
    if (Math.abs(advance) < 6 && projection.distance <= track.event.width / 2 + 3) {
      player.station += advance;
    }

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
        for (let elapsed = race.elapsed + 0.1; car.finishTime === null; elapsed += 0.1) {
          moveOpponent(car, 0.1, elapsed);
        }
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
