/**
 * GM-inspired synth instrument presets.
 *
 * Each preset shapes the subtractive voice (oscillator waveform, filter
 * cutoff/resonance, ADSR envelope) so the same keyboard can sound like a
 * pad, pluck, bass, bell, etc. Triggered through `engine.triggerOneShot`
 * which already pitches the voice by MIDI note — every preset is fully
 * pitch-adjusted across the keyboard.
 *
 * Cutoffs are absolute Hz (not relative) to keep the math simple and
 * predictable; presets that want extra "bite" raise resonance, presets
 * meant to be airy lower it.
 */

import type { ADSR } from "@/audio/voices/subtractive";

export interface SynthPreset {
  id: string;
  name: string;
  group: "Keys" | "Strings & Pads" | "Bass" | "Leads" | "Bells & Plucks" | "Brass & Winds";
  wave: OscillatorType;
  cutoff: number;
  resonance: number;
  adsr: ADSR;
}

export const SYNTH_PRESETS: SynthPreset[] = [
  // Keys
  { id: "piano",  name: "Acoustic Piano", group: "Keys", wave: "triangle", cutoff: 6000, resonance: 0.7,
    adsr: { a: 0.002, d: 0.6, s: 0.0, r: 0.4 } },
  { id: "epiano", name: "Electric Piano", group: "Keys", wave: "sine",     cutoff: 4500, resonance: 0.5,
    adsr: { a: 0.003, d: 0.5, s: 0.15, r: 0.5 } },
  { id: "organ",  name: "Organ",          group: "Keys", wave: "square",   cutoff: 5000, resonance: 0.4,
    adsr: { a: 0.005, d: 0.05, s: 0.85, r: 0.1 } },
  { id: "clav",   name: "Clavinet",       group: "Keys", wave: "square",   cutoff: 3500, resonance: 2.5,
    adsr: { a: 0.001, d: 0.15, s: 0.0, r: 0.12 } },

  // Strings & Pads
  { id: "strings", name: "Strings",       group: "Strings & Pads", wave: "sawtooth", cutoff: 3500, resonance: 0.8,
    adsr: { a: 0.18, d: 0.2, s: 0.8, r: 0.6 } },
  { id: "warmpad", name: "Warm Pad",      group: "Strings & Pads", wave: "sawtooth", cutoff: 2200, resonance: 1.0,
    adsr: { a: 0.5, d: 0.4, s: 0.85, r: 1.2 } },
  { id: "choir",   name: "Choir Aahs",    group: "Strings & Pads", wave: "triangle", cutoff: 2400, resonance: 0.6,
    adsr: { a: 0.35, d: 0.3, s: 0.9, r: 0.9 } },
  { id: "sweep",   name: "Sweep Pad",     group: "Strings & Pads", wave: "sawtooth", cutoff: 1800, resonance: 4.0,
    adsr: { a: 0.8, d: 0.5, s: 0.7, r: 1.5 } },

  // Bass
  { id: "subbass",  name: "Sub Bass",     group: "Bass", wave: "sine",     cutoff: 800,  resonance: 0.5,
    adsr: { a: 0.002, d: 0.2, s: 0.6, r: 0.2 } },
  { id: "synthbass", name: "Synth Bass",  group: "Bass", wave: "sawtooth", cutoff: 1200, resonance: 4.0,
    adsr: { a: 0.001, d: 0.25, s: 0.3, r: 0.15 } },
  { id: "acidbass",  name: "Acid Bass",   group: "Bass", wave: "sawtooth", cutoff: 900,  resonance: 12.0,
    adsr: { a: 0.001, d: 0.18, s: 0.0, r: 0.1 } },

  // Leads
  { id: "leadsaw",   name: "Saw Lead",    group: "Leads", wave: "sawtooth", cutoff: 8000, resonance: 1.5,
    adsr: { a: 0.005, d: 0.2, s: 0.7, r: 0.2 } },
  { id: "leadsquare", name: "Square Lead", group: "Leads", wave: "square",  cutoff: 6500, resonance: 1.0,
    adsr: { a: 0.005, d: 0.15, s: 0.75, r: 0.18 } },
  { id: "leadsine",  name: "Sine Lead",   group: "Leads", wave: "sine",     cutoff: 10000, resonance: 0.5,
    adsr: { a: 0.01, d: 0.1, s: 0.8, r: 0.25 } },

  // Bells & Plucks
  { id: "bell",  name: "Bell",            group: "Bells & Plucks", wave: "triangle", cutoff: 9000, resonance: 0.5,
    adsr: { a: 0.001, d: 1.2, s: 0.0, r: 0.8 } },
  { id: "pluck", name: "Pluck",           group: "Bells & Plucks", wave: "sawtooth", cutoff: 5000, resonance: 1.5,
    adsr: { a: 0.001, d: 0.2, s: 0.0, r: 0.15 } },
  { id: "mallet", name: "Mallet",         group: "Bells & Plucks", wave: "sine",     cutoff: 4500, resonance: 0.8,
    adsr: { a: 0.001, d: 0.4, s: 0.0, r: 0.3 } },

  // Brass & Winds
  { id: "brass", name: "Brass",           group: "Brass & Winds", wave: "sawtooth", cutoff: 3800, resonance: 1.2,
    adsr: { a: 0.04, d: 0.2, s: 0.75, r: 0.25 } },
  { id: "flute", name: "Flute",           group: "Brass & Winds", wave: "sine",     cutoff: 4000, resonance: 0.4,
    adsr: { a: 0.05, d: 0.1, s: 0.85, r: 0.2 } },
];

export function getPreset(id: string): SynthPreset | undefined {
  return SYNTH_PRESETS.find((p) => p.id === id);
}

/** Groups for the <optgroup> in the instrument selector. */
export const PRESET_GROUPS = Array.from(new Set(SYNTH_PRESETS.map((p) => p.group)));
