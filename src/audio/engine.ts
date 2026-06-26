/**
 * Real-time audio engine.
 *
 * Owns the single AudioContext, master bus, per-track output channels, and
 * two global FX buses (reverb + delay) that any track can send to.
 *
 * Per-track chain:
 *
 *   voice → filter → eqLow → eqMid → eqHigh → gain → analyser → master
 *                                              ├──→ reverbSend → reverbBus
 *                                              └──→ delaySend  → delayBus
 *
 * The reverb bus is a synthesized-impulse `ConvolverNode`; the delay bus is
 * a `DelayNode` with a feedback `GainNode`. Both terminate at master.
 */

import { bus } from "./bus";
import { createDrumVoice, type DrumKind } from "./voices/drum-voices";
import { createSubtractiveVoice, type ADSR } from "./voices/subtractive";

export interface TrackChannel {
  id: string;
  kind: TrackKind;
  gain: GainNode;
  filter: BiquadFilterNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  analyser: AnalyserNode;
  reverbSend: GainNode;
  delaySend: GainNode;
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

  // ===== Global FX buses =====
  reverbBus: ConvolverNode | null = null;
  reverbReturn: GainNode | null = null;
  delayBus: DelayNode | null = null;
  delayFeedback: GainNode | null = null;
  delayReturn: GainNode | null = null;

  private unsub: Array<() => void> = [];
  /** Scratch buffer for analyser peak reads. */
  private meterBuf: Float32Array = new Float32Array(new ArrayBuffer(256 * 4));

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

    // ----- Reverb bus -----
    this.reverbBus = ctx.createConvolver();
    this.reverbBus.buffer = buildImpulse(ctx, 2.4, 2.5);
    this.reverbReturn = ctx.createGain();
    this.reverbReturn.gain.value = 0.9;
    this.reverbBus.connect(this.reverbReturn).connect(this.master);

    // ----- Delay bus (with feedback) -----
    this.delayBus = ctx.createDelay(2);
    this.delayBus.delayTime.value = 0.33;
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.38;
    this.delayReturn = ctx.createGain();
    this.delayReturn.gain.value = 0.9;
    this.delayBus.connect(this.delayFeedback).connect(this.delayBus);
    this.delayBus.connect(this.delayReturn).connect(this.master);

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

