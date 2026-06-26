import { useEffect, useState } from "react";
import { engine } from "@/audio/engine";
import { mediaPlayer } from "@/audio/media-player";
import { useWorkspace, workspace } from "@/state/workspace";

/**
 * Mixer panel.
 *
 * Surfaces every gain stage in the app so the user has one place to balance
 * everything they hear:
 *   - MASTER : output of the WebAudio graph (drums, synth, chaos pad, soundboard
 *              MIDI/synth pads), pre-limiter.
 *   - MUSIC  : Music Board global gain (HTMLAudio crossfade layer).
 *   - SFX    : Soundboard sample/MIDI/synth pad global gain.
 *   - TRACKS : per-sequencer-track gain + mute/solo, matching the pattern.
 *
 * Sample-based soundboard pads route through MUSIC's media-player rather than
 * the WebAudio master, so they are governed by SFX master here.
 */

const FaderColumn = ({
  label,
  value,
  onChange,
  accent = "primary",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  accent?: "primary" | "accent";
}) => (
  <div className="flex w-14 shrink-0 flex-col items-center gap-2 rounded border border-border bg-background p-2">
    <div className="readout text-[9px]">{label}</div>
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`h-24 ${accent === "primary" ? "accent-[var(--color-primary)]" : "accent-[var(--color-accent)]"}`}
      style={{ writingMode: "vertical-lr" as never, direction: "rtl" }}
    />
    <div className="readout text-[9px]">{Math.round(value * 100)}</div>
  </div>
);

export function MixerPanel() {
  const pattern = useWorkspace((s) => s.pattern);
  const musicMaster = useWorkspace((s) => s.musicMaster);
  const sfxMaster = useWorkspace((s) => s.sfxMaster);
  // Engine master is owned by the audio graph, not the workspace state — keep
  // a small mirror here so the slider reflects live changes after boot.
  const [master, setMaster] = useState(0.8);

  useEffect(() => {
    setMaster(engine.getMasterGain());
  }, []);

  // Reflect music-master changes onto any tracks already playing.
  useEffect(() => {
    for (const tr of workspace.get().musicTracks) {
      if (mediaPlayer.isPlaying(tr.id)) {
        mediaPlayer.setVolume(tr.id, tr.volume * musicMaster);
      }
    }
  }, [musicMaster]);

  return (
    <div className="flex h-full flex-col p-3">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Mixer</h2>
      <div className="flex flex-1 gap-2 overflow-auto">
        <FaderColumn
          label="MAST"
          value={master}
          onChange={(v) => {
            setMaster(v);
            engine.setMasterGain(v);
          }}
          accent="accent"
        />
        <FaderColumn
          label="MUSIC"
          value={musicMaster}
          onChange={(v) => workspace.setMusicMaster(v)}
          accent="accent"
        />
        <FaderColumn
          label="SFX"
          value={sfxMaster}
          onChange={(v) => workspace.setSfxMaster(v)}
          accent="accent"
        />
        <div className="w-px shrink-0 self-stretch bg-border" />
        {pattern.tracks.map((t) => (
          <div
            key={t.id}
            className="flex w-14 shrink-0 flex-col items-center gap-2 rounded border border-border bg-background p-2"
          >
            <div className="readout truncate text-[9px]" title={t.name}>{t.name}</div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              defaultValue={0.8}
              onChange={(e) => engine.setTrackGain(t.id, Number(e.target.value))}
              className="h-24 accent-[var(--color-primary)]"
              style={{ writingMode: "vertical-lr" as never, direction: "rtl" }}
            />
            <div className="flex gap-1">
              <button
                onClick={() =>
                  workspace.set((s) => ({
                    ...s,
                    pattern: {
                      ...s.pattern,
                      tracks: s.pattern.tracks.map((x) =>
                        x.id === t.id ? { ...x, mute: !x.mute } : x,
                      ),
                    },
                  }))
                }
                className={`rounded px-1 py-0.5 text-[8px] uppercase ${t.mute ? "bg-accent text-accent-foreground" : "bg-secondary"}`}
              >
                M
              </button>
              <button
                onClick={() =>
                  workspace.set((s) => ({
                    ...s,
                    pattern: {
                      ...s.pattern,
                      tracks: s.pattern.tracks.map((x) =>
                        x.id === t.id ? { ...x, solo: !x.solo } : x,
                      ),
                    },
                  }))
                }
                className={`rounded px-1 py-0.5 text-[8px] uppercase ${t.solo ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
              >
                S
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
