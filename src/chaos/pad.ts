/**
 * Chaos pad — Kaoss-style XY controller.
 *
 * Macros let each axis route to multiple destinations (modulation matrix).
 * The recording buffer is the foundation for XY automation playback.
 */

import { bus } from "../audio/bus";
import { engine } from "../audio/engine";

export interface MacroRoute {
  axis: "x" | "y";
  target: string; // e.g. "synth.cutoff"
  depth: number; // -1..1
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
  private recording: ChaosRecording | null = null;

  setXY(x: number, y: number) {
    this.x = Math.max(0, Math.min(1, x));
    this.y = Math.max(0, Math.min(1, y));
    engine.setChaosXY(this.x, this.y);
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