  /** Register a drum or synth track with full EQ + sends chain. */
  addTrack(id: string, kind: TrackKind) {
    if (!this.ctx || !this.master) throw new Error("Engine not initialized");
    const ctx = this.ctx;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 18000;
    filter.Q.value = 0.7;

    // 3-band EQ — low shelf (≤200 Hz), mid peak (~1 kHz), high shelf (≥4 kHz).
    const eqLow = ctx.createBiquadFilter();
    eqLow.type = "lowshelf";
    eqLow.frequency.value = 200;
    const eqMid = ctx.createBiquadFilter();
    eqMid.type = "peaking";
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 0.9;
    const eqHigh = ctx.createBiquadFilter();
    eqHigh.type = "highshelf";
    eqHigh.frequency.value = 4000;

    const gain = ctx.createGain();
    gain.gain.value = 0.8;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0;

    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 0;
    const delaySend = ctx.createGain();
    delaySend.gain.value = 0;

    // Chain: filter → eq → gain → analyser → master, with parallel sends post-gain.
    filter.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(gain);
    gain.connect(analyser);
    analyser.connect(this.master);
    gain.connect(reverbSend);
    if (this.reverbBus) reverbSend.connect(this.reverbBus);
    gain.connect(delaySend);
    if (this.delayBus) delaySend.connect(this.delayBus);

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
        createDrumVoice(ctx, filter, kind, {
          time,
          velocity,
          tune: pLocks?.tune ?? 0,
        });
      };
    }

    const ch: TrackChannel = {
      id, kind, gain, filter, eqLow, eqMid, eqHigh, analyser,
      reverbSend, delaySend, trigger,
    };
    this.tracks.set(id, ch);
    return ch;
  }

  removeTrack(id: string) {
    const ch = this.tracks.get(id);
    if (!ch) return;
    try {
      ch.filter.disconnect();
      ch.eqLow.disconnect();
      ch.eqMid.disconnect();
      ch.eqHigh.disconnect();
      ch.gain.disconnect();
      ch.analyser.disconnect();
      ch.reverbSend.disconnect();
      ch.delaySend.disconnect();
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

  /** Set one of "low" | "mid" | "high" EQ bands in dB. */
  setTrackEq(id: string, band: "low" | "mid" | "high", dB: number) {
    const ch = this.tracks.get(id);
    if (!ch || !this.ctx) return;
    const node = band === "low" ? ch.eqLow : band === "mid" ? ch.eqMid : ch.eqHigh;
    node.gain.setTargetAtTime(Math.max(-24, Math.min(24, dB)), this.ctx.currentTime, 0.02);
  }

  /** Set the reverb/delay send for a track (0..1). */
  setTrackSend(id: string, target: "reverb" | "delay", value: number) {
    const ch = this.tracks.get(id);
    if (!ch || !this.ctx) return;
    const node = target === "reverb" ? ch.reverbSend : ch.delaySend;
    node.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.ctx.currentTime, 0.02);
  }

  /** Read the current peak amplitude (0..1) of a track's output. */
  getTrackLevel(id: string): number {
    const ch = this.tracks.get(id);
    if (!ch) return 0;
    return readPeak(ch.analyser, this.meterBuf);
  }

  /** Master output gain (pre-limiter). */
  setMasterGain(value: number) {
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(Math.max(0, value), this.ctx.currentTime, 0.01);
  }
  getMasterGain(): number {
    return this.master?.gain.value ?? 0.8;
  }

  // ===== FX bus parameters =====
  setReverbMix(v: number) {
    if (!this.ctx || !this.reverbReturn) return;
    this.reverbReturn.gain.setTargetAtTime(Math.max(0, Math.min(2, v)), this.ctx.currentTime, 0.02);
  }
  setReverbDecay(seconds: number) {
    if (!this.ctx || !this.reverbBus) return;
    this.reverbBus.buffer = buildImpulse(this.ctx, Math.max(0.2, Math.min(8, seconds)), 2.5);
  }
  setDelayTime(seconds: number) {
    if (!this.ctx || !this.delayBus) return;
    this.delayBus.delayTime.setTargetAtTime(Math.max(0.01, Math.min(1.5, seconds)), this.ctx.currentTime, 0.02);
  }
  setDelayFeedback(v: number) {
    if (!this.ctx || !this.delayFeedback) return;
    this.delayFeedback.gain.setTargetAtTime(Math.max(0, Math.min(0.92, v)), this.ctx.currentTime, 0.02);
  }
  setDelayMix(v: number) {
    if (!this.ctx || !this.delayReturn) return;
    this.delayReturn.gain.setTargetAtTime(Math.max(0, Math.min(2, v)), this.ctx.currentTime, 0.02);
  }

  /** Called by chaos pad — writes shared synth filter target. */
  setChaosXY(x: number, y: number) {
    this.chaosCutoff = 80 * Math.pow(200, x);
    this.chaosResonance = 0.5 + y * 18;
  }

  /**
   * Fire a one-shot voice directly into the master bus (no track channel).
   * Used by the Soundboard / Synth panels.
   */
  triggerOneShot(
    kind: TrackKind,
    opts: {
      note?: number;
      velocity?: number;
      adsr?: ADSR;
      wave?: OscillatorType;
      cutoff?: number;
      resonance?: number;
    } = {},
  ) {
    if (!this.ctx || !this.master) return;
    const time = this.now();
    const velocity = opts.velocity ?? 0.9;
    if (kind === "synth") {
      createSubtractiveVoice(this.ctx, this.master, {
        note: opts.note ?? 60,
        velocity,
        time,
        cutoff: opts.cutoff ?? this.chaosCutoff,
        resonance: opts.resonance ?? this.chaosResonance,
        adsr: opts.adsr,
        wave: opts.wave,
      });
    } else {
      createDrumVoice(this.ctx, this.master, kind, { time, velocity, note: opts.note });
    }
  }

  now(): number {
    return this.ctx?.currentTime ?? 0;
  }
}

/** Build a synthesized exponentially-decaying noise impulse for the convolver. */
function buildImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

/** Read the current absolute-peak sample value from an AnalyserNode. */
function readPeak(an: AnalyserNode, scratch: Float32Array): number {
  // TS lib types are picky about ArrayBuffer vs ArrayBufferLike — cast.
  an.getFloatTimeDomainData(scratch as Float32Array<ArrayBuffer>);
  let peak = 0;
  for (let i = 0; i < scratch.length; i++) {
    const v = scratch[i] < 0 ? -scratch[i] : scratch[i];
    if (v > peak) peak = v;
  }
  return peak;
}

export const engine = new AudioEngine();
