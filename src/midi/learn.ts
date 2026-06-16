/**
 * MIDI learn — bind incoming CC messages to UI control targets.
 */

import { bus } from "../audio/bus";
import { CC } from "./types";
import type { MidiBackend, MidiMessage } from "./types";

export type Binding = { target: string; cc: number; channel: number };

class MidiLearn {
  bindings: Binding[] = [];
  armedTarget: string | null = null;
  private unsub: (() => void) | null = null;

  attach(backend: MidiBackend) {
    this.unsub?.();
    this.unsub = backend.onMessage((m) => this.handle(m));
  }

  detach() {
    this.unsub?.();
    this.unsub = null;
  }

  arm(target: string) {
    this.armedTarget = target;
  }

  cancel() {
    this.armedTarget = null;
  }

  private handle(m: MidiMessage) {
    bus.emit("midi:message", m);
    const status = m.status & 0xf0;
    const channel = m.status & 0x0f;
    if (status !== CC) return;
    const cc = m.data1;
    const value = m.data2 / 127;

    if (this.armedTarget) {
      this.bindings = this.bindings.filter((b) => b.target !== this.armedTarget);
      this.bindings.push({ target: this.armedTarget, cc, channel });
      bus.emit("midi:learn", { cc, channel });
      this.armedTarget = null;
      return;
    }
    for (const b of this.bindings) {
      if (b.cc === cc && b.channel === channel) {
        bus.emit("param:change", { target: b.target, value });
      }
    }
  }
}

export const midiLearn = new MidiLearn();
