/**
 * Global hotkey + MIDI-note router for soundboard pads and music tracks.
 *
 * - Listens for `keydown` events and matches against each pad's `hotkey`.
 * - Subscribes to `bus("midi:message")` and matches note-on against each
 *   pad's `midiNote` (+ optional `midiChannel`).
 *
 * SFX pads fire one-shot via `triggerSfx`; music tracks toggle play/stop
 * via `toggleMusic`. Inputs/textareas/contenteditable elements are ignored
 * so typing in the rename / URL fields doesn't fire pads.
 */

import { useEffect } from "react";
import { bus } from "@/audio/bus";
import { workspace } from "@/state/workspace";
import { triggerSfx, toggleMusic } from "@/audio/triggers";
import { NOTE_ON } from "@/midi/types";

/**
 * Normalize a KeyboardEvent into a stable string like "q", "Shift+1", or
 * "Ctrl+Alt+k". Only modifiers + the printable key are kept; case is
 * lowered so users don't have to think about caps lock.
 */
export function keyEventToHotkey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");
  // Skip pure-modifier presses.
  const k = e.key;
  if (k === "Control" || k === "Alt" || k === "Shift" || k === "Meta") return "";
  parts.push(k.length === 1 ? k.toLowerCase() : k);
  return parts.join("+");
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable);

export function usePadTriggers() {
  useEffect(() => {
    const held = new Set<string>();

    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const tag = keyEventToHotkey(e);
      if (!tag) return;
      // Don't auto-repeat fire; pads are one-shot per press.
      const repeatKey = `k:${tag}`;
      if (held.has(repeatKey)) return;
      held.add(repeatKey);

      const s = workspace.get();
      const sfx = s.soundEffects.find((p) => p.hotkey === tag);
      if (sfx) {
        e.preventDefault();
        void triggerSfx(sfx);
        return;
      }
      const music = s.musicTracks.find((p) => p.hotkey === tag);
      if (music) {
        e.preventDefault();
        void toggleMusic(music);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const tag = keyEventToHotkey(e);
      if (tag) held.delete(`k:${tag}`);
    };

    const offMidi = bus.on("midi:message", (m) => {
      const status = m.status & 0xf0;
      const channel = m.status & 0x0f;
      if (status !== NOTE_ON || m.data2 === 0) return;
      const note = m.data1;
      const s = workspace.get();
      const matchChan = (c?: number) => c === undefined || c === channel;
      const sfx = s.soundEffects.find((p) => p.midiNote === note && matchChan(p.midiChannel));
      if (sfx) {
        void triggerSfx(sfx);
        return;
      }
      const music = s.musicTracks.find((p) => p.midiNote === note && matchChan(p.midiChannel));
      if (music) void toggleMusic(music);
    });

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      offMidi();
    };
  }, []);
}
