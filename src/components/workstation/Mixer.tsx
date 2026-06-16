import { engine } from "@/audio/engine";
import { useWorkspace, workspace } from "@/state/workspace";

export function MixerPanel() {
  const pattern = useWorkspace((s) => s.pattern);

  return (
    <div className="flex h-full flex-col p-3">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Mixer</h2>
      <div className="flex flex-1 gap-2 overflow-auto">
        {pattern.tracks.map((t) => (
          <div key={t.id} className="flex w-14 shrink-0 flex-col items-center gap-2 rounded border border-border bg-background p-2">
            <div className="readout text-[9px]">{t.name}</div>
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
