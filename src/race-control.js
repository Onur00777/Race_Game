import { angleBetween, clamp } from './vehicle-physics.js';
import { compoundId, recommendedCompound } from './tire-strategy.js';
import { createTires } from './tires.js';
import { damageZones } from './vehicle-damage.js';

const halfSector = 43;
const speedUnderYellow = 80 / 3.6;
const activeCar = car => car.finishTime == null && car.damage < 100;

export function createRaceControl(race, saved) {
  const { track, cars, player } = race;
  const ids = new Set(cars.map(car => car.id));
  const participants = value => Array.isArray(value) ? [...new Set(value.filter(id => ids.has(id)))] : [];
  const time = value => Number.isFinite(value) ? Math.max(0, value) : 0;
  const state = {
    flag: ['green', 'yellow', 'red'].includes(saved?.flag) ? saved.flag : 'green',
    changed: time(saved?.changed), graceUntil: time(saved?.graceUntil),
    sector: Number.isFinite(saved?.sector) ? saved.sector : 0,
    protected: participants(saved?.protected), hazards: participants(saved?.hazards),
    violations: participants(saved?.violations), clearAt: time(saved?.clearAt),
  };
  const stall = new Map();
  const severe = [];
  const disabledByWheel = new Map();
  let focus;
  let debrisFocus;

  function reportDetached(car) {
    disabledByWheel.set(car.id, race.elapsed + 6.2);
    debrisFocus ??= car.station;
  }

  function inSector(station) {
    const period = track.length;
    const gap = ((station - state.sector + period / 2) % period + period) % period - period / 2;
    return Math.abs(gap) < halfSector;
  }

  function report(impact, first, second) {
    if (impact.normalSpeed >= 11 && first.onRoad && Math.abs(first.offset) < track.event.width / 2 - 0.1) focus = first.station;
    if (second && impact.normalSpeed >= 14 && (first.onRoad || second.onRoad)) {
      severe.push({ time: race.elapsed, first: first.id, second: second.id, station: first.station });
    }
  }

  function danger(car, dt) {
    if (car.finishTime != null || !car.onRoad || car.pit.lane || car.recovered) {
      stall.delete(car.id);
      return false;
    }
    const forward = track.at(car.station).yaw;
    const spin = Math.abs(car.spin) > 1.07 && Math.abs(angleBetween(forward, car.yaw)) > 0.41 && car.speed > 4;
    const stationary = Math.abs(car.speed) < 1.5 && !car.pit.remaining;
    const stopped = stationary ? (stall.get(car.id) ?? 0) + dt : 0;
    stall.set(car.id, stopped);
    return spin || (car.damage >= 74 && car.speed < 9) || stopped > (car === player ? 5 : 2.7);
  }

  function announce(flag, sector, hazards) {
    state.flag = flag;
    state.changed = race.elapsed;
    state.clearAt = 0;
    if (flag === 'green') {
      state.hazards = state.protected = state.violations = [];
      return;
    }
    state.sector = sector;
    state.hazards = hazards.map(car => car.id);
    state.protected = cars.filter(car => activeCar(car) && !state.hazards.includes(car.id))
      .sort((a, b) => b.station - a.station).map(car => car.id);
    state.violations = [];
  }

  function recover(car) {
    const offset = -track.pit.side * (track.railOffset - 1.36);
    Object.assign(car, track.at(car.station, offset), { offset, speed: 0, lateral: 0, spin: 0,
      onRoad: false, recovered: car.damage >= 100, stuck: 0 });
  }

  function update(dt) {
    while (severe.length && race.elapsed - severe[0].time > 2.7) severe.shift();
    if (race.elapsed < Math.max(5.2, state.graceUntil) && !disabledByWheel.size) {
      focus = undefined;
      severe.length = 0;
      return;
    }
    for (const [id, expiry] of disabledByWheel) if (expiry < race.elapsed) disabledByWheel.delete(id);
    const looseWheelSectors = race.looseWheels.map(wheel => track.project(wheel.x, wheel.z))
      .filter(point => point.distance < track.event.width / 2).map(point => point.station);
    let hazards = cars.filter(car => disabledByWheel.has(car.id) || danger(car, dt));
    if (state.flag === 'yellow' && race.elapsed - state.changed >= 18) {
      for (const car of hazards) {
        if (!inSector(car.station) || car === player) continue;
        recover(car);
        stall.delete(car.id);
      }
      hazards = hazards.filter(car => car.onRoad);
    }
    const hotspot = severe[0]?.station;
    const nearby = severe.filter(hit => Math.abs(hit.station - hotspot) < 57 ||
      track.length - Math.abs(hit.station - hotspot) < 57 && Math.abs(hit.station - hotspot) < track.length + 57);
    const chain = new Set(nearby.flatMap(hit => [hit.first, hit.second]));
    const crowded = hazards.find(hazard => hazards.filter(car =>
      Math.abs(car.station - hazard.station) <= 19 && (stall.get(car.id) > 4 || car.damage > 65)).length >= 3);
    if (chain.size >= 3 || crowded) {
      announce('red', crowded?.station ?? hotspot, hazards);
      return;
    }
    if (state.flag !== 'yellow' && (hazards.length || Number.isFinite(focus) || Number.isFinite(debrisFocus) || looseWheelSectors.length)) {
      const center = debrisFocus ?? hazards[0]?.station ?? focus ?? looseWheelSectors[0];
      announce('yellow', center, hazards.filter(car => Math.abs(car.station - center) <= halfSector));
    }
    focus = undefined;
    debrisFocus = undefined;
    if (state.flag !== 'yellow') return;
    const live = hazards.filter(car => inSector(car.station));
    const obstruction = looseWheelSectors.some(inSector);
    if (live.length || obstruction) {
      state.hazards = [...new Set([...state.hazards, ...live.map(car => car.id)])];
      state.clearAt = 0;
    } else if (!state.clearAt) {
      state.clearAt = Math.max(race.elapsed + 2.25, state.changed + 4.2);
    }
    if (state.clearAt && race.elapsed >= state.clearAt) return announce('green');
    penalizePasses();
  }

  function priorOrder(car) {
    const index = state.protected.indexOf(car.id);
    for (let entry = index - 1; entry >= 0; entry--) {
      const id = state.protected[entry];
      if (state.hazards.includes(id)) continue;
      const candidate = cars.find(other => other.id === id);
      if (activeCar(candidate) && !candidate.pit.lane && inSector(candidate.station)) return candidate;
    }
    return null;
  }

  function penalizePasses() {
    for (const car of cars) {
      if (!activeCar(car) || car.pit.lane || !inSector(car.station) ||
          state.violations.includes(car.id) || state.hazards.includes(car.id)) continue;
      const lead = priorOrder(car);
      if (lead && car.station - lead.station > 1.2 && car.station - lead.station < 22) {
        car.timePenalty = (car.timePenalty ?? 0) + 3;
        state.violations.push(car.id);
      }
    }
  }

  function limit(car, controls) {
    if (state.flag !== 'yellow' || !inSector(car.station) || car.pit.lane) return controls;
    const lead = priorOrder(car);
    const gap = lead?.station - car.station;
    const following = lead && gap > -22 && gap < 21 ? Math.max(0, lead.speed + (gap - 4) * 0.81) : Infinity;
    const speedLimit = Math.min(controls.speedLimit ?? Infinity, speedUnderYellow, following);
    return { ...controls, speedLimit, draft: 0 };
  }

  function restart(plan) {
    if (state.flag !== 'red' || !activeCar(player)) return false;
    const grid = cars.filter(activeCar).sort((a, b) => b.station - a.station);
    grid.forEach((car, index) => {
      const lap = Math.max(0, car === player ? car.lap : Math.floor(car.station / track.length));
      const station = lap * track.length - (3 + Math.floor(index / 2) * 8);
      const offset = index % 2 ? 2.5 : -2.5;
      Object.assign(car, track.at(station, offset), { station, offset, speed: 0, lateral: 0, yawRate: 0,
        spin: 0, steer: 0, stuck: 0, aiOffset: offset, onRoad: true, wheels: createTires() });
      Object.assign(car.pit, { lane: false, remaining: 0, duration: 0, service: null, routeLap: null, plan: null });
      const compound = car === player ? compoundId(plan?.compound ?? car.compound) :
        recommendedCompound(race.wetness, track.event.laps - lap);
      race.fitTires(car, compound);
      if ((car === player ? plan?.repair : true) && car.damage > 0) {
        const fraction = Math.max(0, car.damage - 18) / car.damage;
        car.damage *= fraction;
        for (const zone of [...damageZones, 'hoodDamage', 'splitterDamage', 'wingDamage']) {
          if ((zone === 'splitterDamage' || zone === 'wingDamage') && car[zone] === 1) continue;
          car[zone] *= fraction;
        }
      }
    });
    player.lapStarted = race.elapsed;
    player.invalidatedLap = player.lap;
    race.countdown = 3;
    race.launchHold = 0;
    race.restartLaunchUntil = race.elapsed + 3.6;
    race.impact = null;
    announce('green');
    state.graceUntil = race.elapsed + 5.2;
    severe.length = 0;
    disabledByWheel.clear();
    stall.clear();
    focus = undefined;
    race.refreshHandling();
    return true;
  }

  return { state, report, reportDetached, update, limit, restart };
}
