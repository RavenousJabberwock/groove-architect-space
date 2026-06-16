/**
 * Real-time audio engine.
 *
 * Owns the single AudioContext, master bus, and per-track output channels.
 * Voices schedule themselves on the shared context clock for sample-accurate
 * timing. The sequencer drives note-on events via the central event bus.
 */

import { bus } from "./bus";
import { createDrumVoice, type DrumKind } from "./voices/drum-voices";
import { createSubtractiveVoice } from "./voices/subtractive";

export interface TrackChannel {
  id: string;
  kind: TrackKind;
  gain: GainNode;
  filter: BiquadFilterNode;
  trigger: (time: number, opts: { note: number; velocity: number; pLocks?: Record<string, number> }) => void;
}

export type TrackKind = DrumKind | "synth";

export const ALL_TRACK_KINDS: TrackKind[] = [
  "kick", "snare", "hat", "openhat", "clap", "rim",
  "tom", "conga", "cowbell", "cymbal", "shaker", "perc", "synth",
];

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  limiter: DynamicsCompressorNode | null = null;
  /** Shared filter cutoff/resonance written to by the chaos pad. */
  chaosCutoff = 8000;
  chaosResonance = 1;
  tracks = new Map<string, TrackChannel>();

  private unsub: Array<() => void> = [];

  /** Lazy init — must be called from a user gesture for autoplay policy. */
  async init() {
    if (this.ctx) return;
    const ctx = new AudioContext({ latencyHint: "interactive" });
    this.ctx = ctx;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.1;

    this.master = ctx.createGain();
    this.master.gain.value = 0.8;

    this.master.connect(this.limiter).connect(ctx.destination);

    // Subscribe to step triggers.
    this.unsub.push(
      bus.on("step:trigger", ({ trackId, time, velocity, note, pLocks }) => {
        const ch = this.tracks.get(trackId);
        if (!ch) return;
        ch.trigger(time, { note, velocity, pLocks });
      }),
    );
  }

  async resume() {
    if (this.ctx?.state === "suspended") await this.ctx.resume();
  }

  /** Register a drum or synth track. */
  addTrack(id: string, kind: TrackKind) {
    if (!this.ctx || !this.master) throw new Error("Engine not initialized");
    const ctx = this.ctx;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 18000;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.value = 0.8;

    filter.connect(gain).connect(this.master);

    let trigger: TrackChannel["trigger"];
    if (kind === "synth") {
      trigger = (time, { note, velocity, pLocks }) => {
        createSubtractiveVoice(ctx, filter, {
          note,
          velocity,
          time,
          cutoff: pLocks?.cutoff ?? this.chaosCutoff,
          resonance: pLocks?.resonance ?? this.chaosResonance,
        });
      };
    } else {
      trigger = (time, { velocity, pLocks }) => {
        createDrumVoice(ctx, filter, kind, { time, velocity, tune: pLocks?.tune ?? 0 });
      };
    }

    const ch: TrackChannel = { id, kind, gain, filter, trigger };
    this.tracks.set(id, ch);
    return ch;
  }

  removeTrack(id: string) {
    const ch = this.tracks.get(id);
    if (!ch) return;
    try {
      ch.filter.disconnect();
      ch.gain.disconnect();
    } catch {
      /* ignore */
    }
    this.tracks.delete(id);
  }

  /** Reconcile engine channels with the pattern's tracks. Idempotent. */
  syncTracks(tracks: Array<{ id: string; kind: TrackKind }>) {
    if (!this.ctx) return;
    const wanted = new Map(tracks.map((t) => [t.id, t.kind]));
    for (const [id, ch] of this.tracks) {
      const wantKind = wanted.get(id);
      if (wantKind === undefined || wantKind !== ch.kind) this.removeTrack(id);
    }
    for (const t of tracks) {
      if (!this.tracks.has(t.id)) this.addTrack(t.id, t.kind);
    }
  }

  setTrackGain(id: string, value: number) {
    const ch = this.tracks.get(id);
    if (!ch || !this.ctx) return;
    ch.gain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
  }

  /** Called by chaos pad — writes shared synth filter target. */
  setChaosXY(x: number, y: number) {
    // Map X to cutoff (log) and Y to resonance.
    this.chaosCutoff = 80 * Math.pow(200, x);
    this.chaosResonance = 0.5 + y * 18;
    if (!this.ctx) return;
    // Push to live synth filters (per-track filter is currently a one-shot per
    // voice; this is here so future continuous voices can pick it up).
  }

  now(): number {
    return this.ctx?.currentTime ?? 0;
  }
}

export const engine = new AudioEngine();
