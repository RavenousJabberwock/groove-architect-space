import { useEffect, useRef, useState } from "react";
import { Play, Square, Trash2, Plus, Upload, Pencil, Check, X, ListMusic, Shuffle } from "lucide-react";
import { useWorkspace, workspace, type MusicTrack } from "@/state/workspace";
import { mediaPlayer } from "@/audio/media-player";
import { readId3Title, titleFromUrl } from "@/audio/id3";
import { toggleMusic, crossfadeMusic } from "@/audio/triggers";
import { BindingsField } from "./BindingsField";
import { toast } from "sonner";

/**
 * Music Board — DJ-style background music mixer for tabletop RPGs.
 *
 * Each track has its own fader, loop toggle, and optional hotkey / MIDI-note
 * binding. When **Playlist** mode is on, the board automatically crossfades
 * from the playing track to the next one in the playlist a few seconds
 * before it ends (using the global Fade length). `loop` is ignored while
 * playlist mode is active so the `ended` watcher can advance.
 */
export function MusicBoardPanel() {
  const tracks = useWorkspace((s) => s.musicTracks);
  const master = useWorkspace((s) => s.musicMaster);
  const fadeMs = useWorkspace((s) => s.fadeMs);
  const playlist = useWorkspace((s) => s.playlist);
  const [playingIds, setPlayingIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const advancingRef = useRef(false);

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

  // Playlist auto-crossfade. Polls the playing element's currentTime/duration
  // each second; when within `fadeMs` of the end, kicks off the crossfade to
  // the next queued track. `loop` is forced off in playlist mode so the
  // element actually reaches its end.
  useEffect(() => {
    if (!playlist.enabled || playlist.trackIds.length === 0) return;
    const poll = setInterval(() => {
      if (advancingRef.current) return;
      const ids = playlist.trackIds;
      // Find the currently-playing playlist track.
      const playing = ids
        .map((id) => ({ id, el: mediaPlayer.element(id) }))
        .find(({ id }) => mediaPlayer.isPlaying(id));
      if (!playing?.el || !isFinite(playing.el.duration)) return;
      const remaining = playing.el.duration - playing.el.currentTime;
      if (remaining > fadeMs / 1000 + 0.25) return;

      const cursor = ids.indexOf(playing.id);
      const nextIdx = playlist.shuffle
        ? Math.floor(Math.random() * ids.length)
        : (cursor + 1) % ids.length;
      const nextId = ids[nextIdx];
      const nextTrack = workspace.get().musicTracks.find((m) => m.id === nextId);
      if (!nextTrack) return;
      advancingRef.current = true;
      void crossfadeMusic({ ...nextTrack, loop: false }).finally(() => {
        // Cooldown so we don't double-advance during the fade window.
        setTimeout(() => (advancingRef.current = false), Math.max(500, fadeMs));
      });
    }, 500);
    return () => clearInterval(poll);
  }, [playlist.enabled, playlist.trackIds, playlist.shuffle, fadeMs]);

  return (
    <div className="flex h-full flex-col gap-2 p-3 text-sm">
      <header className="flex flex-wrap items-center gap-2">
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
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Fade</span>
        <input
          type="number"
          min={0}
          step={250}
          value={fadeMs}
          onChange={(e) => workspace.setFadeMs(Number(e.target.value))}
          className="readout w-16 rounded border border-border bg-background px-1 text-right"
        />
        <span className="text-[10px] text-muted-foreground">ms</span>
        <button
          onClick={() => workspace.setPlaylist({ enabled: !playlist.enabled })}
          className={`flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] uppercase tracking-wider ${
            playlist.enabled ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
          }`}
          title="Auto-crossfade through queued tracks"
        >
          <ListMusic className="h-3 w-3" /> Playlist
        </button>
        <button
          onClick={() => workspace.setPlaylist({ shuffle: !playlist.shuffle })}
          className={`flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] uppercase tracking-wider ${
            playlist.shuffle ? "bg-accent text-accent-foreground" : "hover:bg-secondary"
          }`}
          title="Pick the next playlist track at random"
        >
          <Shuffle className="h-3 w-3" />
        </button>
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
            inPlaylist={playlist.trackIds.includes(tr.id)}
            playlistEnabled={playlist.enabled}
            onToggle={() => toggleMusic(tr)}
            onCrossfade={() => crossfadeMusic(tr)}
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
  inPlaylist,
  playlistEnabled,
  onToggle,
  onCrossfade,
}: {
  track: MusicTrack;
  playing: boolean;
  inPlaylist: boolean;
  playlistEnabled: boolean;
  onToggle: () => void;
  onCrossfade: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [bindingsOpen, setBindingsOpen] = useState(false);
  const [title, setTitle] = useState(track.title);

  const commit = () => {
    workspace.updateMusic(track.id, { title: title.trim() || track.title });
    setEditing(false);
  };

  const togglePlaylist = () => {
    const cur = workspace.get().playlist.trackIds;
    const next = cur.includes(track.id) ? cur.filter((x) => x !== track.id) : [...cur, track.id];
    workspace.setPlaylist({ trackIds: next });
  };

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 px-2 py-1.5">
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
              {track.hotkey && (
                <span className="rounded border border-border px-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                  {track.hotkey}
                </span>
              )}
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
        {playlistEnabled && (
          <button
            onClick={togglePlaylist}
            title={inPlaylist ? "Remove from playlist" : "Add to playlist"}
            className={`rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider hover:bg-secondary ${
              inPlaylist ? "bg-primary/30" : ""
            }`}
          >
            <ListMusic className="h-3 w-3" />
          </button>
        )}
        <button
          onClick={() => setBindingsOpen((v) => !v)}
          title="Hotkey / MIDI bindings"
          className={`rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider hover:bg-secondary ${
            track.hotkey || track.midiNote !== undefined ? "border-primary/60" : ""
          }`}
        >
          Bind
        </button>
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
      {bindingsOpen && (
        <div className="px-2 pb-2">
          <BindingsField
            hotkey={track.hotkey}
            midiNote={track.midiNote}
            onChange={(patch) => workspace.updateMusic(track.id, patch)}
          />
        </div>
      )}
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
