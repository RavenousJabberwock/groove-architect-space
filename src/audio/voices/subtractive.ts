/**
 * Subtractive synth voice — saw oscillator → biquad lowpass → ADSR amp.
 * Wavetable and FM voices share the same `createXVoice(ctx, dest, opts)`
 * signature so the engine can swap voice modules without changes.
 */

export interface ADSR {
  /** Attack seconds. */
  a: number;
  /** Decay seconds. */
  d: number;
  /** Sustain level 0..1. */
  s: number;
  /** Release seconds. */
  r: number;
}

export const DEFAULT_ADSR: ADSR = { a: 0.01, d: 0.14, s: 0.5, r: 0.45 };

interface SubOpts {
  note: number; // MIDI note
  velocity: number; // 0..1
  time: number;
  cutoff: number;
  resonance: number;
  adsr?: ADSR;
  /** Oscillator waveform. */
  wave?: OscillatorType;
}

const mtof = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export function createSubtractiveVoice(ctx: AudioContext, dest: AudioNode, opts: SubOpts) {
  const { note, velocity, time, cutoff, resonance } = opts;
  const adsr = opts.adsr ?? DEFAULT_ADSR;
  const osc = ctx.createOscillator();
  osc.type = opts.wave ?? "sawtooth";
  osc.frequency.value = mtof(note);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  filter.Q.value = resonance;

  const amp = ctx.createGain();
  const peak = Math.max(0.0001, velocity * 0.6);
  const sustain = Math.max(0.0001, peak * adsr.s);
  const tA = time + Math.max(0.001, adsr.a);
  const tD = tA + Math.max(0.001, adsr.d);
  const tR = tD + Math.max(0.02, adsr.r);
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(peak, tA);
  amp.gain.exponentialRampToValueAtTime(sustain, tD);
  amp.gain.exponentialRampToValueAtTime(0.0001, tR);

  osc.connect(filter).connect(amp).connect(dest);
  osc.start(time);
  osc.stop(tR + 0.05);
}
