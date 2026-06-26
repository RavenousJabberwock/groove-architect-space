/**
 * Boot-time wiring: create audio tracks for the loaded pattern, attach MIDI
 * backend, route incoming MIDI notes to step triggers (optional pass-through).
 */

import { engine } from "../audio/engine";
import { bus } from "../audio/bus";
import { Midi1Backend } from "../midi/midi1-backend";
import { Midi2Backend } from "../midi/midi2-backend";
import { midiLearn } from "../midi/learn";
import type { MidiBackend } from "../midi/types";
import { NOTE_ON } from "../midi/types";
import { workspace } from "./workspace";
import type { TrackKind } from "../audio/engine";

let booted = false;
let backend: MidiBackend | null = null;

export async function boot(opts: { midiVersion?: 1 | 2 } = {}) {
  if (booted) return;
  await engine.init();
  await engine.resume();

  // Create audio channels for each track in pattern.
  const ws = workspace.get();
  for (const t of ws.pattern.tracks) {
    engine.addTrack(t.id, t.kind as TrackKind);
    // Restore EQ / send settings that may have been edited while the engine
    // was still suspended (workspace state set / loaded pre-boot).
    if (t.eq) {
      engine.setTrackEq(t.id, "low", t.eq.low);
      engine.setTrackEq(t.id, "mid", t.eq.mid);
      engine.setTrackEq(t.id, "high", t.eq.high);
    }
    if (t.sends) {
      engine.setTrackSend(t.id, "reverb", t.sends.reverb);
      engine.setTrackSend(t.id, "delay", t.sends.delay);
    }
  }

  // MIDI backend selection.
  backend = opts.midiVersion === 2 ? new Midi2Backend() : new Midi1Backend();
  await backend.init();
  midiLearn.attach(backend);

  // Bridge incoming note-on messages → fire synth track immediately.
  backend.onMessage((m) => {
    const status = m.status & 0xf0;
    if (status !== NOTE_ON || m.data2 === 0) return;
    const synthTrack = workspace.get().pattern.tracks.find((t) => t.kind === "synth");
    if (!synthTrack) return;
    bus.emit("step:trigger", {
      trackId: synthTrack.id,
      time: engine.now(),
      velocity: m.data2 / 127,
      note: m.data1,
    });
  });

  booted = true;
}

export function getMidiBackend(): MidiBackend | null {
  return backend;
}

export async function switchMidiBackend(version: 1 | 2) {
  midiLearn.detach();
  backend = version === 2 ? new Midi2Backend() : new Midi1Backend();
  await backend.init();
  midiLearn.attach(backend);
}
