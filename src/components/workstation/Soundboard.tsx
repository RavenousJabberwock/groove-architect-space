import { useRef, useState } from "react";
import { Plus, Trash2, Upload, Pencil, Check, X } from "lucide-react";
import { useWorkspace, workspace, type SoundEffect } from "@/state/workspace";
import { mediaPlayer } from "@/audio/media-player";
import { readId3Title, titleFromUrl } from "@/audio/id3";
import { toast } from "sonner";

/**
 * Soundboard — grid of one-shot SFX pads for tabletop RPGs. Click a pad
 * to trigger; right-click (or the inline edit button) to rename / replace
 * the source. New pads can be added from a URL or file upload.
 */
export function SoundboardPanel() {
  const sfx = useWorkspace((s) => s.soundEffects);
  const master = useWorkspace((s) => s.sfxMaster);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const trigger = (s: SoundEffect) => {
    if (!s.url) {
      toast.error(`"${s.title}" has no audio yet — edit to add a URL or file`);
      return;
    }
    void mediaPlayer.trigger(s.id, s.url, s.volume * master);
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
          <div key={s.id} className="relative">
            <button
              onClick={() => trigger(s)}
              onContextMenu={(e) => {
                e.preventDefault();
                setEditingId(s.id);
              }}
              className={`flex h-16 w-full flex-col items-center justify-center rounded border border-border px-2 text-center text-xs transition active:scale-[0.97] ${
                s.url ? "bg-secondary hover:brightness-110" : "bg-card/40 text-muted-foreground"
              }`}
            >
              <span className="line-clamp-2 leading-tight">{s.title}</span>
              {!s.url && <span className="text-[9px] opacity-60">tap to configure</span>}
            </button>
            <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition group-hover:opacity-100 hover:opacity-100">
              <button
                onClick={() => setEditingId(s.id)}
                className="rounded bg-background/80 p-0.5 hover:bg-background"
                aria-label="Edit"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={() => workspace.removeSfx(s.id)}
                className="rounded bg-background/80 p-0.5 text-destructive hover:bg-background"
                aria-label="Remove"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            {editingId === s.id && (
              <EditSfx sfx={s} onDone={() => setEditingId(null)} />
            )}
          </div>
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

function EditSfx({ sfx, onDone }: { sfx: SoundEffect; onDone: () => void }) {
  const [title, setTitle] = useState(sfx.title);
  const [url, setUrl] = useState(sfx.url);
  const [volume, setVolume] = useState(sfx.volume);
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
    workspace.updateSfx(sfx.id, { title: title.trim() || sfx.title, url, volume });
    onDone();
  };

  return (
    <div className="panel absolute left-0 top-full z-50 mt-1 w-64 space-y-1 p-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="readout w-full rounded border border-border bg-background px-2 py-1 text-xs"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Audio URL"
        className="readout w-full rounded border border-border bg-background px-2 py-1 text-xs"
      />
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
        <button
          onClick={save}
          className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:brightness-110"
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

function AddSfxForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
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
      url: dataUrl,
    });
    toast.success("Sound added");
    onDone();
  };

  const submitUrl = () => {
    if (!url.trim()) return;
    workspace.addSfx({
      title: title.trim() || titleFromUrl(url),
      url: url.trim(),
    });
    toast.success("Sound added");
    onDone();
  };

  return (
    <div className="space-y-1 rounded border border-border bg-card/40 p-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (auto from ID3 / URL)"
        className="readout w-full rounded border border-border bg-background px-2 py-1 text-xs"
      />
      <div className="flex gap-1">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Audio URL"
          className="readout flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
        />
        <button
          onClick={submitUrl}
          className="rounded bg-primary px-2 text-xs text-primary-foreground"
        >
          <Check className="h-3 w-3" />
        </button>
      </div>
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
          <Upload className="h-3 w-3" /> Upload file
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
