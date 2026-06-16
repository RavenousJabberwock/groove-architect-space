/**
 * MIDI 2.0 backend — stub.
 *
 * Web MIDI 2.0 / UMP support is not broadly shipped in browsers yet. This
 * backend exposes the same shape so the rest of the app can opt-in once
 * support lands; `send` translates the message to a UMP packet but currently
 * throws NotImplemented.
 */

import type { MidiBackend, MidiMessage, MidiPort } from "./types";

export class Midi2Backend implements MidiBackend {
  readonly version = 2 as const;
  async init(): Promise<void> {
    /* future: navigator.requestMIDIAccess({ midi2: true }) */
  }
  inputs(): MidiPort[] {
    return [];
  }
  outputs(): MidiPort[] {
    return [];
  }
  onMessage(_cb: (msg: MidiMessage) => void): () => void {
    return () => {};
  }
  send(_msg: MidiMessage): void {
    throw new Error("MIDI 2.0 send not implemented yet");
  }
}
