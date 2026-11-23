export async function createAudio() {
  const context = new AudioContext();
  const engine = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  engine.type = 'sawtooth';
  filter.frequency.value = 240;
  gain.gain.value = 0;
  engine.connect(filter).connect(gain).connect(context.destination);
  engine.start();
  const crash = context.createBuffer(1, Math.floor(context.sampleRate * 0.29), context.sampleRate);
  const noise = crash.getChannelData(0);
  for (let i = 0; i < noise.length; i++) {
    const time = i / context.sampleRate;
    noise[i] = ((Math.random() * 2 - 1) * 0.66 + Math.sin(2 * Math.PI * 57 * time) * 0.4) * Math.exp(-time * 16);
  }
  await context.resume();
  return { context, engine, gain, crash, lastImpact: null };
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
  audio.engine.frequency.setTargetAtTime(42 + (speed % 10) * 6.8 + speed * 0.55, audio.context.currentTime, 0.075);
  audio.gain.gain.setTargetAtTime(audible ? 0.027 + Math.min(speed / 2500, 0.019) : 0, audio.context.currentTime, 0.08);
  if (race?.impact && race.impact !== audio.lastImpact) {
    audio.lastImpact = race.impact;
    if (audible) crashSound(race.impact, audio);
  }
}
