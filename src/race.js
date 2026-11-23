import { CatmullRomCurve3, Vector3 } from 'three';
import { rivals } from './career.js';
import { railRunoff, resolveBarrierContact, resolveVehicleContact } from './contact.js';
import { vehicleStats } from './setup.js';
import { difficultyId } from './difficulty.js';
import { advanceVehicle, angleBetween, clamp } from './vehicle-physics.js';
import { createRaceIntel, wakeFactor } from './race-ai.js';

const wrap = (value, period) => ((value % period) + period) % period;
export const raceStep = 1 / 120;

const visualPose = ({ x, z, yaw, speed, steer, station }) => ({ x, z, yaw, speed, steer, station });

export function renderPose(car, previous, fraction) {
  if (!previous) return car;
  return {
    ...car,
    x: previous.x + (car.x - previous.x) * fraction,
    z: previous.z + (car.z - previous.z) * fraction,
    yaw: previous.yaw + angleBetween(previous.yaw, car.yaw) * fraction,
    speed: previous.speed + (car.speed - previous.speed) * fraction,
    steer: previous.steer + (car.steer - previous.steer) * fraction,
    station: previous.station + (car.station - previous.station) * fraction,
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

export function createRace(track, team, upgrades, setup, appearance, options = {}) {
  const finish = track.length * track.event.laps;
  const player = {
    id: 'player', color: team.color, station: -18, ...track.at(-18, 2.5), ...bodyState(),
    onRoad: true, offset: 2.5, lap: 0, lapStarted: 0, bestLap: null, appearance,
  };
  const opponents = rivals.map((rival, index) => {
    const station = -2 - Math.floor(index / 2) * 8;
    const lane = [-4.35, 4.35, -1.46, 1.46][index];
    const offset = (index % 2 ? 2.5 : -2.5) + Math.sin(station * 0.028) * 0.85;
    return { ...rival, pace: rival.pace * track.event.rivalPace[index], station, lane, offset, onRoad: true, stuck: 0,
      ...track.at(station, offset), ...bodyState(), finishTime: null };
  });
  const cars = [player, ...opponents];
  const race = { track, player, opponents, cars, difficulty: difficultyId(options.difficulty), previousPoses: cars.map(visualPose),
    elapsed: 0, countdown: 3, order: null, impact: null, throttle: false, backfire: null, engineLevel: upgrades.engine };
  const surfaceGrip = track.event.surfaceGrip;
  const playerHandling = { ...vehicleStats(team, upgrades, setup), surfaceGrip };
  const { topSpeed, braking, grip, load } = playerHandling;
  race.handling = { topSpeed, braking: braking * surfaceGrip, grip: (grip + load * 0.018) * surfaceGrip };

  function relativeStation(station, reference) {
    return wrap(station - reference + track.length / 2, track.length) - track.length / 2;
  }

  const raceIntel = createRaceIntel(track, race.difficulty, opponents, relativeStation);

  function rejoin(car) {
    const nearby = cars.filter(other => other !== car && Math.abs(relativeStation(other.station, car.station)) < 5.5);
    const offset = [0, -4.2, 4.2].find(lane => nearby.every(other => Math.abs(other.offset - lane) > 2.5)) ?? 0;
    Object.assign(car, track.at(car.station, offset), { speed: 0, lateral: 0, spin: 0, steer: 0, yawRate: 0,
      offset, onRoad: true, stuck: 0, aiOffset: offset });
    race.previousPoses[cars.indexOf(car)] = visualPose(car);
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

  function trackProgress(car, dt) {
    let projection = track.project(car.x, car.z);
    if (projection.distance > track.railOffset + 8) {
      rejoin(car);
      return;
    }
    const { x, z } = car;
    reportImpact(resolveBarrierContact(car, projection, track.railOffset), car);
    if (car.x !== x || car.z !== z) projection = track.project(car.x, car.z);
    car.offset = projection.offset;
    car.onRoad = projection.distance <= track.event.width / 2 + 0.6;
    const delta = relativeStation(projection.station, car.station);
    const previous = car.station;
    // Reject projection jumps between different sections of a hairpin.
    const advance = Math.abs(delta) < 6 ? delta : 0;
    car.station += advance;
    if (car.finishTime == null && car.station >= finish) car.finishTime = race.elapsed - dt + dt * (finish - previous) / advance;
    if (car === player) updateLap(previous);
    else if (car.finishTime == null) {
      car.stuck = advance < dt * 0.25 ? car.stuck + dt : 0;
      if (car.stuck > 5.5) {
        car.rejoins = (car.rejoins ?? 0) + 1;
        rejoin(car);
      }
    }
  }

  function updateLap(previous) {
    const lap = Math.floor(player.station / track.length);
    if (lap < player.lap || player.station < 0 || (previous >= 0 && lap <= player.lap)) return;
    if (lap > player.lap) {
      const lapTime = (player.finishTime ?? race.elapsed) - player.lapStarted;
      player.bestLap = Math.min(player.bestLap ?? Infinity, lapTime);
    }
    player.lap = lap;
    player.lapStarted = race.elapsed;
  }

  function classify() {
    race.order = [...cars].sort((a, b) =>
      (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity) || b.station - a.station).map(car => car.id);
  }

  function update(dt, input) {
    if (race.order) return;
    if (race.countdown > 0) {
      race.countdown = Math.max(0, race.countdown - dt);
      return;
    }
    race.previousPoses = cars.map(visualPose);
    race.elapsed += dt;
    const { gas, brake } = input;
    const throttle = gas && !brake;
    if (race.throttle && !throttle && upgrades.engine > 0 && player.speed > 13 &&
        race.elapsed - (race.backfire?.time ?? -Infinity) > 0.32) {
      race.backfire = { time: race.elapsed, intensity: 0.58 + upgrades.engine * 0.18 };
    }
    race.throttle = throttle;
    const active = race.cars.filter(car => car.finishTime == null || car.speed > 1);
    const rivalControls = opponents.map(car => raceIntel.controls(car, cars, race.elapsed, dt));
    advanceVehicle(player, { ...input, draft: wakeFactor(track, player, cars, relativeStation) }, playerHandling, dt, true);
    opponents.forEach((car, index) => {
      if (car.finishTime == null || car.speed > 1) advanceVehicle(car, rivalControls[index], raceIntel.handling, dt);
    });
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];
        reportImpact(resolveVehicleContact(a, b), a, b);
      }
    }
    for (const car of active) trackProgress(car, dt);
    if (player.finishTime != null) {
      race.elapsed = player.finishTime;
      classify();
    }
  }

  race.reset = () => rejoin(player);
  race.update = update;
  race.position = () => race.order ? race.order.indexOf(player.id) + 1
    : 1 + opponents.filter(car => car.station > player.station).length;
  return race;
}
