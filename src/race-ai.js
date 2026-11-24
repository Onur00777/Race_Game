import { difficulties } from './difficulty.js';
import { makeRacingLine } from './racing-line.js';
import { vehicleStats } from './setup.js';
import { angleBetween, approach, clamp } from './vehicle-physics.js';

const rivalParts = { engine: 0, brakes: 0, tires: 0, aero: 0 };
const privateer = { power: 0, grip: 0 };

export function wakeFactor(track, car, cars, gapBetween) {
  if (car.speed < 12 || !car.onRoad) return 0;
  const entry = track.at(car.station + 3);
  const exit = track.at(car.station + 23);
  if (Math.abs(angleBetween(entry.yaw, exit.yaw)) > 0.19) return 0;
  let draft = 0;
  for (const other of cars) {
    if (other === car || !other.onRoad || other.speed < 11) continue;
    const gap = gapBetween(other.station, car.station);
    const lateral = Math.abs(car.offset - other.offset);
    if (gap < 5 || gap > 25 || lateral >= 1.65 || Math.abs(angleBetween(car.yaw, other.yaw)) > 0.36) continue;
    draft = Math.max(draft, (1 - (gap - 5) / 20) * (1 - lateral / 1.65));
  }
  return draft;
}

export function createRaceIntel(track, difficulty, rivals, gapBetween) {
  const settings = difficulties[difficulty];
  const handling = { ...vehicleStats(privateer, rivalParts), surfaceGrip: track.event.surfaceGrip };
  const aggression = track.event.aggression;
  const profiles = new Map(rivals.map((car, index) => {
    const skill = 0.82 + car.pace * 0.18;
    const speed = handling.topSpeed * settings.speed * skill;
    const line = makeRacingLine(track, { ...handling, topSpeed: speed }, {
      lateralGrip: (13.7 + aggression * 0.75) * settings.grip * track.event.surfaceGrip * skill,
      braking: settings.braking * track.event.surfaceGrip,
    });
    return [car.id, { skill, speed, line, index }];
  }));

  function interactions(car, cars, lane, corner, profile) {
    let speed = Infinity;
    let offset = lane;
    const attack = settings.attack + aggression * 0.10;
    const room = settings.room;
    const width = track.event.width / 2 - 1.35;
    const traffic = cars.filter(other => other !== car && other.finishTime == null).map(other => ({
      other, gap: gapBetween(other.station, car.station),
    })).filter(item => Math.abs(item.gap) < 33);
    const leader = traffic.filter(item => item.gap > 0 && item.gap < 22 &&
      Math.abs(item.other.offset - car.offset) < room).sort((a, b) => a.gap - b.gap)[0];
    const clear = (target, ignore) => target >= -width && target <= width &&
      traffic.every(({ other, gap }) => other === ignore || Math.abs(gap) > 8.5 || Math.abs(other.offset - target) > 2.62);

    if (leader) {
      const { gap, other } = leader;
      const closing = car.speed - other.speed;
      const following = 4.7 + car.speed * (0.17 - attack * 0.08);
      const inside = Math.sign(corner) || (profile.index % 2 ? 1 : -1);
      const first = other.offset + inside * room;
      const second = other.offset - inside * room;
      const pass = Math.abs(corner) < 0.056 && gap < 10 + attack * 9 && closing > (1.6 - attack) &&
        (clear(first, other) ? first : clear(second, other) ? second : null);
      if (typeof pass === 'number') {
        offset = pass;
        if (Math.abs(car.offset - other.offset) < 2.45) speed = Math.max(3, other.speed + (gap - following) * 1.6);
      } else if (gap < following + (settings.draft ? 5 : 10)) {
        speed = Math.max(3, other.speed + (gap - following) * 1.3);
        if (settings.draft && gap > following + 2 && Math.abs(corner) < 0.012) offset = other.offset;
      }
    }

    if (!leader && settings.guard && Math.abs(corner) < 0.035) {
      const threat = traffic.find(({ other, gap }) => gap < -5.5 && gap > -17 && other.speed > car.speed + 1.1 &&
        Math.abs(other.offset - car.offset) < 3.2);
      if (threat) {
        const sign = Math.sign(corner) || Math.sign(threat.other.offset - lane) || 1;
        const cover = clamp(lane + sign * 1.75, -width, width);
        if (clear(cover, threat.other)) offset = cover;
      }
    }

    for (const { other, gap } of traffic) {
      if (Math.abs(gap) > 4.8 || Math.abs(other.offset - car.offset) > room) continue;
      const side = Math.sign(car.offset - other.offset) || (profile.index % 2 ? 1 : -1);
      const clearance = other.offset + side * room;
      offset = side > 0 ? Math.max(offset, clearance) : Math.min(offset, clearance);
      if (Math.abs(clearance) > width && gap > 0) speed = Math.min(speed, Math.max(2, other.speed - 1.7));
    }
    return { speed, offset: clamp(offset, -width, width) };
  }

  function controls(car, cars, elapsed, dt) {
    const profile = profiles.get(car.id);
    const speed = Math.max(0, car.speed);
    const look = clamp(6.6 + speed * settings.look, 7.4, 23);
    const reference = profile.line.sample(car.station + look);
    const now = profile.line.sample(car.station);
    const closing = car.finishTime != null;
    const spread = car.lane * (0.41 + (1 - settings.apex) * 0.12);
    const launch = clamp(1 - elapsed / 5.5, 0, 1);
    const bias = spread * (1 - 0.45 * Math.min(1, Math.abs(reference.curvature) * 26)) + car.lane * launch * 0.50;
    const error = Math.sin(car.station * 0.039 + profile.index * 2.1) * (1 - settings.apex) * 0.82;
    const lane = reference.offset * settings.apex + bias + error;
    const traffic = closing ? { speed: 0, offset: Math.sign(car.lane) * (track.event.width / 2 + 1.5) } :
      interactions(car, cars, lane, reference.curvature, profile);
    car.aiOffset = approach(car.aiOffset ?? car.offset, traffic.offset, (2.15 + settings.attack * 2.0) * dt);
    const point = track.at(car.station + look, car.aiOffset);
    const desiredYaw = Math.atan2(point.x - car.x, point.z - car.z);
    const headingError = -angleBetween(car.yaw, desiredYaw) + Math.atan2(car.lateral, Math.max(10, speed)) * 0.34;
    const steering = clamp(headingError * (3.85 + settings.apex * 0.45), -1, 1);
    const recovering = Math.abs(headingError) > 0.74;
    const draft = !closing && settings.draft ? wakeFactor(track, car, cars, gapBetween) : 0;
    const wetGrip = clamp(Math.sqrt(car.tireGrip ?? 1), 0.65, 1.07);
    const envelope = Math.min(now.targetSpeed * wetGrip + draft * 1.4, traffic.speed);
    const bend = Math.min(1, Math.abs(reference.curvature) * 33);
    const targetSpeed = recovering ? Math.min(envelope, 8.4) : envelope;
    const difference = targetSpeed - speed;
    const trail = settings.trailer * bend * clamp((speed - reference.targetSpeed + 1.4) / 4.6, 0, 1);
    const brake = closing ? 0.22 : clamp((-difference - 0.28) * 0.235 + trail, 0, 0.86);
    const throttle = brake > 0 ? 0 : clamp(difference * 0.38 + 0.19, 0, 1) * (1 - bend * (1 - settings.exit));
    return { steering, gas: throttle, brake, handbrake: false, draft, intent: traffic.offset };
  }

  return { controls, handling };
}
