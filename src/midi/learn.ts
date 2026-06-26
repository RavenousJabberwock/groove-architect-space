/**
 * MIDI learn — bind incoming CC messages to UI control targets, plus a
 * separate "note learn" channel that pad UIs (Soundboard / Music Board) use
 * to capture the next note-on event for trigger binding.
 */

import { bus } from "../audio/bus";
import { CC, NOTE_ON } from "./types";
import type { MidiBackend, MidiMessage } from "./types";

export type Binding = { target: string; cc: number; channel: number };

type NoteLearnCb = (n: { note: number; channel: number }) => void;

class MidiLearn {
  bindings: Binding[] = [];
  armedTarget: string | null = null;
  /** Pending note-learn callback (one-shot). */
  private armedNoteCb: NoteLearnCb | null = null;
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

  /**
   * Capture the next note-on message and deliver it to `cb`. Use this for
   * binding hardware drum/keyboard pads to UI buttons.
   */
  armNote(cb: NoteLearnCb) {
    this.armedNoteCb = cb;
  }

  cancel() {
    this.armedTarget = null;
    this.armedNoteCb = null;
  }

  private handle(m: MidiMessage) {
    bus.emit("midi:message", m);
    const status = m.status & 0xf0;
    const channel = m.status & 0x0f;

    if (status === NOTE_ON && m.data2 > 0 && this.armedNoteCb) {
      const cb = this.armedNoteCb;
      this.armedNoteCb = null;
      cb({ note: m.data1, channel });
      bus.emit("midi:learn-note", { note: m.data1, channel });
      return;
    }

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
