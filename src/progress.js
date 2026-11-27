import { currentEvent, normalizeLoadout, teamById } from './career.js';
import { createRace } from './race.js';
import { legacyEvents, originalEvents, trackLayoutVersion } from './events.js';
import { difficultyId } from './difficulty.js';
import { vehicleCondition } from './vehicle-damage.js';
import { applyTireGrip, fitTires } from './tire-strategy.js';
import { migratePitPosition, normalizePitPlan, pitLayoutVersion, restorePitCar } from './pit-lane.js';
import { restoreEngineTemperature } from './thermals.js';
import { restoreLooseWheels } from './loose-wheel.js';

const carFields = ['x', 'z', 'yaw', 'speed', 'lateral', 'spin', 'steer', 'station',
  'damage', 'frontDamage', 'rearDamage'];

export function raceCheckpoint(career, race, loadout, alternateCamera) {
  return {
    version: 3,
    event: race.track.event.id,
    runId: race.runId,
    legacy: race.track.event.legacy === true,
    trackLayout: race.track.event.trackLayout ?? 0,
    season: career.season,
    round: career.results.length,
    difficulty: race.difficulty,
    tcMode: race.tcMode,
    weather: { wetness: race.wetness, dynamic: race.dynamicWeather },
    pitPlan: race.pit.plan,
    pitLayout: pitLayoutVersion,
    raceControl: race.control,
    looseWheels: race.looseWheels,
    redPlan: race.redPlan,
    restartLaunchUntil: race.restartLaunchUntil,
    loadout,
    alternateCamera,
    elapsed: race.elapsed,
    countdown: race.countdown,
    cars: race.cars.map((car, index) => ({
      ...Object.fromEntries(carFields.map(key => [key, car[key]])),
      leftDamage: car.leftDamage, rightDamage: car.rightDamage,
      hoodDamage: car.hoodDamage, splitterDamage: car.splitterDamage, wingDamage: car.wingDamage,
      corners: car.corners,
      compound: car.compound, tireLife: car.tireLife, tireTemperatures: car.tireTemperatures, engineTemperature: car.engineTemperature,
      pit: car.pit,
      timePenalty: car.timePenalty,
      recovered: car.recovered,
      id: car.id, offset: car.offset, onRoad: car.onRoad,
      ...(index === 0
        ? { lap: car.lap, lapStarted: car.lapStarted, bestLap: car.bestLap, invalidatedLap: car.invalidatedLap, finishTime: car.finishTime }
        : { aiOffset: car.aiOffset, stuck: car.stuck, finishTime: car.finishTime }),
    })),
  };
}

export function hasSavedRace(career) {
  const save = career.activeRace;
  const event = currentEvent(career);
  return Boolean(event && save?.season === career.season && save.round === career.results.length &&
    (save.version === 1 ? legacyEvents[save.round] : (save.version === 2 || save.version === 3) && save.event === event.id));
}

export function eventDifficulty(career) {
  return hasSavedRace(career) ? difficultyId(career.activeRace.difficulty, 'easy') : difficultyId(career.difficulty);
}

export function eventForResume(career, restart = false) {
  if (!hasSavedRace(career)) return currentEvent(career);
  const save = career.activeRace;
  if (save.version === 1 || save.legacy) return legacyEvents[save.round] ?? currentEvent(career);
  return restart || save.trackLayout === trackLayoutVersion ? currentEvent(career) : originalEvents[save.round];
}

export function restoreRace(career, track) {
  if (!hasSavedRace(career)) return null;
  const save = career.activeRace;
  const event = eventForResume(career);
  if (track.event.id !== event.id || track.event.laps !== event.laps || track.event.trackLayout !== event.trackLayout) return null;
  const loadout = normalizeLoadout(save.loadout);
  const race = createRace(track, teamById(loadout.team), loadout.upgrades, loadout.setup, loadout.appearance,
    { difficulty: eventDifficulty(career), runId: typeof save.runId === 'string' ? save.runId : undefined,
      electronics: loadout.electronics, tcMode: save.tcMode,
      wetness: save.weather?.wetness, dynamicWeather: save.weather ? save.weather.dynamic !== false : false,
      pitPlan: save.pitPlan, raceControl: save.raceControl });
  if (!Number.isFinite(save.elapsed) || save.elapsed < 0 ||
      !Number.isFinite(save.countdown) || save.countdown < 0 || save.countdown > 3 ||
      !Array.isArray(save.cars) || save.cars.length !== race.cars.length) return null;

  for (const [i, car] of race.cars.entries()) {
    const state = save.cars[i];
    if (!state || car.id !== state.id || !carFields.every(key => Number.isFinite(state[key]))) return null;
    for (const key of carFields) car[key] = state[key];
    Object.assign(car, vehicleCondition(state));
    fitTires(car, state.compound ?? car.compound, state.tireLife, state.tireTemperatures ?? state.tireTemperature);
    restoreEngineTemperature(car, state.engineTemperature);
    restorePitCar(car, state.pit);
    car.timePenalty = Number.isFinite(state.timePenalty) ? Math.max(0, Math.min(240, state.timePenalty)) : 0;
    car.recovered = state.recovered === true && car.damage >= 100;
    applyTireGrip(car, race.wetness);
    const projection = track.project(car.x, car.z);
    car.offset = Number.isFinite(state.offset) ? state.offset : projection.offset;
    car.onRoad = typeof state.onRoad === 'boolean' ? state.onRoad : projection.distance <= event.width / 2 + 0.6;
    if (save.pitLayout !== pitLayoutVersion && car.pit.lane) migratePitPosition(track, car, i);
    if (i === 0) {
      const finished = Number.isFinite(state.finishTime) && state.finishTime <= save.elapsed;
      if (!Number.isInteger(state.lap) || state.lap < 0 || state.lap > track.event.laps ||
          (state.lap === track.event.laps && !finished && car.station < track.length * track.event.laps) ||
          !Number.isFinite(state.lapStarted) || !(state.bestLap === null || Number.isFinite(state.bestLap))) return null;
      Object.assign(car, { lap: state.lap, lapStarted: state.lapStarted, bestLap: state.bestLap,
        invalidatedLap: Number.isInteger(state.invalidatedLap) ? state.invalidatedLap : undefined });
      if (finished) car.finishTime = state.finishTime;
    } else {
      if (!Number.isFinite(state.offset) || !(state.finishTime === null || Number.isFinite(state.finishTime))) return null;
      Object.assign(car, { aiOffset: Number.isFinite(state.aiOffset) ? state.aiOffset : car.offset,
        stuck: Number.isFinite(state.stuck) ? Math.max(0, Math.min(5.5, state.stuck)) : 0, finishTime: state.finishTime });
    }
    race.previousPoses[i] = { x: car.x, z: car.z, yaw: car.yaw, speed: car.speed, steer: car.steer, station: car.station };
  }
  race.elapsed = save.elapsed;
  race.looseWheels = restoreLooseWheels(save.looseWheels, race.cars.map(car => car.id));
  race.countdown = save.countdown;
  if (save.redPlan) race.redPlan = normalizePitPlan(save.redPlan, race.player.compound);
  if (Number.isFinite(save.restartLaunchUntil)) race.restartLaunchUntil = Math.max(0, Math.min(race.elapsed + 3.6, save.restartLaunchUntil));
  race.refreshHandling();
  return { race, loadout, alternateCamera: save.alternateCamera === true };
}
