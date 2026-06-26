import { useEffect, useRef, useState } from "react";
import { LayoutGrid, Check, Plus, Trash2 } from "lucide-react";
import {
  workspace,
  useWorkspace,
  PANEL_TYPES,
  PANEL_LABELS,
  type PanelType,
} from "@/state/workspace";

/**
 * Windows menu.
 *
 * Top section: spawn a brand-new instance of any panel type ("+ Synth",
 * "+ Music Board", etc.). Multiple instances of the same type are allowed
 * and each gets its own floating window.
 *
 * Bottom section: every existing instance, with a visibility toggle and a
 * delete button (non-default instances only).
 */
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

  const instances = Object.values(layouts).sort((a, b) =>
    a.type === b.type ? a.id.localeCompare(b.id) : a.type.localeCompare(b.type),
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded border border-border bg-background px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-secondary"
      >
        <LayoutGrid className="h-3 w-3" /> Windows
      </button>
      {open && (
        <div className="panel absolute right-0 top-full z-50 mt-1 w-64 p-2">
          <div className="mb-1 px-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Add window
          </div>
          <div className="mb-2 grid grid-cols-2 gap-1">
            {PANEL_TYPES.map((t: PanelType) => (
              <button
                key={t}
                onClick={() => workspace.addPanelInstance(t)}
                className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-secondary"
              >
                <Plus className="h-3 w-3" /> {PANEL_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="mb-1 px-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Windows
          </div>
          <div className="max-h-64 overflow-auto">
            {instances.map((inst) => {
              const isDefault = inst.id === inst.type;
              return (
                <div
                  key={inst.id}
                  className="flex items-center gap-1 rounded px-2 py-1.5 text-xs hover:bg-secondary"
                >
                  <button
                    onClick={() => workspace.setPanelVisible(inst.id, !inst.visible)}
                    className="flex flex-1 items-center justify-between text-left"
                  >
                    <span className="truncate">{inst.title || PANEL_LABELS[inst.type]}</span>
                    {inst.visible && <Check className="h-3 w-3 text-primary" />}
                  </button>
                  {!isDefault && (
                    <button
                      onClick={() => workspace.removePanelInstance(inst.id)}
                      aria-label="Remove window"
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
