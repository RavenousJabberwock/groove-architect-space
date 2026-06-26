import { useEffect, useRef, useState } from "react";
import { engine, ALL_TRACK_KINDS, type TrackKind } from "@/audio/engine";
import { boot } from "@/state/setup";
import { useWorkspace, workspace } from "@/state/workspace";
import { midiLearn } from "@/midi/learn";
import { toast } from "sonner";
import { SYNTH_PRESETS, PRESET_GROUPS, getPreset } from "@/audio/synth-presets";

/**
 * Synth panel — two-octave piano keyboard with selectable instrument.
 *
 *  - Synth presets (piano, leads, bass…) and pitched percussion share one
 *    instrument dropdown.
 *  - "Repeat" toggle re-triggers the held key at a chosen rate (1/4, 1/8,
 *    1/16, 1/32) for hands-free rolls / arpeggio-style bursts.
 */

const WHITE: Array<{ semi: number; label: string }> = [
  { semi: 0, label: "C" }, { semi: 2, label: "D" }, { semi: 4, label: "E" },
  { semi: 5, label: "F" }, { semi: 7, label: "G" }, { semi: 9, label: "A" },
  { semi: 11, label: "B" },
];
const BLACK_AFTER: Array<number | undefined> = [1, 3, undefined, 6, 8, 10, undefined];
const OCTAVES = 2;

const DRUM_KINDS = ALL_TRACK_KINDS.filter((k) => k !== "synth") as TrackKind[];

const REPEAT_RATES: Array<{ id: string; label: string; div: number }> = [
  { id: "1/4", label: "¼", div: 4 },
  { id: "1/8", label: "⅛", div: 8 },
  { id: "1/16", label: "1⁄16", div: 16 },
  { id: "1/32", label: "1⁄32", div: 32 },
];

interface Props { instanceId?: string; }

export function SynthPanel(_props: Props) {
  const mode = useWorkspace((s) => s.mode);
  const bpm = useWorkspace((s) => s.pattern.bpm);
  const [octave, setOctave] = useState(4);
  const [instrument, setInstrument] = useState<string>("piano");
  const [repeat, setRepeat] = useState(false);
  const [rate, setRate] = useState("1/16");
  const intervalsRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  // Stop all repeating notes when component unmounts or repeat turns off.
  useEffect(() => {
    if (!repeat) {
      for (const id of intervalsRef.current.values()) clearInterval(id);
      intervalsRef.current.clear();
    }
    return () => {
      for (const id of intervalsRef.current.values()) clearInterval(id);
      intervalsRef.current.clear();
    };
  }, [repeat]);

  const fireOnce = async (note: number) => {
    await boot();
    if (instrument.startsWith("drum:")) {
      engine.triggerOneShot(instrument.slice(5) as TrackKind, { velocity: 0.9, note });
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

  const press = (note: number) => {
    void fireOnce(note);
    if (repeat) {
      // Repeat interval based on current BPM + chosen rate division.
      const div = REPEAT_RATES.find((r) => r.id === rate)?.div ?? 16;
      const ms = (60_000 / Math.max(40, bpm)) * (4 / div);
      const existing = intervalsRef.current.get(note);
      if (existing) clearInterval(existing);
      const handle = setInterval(() => fireOnce(note), Math.max(40, ms));
      intervalsRef.current.set(note, handle);
    }
  };
  const release = (note: number) => {
    const h = intervalsRef.current.get(note);
    if (h) {
      clearInterval(h);
      intervalsRef.current.delete(note);
    }
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
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Synth</h2>
        <div className="flex flex-wrap items-center gap-1 text-[10px] uppercase text-muted-foreground">
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
            onClick={() => setRepeat((v) => !v)}
            className={`rounded border border-border px-1 py-0.5 ${repeat ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            title="Hold a key to retrigger at the chosen rate"
          >
            Repeat
          </button>
          {repeat && (
            <select
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="readout rounded border border-border bg-background px-1 py-0.5 text-[10px]"
              title="Repeat rate"
            >
              {REPEAT_RATES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          )}
          <button onClick={() => setOctave(Math.max(0, octave - 1))} className="rounded border border-border px-1 hover:bg-secondary" aria-label="Octave down">−</button>
          <span className="readout w-5 text-center">{octave}</span>
          <button onClick={() => setOctave(Math.min(7, octave + 1))} className="rounded border border-border px-1 hover:bg-secondary" aria-label="Octave up">+</button>
        </div>
      </div>

      <div className="relative flex-1 select-none">
        <div className="absolute inset-0 flex">
          {whiteKeys.map(({ note, label }) => (
            <button
              key={note}
              onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); press(note); }}
              onPointerUp={() => release(note)}
              onPointerCancel={() => release(note)}
              onPointerLeave={(e) => { if (e.buttons === 0) release(note); }}
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
                onPointerDown={(e) => { e.preventDefault(); press(note); }}
                onPointerUp={() => release(note)}
                onPointerCancel={() => release(note)}
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
