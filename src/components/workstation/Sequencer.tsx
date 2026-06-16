import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { bus } from "@/audio/bus";
import { useWorkspace, workspace } from "@/state/workspace";
import type { Condition, Step } from "@/sequencer/types";
import { ALL_TRACK_KINDS, type TrackKind } from "@/audio/engine";

const CONDITIONS: Condition[] = [null, "1:2", "2:2", "FILL", "PRE", "NEI"];

export function SequencerPanel() {
  const pattern = useWorkspace((s) => s.pattern);
  const selectedTrackId = useWorkspace((s) => s.selectedTrackId);
  const mode = useWorkspace((s) => s.mode);
  const [playStep, setPlayStep] = useState(0);

  useEffect(() => bus.on("transport:step", (e) => setPlayStep(e.step % 16)), []);

  const updateStep = (trackId: string, idx: number, patch: Partial<Step>) => {
    workspace.set((s) => ({
      ...s,
      pattern: {
        ...s.pattern,
        tracks: s.pattern.tracks.map((t) =>
          t.id === trackId
            ? { ...t, steps: t.steps.map((st, i) => (i === idx ? { ...st, ...patch } : st)) }
            : t,
        ),
      },
    }));
  };

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Sequencer</h2>
        <div className="readout text-xs">{String(playStep + 1).padStart(2, "0")} / 16</div>
        <select
          onChange={(e) => {
            if (!e.target.value) return;
            workspace.addTrack(e.target.value as TrackKind);
            e.target.value = "";
          }}
          defaultValue=""
          className="ml-auto flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[10px] uppercase tracking-wider hover:bg-secondary"
          title="Add track"
        >
          <option value="" disabled>+ Add track</option>
          {ALL_TRACK_KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 space-y-1 overflow-auto">
        {pattern.tracks.map((track) => {
          const selected = track.id === selectedTrackId;
          return (
            <div key={track.id} className="flex items-center gap-2">
              <div className="flex w-32 shrink-0 items-center gap-1">
                <button
                  onClick={() => workspace.set((s) => ({ ...s, selectedTrackId: track.id }))}
                  className={`min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wider ${
                    selected ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                  }`}
                  title={track.name}
                >
                  {track.name}
                </button>
                <select
                  value={track.kind}
                  onChange={(e) => workspace.setTrackKind(track.id, e.target.value as TrackKind)}
                  className="readout w-16 rounded border border-border bg-background px-1 py-1 text-[9px] uppercase"
                  title="Instrument"
                >
                  {ALL_TRACK_KINDS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <button
                  onClick={() => workspace.removeTrack(track.id)}
                  className="rounded border border-border bg-background p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  title="Remove track"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="flex flex-1 gap-1">
                {track.steps.slice(0, 16).map((step, i) => {
                  const playing = i === playStep && i < track.length;
                  const inBounds = i < track.length;
                  return (
                    <button
                      key={i}
                      onClick={() => updateStep(track.id, i, { active: !step.active })}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (mode !== "pro") return;
                        const next: Condition =
                          CONDITIONS[(CONDITIONS.indexOf(step.condition) + 1) % CONDITIONS.length] ?? null;
                        updateStep(track.id, i, { condition: next });
                      }}
                      onWheel={(e) => {
                        if (mode !== "pro") return;
                        e.preventDefault();
                        const delta = e.deltaY > 0 ? -5 : 5;
                        updateStep(track.id, i, {
                          probability: Math.max(0, Math.min(100, step.probability + delta)),
                        });
                      }}
                      className={`relative h-9 flex-1 rounded border text-[9px] transition ${
                        !inBounds
                          ? "border-transparent bg-background/40 opacity-30"
                          : step.active
                            ? playing
                              ? "border-accent bg-accent text-accent-foreground shadow-[0_0_12px_var(--color-accent)]"
                              : "border-primary bg-primary text-primary-foreground"
                            : playing
                              ? "border-accent bg-accent/20"
                              : i % 4 === 0
                                ? "border-border bg-secondary"
                                : "border-border bg-background"
                      }`}
                    >
                      {mode === "pro" && step.active && step.condition && (
                        <span className="readout absolute left-0.5 top-0 text-[8px]">
                          {step.condition}
                        </span>
                      )}
                      {mode === "pro" && step.active && step.probability < 100 && (
                        <span className="readout absolute right-0.5 bottom-0 text-[8px]">
                          {step.probability}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {mode === "pro" && (
                <input
                  type="number"
                  min={1}
                  max={32}
                  value={track.length}
                  onChange={(e) =>
                    workspace.set((s) => ({
                      ...s,
                      pattern: {
                        ...s.pattern,
                        tracks: s.pattern.tracks.map((t) =>
                          t.id === track.id ? { ...t, length: Number(e.target.value) } : t,
                        ),
                      },
                    }))
                  }
                  className="readout w-10 rounded border border-border bg-background px-1 py-0.5 text-right text-[10px]"
                  title="Track length (polymeter)"
                />
              )}
            </div>
          );
        })}
      </div>
      {mode === "pro" && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Right-click step: cycle conditional trigs. Scroll on step: probability. Per-row dropdown swaps
          the instrument; × removes the row; "+ Add track" creates a new row.
        </p>
      )}
      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/70">
        <Plus className="h-3 w-3" /> Space play/stop · F fill · B beginner/pro · ⌘/Ctrl+S save
      </p>
    </div>
  );
}
