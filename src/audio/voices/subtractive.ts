/**
 * Subtractive synth voice — saw oscillator → biquad lowpass → ADSR amp.
 * Wavetable and FM voices share the same `createXVoice(ctx, dest, opts)`
 * signature so the engine can swap voice modules without changes.
 */

interface SubOpts {
  note: number; // MIDI note
  velocity: number; // 0..1
  time: number;
  cutoff: number;
  resonance: number;
}

const mtof = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export function createSubtractiveVoice(ctx: AudioContext, dest: AudioNode, opts: SubOpts) {
  const { note, velocity, time, cutoff, resonance } = opts;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = mtof(note);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  filter.Q.value = resonance;

  const amp = ctx.createGain();
  const peak = velocity * 0.6;
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(peak, time + 0.01);
  amp.gain.exponentialRampToValueAtTime(peak * 0.5, time + 0.15);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.6);

  osc.connect(filter).connect(amp).connect(dest);
  osc.start(time);
  osc.stop(time + 0.65);
}
