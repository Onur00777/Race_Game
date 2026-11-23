const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mix = (a, b, amount) => a + (b - a) * amount;
const signedAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

export function makeRacingLine(track, handling, driving = {}) {
  const count = Math.ceil(track.length / 2.1);
  const spacing = track.length / count;
  const corner = distance => {
    const turn = track.at(distance - 7.5).yaw - track.at(distance + 7.5).yaw;
    return signedAngle(turn) / 15;
  };
  const offsets = new Float32Array(count);
  const limits = new Float32Array(count);
  const lateralGrip = driving.lateralGrip ?? handling.grip * 1.34;
  const braking = driving.braking ?? Math.min(12.4, handling.braking * 0.53);
  for (let i = 0; i < count; i++) {
    const station = i * spacing;
    const bend = corner(station);
    const apex = clamp(bend * 26, -1, 1);
    const entry = clamp(corner(station + 17) * 23, -1, 1);
    const exit = clamp(corner(station - 18) * 19, -1, 1);
    offsets[i] = clamp(apex - 0.48 * entry - 0.43 * exit, -1, 1) * track.event.width * 0.26;
    limits[i] = Math.min(handling.topSpeed, Math.sqrt(lateralGrip / Math.max(0.0001, Math.abs(bend))));
  }
  // A backwards pass propagates the corner speed to its braking approach.
  for (let index = count * 2 - 1; index >= 0; index--) {
    const i = index % count;
    limits[i] = Math.min(limits[i], Math.sqrt(limits[(i + 1) % count] ** 2 + 2 * braking * spacing));
  }

  return {
    sample(distance) {
      const index = ((distance % track.length + track.length) % track.length) / spacing;
      const start = Math.floor(index) % count;
      const next = (start + 1) % count;
      const fraction = index % 1;
      const offset = mix(offsets[start], offsets[next], fraction);
      return { ...track.at(distance, offset), offset, curvature: corner(distance), targetSpeed: mix(limits[start], limits[next], fraction) };
    },
  };
}

export function brakingRisk(speed, targetSpeed, distance, topSpeed) {
  if (targetSpeed >= topSpeed - 0.25) return 0;
  const projected = Math.sqrt(Math.max(0, speed ** 2 - 2 * 0.72 * Math.max(0, distance)));
  return clamp((projected - targetSpeed + 2.7) / 10.5, 0, 1);
}
