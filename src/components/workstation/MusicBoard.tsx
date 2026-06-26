import { useEffect, useRef, useState } from "react";
import { Play, Square, Trash2, Plus, Upload, Pencil, Check, X } from "lucide-react";
import { useWorkspace, workspace, type MusicTrack } from "@/state/workspace";
import { mediaPlayer } from "@/audio/media-player";
import { readId3Title, titleFromUrl } from "@/audio/id3";
import { toast } from "sonner";

/**
 * Music Board — DJ-style background music mixer for tabletop RPGs.
 * Each track has its own fader and loop toggle; new tracks fade in
 * while currently-playing tracks fade out over the global Fade time.
 */
export function MusicBoardPanel() {
  const tracks = useWorkspace((s) => s.musicTracks);
  const master = useWorkspace((s) => s.musicMaster);
  const fadeMs = useWorkspace((s) => s.fadeMs);
  const [playingIds, setPlayingIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  // Keep "playing" state synced with element state.
  useEffect(() => {
    const t = setInterval(() => {
      setPlayingIds((prev) => {
        const next = new Set<string>();
        for (const tr of workspace.get().musicTracks) {
          if (mediaPlayer.isPlaying(tr.id)) next.add(tr.id);
        }
        if (next.size === prev.size && [...next].every((id) => prev.has(id))) return prev;
        return next;
      });
    }, 400);
    return () => clearInterval(t);
  }, []);

  const togglePlay = async (tr: MusicTrack) => {
    if (!tr.url) {
      toast.error("Track has no URL — edit it to add one");
      return;
    }
    if (mediaPlayer.isPlaying(tr.id)) {
      mediaPlayer.stop(tr.id, fadeMs);
    } else {
      await mediaPlayer.play(tr.id, tr.url, {
        volume: tr.volume * master,
        loop: tr.loop,
        fadeMs,
      });
    }
  };

  const crossfadeTo = async (tr: MusicTrack) => {
    if (!tr.url) return;
    for (const other of workspace.get().musicTracks) {
      if (other.id !== tr.id && mediaPlayer.isPlaying(other.id)) {
        mediaPlayer.stop(other.id, fadeMs);
      }
    }
    await mediaPlayer.play(tr.id, tr.url, { volume: tr.volume * master, loop: tr.loop, fadeMs });
  };

  return (
    <div className="flex h-full flex-col gap-2 p-3 text-sm">
      <header className="flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Master</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={master}
          onChange={(e) => workspace.setMusicMaster(Number(e.target.value))}
          className="flex-1 accent-[var(--color-primary)]"
        />
        <span className="readout w-8 text-right">{Math.round(master * 100)}</span>
        <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Fade</span>
        <input
          type="number"
          min={0}
          step={250}
          value={fadeMs}
          onChange={(e) => workspace.setFadeMs(Number(e.target.value))}
          className="readout w-16 rounded border border-border bg-background px-1 text-right"
        />
        <span className="text-[10px] text-muted-foreground">ms</span>
      </header>

      <div className="min-h-0 flex-1 overflow-auto rounded border border-border">
        {tracks.length === 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No tracks. Add a URL or upload a file below.
          </div>
        )}
        {tracks.map((tr) => (
          <MusicRow
            key={tr.id}
            track={tr}
            playing={playingIds.has(tr.id)}
            onToggle={() => togglePlay(tr)}
            onCrossfade={() => crossfadeTo(tr)}
          />
        ))}
      </div>

      {adding ? (
        <AddMusicForm onDone={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center justify-center gap-1 rounded border border-dashed border-border px-2 py-1.5 text-xs uppercase tracking-wider hover:bg-secondary"
        >
          <Plus className="h-3 w-3" /> Add Track
        </button>
      )}
    </div>
  );
}

function MusicRow({
  track,
  playing,
  onToggle,
  onCrossfade,
}: {
  track: MusicTrack;
  playing: boolean;
  onToggle: () => void;
  onCrossfade: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(track.title);

  const commit = () => {
    workspace.updateMusic(track.id, { title: title.trim() || track.title });
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 border-b border-border px-2 py-1.5 last:border-b-0">
      <button
        onClick={onToggle}
        className={`flex h-7 w-7 items-center justify-center rounded ${
          playing ? "bg-primary text-primary-foreground" : "bg-secondary"
        }`}
        aria-label={playing ? "Stop" : "Play"}
      >
        {playing ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            className="readout w-full rounded border border-border bg-background px-1 text-xs"
          />
        ) : (
          <div className="flex items-center gap-1">
            <span className="truncate text-xs">{track.title}</span>
            <button
              onClick={() => {
                setTitle(track.title);
                setEditing(true);
              }}
              className="opacity-50 hover:opacity-100"
              aria-label="Rename"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="truncate text-[10px] text-muted-foreground" title={track.url || "no source"}>
          {track.url ? track.url.replace(/^data:.*?;base64,.*/, "[uploaded file]") : "no source"}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={track.volume}
        onChange={(e) => {
          const v = Number(e.target.value);
          workspace.updateMusic(track.id, { volume: v });
          if (playing) mediaPlayer.setVolume(track.id, v * workspace.get().musicMaster);
        }}
        className="w-20 accent-[var(--color-primary)]"
      />
      <label className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
        <input
          type="checkbox"
          checked={track.loop}
          onChange={(e) => workspace.updateMusic(track.id, { loop: e.target.checked })}
        />
        Loop
      </label>
      <button
        onClick={onCrossfade}
        title="Crossfade to this track"
        className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider hover:bg-secondary"
      >
        XFade
      </button>
      <button
        onClick={() => workspace.removeMusic(track.id)}
        className="text-muted-foreground hover:text-destructive"
        aria-label="Remove"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function AddMusicForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    const id3 = await readId3Title(f);
    const dataUrl: string = await new Promise((res) => {
      const reader = new FileReader();
      reader.onload = () => res(String(reader.result));
      reader.readAsDataURL(f);
    });
    workspace.addMusic({
      title: title.trim() || id3 || f.name.replace(/\.[a-z0-9]+$/i, ""),
      url: dataUrl,
    });
    toast.success("Track added");
    onDone();
  };

  const handleUrl = () => {
    if (!url.trim()) return;
    workspace.addMusic({
      title: title.trim() || titleFromUrl(url),
      url: url.trim(),
    });
    toast.success("Track added");
    onDone();
  };

  return (
    <div className="space-y-1 rounded border border-border bg-card/40 p-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (auto from ID3 / URL if blank)"
        className="readout w-full rounded border border-border bg-background px-2 py-1 text-xs"
      />
      <div className="flex gap-1">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Audio URL (mp3 / ogg / wav)"
          className="readout flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
        />
        <button
          onClick={handleUrl}
          className="rounded bg-primary px-2 text-xs uppercase text-primary-foreground hover:brightness-110"
        >
          <Check className="h-3 w-3" />
        </button>
      </div>
      <div className="flex items-center gap-1">
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
          aria-label="Cancel"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
