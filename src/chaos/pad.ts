/**
 * Chaos pad — Kaoss-style XY controller.
 *
 * Macros let each axis route to multiple destinations (modulation matrix).
 * A continuous voice (saw → biquad → amp) sounds while the pad is held so
 * the XY movement is immediately audible.
 */

import { bus } from "../audio/bus";
import { engine } from "../audio/engine";

export interface MacroRoute {
  axis: "x" | "y";
  target: string;
  depth: number;
}

export interface ChaosRecording {
  startedAt: number;
  events: Array<{ t: number; x: number; y: number }>;
}

class ChaosPad {
  x = 0.5;
  y = 0.5;
  routes: MacroRoute[] = [
    { axis: "x", target: "synth.cutoff", depth: 1 },
    { axis: "y", target: "synth.resonance", depth: 1 },
  ];
  /** Base pitch of the continuous voice (MIDI note). */
  basePitch = 33;

  private recording: ChaosRecording | null = null;
  private osc: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private amp: GainNode | null = null;

  /** Start the continuous chaos voice (call on pointer-down). */
  async engage() {
    await engine.init();
    await engine.resume();
    if (this.osc || !engine.ctx || !engine.master) return;
    const ctx = engine.ctx;
    this.osc = ctx.createOscillator();
    this.osc.type = "sawtooth";
    this.osc.frequency.value = 440 * Math.pow(2, (this.basePitch - 69) / 12);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = engine.chaosCutoff;
    this.filter.Q.value = engine.chaosResonance;
    this.amp = ctx.createGain();
    this.amp.gain.value = 0;
    this.osc.connect(this.filter).connect(this.amp).connect(engine.master);
    this.osc.start();
    this.amp.gain.setTargetAtTime(0.18, ctx.currentTime, 0.02);
  }

  /** Release the continuous voice with a short fade. */
  release() {
    if (!this.osc || !this.amp || !engine.ctx) return;
    const ctx = engine.ctx;
    this.amp.gain.cancelScheduledValues(ctx.currentTime);
    this.amp.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    const osc = this.osc;
    const filter = this.filter;
    const amp = this.amp;
    setTimeout(() => {
      try {
        osc.stop();
        osc.disconnect();
        filter?.disconnect();
        amp.disconnect();
      } catch {
        /* noop */
      }
    }, 250);
    this.osc = null;
    this.filter = null;
    this.amp = null;
  }

  setXY(x: number, y: number) {
    this.x = Math.max(0, Math.min(1, x));
    this.y = Math.max(0, Math.min(1, y));
    engine.setChaosXY(this.x, this.y);

    // Drive the live voice in real time.
    if (this.filter && engine.ctx) {
      this.filter.frequency.setTargetAtTime(engine.chaosCutoff, engine.ctx.currentTime, 0.005);
      this.filter.Q.setTargetAtTime(engine.chaosResonance, engine.ctx.currentTime, 0.01);
    }

    bus.emit("chaos:xy", { x: this.x, y: this.y });
    for (const r of this.routes) {
      const v = (r.axis === "x" ? this.x : this.y) * r.depth;
      bus.emit("param:change", { target: r.target, value: v });
    }
    if (this.recording) {
      this.recording.events.push({
        t: performance.now() - this.recording.startedAt,
        x: this.x,
        y: this.y,
      });
    }
  }

  startRecording() {
    this.recording = { startedAt: performance.now(), events: [] };
  }
  stopRecording(): ChaosRecording | null {
    const r = this.recording;
    this.recording = null;
    return r;
  }
  isRecording() {
    return this.recording !== null;
  }
}

export const chaos = new ChaosPad();
