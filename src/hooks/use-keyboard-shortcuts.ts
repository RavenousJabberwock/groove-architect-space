/**
 * Global keyboard shortcuts.
 *
 * Conventions follow common hardware/DAW idioms:
 *  - Space            : transport play/stop
 *  - F                : toggle fill mode
 *  - B                : toggle Beginner/Pro
 *  - ⌘/Ctrl + S       : save workspace
 *  - ⌘/Ctrl + O       : load workspace
 *  - Z / X            : synth octave down/up
 *  - A W S E D F T G Y H U J : white+black synth keys starting at C
 *  - 1..8             : trigger drum tracks 1..8
 *
 * Shortcuts are ignored while typing in inputs/selects.
 */

import { useEffect } from "react";
import { sequencer } from "@/sequencer/engine";
import { boot } from "@/state/setup";
import { workspace } from "@/state/workspace";
import { engine } from "@/audio/engine";
import { bus } from "@/audio/bus";
import { toast } from "sonner";

// FL-style mapping: A=C, W=C#, S=D, E=D#, ...
const SYNTH_MAP: Record<string, number> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5,
  KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12,
};

export function useKeyboardShortcuts() {
  useEffect(() => {
    let octave = 4; // C4 = 60
    const heldNotes = new Set<string>();

    const triggerSynth = async (note: number) => {
      const synth = workspace.get().pattern.tracks.find((t) => t.kind === "synth");
      if (!synth) return;
      await boot();
      bus.emit("step:trigger", {
        trackId: synth.id,
        time: engine.now(),
        velocity: 0.9,
        note,
      });
    };

    const triggerDrum = async (idx: number) => {
      const drums = workspace.get().pattern.tracks.filter((t) => t.kind !== "synth");
      const t = drums[idx];
      if (!t) return;
      await boot();
      bus.emit("step:trigger", {
        trackId: t.id,
        time: engine.now(),
        velocity: 1,
        note: t.midiNote,
      });
    };

    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable);

    const onDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.repeat && !e.code.startsWith("Key") && e.code !== "Space") return;

      // Modifier combos
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyS") {
        e.preventDefault();
        workspace.save();
        toast.success("Workspace saved");
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyO") {
        e.preventDefault();
        workspace.load() ? toast.success("Workspace loaded") : toast.error("No saved workspace");
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyZ") {
        e.preventDefault();
        const ok = e.shiftKey ? workspace.redo() : workspace.undo();
        toast(ok ? (e.shiftKey ? "Redo" : "Undo") : "Nothing to " + (e.shiftKey ? "redo" : "undo"), { duration: 500 });
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyY") {
        e.preventDefault();
        const ok = workspace.redo();
        toast(ok ? "Redo" : "Nothing to redo", { duration: 500 });
        return;
      }
      if (e.metaKey || e.ctrlKey) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          (async () => {
            await boot();
            sequencer.isPlaying() ? sequencer.stop() : sequencer.start();
          })();
          return;
        case "KeyF":
          if (e.repeat) return;
          sequencer.fill = !sequencer.fill;
          toast(`Fill ${sequencer.fill ? "ON" : "OFF"}`, { duration: 600 });
          return;
        case "KeyB":
          if (e.repeat) return;
          workspace.set((s) => ({ ...s, mode: s.mode === "beginner" ? "pro" : "beginner" }));
          return;
        case "KeyZ":
          if (e.repeat) return;
          octave = Math.max(0, octave - 1);
          toast(`Octave ${octave}`, { duration: 500 });
          return;
        case "KeyX":
          if (e.repeat) return;
          octave = Math.min(8, octave + 1);
          toast(`Octave ${octave}`, { duration: 500 });
          return;
      }

      // Number row → drum pads.
      if (/^Digit[1-8]$/.test(e.code)) {
        const idx = Number(e.code.slice(5)) - 1;
        if (heldNotes.has(e.code)) return;
        heldNotes.add(e.code);
        triggerDrum(idx);
        return;
      }

      // Synth keys.
      const semi = SYNTH_MAP[e.code];
      if (semi !== undefined) {
        if (heldNotes.has(e.code)) return;
        heldNotes.add(e.code);
        triggerSynth(12 * (octave + 1) + semi); // octave 4 → 60..72
      }
    };

    const onUp = (e: KeyboardEvent) => {
      heldNotes.delete(e.code);
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);
}
