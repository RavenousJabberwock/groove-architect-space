import { Play, Square, Save, FolderOpen, Zap, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { sequencer } from "@/sequencer/engine";
import { workspace, useWorkspace } from "@/state/workspace";
import { bus } from "@/audio/bus";
import { boot } from "@/state/setup";
import { toast } from "sonner";

export function TopBar() {
  const pattern = useWorkspace((s) => s.pattern);
  const mode = useWorkspace((s) => s.mode);
  const [playing, setPlaying] = useState(false);

  useEffect(() => bus.on("transport:state", (e) => setPlaying(e.playing)), []);

  return (
    <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2">
      <div className="flex items-center gap-1">
        <button
          onClick={async () => {
            await boot();
            playing ? sequencer.stop() : sequencer.start();
          }}
          className="flex h-9 w-9 items-center justify-center rounded bg-primary text-primary-foreground transition hover:brightness-110"
          aria-label={playing ? "Stop" : "Play"}
        >
          {playing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
        </button>
      </div>

      <div className="readout flex items-center gap-2 rounded border border-border bg-background px-3 py-1.5 text-sm">
        <span className="opacity-60">BPM</span>
        <input
          type="number"
          min={40}
          max={240}
          value={pattern.bpm}
          onChange={(e) =>
            workspace.set((s) => ({ ...s, pattern: { ...s.pattern, bpm: Number(e.target.value) } }))
          }
          className="readout w-14 bg-transparent text-right outline-none"
        />
      </div>

      <div className="readout flex items-center gap-2 rounded border border-border bg-background px-3 py-1.5 text-sm">
        <span className="opacity-60">SWING</span>
        <input
          type="range"
          min={0}
          max={0.5}
          step={0.01}
          value={pattern.swing}
          onChange={(e) =>
            workspace.set((s) => ({ ...s, pattern: { ...s.pattern, swing: Number(e.target.value) } }))
          }
          className="w-24 accent-[var(--color-primary)]"
        />
        <span className="readout w-8 text-right">{Math.round(pattern.swing * 100)}</span>
      </div>

      <button
        onClick={() => (sequencer.fill = !sequencer.fill)}
        className="flex items-center gap-1 rounded border border-border bg-background px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-secondary"
      >
        <Zap className="h-3 w-3" /> Fill
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() =>
            workspace.set((s) => ({ ...s, mode: s.mode === "beginner" ? "pro" : "beginner" }))
          }
          className="flex items-center gap-1 rounded border border-border bg-background px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-secondary"
        >
          <Settings className="h-3 w-3" />
          {mode === "pro" ? "Pro" : "Beginner"}
        </button>
        <button
          onClick={() => {
            workspace.save();
            toast.success("Workspace saved");
          }}
          className="flex items-center gap-1 rounded border border-border bg-background px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-secondary"
        >
          <Save className="h-3 w-3" /> Save
        </button>
        <button
          onClick={() => {
            if (workspace.load()) toast.success("Workspace loaded");
            else toast.error("No saved workspace");
          }}
          className="flex items-center gap-1 rounded border border-border bg-background px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-secondary"
        >
          <FolderOpen className="h-3 w-3" /> Load
        </button>
      </div>
    </div>
  );
}
