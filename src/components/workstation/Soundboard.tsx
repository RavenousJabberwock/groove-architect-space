import { useRef, useState } from "react";
import { Plus, Trash2, Upload, Pencil, Check, X } from "lucide-react";
import { useWorkspace, workspace, type SoundEffect, type SfxKind } from "@/state/workspace";
import { readId3Title, titleFromUrl } from "@/audio/id3";
import { ALL_TRACK_KINDS, type TrackKind } from "@/audio/engine";
import { triggerSfx } from "@/audio/triggers";
import { BindingsField } from "./BindingsField";
import { toast } from "sonner";

/**
 * Soundboard — grid of one-shot SFX pads for tabletop RPGs.
 *
 * Each pad has a `kind`:
 *   - "sample" : plays an audio file/URL through the media player.
 *   - "midi"   : triggers a built-in percussion voice (kick, snare, …).
 *   - "synth"  : plays a single note with a user-defined ADSR + waveform.
 *
 * Click a pad to trigger; right-click (or the inline edit button) to edit.
 */

const DRUM_KINDS = ALL_TRACK_KINDS.filter((k) => k !== "synth") as TrackKind[];
const WAVES: OscillatorType[] = ["sine", "triangle", "sawtooth", "square"];
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteName = (n: number) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
const DEFAULT_ADSR = { a: 0.01, d: 0.14, s: 0.5, r: 0.45 };

export function SoundboardPanel() {
  const sfx = useWorkspace((s) => s.soundEffects);
  const master = useWorkspace((s) => s.sfxMaster);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const trigger = async (s: SoundEffect) => {
    const ok = await triggerSfx(s);
    if (!ok) {
      const kind: SfxKind = s.kind ?? "sample";
      if (kind === "sample") toast.error(`"${s.title}" has no audio yet — edit to add a URL or file`);
      else if (kind === "midi") toast.error(`"${s.title}" has no MIDI instrument selected`);
    }
  };

  return (
    <div className="flex h-full flex-col gap-2 p-3 text-sm">
      <header className="flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">SFX Master</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={master}
          onChange={(e) => workspace.setSfxMaster(Number(e.target.value))}
          className="flex-1 accent-[var(--color-primary)]"
        />
        <span className="readout w-8 text-right">{Math.round(master * 100)}</span>
      </header>

      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-auto sm:grid-cols-3">
        {sfx.map((s) => (
          <PadCell
            key={s.id}
            sfx={s}
            editing={editingId === s.id}
            onTrigger={() => trigger(s)}
            onEdit={() => setEditingId(s.id)}
            onClose={() => setEditingId(null)}
          />
        ))}

        <button
          onClick={() => setAdding(true)}
          className="flex h-16 items-center justify-center rounded border border-dashed border-border text-xs uppercase text-muted-foreground hover:bg-secondary"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {adding && <AddSfxForm onDone={() => setAdding(false)} />}
    </div>
  );
}

function PadCell({
  sfx,
  editing,
  onTrigger,
  onEdit,
  onClose,
}: {
  sfx: SoundEffect;
  editing: boolean;
  onTrigger: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const kind: SfxKind = sfx.kind ?? "sample";
  const ready = kind !== "sample" || !!sfx.url;
  const badge = kind === "midi" ? (sfx.midiKind ?? "midi") : kind === "synth" ? noteName(sfx.note ?? 60) : "sample";
  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={onTrigger}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onTrigger()}
        onContextMenu={(e) => {
          e.preventDefault();
          onEdit();
        }}
        className={`flex h-16 w-full cursor-pointer flex-col items-center justify-center rounded border border-border px-2 text-center text-xs transition active:scale-[0.97] ${
          ready ? "bg-secondary hover:brightness-110" : "bg-card/40 text-muted-foreground"
        }`}
      >
        <span className="line-clamp-2 leading-tight">{sfx.title}</span>
        <span className="mt-0.5 text-[9px] uppercase tracking-wider opacity-60">{badge}</span>
        {!ready && <span className="text-[9px] opacity-60">tap to configure</span>}
      </div>
      <div className="absolute right-1 top-1 flex gap-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="rounded bg-background/80 p-0.5 hover:bg-background"
          aria-label="Edit"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); workspace.removeSfx(sfx.id); }}
          className="rounded bg-background/80 p-0.5 text-destructive hover:bg-background"
          aria-label="Remove"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {editing && <EditSfx sfx={sfx} onDone={onClose} />}
    </div>
  );
}

