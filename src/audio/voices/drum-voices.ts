/**
 * Synthesized drum voices — stateless one-shots.
 * Each function creates ephemeral nodes scheduled at `time` and tears down
 * automatically when the envelope completes.
 */

export type DrumKind = "kick" | "snare" | "hat" | "clap" | "tom" | "perc";

interface DrumOpts {
  time: number;
  velocity: number;
  tune?: number; // -12..12 semitones
}

const semi = (s: number) => Math.pow(2, s / 12);

export function createDrumVoice(
  ctx: AudioContext,
  dest: AudioNode,
  kind: DrumKind,
  opts: DrumOpts,
) {
  switch (kind) {
    case "kick":
      return kick(ctx, dest, opts);
    case "snare":
      return snare(ctx, dest, opts);
    case "hat":
      return hat(ctx, dest, opts);
    case "clap":
      return clap(ctx, dest, opts);
    case "tom":
      return tom(ctx, dest, opts);
    case "perc":
      return perc(ctx, dest, opts);
  }
}

function kick(ctx: AudioContext, dest: AudioNode, { time, velocity, tune = 0 }: DrumOpts) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const base = 55 * semi(tune);
  osc.frequency.setValueAtTime(base * 4, time);
  osc.frequency.exponentialRampToValueAtTime(base, time + 0.08);
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(velocity, time + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.4);
  osc.connect(amp).connect(dest);
  osc.start(time);
  osc.stop(time + 0.45);
}

function snare(ctx: AudioContext, dest: AudioNode, { time, velocity }: DrumOpts) {
  // Tonal body
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = 200;
  const oscAmp = ctx.createGain();
  oscAmp.gain.setValueAtTime(0.0001, time);
  oscAmp.gain.exponentialRampToValueAtTime(velocity * 0.4, time + 0.002);
  oscAmp.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
  osc.connect(oscAmp).connect(dest);
  osc.start(time);
  osc.stop(time + 0.15);
  // Noise
  noise(ctx, dest, time, velocity * 0.8, 0.18, 1800);
}

function hat(ctx: AudioContext, dest: AudioNode, { time, velocity }: DrumOpts) {
  noise(ctx, dest, time, velocity * 0.5, 0.05, 8000, "highpass");
}

function clap(ctx: AudioContext, dest: AudioNode, { time, velocity }: DrumOpts) {
  [0, 0.01, 0.02, 0.03].forEach((d, i) =>
    noise(ctx, dest, time + d, velocity * (i === 3 ? 0.6 : 0.3), 0.04, 1500, "bandpass"),
  );
}

function tom(ctx: AudioContext, dest: AudioNode, { time, velocity, tune = 0 }: DrumOpts) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  const f = 120 * semi(tune);
  osc.frequency.setValueAtTime(f * 2, time);
  osc.frequency.exponentialRampToValueAtTime(f, time + 0.1);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(velocity, time + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
  osc.connect(amp).connect(dest);
  osc.start(time);
  osc.stop(time + 0.35);
}

function perc(ctx: AudioContext, dest: AudioNode, { time, velocity, tune = 0 }: DrumOpts) {
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = 800 * semi(tune);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(velocity * 0.5, time + 0.001);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
  osc.connect(amp).connect(dest);
  osc.start(time);
  osc.stop(time + 0.1);
}

function noise(
  ctx: AudioContext,
  dest: AudioNode,
  time: number,
  vel: number,
  dur: number,
  freq: number,
  type: BiquadFilterType = "lowpass",
) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(vel, time);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  src.connect(filter).connect(amp).connect(dest);
  src.start(time);
  src.stop(time + dur + 0.01);
}
