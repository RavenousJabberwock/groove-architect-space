/**
 * Hotkey + MIDI-note binding controls used by both the Soundboard pad
 * editor and the Music Board row controls.
 *
 * - "Learn" key captures the next physical keyboard press (modifiers + key)
 *   and stores the canonical string (see `keyEventToHotkey`).
 * - "Learn" MIDI captures the next note-on via `midiLearn.armNote(...)`.
 *
 * Both bindings are clearable with the "×" button.
 */

import { useEffect, useState } from "react";
import { Keyboard, Cable, X } from "lucide-react";
import { midiLearn } from "@/midi/learn";
import { keyEventToHotkey } from "@/hooks/use-pad-triggers";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteLabel = (n: number) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;

export function BindingsField({
  hotkey,
  midiNote,
  onChange,
}: {
  hotkey?: string;
  midiNote?: number;
  onChange: (patch: { hotkey?: string; midiNote?: number }) => void;
}) {
  const [armKey, setArmKey] = useState(false);
  const [armMidi, setArmMidi] = useState(false);

  // Key learn — listen for the next non-modifier keydown anywhere.
  useEffect(() => {
    if (!armKey) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = keyEventToHotkey(e);
      if (!tag) return;
      e.preventDefault();
      e.stopPropagation();
      if (tag === "Escape") {
        setArmKey(false);
        return;
      }
      onChange({ hotkey: tag });
      setArmKey(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [armKey, onChange]);

  // MIDI learn — first note-on wins.
  useEffect(() => {
    if (!armMidi) return;
    midiLearn.armNote(({ note }) => {
      onChange({ midiNote: note });
      setArmMidi(false);
    });
    return () => midiLearn.cancel();
  }, [armMidi, onChange]);

  return (
    <div className="flex flex-wrap items-center gap-1 text-[10px] uppercase">
      <button
        type="button"
        onClick={() => setArmKey((v) => !v)}
        className={`flex items-center gap-1 rounded border border-border px-1.5 py-0.5 hover:bg-secondary ${
          armKey ? "bg-accent text-accent-foreground" : ""
        }`}
        title="Bind a keyboard hotkey"
      >
        <Keyboard className="h-3 w-3" />
        {armKey ? "press key…" : hotkey ? hotkey : "key"}
      </button>
      {hotkey && !armKey && (
        <button
          type="button"
          onClick={() => onChange({ hotkey: undefined })}
          className="rounded border border-border px-1 py-0.5 text-muted-foreground hover:bg-secondary"
          aria-label="Clear hotkey"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <button
        type="button"
        onClick={() => setArmMidi((v) => !v)}
        className={`flex items-center gap-1 rounded border border-border px-1.5 py-0.5 hover:bg-secondary ${
          armMidi ? "bg-accent text-accent-foreground" : ""
        }`}
        title="Bind a MIDI note (press a key on your controller)"
      >
        <Cable className="h-3 w-3" />
        {armMidi ? "play note…" : midiNote !== undefined ? noteLabel(midiNote) : "midi"}
      </button>
      {midiNote !== undefined && !armMidi && (
        <button
          type="button"
          onClick={() => onChange({ midiNote: undefined })}
          className="rounded border border-border px-1 py-0.5 text-muted-foreground hover:bg-secondary"
          aria-label="Clear MIDI binding"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