function EditSfx({ sfx, onDone }: { sfx: SoundEffect; onDone: () => void }) {
  const [title, setTitle] = useState(sfx.title);
  const [kind, setKind] = useState<SfxKind>(sfx.kind ?? "sample");
  const [url, setUrl] = useState(sfx.url ?? "");
  const [volume, setVolume] = useState(sfx.volume);
  const [midiKind, setMidiKind] = useState<string>(sfx.midiKind ?? "kick");
  const [note, setNote] = useState(sfx.note ?? 60);
  const [wave, setWave] = useState<OscillatorType>(sfx.wave ?? "sawtooth");
  const [adsr, setAdsr] = useState(sfx.adsr ?? DEFAULT_ADSR);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    const id3 = await readId3Title(f);
    const dataUrl: string = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.readAsDataURL(f);
    });
    setUrl(dataUrl);
    if (!title.trim()) setTitle(id3 || f.name.replace(/\.[a-z0-9]+$/i, ""));
  };

  const save = () => {
    workspace.updateSfx(sfx.id, {
      title: title.trim() || sfx.title,
      kind,
      url,
      volume,
      midiKind: kind === "midi" ? midiKind : undefined,
      note: kind === "synth" ? note : undefined,
      wave: kind === "synth" ? wave : undefined,
      adsr: kind === "synth" ? adsr : undefined,
    });
    onDone();
  };

  return (
    <div className="panel absolute left-0 top-full z-50 mt-1 w-72 space-y-1.5 p-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="readout w-full rounded border border-border bg-background px-2 py-1 text-xs"
      />
      <div className="flex gap-1">
        {(["sample", "midi", "synth"] as SfxKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`flex-1 rounded border border-border px-2 py-1 text-[10px] uppercase ${
              kind === k ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {kind === "sample" && (
        <>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Audio URL"
            className="readout w-full rounded border border-border bg-background px-2 py-1 text-xs"
          />
          <div className="flex gap-1">
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-secondary"
            >
              <Upload className="h-3 w-3" /> Upload
            </button>
          </div>
        </>
      )}

      {kind === "midi" && (
        <label className="flex items-center gap-2 text-xs">
          <span className="text-[10px] uppercase text-muted-foreground">Voice</span>
          <select
            value={midiKind}
            onChange={(e) => setMidiKind(e.target.value)}
            className="readout flex-1 rounded border border-border bg-background px-1 py-1 text-xs"
          >
            {DRUM_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
      )}

      {kind === "synth" && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[10px] uppercase text-muted-foreground">Note</span>
            <input
              type="number"
              min={0}
              max={127}
              value={note}
              onChange={(e) => setNote(Number(e.target.value))}
              className="readout w-16 rounded border border-border bg-background px-1 text-xs"
            />
            <span className="text-[10px] text-muted-foreground">{noteName(note)}</span>
            <select
              value={wave}
              onChange={(e) => setWave(e.target.value as OscillatorType)}
              className="readout ml-auto rounded border border-border bg-background px-1 py-0.5 text-xs"
            >
              {WAVES.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          {(["a", "d", "s", "r"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-[10px] uppercase">
              <span className="w-3 text-muted-foreground">{k}</span>
              <input
                type="range"
                min={0}
                max={k === "s" ? 1 : 2}
                step={0.005}
                value={adsr[k]}
                onChange={(e) => setAdsr({ ...adsr, [k]: Number(e.target.value) })}
                className="flex-1 accent-[var(--color-primary)]"
              />
              <span className="readout w-10 text-right normal-case">
                {k === "s" ? adsr[k].toFixed(2) : `${(adsr[k] * 1000).toFixed(0)}ms`}
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase text-muted-foreground">Vol</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="flex-1 accent-[var(--color-primary)]"
        />
        <span className="readout w-8 text-right text-xs">{Math.round(volume * 100)}</span>
      </div>

      <BindingsField
        hotkey={sfx.hotkey}
        midiNote={sfx.midiNote}
        onChange={(patch) => workspace.updateSfx(sfx.id, patch)}
      />

      <AutoTriggerField sfx={sfx} />




      <div className="flex gap-1">
        <button
          onClick={save}
          className="flex flex-1 items-center justify-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:brightness-110"
        >
          <Check className="h-3 w-3" /> Save
        </button>
        <button
          onClick={onDone}
          className="rounded border border-border px-2 py-1 text-xs hover:bg-secondary"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/**
 * Per-pad random auto-trigger controls. When enabled, the pad-triggers hook
 * schedules a `triggerSfx` call after a random delay in [min, max] ms.
 * Perfect for ambient cues (distant thunder, wolf howls, dripping water).
 */
function AutoTriggerField({ sfx }: { sfx: SoundEffect }) {
  const auto = sfx.auto ?? { enabled: false, minMs: 20000, maxMs: 60000 };
  const set = (patch: Partial<NonNullable<SoundEffect["auto"]>>) =>
    workspace.updateSfx(sfx.id, { auto: { ...auto, ...patch } });
  return (
    <div className="rounded border border-border p-1.5">
      <label className="flex items-center gap-2 text-[10px] uppercase">
        <input
          type="checkbox"
          checked={auto.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
          className="accent-[var(--color-primary)]"
        />
        Auto-fire randomly
      </label>
      {auto.enabled && (
        <div className="mt-1 space-y-1">
          <label className="flex items-center gap-2 text-[10px] uppercase">
            <span className="w-8 text-muted-foreground">Min</span>
            <input
              type="range" min={1000} max={120000} step={500}
              value={auto.minMs}
              onChange={(e) => set({ minMs: Number(e.target.value) })}
              className="flex-1 accent-[var(--color-primary)]"
            />
            <span className="readout w-12 text-right normal-case">{(auto.minMs / 1000).toFixed(1)}s</span>
          </label>
          <label className="flex items-center gap-2 text-[10px] uppercase">
            <span className="w-8 text-muted-foreground">Max</span>
            <input
              type="range" min={2000} max={300000} step={500}
              value={auto.maxMs}
              onChange={(e) => set({ maxMs: Number(e.target.value) })}
              className="flex-1 accent-[var(--color-primary)]"
            />
            <span className="readout w-12 text-right normal-case">{(auto.maxMs / 1000).toFixed(1)}s</span>
          </label>
        </div>
      )}
    </div>
  );
}

function AddSfxForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<SfxKind>("sample");
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    const id3 = await readId3Title(f);
    const dataUrl: string = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.readAsDataURL(f);
    });
    workspace.addSfx({
      title: title.trim() || id3 || f.name.replace(/\.[a-z0-9]+$/i, ""),
      kind: "sample",
      url: dataUrl,
    });
    toast.success("Sound added");
    onDone();
  };

  const submit = () => {
    if (kind === "sample") {
      if (!url.trim() && !title.trim()) {
        toast.error("Need a URL or title");
        return;
      }
      workspace.addSfx({
        title: title.trim() || titleFromUrl(url),
        kind: "sample",
        url: url.trim(),
      });
    } else if (kind === "midi") {
      workspace.addSfx({
        title: title.trim() || "Kick",
        kind: "midi",
        midiKind: "kick",
      });
    } else {
      workspace.addSfx({
        title: title.trim() || "Synth Pad",
        kind: "synth",
        note: 60,
        wave: "sawtooth",
        adsr: DEFAULT_ADSR,
      });
    }
    toast.success("Sound added — right-click to configure");
    onDone();
  };

  return (
    <div className="space-y-1 rounded border border-border bg-card/40 p-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="readout w-full rounded border border-border bg-background px-2 py-1 text-xs"
      />
      <div className="flex gap-1">
        {(["sample", "midi", "synth"] as SfxKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`flex-1 rounded border border-border px-2 py-1 text-[10px] uppercase ${
              kind === k ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
            }`}
          >
            {k}
          </button>
        ))}
      </div>
      {kind === "sample" && (
        <div className="flex gap-1">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Audio URL"
            className="readout flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
          />
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded border border-border px-2 text-xs hover:bg-secondary"
            title="Upload file"
          >
            <Upload className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className="flex gap-1">
        <button
          onClick={submit}
          className="flex flex-1 items-center justify-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
        >
          <Check className="h-3 w-3" /> Add
        </button>
        <button
          onClick={onDone}
          className="rounded border border-border px-2 py-1 text-xs hover:bg-secondary"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
