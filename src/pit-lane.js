import { angleBetween, clamp } from './vehicle-physics.js';
import { compoundId, recommendedCompound, tireHealth } from './tire-strategy.js';
import { vehicleCondition } from './vehicle-damage.js';

export const pitSpeed = 80 / 3.6;
const smooth = value => { const x = clamp(value, 0, 1); return x * x * (3 - 2 * x); };

export function buildPitLane(track) {
  const entry = -43, laneStart = -15, box = 18, laneEnd = 48, exit = 76;
  const side = track.event.pitSide ?? -1;
  const edge = track.event.width / 2;
  const center = side * (edge + 2.38);
  const halfWidth = 1.94;
  const wrap = station => ((station - entry + track.length * 0.5) % track.length + track.length) % track.length -
    track.length * 0.5 + entry;
  const offsetAt = station => {
    const path = smooth((station - entry) / (laneStart - entry)) * smooth((exit - station) / (exit - laneEnd));
    return side * (edge - 2.05) + (center - side * (edge - 2.05)) * path;
  };
  const contains = (station, offset) => {
    const local = wrap(station);
    return local > entry && local < exit && side * offset > edge + 0.12 && Math.abs(offset - offsetAt(local)) < halfWidth + 0.18;
  };
  return { entry, laneStart, box, laneEnd, exit, side, center, halfWidth, edge, wrap, offsetAt, contains };
}

const stateFor = car => ({
  lane: false, remaining: 0, duration: 0, stops: 0, servicedLap: -2, routeLap: null,
  plan: null, service: null, ...car.pit,
});

export function normalizePitPlan(value, fallback = 'medium') {
  return { compound: compoundId(value?.compound ?? fallback), repair: value?.repair === true };
}

export function restorePitCar(car, state) {
  const count = (value, max, fallback) => Number.isFinite(value) ? clamp(value, 0, max) : fallback;
  car.pit = stateFor({});
  if (!state) return;
  car.pit.lane = state.lane === true;
  car.pit.duration = count(state.duration, 12, 0);
  car.pit.remaining = count(state.remaining, car.pit.duration, 0);
  car.pit.stops = Math.floor(count(state.stops, 30, 0));
  car.pit.servicedLap = Number.isInteger(state.servicedLap) ? state.servicedLap : -2;
  car.pit.routeLap = Number.isInteger(state.routeLap) ? state.routeLap : null;
  car.pit.plan = state.plan ? normalizePitPlan(state.plan) : null;
  car.pit.service = state.service ? normalizePitPlan(state.service) : null;
  if (!car.pit.service) car.pit.remaining = 0;
}

export function createPitControl(race, plan) {
  const { track, player, opponents, cars } = race;
  const lane = track.pit;
  cars.forEach(car => { car.pit = stateFor(car); });
  const pit = { plan: normalizePitPlan(plan, player.compound) };

  const lapAt = car => Math.round((car.station - lane.wrap(car.station)) / track.length);
  const boxFor = car => lane.box + (car === player ? 0 : [-12, -6, 6, 12][opponents.indexOf(car)]);

  function aiRoute(car, controls) {
    if (car === player || car.damage >= 100 || car.finishTime != null) return controls;
    const state = car.pit;
    const local = lane.wrap(car.station);
    const lap = lapAt(car);
    if (state.routeLap !== null && (local > lane.exit + 3 || lap > state.routeLap)) {
      state.routeLap = null;
      state.plan = null;
    }
    const lapsLeft = track.event.laps - lap;
    const wetChange = race.wetness > 0.40 && car.compound !== 'rain';
    const drying = race.wetness < 0.20 && car.compound === 'rain';
    if (state.routeLap === null && lap > 0 && lapsLeft > 0 && lap - state.servicedLap >= 1 &&
        local > lane.entry - 26 && local < lane.entry - 10 && (wetChange || drying || tireHealth(car) < 0.23)) {
      state.routeLap = lap;
      state.plan = { compound: recommendedCompound(race.wetness, lapsLeft), repair: car.damage > 39 };
    }
    if (state.routeLap !== lap) return controls;
    const distance = boxFor(car) - local;
    const stillNeedsBox = state.servicedLap !== lap && distance > -2.7;
    const look = Math.min(stillNeedsBox ? Math.max(2, distance + 1) : 13, 4 + Math.max(0, car.speed) * 0.40);
    const target = track.at(car.station + look, lane.offsetAt(local + look));
    const yaw = Math.atan2(target.x - car.x, target.z - car.z);
    const heading = angleBetween(car.yaw, yaw);
    const stop = stillNeedsBox ? Math.sqrt(Math.max(0, distance - 0.62) * 2 * 5.7) : pitSpeed;
    const pace = Math.min(pitSpeed, stop);
    return { ...controls, steering: -clamp(heading * 4.25, -1, 1),
      gas: clamp((pace - car.speed) * 0.37, 0, 1), brake: clamp((car.speed - pace + 0.02) * 0.40, 0, 1), draft: 0 };
  }

  function controlsFor(car, controls) {
    const state = car.pit;
    const selected = aiRoute(car, controls);
    if (state.remaining > 0) return { ...selected, gas: 0, brake: 1, steering: 0, holdPosition: true, speedLimit: 0, draft: 0 };
    if (!state.lane) return selected;
    return { ...selected, speedLimit: pitSpeed, draft: 0 };
  }

  function update(car, projection, dt) {
    const state = car.pit;
    const local = lane.wrap(projection.station);
    state.lane = lane.contains(projection.station, projection.offset);
    if (state.remaining > 0) {
      state.remaining = Math.max(0, state.remaining - dt);
      if (!state.remaining) {
        const service = state.service;
        race.fitTires(car, service.compound);
        if (service.repair) Object.assign(car, vehicleCondition());
        state.stops++;
        state.servicedLap = lapAt(car);
        state.service = null;
        if (car === player) race.refreshHandling();
      }
      return;
    }
    if (car.damage >= 100 || car.finishTime != null || !state.lane ||
        state.servicedLap === lapAt(car) || Math.hypot(car.speed, car.lateral) > 0.82 ||
        Math.abs(local - boxFor(car)) > 2.9 || Math.abs(projection.offset - lane.center) > 1.19) return;
    if (car !== player && !state.plan) return;
    state.service = { ...(car === player ? pit.plan : state.plan) };
    state.duration = 2.25 + (state.service.repair ? car.damage * 0.046 : 0);
    state.remaining = state.duration;
    car.speed = car.lateral = car.spin = 0;
  }

  return { pit, update, controlsFor };
}
