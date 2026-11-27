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
    const metal = Math.sin(2 * Math.PI * 393 * time) * 0.14 + Math.sin(2 * Math.PI * 611 * time) * 0.09;
    const fold = Math.sin(Math.PI * 2 * (54 * time + 112 * time ** 2)) * 0.32 + Math.sin(2 * Math.PI * 133 * time) * 0.20;
    noise[i] = ((Math.random() * 2 - 1) * 0.56 + fold) * Math.exp(-time * 15) + metal * Math.exp(-time * 22);
  }
  const blowout = context.createBuffer(1, Math.floor(context.sampleRate * 0.46), context.sampleRate);
  const rupture = blowout.getChannelData(0);
  let pressure = 0;
  for (let i = 0; i < rupture.length; i++) {
    const time = i / context.sampleRate;
    const grain = Math.random() * 2 - 1;
    pressure = pressure * 0.72 + grain * 0.28;
    rupture[i] = (grain * 0.28 + pressure * 0.43) * Math.exp(-time * 10) +
      Math.sin(2 * Math.PI * (105 * time - 63 * time ** 2)) * Math.exp(-time * 24) * 0.43;
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
  return { context, engine, sub, filter, gain, crash, blowout, skidSource, skidFilter, skidTone, skidGain,
    lastImpact: null, lastFire: null, wheelRace: null, lastWheelSerial: 0 };
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

function oneShot(audio, buffer, volume, band, pitch, pan) {
  const { context } = audio;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const balance = context.createStereoPanner();
  filter.type = 'lowpass';
  filter.frequency.value = band;
  gain.gain.value = volume;
  source.buffer = buffer;
  source.playbackRate.value = pitch;
  balance.pan.value = pan;
  source.connect(filter).connect(gain).connect(balance).connect(context.destination);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
    balance.disconnect();
  };
  source.start();
}

function contactPan(contact, player) {
  const across = (contact.x - player.x) * Math.cos(player.yaw) - (contact.z - player.z) * Math.sin(player.yaw);
  return Math.max(-0.76, Math.min(0.76, -across * 0.53));
}

function crashSound(impact, audio, player) {
  const concrete = impact.surface === 'concrete';
  const sharpness = impact.kind === 'rail' ? (concrete ? 1560 : 2300) : 1170;
  const pan = contactPan(impact, player);
  oneShot(audio, audio.crash, Math.min(0.46, impact.impulse * 0.011 + impact.normalSpeed * 0.003), sharpness,
    concrete ? 0.77 : impact.kind === 'rail' ? 1.04 : 0.86, pan);
  if (impact.normalSpeed > 13) {
    const thump = Math.min(0.26, (impact.normalSpeed - 13) * 0.016);
    oneShot(audio, audio.crash, thump, 370, 0.62, pan * 0.45);
  }
}

function updateWheelSound(audio, race, allowed) {
  if (race !== audio.wheelRace) {
    audio.wheelRace = race;
    audio.lastWheelSerial = 0;
  }
  for (const event of race?.wheelEvents ?? []) {
    if (event.serial <= audio.lastWheelSerial) continue;
    audio.lastWheelSerial = event.serial;
    const distance = Math.hypot(event.x - race.player.x, event.z - race.player.z);
    const proximity = event.carId === race.player.id ? 1 : Math.max(0, 1 - distance / 29) ** 2 * 0.76;
    if (allowed && proximity > 0.05) oneShot(audio, audio.blowout, proximity * 0.81, 3570,
      event.type === 'detached' ? 0.76 : 0.94, contactPan(event, race.player));
  }
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
  updateWheelSound(audio, race, allowImpact);
  if (race?.impact && race.impact !== audio.lastImpact) {
    audio.lastImpact = race.impact;
    if (allowImpact) crashSound(race.impact, audio, race.player);
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
