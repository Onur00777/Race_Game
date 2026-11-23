export async function createAudio() {
  const context = new AudioContext();
  const engine = context.createOscillator();
  const sub = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  engine.type = 'sawtooth';
  sub.type = 'triangle';
  filter.frequency.value = 240;
  gain.gain.value = 0;
  engine.connect(filter).connect(gain).connect(context.destination);
  sub.connect(filter);
  engine.start();
  sub.start();
  const crash = context.createBuffer(1, Math.floor(context.sampleRate * 0.29), context.sampleRate);
  const noise = crash.getChannelData(0);
  for (let i = 0; i < noise.length; i++) {
    const time = i / context.sampleRate;
    noise[i] = ((Math.random() * 2 - 1) * 0.66 + Math.sin(2 * Math.PI * 57 * time) * 0.4) * Math.exp(-time * 16);
  }
  await context.resume();
  return { context, engine, sub, filter, gain, crash, lastImpact: null, lastFire: null };
}

function crashSound(impact, audio) {
  const { context, crash } = audio;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  filter.type = 'lowpass';
  filter.frequency.value = impact.kind === 'rail' ? 980 : 570;
  gain.gain.value = Math.min(0.26, impact.impulse * 0.008);
  source.buffer = crash;
  source.playbackRate.value = impact.kind === 'rail' ? 1.05 : 0.83;
  source.connect(filter).connect(gain).connect(context.destination);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
  source.start();
}

export function updateAudio(audio, race, playing) {
  if (!audio) return;
  const speed = Math.abs(race?.player.speed ?? 0);
  const audible = playing && race.countdown === 0;
  const level = race?.engineLevel ?? 0;
  const load = race?.throttle ? 1 : 0;
  const now = audio.context.currentTime;
  const previousShift = [48, 36, 25, 15, 7, 0].find(shift => speed >= shift);
  const hz = 46 + (speed - previousShift) * (4.75 - level * 0.29) + speed * 0.83 + load * 12;
  audio.engine.frequency.setTargetAtTime(hz, now, 0.067);
  audio.sub.frequency.setTargetAtTime(hz * (level > 0 ? 0.5 : 0.75), now, 0.067);
  audio.filter.frequency.setTargetAtTime(179 + speed * 4.9 + level * 33 + load * 106, now, 0.083);
  audio.gain.gain.setTargetAtTime(audible ? 0.015 + Math.min(speed / 4200, 0.012) + load * (0.007 + level * 0.002) : 0, now, 0.08);
  if (race?.impact && race.impact !== audio.lastImpact) {
    audio.lastImpact = race.impact;
    if (audible) crashSound(race.impact, audio);
  }
  if (race?.backfire && race.backfire !== audio.lastFire) {
    audio.lastFire = race.backfire;
    if (audible) {
      const source = audio.context.createBufferSource();
      const gain = audio.context.createGain();
      source.buffer = audio.crash;
      source.playbackRate.value = 2.05;
      gain.gain.setValueAtTime(0.15 * race.backfire.intensity, now);
      gain.gain.exponentialRampToValueAtTime(0.002, now + 0.099);
      source.connect(gain).connect(audio.context.destination);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start();
    }
  }
}
