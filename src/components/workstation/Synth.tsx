import { useState } from "react";
import { engine, ALL_TRACK_KINDS, type TrackKind } from "@/audio/engine";
import { boot } from "@/state/setup";
import { useWorkspace } from "@/state/workspace";
import { midiLearn } from "@/midi/learn";
import { toast } from "sonner";
import { SYNTH_PRESETS, PRESET_GROUPS, getPreset } from "@/audio/synth-presets";

/**
 * Synth panel — two-octave piano keyboard with selectable instrument.
 *
 * Two instrument families share one selector:
 *  - **Synth presets** (Piano, Strings, Bass, Lead, etc.) — built from
 *    `SYNTH_PRESETS`. Each preset chooses a waveform, filter setting, and
 *    ADSR envelope; voices are pitched per key via MIDI note.
 *  - **Percussion** — every drum voice in `ALL_TRACK_KINDS`, also
 *    pitch-shifted by the key pressed (relative to C4).
 *
 * Each Synth window instance keeps its own instrument + octave selection in
 * local React state, so users can spawn multiple synth windows tuned to
 * different sounds and play them side by side.
 */

const WHITE: Array<{ semi: number; label: string }> = [
  { semi: 0, label: "C" }, { semi: 2, label: "D" }, { semi: 4, label: "E" },
  { semi: 5, label: "F" }, { semi: 7, label: "G" }, { semi: 9, label: "A" },
  { semi: 11, label: "B" },
];
const BLACK_AFTER: Array<number | undefined> = [1, 3, undefined, 6, 8, 10, undefined];
const OCTAVES = 2;

const DRUM_KINDS = ALL_TRACK_KINDS.filter((k) => k !== "synth") as TrackKind[];

interface Props {
  /** Workspace instance id. Currently used as a stable key; kept for future per-instance persistence. */
  instanceId?: string;
}

export function SynthPanel(_props: Props) {
  const mode = useWorkspace((s) => s.mode);
  const [octave, setOctave] = useState(4);
  // `instrument` is either a synth preset id ("piano", "leadsaw", ...) or
  // a percussion kind prefixed with "drum:" (e.g. "drum:snare").
  const [instrument, setInstrument] = useState<string>("piano");

  const play = async (note: number) => {
    await boot();
    if (instrument.startsWith("drum:")) {
      const kind = instrument.slice(5) as TrackKind;
      engine.triggerOneShot(kind, { velocity: 0.9, note });
      return;
    }
    const preset = getPreset(instrument) ?? SYNTH_PRESETS[0];
    engine.triggerOneShot("synth", {
      note,
      velocity: 0.9,
      wave: preset.wave,
      adsr: preset.adsr,
      cutoff: preset.cutoff,
      resonance: preset.resonance,
    });
  };

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
            onChange={(e) => setInstrument(e.target.value)}
            className="readout max-w-[140px] rounded border border-border bg-background px-1 py-0.5 text-[10px]"
          >
            {PRESET_GROUPS.map((group) => (
              <optgroup key={group} label={group}>
                {SYNTH_PRESETS.filter((p) => p.group === group).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </optgroup>
            ))}
            <optgroup label="Percussion (pitched)">
              {DRUM_KINDS.map((k) => (
                <option key={k} value={`drum:${k}`}>{k}</option>
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
        <div className="pointer-events-none absolute inset-0">
          {whiteKeys.map((wk, i) => {
            const slot = i % 7;
            const blackSemi = BLACK_AFTER[slot];
            if (blackSemi === undefined) return null;
            if (i === whiteKeys.length - 1) return null;
            const whiteW = 100 / whiteKeys.length;
            const left = (i + 1) * whiteW - whiteW * 0.3;
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
