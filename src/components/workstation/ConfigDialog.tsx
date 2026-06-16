import { X, RotateCcw } from "lucide-react";
import { PALETTES } from "@/themes/palettes";
import { workspace, useWorkspace, PANEL_IDS, type PanelId } from "@/state/workspace";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PANEL_LABELS: Record<PanelId, string> = {
  sequencer: "Sequencer",
  drum: "Drums",
  synth: "Synth",
  chaos: "Chaos Pad",
  mixer: "Mixer",
  browser: "Browser",
};

export function ConfigDialog({ open, onClose }: Props) {
  const palette = useWorkspace((s) => s.palette);
  const layouts = useWorkspace((s) => s.layouts);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel w-[560px] max-w-[90vw] max-h-[80vh] overflow-auto p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Configure
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <section className="mb-6">
          <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Palette
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                onClick={() => workspace.setPalette(p.id)}
                className={`flex items-center gap-3 rounded border bg-background p-3 text-left transition hover:border-primary ${
                  palette === p.id ? "border-primary ring-1 ring-primary" : "border-border"
                }`}
              >
                <div className="flex gap-1">
                  {p.swatch.map((c, i) => (
                    <div
                      key={i}
                      className="h-6 w-3 rounded-sm border border-black/40"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium">{p.name}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {p.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Panels
            </div>
            <button
              onClick={() => workspace.resetLayouts()}
              className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] uppercase tracking-wider hover:bg-secondary"
            >
              <RotateCcw className="h-3 w-3" /> Reset layout
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PANEL_IDS.map((id) => (
              <label
                key={id}
                className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-xs"
              >
                <input
                  type="checkbox"
                  checked={!!layouts[id]?.visible}
                  onChange={(e) => workspace.setPanelVisible(id, e.target.checked)}
                  className="accent-[var(--color-primary)]"
                />
                {PANEL_LABELS[id]}
              </label>
            ))}
          </div>
        </section>

        <div className="text-[10px] text-muted-foreground">
          Drag a panel's title bar to move it. Drag the bottom-right corner to resize.
          Use <kbd className="rounded border border-border bg-secondary px-1">Save</kbd> in
          the top bar to persist layout, palette, and pattern together.
        </div>
      </div>
    </div>
  );
}
