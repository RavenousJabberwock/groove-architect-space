import { useEffect, useRef, useState } from "react";
import { LayoutGrid, Check } from "lucide-react";
import { workspace, useWorkspace, PANEL_IDS, type PanelId } from "@/state/workspace";

const LABELS: Record<PanelId, string> = {
  sequencer: "Sequencer",
  drum: "Drums",
  synth: "Synth",
  chaos: "Chaos Pad",
  mixer: "Mixer",
  browser: "Browser",
  music: "Music Board",
  soundboard: "Soundboard",
};

export function WindowsMenu() {
  const layouts = useWorkspace((s) => s.layouts);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded border border-border bg-background px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-secondary"
      >
        <LayoutGrid className="h-3 w-3" /> Windows
      </button>
      {open && (
        <div className="panel absolute right-0 top-full z-50 mt-1 w-44 p-1">
          {PANEL_IDS.map((id) => {
            const visible = !!layouts[id]?.visible;
            return (
              <button
                key={id}
                onClick={() => workspace.setPanelVisible(id, !visible)}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-secondary"
              >
                <span>{LABELS[id]}</span>
                {visible && <Check className="h-3 w-3 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
