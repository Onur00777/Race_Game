import { currentEvent, normalizeLoadout, teamById } from './career.js';
import { createRace } from './race.js';
import { legacyEvents } from './events.js';
import { difficultyId } from './difficulty.js';
import { vehicleCondition } from './vehicle-damage.js';

const carFields = ['x', 'z', 'yaw', 'speed', 'lateral', 'spin', 'steer', 'station',
  'damage', 'frontDamage', 'rearDamage'];

export function raceCheckpoint(career, race, loadout, alternateCamera) {
  return {
    version: 3,
    event: race.track.event.id,
    runId: race.runId,
    legacy: race.track.event.legacy === true,
    season: career.season,
    round: career.results.length,
    difficulty: race.difficulty,
    tcMode: race.tcMode,
    loadout,
    alternateCamera,
    elapsed: race.elapsed,
    countdown: race.countdown,
    cars: race.cars.map((car, index) => ({
      ...Object.fromEntries(carFields.map(key => [key, car[key]])),
      leftDamage: car.leftDamage, rightDamage: car.rightDamage,
      id: car.id, offset: car.offset, onRoad: car.onRoad,
      ...(index === 0
        ? { lap: car.lap, lapStarted: car.lapStarted, bestLap: car.bestLap }
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

export function eventForResume(career) {
  if (!hasSavedRace(career)) return currentEvent(career);
  const save = career.activeRace;
  return (save.version === 1 || save.legacy ? legacyEvents[save.round] : null) ?? currentEvent(career);
}

export function restoreRace(career, track) {
  if (!hasSavedRace(career)) return null;
  const save = career.activeRace;
  const event = eventForResume(career);
  if (track.event.id !== event.id || track.event.laps !== event.laps) return null;
  const loadout = normalizeLoadout(save.loadout);
  const race = createRace(track, teamById(loadout.team), loadout.upgrades, loadout.setup, loadout.appearance,
    { difficulty: eventDifficulty(career), runId: typeof save.runId === 'string' ? save.runId : undefined,
      electronics: loadout.electronics, tcMode: save.tcMode });
  if (!Number.isFinite(save.elapsed) || save.elapsed < 0 ||
      !Number.isFinite(save.countdown) || save.countdown < 0 || save.countdown > 3 ||
      !Array.isArray(save.cars) || save.cars.length !== race.cars.length) return null;

  for (const [i, car] of race.cars.entries()) {
    const state = save.cars[i];
    if (!state || car.id !== state.id || !carFields.every(key => Number.isFinite(state[key]))) return null;
    for (const key of carFields) car[key] = state[key];
    Object.assign(car, vehicleCondition(state));
    const projection = track.project(car.x, car.z);
    car.offset = Number.isFinite(state.offset) ? state.offset : projection.offset;
    car.onRoad = typeof state.onRoad === 'boolean' ? state.onRoad : projection.distance <= event.width / 2 + 0.6;
    if (i === 0) {
      if (!Number.isInteger(state.lap) || state.lap < 0 || state.lap >= track.event.laps ||
          !Number.isFinite(state.lapStarted) || !(state.bestLap === null || Number.isFinite(state.bestLap))) return null;
      Object.assign(car, { lap: state.lap, lapStarted: state.lapStarted, bestLap: state.bestLap });
    } else {
      if (!Number.isFinite(state.offset) || !(state.finishTime === null || Number.isFinite(state.finishTime))) return null;
      Object.assign(car, { aiOffset: Number.isFinite(state.aiOffset) ? state.aiOffset : car.offset,
        stuck: Number.isFinite(state.stuck) ? Math.max(0, Math.min(5.5, state.stuck)) : 0, finishTime: state.finishTime });
    }
    race.previousPoses[i] = { x: car.x, z: car.z, yaw: car.yaw, speed: car.speed, steer: car.steer, station: car.station };
  }
  race.elapsed = save.elapsed;
  race.countdown = save.countdown;
  race.refreshHandling();
  return { race, loadout, alternateCamera: save.alternateCamera === true };
}
