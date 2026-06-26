/**
 * Sequencer data model.
 *
 * Polymeter: each track keeps its own `length` step counter.
 * Polyrhythm: `divisor` adjusts how often a track advances (1 = every step,
 * 2 = every other step, 0.5 = twice per step).
 *
 * Conditional trigs (Elektron-style):
 *  - "1:2", "2:2": fires on the Nth pass of length cycle
 *  - "FILL": fires only when fill mode is engaged
 *  - "PRE": fires if previous step in track fired
 *  - "NEI": fires if neighbouring (previous) track fired
 *
 * Per-track mixing extras (all optional, default-safe):
 *  - swing     : 0..0.66 — extra offset on odd 16ths on top of the
 *                pattern-wide swing.
 *  - humanize  : 0..40 ms — random ± jitter applied to every fired step.
 *  - sends     : reverb/delay bus send levels (0..1).
 *  - eq        : low/mid/high shelf gain in dB (-12..+12).
 */

export type Condition = null | "1:2" | "2:2" | "FILL" | "PRE" | "NEI";

export interface Step {
  active: boolean;
  velocity: number; // 0..1
  probability: number; // 0..100
  condition: Condition;
  /** Parameter locks for this step. */
  pLocks?: Record<string, number>;
  /** Note pitch for synth tracks (MIDI note). */
  note?: number;
}

export interface TrackSends {
  reverb: number;
  delay: number;
}

export interface TrackEq {
  low: number;  // dB
  mid: number;  // dB
  high: number; // dB
}

export interface Track {
  id: string;
  name: string;
  /** Drum kind or "synth". Mirrors TrackKind in audio/engine. */
  kind: string;
  length: number; // 1..32
  divisor: number; // 0.25..4
  steps: Step[];
  mute: boolean;
  solo: boolean;
  midiNote: number;
  midiChannel: number;
  /** Extra per-track swing (0..0.66) layered on top of pattern.swing. */
  swing?: number;
  /** Random timing jitter in ms (± half-range). */
  humanize?: number;
  sends?: TrackSends;
  eq?: TrackEq;
}

export interface Pattern {
  id: string;
  name: string;
  bpm: number;
  swing: number; // 0..0.5
  tracks: Track[];
}

export const emptyStep = (): Step => ({
  active: false,
  velocity: 0.9,
  probability: 100,
  condition: null,
});

export const makeTrack = (
  id: string,
  name: string,
  kind: string,
  midiNote = 36,
  midiChannel = 10,
): Track => ({
  id,
  name,
  kind,
  length: 16,
  divisor: 1,
  steps: Array.from({ length: 16 }, emptyStep),
  mute: false,
  solo: false,
  midiNote,
  midiChannel,
  swing: 0,
  humanize: 0,
  sends: { reverb: 0, delay: 0 },
  eq: { low: 0, mid: 0, high: 0 },
});
