/**
 * Synthesized drum voices — stateless one-shots.
 * Each function creates ephemeral nodes scheduled at `time` and tears down
 * automatically when the envelope completes.
 */

export type DrumKind =
  | "kick" | "snare" | "hat" | "openhat" | "clap" | "rim"
  | "tom" | "conga" | "cowbell" | "cymbal" | "shaker" | "perc";

interface DrumOpts {
  time: number;
  velocity: number;
  /** Explicit pitch offset in semitones relative to the voice's natural tuning. */
  tune?: number; // -12..12 semitones
  /**
   * Incoming MIDI note. When provided (and `tune` isn't), the voice is pitched
   * relative to MIDI 60 (C4): playing C4 leaves the natural pitch untouched,
   * higher keys raise it, lower keys lower it. This is what makes the synth
   * panel's percussion mode actually play scales.
   */
  note?: number;
}

const semi = (s: number) => Math.pow(2, s / 12);

/** Reference note: keys at C4 produce a drum's natural pitch. */
const REF_NOTE = 60;

/** Derive a semitone offset from explicit tune or MIDI note. */
function deriveTune(opts: DrumOpts): number {
  if (opts.tune !== undefined) return opts.tune;
  if (opts.note !== undefined) return opts.note - REF_NOTE;
  return 0;
}

export function createDrumVoice(
  ctx: AudioContext,
  dest: AudioNode,
  kind: DrumKind,
  opts: DrumOpts,
) {
  // Normalise tune up-front so every voice path sees the same number even if
  // it only reads `tune` directly.
  const normalised: DrumOpts = { ...opts, tune: deriveTune(opts) };
  switch (kind) {
    case "kick":    return kick(ctx, dest, normalised);
    case "snare":   return snare(ctx, dest, normalised);
    case "hat":     return hat(ctx, dest, normalised);
    case "openhat": return openhat(ctx, dest, normalised);
    case "clap":    return clap(ctx, dest, normalised);
    case "rim":     return rim(ctx, dest, normalised);
    case "tom":     return tom(ctx, dest, normalised);
    case "conga":   return conga(ctx, dest, normalised);
    case "cowbell": return cowbell(ctx, dest, normalised);
    case "cymbal":  return cymbal(ctx, dest, normalised);
    case "shaker":  return shaker(ctx, dest, normalised);
    case "perc":    return perc(ctx, dest, normalised);
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

function hat(ctx: AudioContext, dest: AudioNode, { time, velocity, tune = 0 }: DrumOpts) {
  noise(ctx, dest, time, velocity * 0.5, 0.05, 8000 * semi(tune), "highpass");
}

function clap(ctx: AudioContext, dest: AudioNode, { time, velocity, tune = 0 }: DrumOpts) {
  const f = 1500 * semi(tune);
  [0, 0.01, 0.02, 0.03].forEach((d, i) =>
    noise(ctx, dest, time + d, velocity * (i === 3 ? 0.6 : 0.3), 0.04, f, "bandpass"),
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

/** Shared filtered-noise burst used by hats, claps, snare body, etc. */
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
  filter.frequency.value = Math.max(20, Math.min(20000, freq));
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(vel, time);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  src.connect(filter).connect(amp).connect(dest);
  src.start(time);
  src.stop(time + dur + 0.01);
}

function openhat(ctx: AudioContext, dest: AudioNode, { time, velocity, tune = 0 }: DrumOpts) {
  const s = semi(tune);
  noise(ctx, dest, time, velocity * 0.45, 0.32, 8000 * s, "highpass");
  noise(ctx, dest, time, velocity * 0.2, 0.3, 6500 * s, "bandpass");
}

function rim(ctx: AudioContext, dest: AudioNode, { time, velocity, tune = 0 }: DrumOpts) {
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = 1700 * semi(tune);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(velocity * 0.4, time + 0.001);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  osc.connect(amp).connect(dest);
  osc.start(time);
  osc.stop(time + 0.06);
  noise(ctx, dest, time, velocity * 0.2, 0.03, 4000 * semi(tune), "highpass");
}

function cowbell(ctx: AudioContext, dest: AudioNode, { time, velocity, tune = 0 }: DrumOpts) {
  const s = semi(tune);
  for (const f of [800, 540]) {
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = f * s;
    const a = ctx.createGain();
    a.gain.setValueAtTime(0.0001, time);
    a.gain.exponentialRampToValueAtTime(velocity * 0.22, time + 0.002);
    a.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
    o.connect(a).connect(dest);
    o.start(time);
    o.stop(time + 0.32);
  }
}

function cymbal(ctx: AudioContext, dest: AudioNode, { time, velocity, tune = 0 }: DrumOpts) {
  const s = semi(tune);
  noise(ctx, dest, time, velocity * 0.35, 0.9, 6000 * s, "highpass");
  noise(ctx, dest, time, velocity * 0.2, 0.6, 9000 * s, "bandpass");
}

function conga(ctx: AudioContext, dest: AudioNode, { time, velocity, tune = 0 }: DrumOpts) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  const f = 220 * semi(tune);
  osc.frequency.setValueAtTime(f * 1.6, time);
  osc.frequency.exponentialRampToValueAtTime(f, time + 0.05);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(velocity * 0.7, time + 0.003);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
  osc.connect(amp).connect(dest);
  osc.start(time);
  osc.stop(time + 0.24);
}

function shaker(ctx: AudioContext, dest: AudioNode, { time, velocity, tune = 0 }: DrumOpts) {
  noise(ctx, dest, time, velocity * 0.3, 0.06, 7500 * semi(tune), "highpass");
}

/* snare's tonal body could also follow `tune`; left flat by design so the
   noise tail remains recognisable as a snare regardless of which key you
   press from the synth panel. */

