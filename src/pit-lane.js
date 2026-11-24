import { angleBetween, clamp } from './vehicle-physics.js';
import { compoundId, recommendedCompound, tireHealth } from './tire-strategy.js';
import { vehicleCondition } from './vehicle-damage.js';

export const pitSpeed = 80 / 3.6;
export const pitLayoutVersion = 2;
const smooth = value => { const x = clamp(value, 0, 1); return x * x * (3 - 2 * x); };

export function buildPitLane(track) {
  const entry = -88, laneStart = -33, box = 19, laneEnd = 68, exit = 113;
  const wallStart = -24, wallEnd = 59, speedLine = -50;
  const side = track.event.pitSide ?? -1;
  const edge = track.event.width / 2;
  const center = side * (edge + 6.15);
  const stallCenter = side * (edge + 7.23);
  const fastCenter = side * (edge + 3.55);
  const halfWidth = 4.15;
  const wallOffset = side * (edge + 1.9);
  const wallWidth = 0.48;
  const wrap = station => ((station + track.length * 0.5) % track.length + track.length) % track.length - track.length * 0.5;
  const taper = station => smooth((station - entry) / (laneStart - entry)) * smooth((exit - station) / (exit - laneEnd));
  const offsetAt = station => {
    return side * (edge - 1.85) + (center - side * (edge - 1.85)) * taper(station);
  };
  const widthAt = station => 1.68 + (halfWidth - 1.68) * taper(station);
  const railAt = station => {
    const local = wrap(station);
    const verge = smooth((local - entry + 18) / 38) * smooth((exit + 13 - local) / 28);
    return track.railOffset + (edge + 11 - track.railOffset) * verge;
  };
  const wallAt = station => {
    const local = wrap(station);
    return local >= wallStart && local <= wallEnd;
  };
  const contains = (station, offset) => {
    const local = wrap(station);
    return local > speedLine && local < exit && side * offset > (wallAt(station) ? Math.abs(wallOffset) : edge + 0.10) &&
      Math.abs(offset - offsetAt(local)) < widthAt(local) + 0.18;
  };
  return { entry, laneStart, box, laneEnd, exit, wallStart, wallEnd, wallOffset, wallWidth, speedLine,
    side, center, stallCenter, fastCenter, halfWidth, edge, wrap, offsetAt, widthAt, taper, railAt, wallAt, contains };
}

export const pitStall = (lane, index) => lane.box + (index < 0 ? 0 : [-12, -6, 6, 12][index]);

export function migratePitPosition(track, car, index) {
  const lane = track.pit;
  const local = lane.wrap(car.station);
  const box = pitStall(lane, index - 1);
  const offset = car.pit.remaining > 0 ? lane.stallCenter :
    lane.offsetAt(local) + (lane.fastCenter - lane.center) * lane.taper(local);
  const station = car.pit.remaining > 0 ? car.station - local + box : car.station;
  Object.assign(car, track.at(station, offset), { station, offset, onRoad: true });
  car.pit.lane = lane.contains(station, offset);
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
  const boxFor = car => pitStall(lane, opponents.indexOf(car));

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
        local > lane.entry - 107 && local < lane.entry - 79 && (wetChange || drying || tireHealth(car) < 0.23)) {
      state.routeLap = lap;
      state.plan = { compound: recommendedCompound(race.wetness, lapsLeft), repair: car.damage > 39 };
    }
    if (state.routeLap !== lap) return controls;
    const distance = boxFor(car) - local;
    const outsideStall = Math.abs(car.offset - lane.stallCenter) > 1.2;
    if (distance < -2.7 || (distance < 0.73 && outsideStall)) state.plan = null;
    const stillNeedsBox = Boolean(state.plan) && state.servicedLap !== lap;
    const look = Math.min(stillNeedsBox ? Math.max(2, distance + 1) : 13, 4 + Math.max(0, car.speed) * 0.40);
    const ahead = local + look;
    const baseOffset = lane.offsetAt(ahead);
    const laneBlend = lane.taper(ahead);
    const moveToStall = stillNeedsBox ? smooth((24 - distance + look) / 19) : 0;
    const targetOffset = baseOffset + (lane.fastCenter - lane.center + (lane.stallCenter - lane.fastCenter) * moveToStall) * laneBlend;
    const target = track.at(car.station + look, targetOffset);
    const yaw = Math.atan2(target.x - car.x, target.z - car.z);
    const heading = angleBetween(car.yaw, yaw);
    const deceleration = 1.12 + Math.min(1.35, (car.tireGrip ?? 1) * track.event.surfaceGrip);
    const stop = stillNeedsBox ? Math.sqrt(Math.max(0, distance - 0.58) * 2 * deceleration) : pitSpeed;
    let pace = Math.min(pitSpeed, stop);
    for (const other of cars) {
      if (other === car || (!other.pit.lane && other.pit.routeLap !== lap)) continue;
      const gap = other.station - car.station;
      if (gap <= 0 || gap > 28 || Math.abs(other.offset - car.offset) > 2.04) continue;
      pace = Math.min(pace, Math.sqrt(Math.max(0, other.speed) ** 2 + 2 * deceleration * Math.max(0, gap - 5.1)));
    }
    const thresholdBrake = clamp((car.tireGrip ?? 1) * track.event.surfaceGrip * 0.80, 0.26, 0.81);
    return { ...controls, steering: local < lane.entry - 30 ? controls.steering : -clamp(heading * 4.25, -1, 1),
      gas: clamp((pace - car.speed) * 0.37, 0, 1), brake: clamp((car.speed - pace) * 0.78, 0, thresholdBrake), draft: 0 };
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
        if (service.repair) Object.assign(car, vehicleCondition(), { engineTemperature: Math.min(91, car.engineTemperature) });
        state.stops++;
        state.servicedLap = lapAt(car);
        state.service = null;
        if (car === player) race.refreshHandling();
      }
      return;
    }
    if (car.damage >= 100 || car.finishTime != null || !state.lane ||
        state.servicedLap === lapAt(car) || Math.hypot(car.speed, car.lateral) > 0.82 ||
        Math.abs(local - boxFor(car)) > 2.9 || Math.abs(projection.offset - lane.stallCenter) > 1.20) return;
    if (car !== player && !state.plan) return;
    state.service = { ...(car === player ? pit.plan : state.plan) };
    state.duration = 2.25 + (state.service.repair ? car.damage * 0.046 : 0);
    state.remaining = state.duration;
    car.speed = car.lateral = car.spin = 0;
  }

  return { pit, update, controlsFor };
}
