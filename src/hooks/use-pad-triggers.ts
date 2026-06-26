/**
 * Global hotkey + MIDI-note router for soundboard pads and music tracks,
 * plus the scheduler for randomized "auto" ambient pads.
 *
 * - Listens for `keydown` events and matches against each pad's `hotkey`.
 * - Subscribes to `bus("midi:message")` and matches note-on against each
 *   pad's `midiNote` (+ optional `midiChannel`).
 * - For SFX pads with `auto.enabled`, schedules a recurring random trigger
 *   in [auto.minMs, auto.maxMs] using `setTimeout` chains. Reschedules
 *   whenever the workspace state changes (pads added/removed/toggled).
 *
 * SFX pads fire one-shot via `triggerSfx`; music tracks toggle play/stop
 * via `toggleMusic`. Inputs/textareas/contenteditable elements are ignored.
 */

import { useEffect } from "react";
import { bus } from "@/audio/bus";
import { workspace } from "@/state/workspace";
import { triggerSfx, toggleMusic } from "@/audio/triggers";
import { NOTE_ON } from "@/midi/types";

export function keyEventToHotkey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");
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
  // ===== Keyboard + MIDI routing =====
  useEffect(() => {
    const held = new Set<string>();

    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const tag = keyEventToHotkey(e);
      if (!tag) return;
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
      if (sfx) { void triggerSfx(sfx); return; }
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

  // ===== Auto / random ambient triggers =====
  // For each pad with `auto.enabled`, schedule a one-shot trigger after a
  // random delay in [minMs, maxMs], then reschedule on each fire. Cleared
  // and re-scheduled whenever the relevant pad list changes.
  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const schedule = (id: string) => {
      const pad = workspace.get().soundEffects.find((p) => p.id === id);
      if (!pad?.auto?.enabled) return;
      const min = Math.max(250, pad.auto.minMs);
      const max = Math.max(min + 250, pad.auto.maxMs);
      const wait = min + Math.random() * (max - min);
      const handle = setTimeout(() => {
        // Re-read in case the pad was toggled off or removed in the meantime.
        const live = workspace.get().soundEffects.find((p) => p.id === id);
        if (live?.auto?.enabled) {
          void triggerSfx(live);
          schedule(id);
        } else {
          timers.delete(id);
        }
      }, wait);
      timers.set(id, handle);
    };

    const sync = () => {
      const active = new Set(
        workspace.get().soundEffects.filter((p) => p.auto?.enabled).map((p) => p.id),
      );
      // Remove timers for pads that are no longer auto.
      for (const [id, h] of timers) {
        if (!active.has(id)) {
          clearTimeout(h);
          timers.delete(id);
        }
      }
      // Add timers for newly-active pads.
      for (const id of active) {
        if (!timers.has(id)) schedule(id);
      }
    };

    sync();
    const off = workspace.subscribe(sync);
    return () => {
      off();
      for (const h of timers.values()) clearTimeout(h);
      timers.clear();
    };
  }, []);
}
