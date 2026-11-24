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
  const skids = context.createBuffer(1, Math.floor(context.sampleRate * 1.4), context.sampleRate);
  const skidData = skids.getChannelData(0);
  let sample = 0;
  for (let i = 0; i < skidData.length; i++) {
    sample = sample * 0.19 + (Math.random() * 2 - 1) * 0.81;
    const edge = Math.min(1, i / 70, (skidData.length - 1 - i) / 70);
    skidData[i] = sample * edge;
  }
  const skidSource = context.createBufferSource();
  skidSource.buffer = skids;
  skidSource.loop = true;
  const skidFilter = context.createBiquadFilter();
  skidFilter.type = 'bandpass';
  skidFilter.Q.value = 1.45;
  const skidTone = context.createOscillator();
  skidTone.type = 'triangle';
  const skidToneMix = context.createGain();
  skidToneMix.gain.value = 0.17;
  const skidGain = context.createGain();
  skidGain.gain.value = 0;
  skidSource.connect(skidFilter).connect(skidGain).connect(context.destination);
  skidTone.connect(skidToneMix).connect(skidGain);
  skidSource.start();
  skidTone.start();
  await context.resume();
  return { context, engine, sub, filter, gain, crash, skidSource, skidFilter, skidTone, skidGain, lastImpact: null, lastFire: null };
}

function updateScreech(audio, race, audible, time) {
  let strain = 0;
  let speed = 0;
  if (audible) {
    for (const car of race.cars) {
      const distance = Math.hypot(car.x - race.player.x, car.z - race.player.z);
      const proximity = car === race.player ? 1 : Math.max(0, 1 - distance / 22) ** 2 * 0.46;
      if (!proximity) continue;
      for (const wheel of car.wheels) {
        const strength = wheel.onRoad ? Math.max(0, wheel.slip - 0.15) / 0.85 * proximity : 0;
        if (strength <= strain) continue;
        strain = strength;
        speed = wheel.speed;
      }
    }
  }
  audio.skidSource.playbackRate.setTargetAtTime(0.74 + speed * 0.014 + strain * 0.2, time, 0.09);
  audio.skidFilter.frequency.setTargetAtTime(540 + speed * 22 + strain * 380, time, 0.065);
  audio.skidTone.frequency.setTargetAtTime(421 + speed * 15 + strain * 310, time, 0.075);
  audio.skidGain.gain.setTargetAtTime(strain ** 1.35 * 0.13, time, strain > 0 ? 0.068 : 0.045);
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

export function updateAudio(audio, race, playing, allowImpact = playing) {
  if (!audio) return;
  const speed = Math.abs(race?.player.speed ?? 0);
  const audible = playing && race.countdown === 0;
  const launchHold = playing ? race?.launchHold ?? 0 : 0;
  const level = race?.engineLevel ?? 0;
  const load = race?.throttle ? 1 : 0;
  const now = audio.context.currentTime;
  const previousShift = [48, 36, 25, 15, 7, 0].find(shift => speed >= shift);
  const hz = launchHold ? launchHold / 36 : 46 + (speed - previousShift) * (4.75 - level * 0.29) + speed * 0.83 + load * 12;
  audio.engine.frequency.setTargetAtTime(hz, now, 0.067);
  audio.sub.frequency.setTargetAtTime(hz * (level > 0 ? 0.5 : 0.75), now, 0.067);
  audio.filter.frequency.setTargetAtTime(179 + speed * 4.9 + level * 33 + load * 106, now, 0.083);
  audio.gain.gain.setTargetAtTime(audible || launchHold ? 0.015 + Math.min(speed / 4200, 0.012) + load * (0.007 + level * 0.002) : 0, now, 0.08);
  updateScreech(audio, race, audible, now);
  if (race?.impact && race.impact !== audio.lastImpact) {
    audio.lastImpact = race.impact;
    if (allowImpact) crashSound(race.impact, audio);
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
