import { useState } from "react";
import { engine, ALL_TRACK_KINDS, type TrackKind } from "@/audio/engine";
import { bus } from "@/audio/bus";
import { boot } from "@/state/setup";
import { useWorkspace } from "@/state/workspace";
import { midiLearn } from "@/midi/learn";
import { toast } from "sonner";

/**
 * Synth panel — two-octave piano keyboard with selectable instrument.
 *
 * The instrument selector lets the user route the keyboard through any of
 * the built-in voices (subtractive synth or any MIDI percussion kind). When
 * "synth" is selected the keyboard fires the project's synth track so MIDI
 * Learn / sequencer routing still work; for percussion kinds we trigger
 * one-shot voices directly through the engine (pitch is ignored by drum
 * voices that don't tune).
 */

const WHITE: Array<{ semi: number; label: string }> = [
  { semi: 0, label: "C" }, { semi: 2, label: "D" }, { semi: 4, label: "E" },
  { semi: 5, label: "F" }, { semi: 7, label: "G" }, { semi: 9, label: "A" },
  { semi: 11, label: "B" },
];
// Black-key semitone offsets indexed by the white key they sit *after*.
// undefined = no black key after that white (E and B).
const BLACK_AFTER: Array<number | undefined> = [1, 3, undefined, 6, 8, 10, undefined];
const OCTAVES = 2;

const DRUM_KINDS = ALL_TRACK_KINDS.filter((k) => k !== "synth") as TrackKind[];

export function SynthPanel() {
  const pattern = useWorkspace((s) => s.pattern);
  const mode = useWorkspace((s) => s.mode);
  const synthTrack = pattern.tracks.find((t) => t.kind === "synth");
  const [octave, setOctave] = useState(4); // bottom octave (C4 = 60)
  const [instrument, setInstrument] = useState<TrackKind>("synth");

  const play = async (note: number) => {
    await boot();
    if (instrument === "synth") {
      if (!synthTrack) {
        // Fall back to a one-shot if there's no synth track yet.
        engine.triggerOneShot("synth", { note, velocity: 0.9 });
        return;
      }
      bus.emit("step:trigger", {
        trackId: synthTrack.id,
        time: engine.now(),
        velocity: 0.9,
        note,
      });
      return;
    }
    // Percussion kinds — pass the key's MIDI note so the voice is pitched
    // relative to C4. Drum factories that don't tune simply ignore it.
    engine.triggerOneShot(instrument, { velocity: 0.9, note });
  };

  // Build flat list of (note, label) for the visible range.
  const whiteKeys: Array<{ note: number; label: string }> = [];
  for (let o = 0; o < OCTAVES; o++) {
    for (const w of WHITE) {
      const note = 12 * (octave + o + 1) + w.semi;
      whiteKeys.push({ note, label: w.semi === 0 ? `${w.label}${octave + o}` : w.label });
    }
  }

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Synth</h2>
        <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
          <span>Inst</span>
          <select
            value={instrument}
            onChange={(e) => setInstrument(e.target.value as TrackKind)}
            className="readout rounded border border-border bg-background px-1 py-0.5 text-[10px]"
          >
            <option value="synth">Subtractive</option>
            <optgroup label="Percussion">
              {DRUM_KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </optgroup>
          </select>
          <button
            onClick={() => setOctave(Math.max(0, octave - 1))}
            className="rounded border border-border px-1 hover:bg-secondary"
            aria-label="Octave down"
          >−</button>
          <span className="readout w-5 text-center">{octave}</span>
          <button
            onClick={() => setOctave(Math.min(7, octave + 1))}
            className="rounded border border-border px-1 hover:bg-secondary"
            aria-label="Octave up"
          >+</button>
        </div>
      </div>

      <div className="relative flex-1 select-none">
        <div className="absolute inset-0 flex">
          {whiteKeys.map(({ note, label }) => (
            <button
              key={note}
              onPointerDown={() => play(note)}
              className="readout group flex flex-1 flex-col items-center justify-end rounded-b border border-border bg-background pb-1 text-[10px] uppercase text-foreground transition active:bg-primary active:text-primary-foreground"
            >
              <span className="opacity-60 group-active:opacity-100">{label}</span>
            </button>
          ))}
        </div>
        {/* Black keys overlay — positioned at fractional offsets between
            white keys. Each black sits centered on the gap between two
            consecutive whites. */}
        <div className="pointer-events-none absolute inset-0">
          {whiteKeys.map((wk, i) => {
            const slot = i % 7;
            const blackSemi = BLACK_AFTER[slot];
            if (blackSemi === undefined) return null;
            if (i === whiteKeys.length - 1) return null; // no room past last white
            const whiteW = 100 / whiteKeys.length;
            const left = (i + 1) * whiteW - whiteW * 0.3;
            // Compute black note: octave of this white + its black semitone
            const baseOctave = Math.floor(wk.note / 12);
            const note = 12 * baseOctave + blackSemi;
            return (
              <button
                key={`b-${wk.note}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  play(note);
                }}
                style={{ left: `${left}%`, width: `${whiteW * 0.6}%` }}
                className="pointer-events-auto absolute top-0 h-3/5 rounded-b border border-border bg-foreground/85 transition active:bg-primary"
              />
            );
          })}
        </div>
      </div>

      {mode === "pro" && (
        <button
          onClick={() => {
            midiLearn.arm("synth.cutoff");
            toast("MIDI learn armed: move a CC for synth.cutoff");
          }}
          className="mt-2 rounded border border-border bg-background py-1 text-[10px] uppercase tracking-wider hover:bg-secondary"
        >
          MIDI Learn — Cutoff
        </button>
      )}
    </div>
  );
}
