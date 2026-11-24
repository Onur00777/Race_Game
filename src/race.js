import { CatmullRomCurve3, Vector3 } from 'three';
import { rivals } from './career.js';
import { railRunoff, resolveBarrierContact, resolveVehicleContact } from './contact.js';
import { vehicleStats } from './setup.js';
import { difficultyId } from './difficulty.js';
import { advanceVehicle, angleBetween, clamp } from './vehicle-physics.js';
import { createRaceIntel, wakeFactor } from './race-ai.js';
import { createTires, updateTires } from './tires.js';
import { applyImpact, damagePerformance, vehicleCondition } from './vehicle-damage.js';
import { launchRPM, normalizeElectronics, tractionMode, tractionModes } from './ecu.js';
import { applyTireGrip, fitTires, recommendedCompound, wearTires, weatherTarget } from './tire-strategy.js';
import { buildPitLane, createPitControl } from './pit-lane.js';
import { createRaceControl } from './race-control.js';

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

  const track = { event, length, spacing, railOffset, samples, at, project };
  track.pit = buildPitLane(track);
  return track;
}

const bodyState = condition => ({ speed: 0, lateral: 0, spin: 0, steer: 0, ...vehicleCondition(condition),
  wheels: createTires(), tireSlip: 0 });

export function createRace(track, team, upgrades, setup, appearance, options = {}) {
  const finish = track.length * track.event.laps;
  const player = {
    id: 'player', color: team.color, station: -18, ...track.at(-18, 2.5), ...bodyState(options.condition),
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
  const race = { track, player, opponents, cars, difficulty: difficultyId(options.difficulty),
    runId: options.runId ?? (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)), previousPoses: cars.map(visualPose),
    elapsed: 0, countdown: 3, order: null, impact: null, impacts: [], retired: false, throttle: false, backfire: null, engineLevel: upgrades.engine };
  race.dynamicWeather = options.dynamicWeather !== false;
  race.wetness = Number.isFinite(options.wetness) ? clamp(options.wetness, 0, 1) : weatherTarget(track.event, 0);
  fitTires(player, setup?.compound);
  opponents.forEach((car, index) => fitTires(car, race.wetness >= 0.37 ? 'rain' :
    index === 0 ? recommendedCompound(race.wetness, track.event.laps) : index === 3 && track.event.laps > 3 ? 'hard' : 'medium'));
  cars.forEach(car => applyTireGrip(car, race.wetness));
  const surfaceGrip = track.event.surfaceGrip;
  const electronics = normalizeElectronics(options.electronics);
  const playerHandling = { ...vehicleStats(team, upgrades, { ...setup, compound: 'medium' }),
    surfaceGrip, ecu: electronics, tcMode: tractionMode(setup?.tcMode) };
  race.electronics = electronics;
  race.tcMode = tractionMode(options.tcMode ?? setup?.tcMode);
  race.launchHold = 0;
  race.rotateTC = () => {
    if (electronics.traction) race.tcMode = tractionModes[(tractionModes.indexOf(race.tcMode) + 1) % tractionModes.length];
  };
  const { topSpeed, braking, grip, load } = playerHandling;
  let impactSerial = 0;
  let handlingUpdated = 0;

  function refreshHandling() {
    const performance = damagePerformance(player);
    const tyre = (player.tireGrip ?? 1) * surfaceGrip;
    const next = { topSpeed: (topSpeed + (player.tireSpeedDelta ?? 0)) * performance.speed,
      braking: braking * tyre, grip: (grip * performance.grip + load * 0.018 * performance.aero) * tyre };
    if (!race.handling || Object.keys(next).some(stat => Math.abs(next[stat] - race.handling[stat]) > 0.04)) race.handling = next;
    handlingUpdated = race.elapsed;
  }
  refreshHandling();

  function relativeStation(station, reference) {
    return wrap(station - reference + track.length / 2, track.length) - track.length / 2;
  }

  const raceIntel = createRaceIntel(track, race.difficulty, opponents, relativeStation);
  const pitControl = createPitControl(race, options.pitPlan);
  race.pit = pitControl.pit;
  const raceControl = createRaceControl(race, options.raceControl);
  race.control = raceControl.state;

  function rejoin(car) {
    const nearby = cars.filter(other => other !== car && Math.abs(relativeStation(other.station, car.station)) < 5.5);
    const offset = [0, -4.2, 4.2].find(lane => nearby.every(other => Math.abs(other.offset - lane) > 2.5)) ?? 0;
    Object.assign(car, track.at(car.station, offset), { speed: 0, lateral: 0, spin: 0, steer: 0, yawRate: 0,
      offset, onRoad: true, stuck: 0, aiOffset: offset, wheels: createTires(), tireSlip: 0 });
    race.previousPoses[cars.indexOf(car)] = visualPose(car);
  }

  function reportImpact(impact, first, second) {
    if (!impact) return;
    const primary = applyImpact(first, impact, false, Boolean(second));
    const secondary = second && applyImpact(second, impact, true, true);
    const own = first === player ? primary : second === player ? secondary : null;
    if (own) refreshHandling();
    if (impact.impulse < 1.15) return;
    const event = { ...impact, kind: second ? 'vehicle' : 'rail', time: race.elapsed, serial: ++impactSerial };
    raceControl.report(event, first, second);
    if (impact.normalSpeed > 5.4 && impact.impulse > 2.7) {
      race.impacts.push(event);
      if (race.impacts.length > 32) race.impacts.shift();
    }
    if (first === player || second === player) {
      const sign = first === player ? 1 : -1;
      race.impact = { ...event, nx: event.nx * sign, nz: event.nz * sign, zone: own?.zone, loss: own?.amount ?? 0 };
    }
  }

  function trackProgress(car, controls, handling, dt) {
    let projection = track.project(car.x, car.z);
    if (projection.distance > track.railOffset + 8) {
      rejoin(car);
      return;
    }
    const { x, z } = car;
    reportImpact(resolveBarrierContact(car, projection, track.railOffset), car);
    if (car.x !== x || car.z !== z) projection = track.project(car.x, car.z);
    car.offset = projection.offset;
    pitControl.update(car, projection, dt);
    car.onRoad = car.pit.lane || projection.distance <= track.event.width / 2 + 0.6;
    updateTires(car, controls, handling, projection, track.event.width / 2, dt,
      (station, offset) => track.pit.contains(station, offset));
    wearTires(car, race.wetness, dt);
    const delta = relativeStation(projection.station, car.station);
    const previous = car.station;
    // Reject projection jumps between different sections of a hairpin.
    const advance = Math.abs(delta) < 6 ? delta : 0;
    car.station += advance;
    if (car.finishTime == null && car.damage < 100 && car.station >= finish) car.finishTime = race.elapsed - dt + dt * (finish - previous) / advance;
    if (car === player) updateLap(previous);
    else if (car.finishTime == null && car.damage < 100) {
      car.stuck = advance < dt * 0.25 && !car.pit.remaining ? car.stuck + dt : 0;
      if (car.stuck > 5.5) {
        car.rejoins = (car.rejoins ?? 0) + 1;
        rejoin(car);
      }
    }
  }

  function updateLap(previous) {
    const lap = Math.floor(player.station / track.length);
    if (lap < player.lap || player.station < 0 || (previous >= 0 && lap <= player.lap)) return;
    if (lap > player.lap && player.invalidatedLap !== player.lap) {
      const lapTime = (player.finishTime ?? race.elapsed) - player.lapStarted;
      player.bestLap = Math.min(player.bestLap ?? Infinity, lapTime);
    }
    player.lap = lap;
    player.lapStarted = race.elapsed;
  }

  function classify(retired = false) {
    race.retired = retired;
    race.retiredDrivers = cars.filter(car => car.damage >= 100 && car.finishTime == null).map(car => car.id);
    if (retired && !race.retiredDrivers.includes(player.id)) race.retiredDrivers.push(player.id);
    const stopped = new Set(race.retiredDrivers);
    const resultTime = car => (car.finishTime ?? Infinity) + (car.timePenalty ?? 0);
    race.order = [...cars].sort((a, b) => Number(stopped.has(a.id)) - Number(stopped.has(b.id)) ||
      resultTime(a) - resultTime(b) || b.station - a.station).map(car => car.id);
  }

  function update(dt, input) {
    if (race.order || race.control.flag === 'red') return;
    if (player.damage >= 100 && player.finishTime == null) {
      classify(true);
      return;
    }
    if (race.countdown > 0) {
      race.launchHold = launchRPM(electronics.launch, input.gas, input.brake);
      race.countdown = Math.max(0, race.countdown - dt);
      return;
    }
    race.previousPoses = cars.map(visualPose);
    race.elapsed += dt;
    if (race.dynamicWeather) {
      const leadingLap = Math.floor(Math.max(...cars.map(car => car.station)) / track.length);
      const target = weatherTarget(track.event, leadingLap);
      race.wetness += clamp(target - race.wetness, -dt * 0.012, dt * 0.032);
    }
    const { gas, brake } = input;
    const throttle = gas && !brake;
    if (race.throttle && !throttle && upgrades.engine > 0 && player.speed > 13 &&
        race.elapsed - (race.backfire?.time ?? -Infinity) > 0.32) {
      race.backfire = { time: race.elapsed, intensity: 0.58 + upgrades.engine * 0.18 };
    }
    race.throttle = throttle;
    const active = cars.filter(car => car.finishTime == null || (car !== player && car.speed > 1));
    active.forEach(car => applyTireGrip(car, race.wetness));
    if (race.elapsed - handlingUpdated > 0.9) refreshHandling();
    race.launchHold = 0;
    const controls = active.map(car => car === player ? { ...input, launch: race.elapsed < (race.restartLaunchUntil ?? 3.6), tcMode: race.tcMode,
      draft: wakeFactor(track, player, cars, relativeStation) } :
      car.damage >= 100 ? { gas: 0, brake: 0.34, steering: 0 } : raceIntel.controls(car, cars, race.elapsed, dt));
    active.forEach((car, index) => {
      controls[index] = raceControl.limit(car, pitControl.controlsFor(car, controls[index]));
      advanceVehicle(car, controls[index], car === player ? playerHandling : raceIntel.handling, dt, car === player);
    });
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];
        reportImpact(resolveVehicleContact(a, b), a, b);
      }
    }
    active.forEach((car, index) => trackProgress(car, controls[index], car === player ? playerHandling : raceIntel.handling, dt));
    if (player.damage >= 100 && player.finishTime == null) {
      classify(true);
    } else if (player.finishTime != null) {
      const corrected = player.finishTime + (player.timePenalty ?? 0);
      if (race.elapsed >= corrected || opponents.every(car => car.finishTime != null || car.damage >= 100)) {
        race.elapsed = corrected;
        classify();
      }
    } else raceControl.update(dt);
  }

  race.reset = () => rejoin(player);
  race.restartAfterRed = plan => {
    if (!raceControl.restart(plan)) return false;
    race.previousPoses = cars.map(visualPose);
    return true;
  };
  race.retire = () => { if (!race.order) classify(true); };
  race.refreshHandling = refreshHandling;
  race.fitTires = (car, compound) => {
    fitTires(car, compound);
    applyTireGrip(car, race.wetness);
    if (car === player) refreshHandling();
  };
  race.update = update;
  race.position = () => race.order ? race.order.indexOf(player.id) + 1
    : 1 + opponents.filter(car => car.station > player.station).length;
  return race;
}
