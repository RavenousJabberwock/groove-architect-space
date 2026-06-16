/**
 * Web MIDI 1.0 backend.
 */

import type { MidiBackend, MidiMessage, MidiPort } from "./types";

export class Midi1Backend implements MidiBackend {
  readonly version = 1 as const;
  private access: MIDIAccess | null = null;
  private listeners = new Set<(m: MidiMessage) => void>();

  async init(): Promise<void> {
    if (typeof navigator === "undefined" || !("requestMIDIAccess" in navigator)) {
      return; // graceful no-op in SSR or browsers without Web MIDI
    }
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.attachInputs();
    this.access.onstatechange = () => this.attachInputs();
  }

  private attachInputs() {
    if (!this.access) return;
    this.access.inputs.forEach((input) => {
      input.onmidimessage = (e: MIDIMessageEvent) => {
        const [status, data1 = 0, data2 = 0] = e.data ?? [];
        const msg: MidiMessage = {
          status: status ?? 0,
          data1,
          data2,
          portId: input.id,
          timestamp: e.timeStamp,
        };
        for (const l of this.listeners) l(msg);
      };
    });
  }

  inputs(): MidiPort[] {
    if (!this.access) return [];
    return Array.from(this.access.inputs.values()).map((p) => ({ id: p.id, name: p.name ?? p.id }));
  }

  outputs(): MidiPort[] {
    if (!this.access) return [];
    return Array.from(this.access.outputs.values()).map((p) => ({ id: p.id, name: p.name ?? p.id }));
  }

  onMessage(cb: (msg: MidiMessage) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  send(msg: MidiMessage): void {
    if (!this.access) return;
    const port = msg.portId
      ? this.access.outputs.get(msg.portId)
      : Array.from(this.access.outputs.values())[0];
    port?.send([msg.status, msg.data1, msg.data2]);
  }
}
