/**
 * Sequencer scheduler.
 *
 * Uses the Chris Wilson lookahead pattern: a setInterval tick wakes the
 * scheduler every ~25ms; it schedules audio events out to `scheduleAhead`
 * seconds on the AudioContext clock for sample-accurate timing while letting
 * UI updates be debounced.
 */

import { bus } from "../audio/bus";
import { engine } from "../audio/engine";
import type { Pattern, Step, Track } from "./types";

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.1; // seconds

export class Sequencer {
  pattern: Pattern | null = null;
  private playing = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  /** Master step counter (drives swing + transport UI). */
  private masterStep = 0;
  /** Per-track step counters (polymeter). */
  private trackSteps = new Map<string, number>();
  /** Per-track last-fired memory (for PRE conditional). */
  private prevFired = new Map<string, boolean>();
  /** Last-fired across tracks for NEI conditional. */
  private prevNeighborFired = false;
  private cycle = new Map<string, number>(); // for 1:2 / 2:2
  fill = false;

  load(p: Pattern) {
    this.pattern = p;
    this.trackSteps.clear();
    this.cycle.clear();
    this.masterStep = 0;
  }

  isPlaying() {
    return this.playing;
  }

  async start() {
    if (this.playing || !this.pattern) return;
    await engine.init();
    await engine.resume();
    this.playing = true;
    this.nextStepTime = engine.now() + 0.05;
    this.intervalId = setInterval(() => this.tick(), LOOKAHEAD_MS);
    bus.emit("transport:state", { playing: true });
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.playing = false;
    this.masterStep = 0;
    this.trackSteps.clear();
    bus.emit("transport:state", { playing: false });
  }

  private secondsPerStep(): number {
    const bpm = this.pattern?.bpm ?? 120;
    // 16th notes
    return 60 / bpm / 4;
  }

  private tick() {
    if (!this.pattern) return;
    const ctxTime = engine.now();
    while (this.nextStepTime < ctxTime + SCHEDULE_AHEAD) {
      this.scheduleStep(this.nextStepTime);
      this.advance();
    }
  }

  private advance() {
    const spStep = this.secondsPerStep();
    // Swing on odd 16ths.
    const swing = this.pattern?.swing ?? 0;
    const isOdd = this.masterStep % 2 === 1;
    this.nextStepTime += spStep * (isOdd ? 1 - swing : 1 + swing);
    this.masterStep++;
  }

  private scheduleStep(time: number) {
    if (!this.pattern) return;
    bus.emit("transport:step", { step: this.masterStep, time });

    const anySolo = this.pattern.tracks.some((t) => t.solo);
    let neighborFiredThisStep = false;
    const spStep = this.secondsPerStep();

    for (const track of this.pattern.tracks) {
      if (track.mute) continue;
      if (anySolo && !track.solo) continue;

      const tStepCounter = this.trackSteps.get(track.id) ?? 0;
      if (track.divisor > 1 && this.masterStep % Math.round(track.divisor) !== 0) {
        continue;
      }
      const stepIdx = tStepCounter % Math.max(1, track.length);
      const step = track.steps[stepIdx];
      this.trackSteps.set(track.id, tStepCounter + 1);

      if (!step?.active) {
        this.prevFired.set(track.id, false);
        continue;
      }
      if (!this.passesCondition(track, step, stepIdx)) {
        this.prevFired.set(track.id, false);
        continue;
      }
      if (step.probability < 100 && Math.random() * 100 > step.probability) {
        this.prevFired.set(track.id, false);
        continue;
      }

      // Per-track timing — extra swing on odd steps + ± humanize jitter.
      let fireTime = time;
      const perTrackSwing = track.swing ?? 0;
      if (perTrackSwing > 0 && this.masterStep % 2 === 1) {
        fireTime += spStep * perTrackSwing;
      }
      const humanize = track.humanize ?? 0;
      if (humanize > 0) {
        fireTime += (Math.random() - 0.5) * (humanize / 1000);
      }
      if (fireTime < this.pattern!.bpm * 0) fireTime = time; // guard

      const note = step.note ?? track.midiNote;
      bus.emit("step:trigger", {
        trackId: track.id,
        time: Math.max(time - 0.001, fireTime),
        velocity: step.velocity,
        note,
        pLocks: step.pLocks,
      });
      this.prevFired.set(track.id, true);
      neighborFiredThisStep = true;
    }
    this.prevNeighborFired = neighborFiredThisStep;
  }

  private passesCondition(track: Track, step: Step, _stepIdx: number): boolean {
    switch (step.condition) {
      case null:
        return true;
      case "FILL":
        return this.fill;
      case "PRE":
        return this.prevFired.get(track.id) === true;
      case "NEI":
        return this.prevNeighborFired;
      case "1:2": {
        const c = (this.cycle.get(track.id) ?? 0) + 1;
        this.cycle.set(track.id, c % 2);
        return c % 2 === 1;
      }
      case "2:2": {
        const c = (this.cycle.get(track.id) ?? 0) + 1;
        this.cycle.set(track.id, c % 2);
        return c % 2 === 0;
      }
      default:
        return true;
    }
  }
}

export const sequencer = new Sequencer();
