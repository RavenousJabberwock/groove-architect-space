/**
 * MIDI backend interface.
 *
 * Backends implement this surface so the rest of the app stays
 * MIDI-version-agnostic. `Midi1Backend` ships today; `Midi2Backend` is a
 * future-ready stub using the same shape (UMP messages).
 */

export interface MidiMessage {
  status: number;
  data1: number;
  data2: number;
  portId?: string;
  timestamp?: number;
}

export interface MidiPort {
  id: string;
  name: string;
}

export interface MidiBackend {
  readonly version: 1 | 2;
  init(): Promise<void>;
  inputs(): MidiPort[];
  outputs(): MidiPort[];
  onMessage(cb: (msg: MidiMessage) => void): () => void;
  send(msg: MidiMessage): void;
}

// Status nibbles
export const NOTE_ON = 0x90;
export const NOTE_OFF = 0x80;
export const CC = 0xb0;
