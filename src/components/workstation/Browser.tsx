import { useState } from "react";
import { workspace } from "@/state/workspace";
import { defaultPattern } from "@/presets/defaults";
import { toast } from "sonner";

export function BrowserPanel() {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="flex h-full flex-col p-3">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Browser</h2>
      <div className="mb-3 space-y-1">
        <div className="text-[10px] uppercase text-muted-foreground">Patterns</div>
        <button
          onClick={() => workspace.set((s) => ({ ...s, pattern: defaultPattern() }))}
          className="block w-full rounded border border-border bg-background px-2 py-1 text-left text-xs hover:bg-secondary"
        >
          INIT — 120 BPM
        </button>
      </div>
      <div className="mb-3 space-y-1">
        <div className="text-[10px] uppercase text-muted-foreground">Workspaces</div>
        {workspace.list().length === 0 && (
          <div className="text-[10px] text-muted-foreground/60">No saved workspaces</div>
        )}
        {workspace.list().map((n) => (
          <button
            key={n}
            onClick={() => {
              workspace.load(n);
              toast.success(`Loaded ${n}`);
            }}
            className="block w-full rounded border border-border bg-background px-2 py-1 text-left text-xs hover:bg-secondary"
          >
            {n}
          </button>
        ))}
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("audio/"));
          if (files.length === 0) {
            toast.error("Drop audio files only");
            return;
          }
          toast.success(`${files.length} sample(s) ready (local-only in this iteration)`);
        }}
        className={`mt-auto flex flex-1 items-center justify-center rounded border border-dashed text-center text-[10px] uppercase tracking-wider transition ${
          dragging
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-background text-muted-foreground"
        }`}
      >
        Drop samples here
      </div>
    </div>
  );
}
