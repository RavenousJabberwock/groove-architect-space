import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Play, Square, ChevronUp, ChevronDown } from "lucide-react";
import { useWorkspace, workspace } from "@/state/workspace";
import { sequencer } from "@/sequencer/engine";
import { bus } from "@/audio/bus";
import { songController } from "@/song/chain";

/**
 * Song Mode panel.
 *
 *   - Pattern library: save the current pattern as a named entry, load any
 *     stored pattern back into the sequencer.
 *   - Chain editor: ordered list of (pattern, bars) steps. When song mode
 *     is enabled, the chain advances at bar boundaries and loops.
 */
export function SongModePanel() {
  const patterns = useWorkspace((s) => s.patterns);
  const song = useWorkspace((s) => s.song);
  const currentPattern = useWorkspace((s) => s.pattern);
  const [cursor, setCursor] = useState(0);

  useEffect(() =>
    bus.on("transport:step", () => setCursor(songController.cursor())),
  []);

  const playStop = async () => {
    if (sequencer.isPlaying()) sequencer.stop();
    else await sequencer.start();
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Song Mode</h2>
        <button
          onClick={playStop}
          className="flex items-center gap-1 rounded border border-border bg-secondary px-2 py-1 text-[10px] uppercase tracking-wider hover:bg-primary hover:text-primary-foreground"
        >
          {sequencer.isPlaying()
            ? <><Square className="h-3 w-3" /> Stop</>
            : <><Play className="h-3 w-3" /> Play</>}
        </button>
      </div>

      <section className="rounded border border-border bg-background p-2">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Patterns</div>
          <button
            onClick={() => {
              const name = prompt("Save current pattern as:", `Pattern ${patterns.length + 1}`);
              if (name) workspace.savePatternToLibrary(name);
            }}
            className="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] uppercase hover:bg-secondary"
          >
            <Save className="h-3 w-3" /> Save current
          </button>
        </div>
        {patterns.length === 0 && (
          <p className="text-[10px] text-muted-foreground">No saved patterns yet. Save the current pattern, then build a chain below.</p>
        )}
        <div className="space-y-1">
          {patterns.map((p) => {
            const isCurrent = p.id === currentPattern.id;
            return (
              <div key={p.id} className="flex items-center gap-2 rounded border border-border px-2 py-1 text-xs">
                <input
                  value={p.name}
                  onChange={(e) => workspace.renamePattern(p.id, e.target.value)}
                  className="flex-1 rounded border border-border bg-background px-1 py-0.5 text-xs"
                />
                <span className="readout text-[10px] text-muted-foreground">{p.bpm} BPM</span>
                <button
                  onClick={() => workspace.loadPatternFromLibrary(p.id)}
                  disabled={isCurrent}
                  className={`rounded border border-border px-2 py-0.5 text-[10px] uppercase ${isCurrent ? "opacity-50" : "hover:bg-secondary"}`}
                >
                  {isCurrent ? "Loaded" : "Load"}
                </button>
                <button
                  onClick={() => workspace.addToSongChain(p.id, 2)}
                  className="rounded border border-border px-2 py-0.5 text-[10px] uppercase hover:bg-secondary"
                  title="Append to chain"
                >
                  <Plus className="h-3 w-3" />
                </button>
                <button
                  onClick={() => workspace.removePatternFromLibrary(p.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  aria-label="Delete pattern"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded border border-border bg-background p-2">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Chain</div>
          <label className="flex items-center gap-1 text-[10px] uppercase">
            <input
              type="checkbox"
              checked={song.enabled}
              onChange={(e) => workspace.setSongEnabled(e.target.checked)}
              className="accent-[var(--color-primary)]"
            />
            Enabled
          </label>
        </div>
        {song.items.length === 0 && (
          <p className="text-[10px] text-muted-foreground">Chain is empty. Use the &quot;+&quot; next to a saved pattern to append it here.</p>
        )}
        <div className="space-y-1">
          {song.items.map((item, idx) => {
            const p = patterns.find((x) => x.id === item.patternId);
            const playing = song.enabled && sequencer.isPlaying() && cursor === idx;
            return (
              <div
                key={idx}
                className={`flex items-center gap-2 rounded border px-2 py-1 text-xs ${
                  playing ? "border-accent bg-accent/15" : "border-border"
                }`}
              >
                <span className="readout w-6 text-[10px] text-muted-foreground">{idx + 1}.</span>
                <span className="flex-1 truncate">{p?.name ?? "(missing)"}</span>
                <label className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
                  bars
                  <input
                    type="number" min={1} max={64} value={item.bars}
                    onChange={(e) => workspace.setChainBars(idx, Number(e.target.value))}
                    className="readout w-12 rounded border border-border bg-background px-1 py-0.5 text-right text-xs"
                  />
                </label>
                <button
                  onClick={() => workspace.moveChainItem(idx, -1)}
                  disabled={idx === 0}
                  className="rounded border border-border p-0.5 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => workspace.moveChainItem(idx, 1)}
                  disabled={idx === song.items.length - 1}
                  className="rounded border border-border p-0.5 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
                <button
                  onClick={() => workspace.removeChainItem(idx)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  aria-label="Remove from chain"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
        {song.enabled && song.items.length > 0 && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Patterns advance at bar boundaries (16 steps) and loop back to step 1.
          </p>
        )}
      </section>
    </div>
  );
}
