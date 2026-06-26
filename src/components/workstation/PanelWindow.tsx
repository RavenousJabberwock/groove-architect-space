import { useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { workspace, useWorkspace } from "@/state/workspace";

interface Props {
  /** Instance id within workspace.layouts. */
  id: string;
  title: string;
  children: ReactNode;
  /** When true, the close button removes the instance entirely instead of just hiding it. */
  removable?: boolean;
}

/**
 * Floating, draggable workstation panel.
 * Position/size/visibility/z-order come from workspace.layouts[id] (in % of container).
 */
export function PanelWindow({ id, title, children, removable }: Props) {
  const layout = useWorkspace((s) => s.layouts[id]);
  const root = useRef<HTMLDivElement>(null);

  if (!layout || !layout.visible) return null;

  const onDragStart = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    const container = root.current?.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { x: layout.x, y: layout.y };
    workspace.bringPanelToFront(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const dxPct = ((ev.clientX - startX) / rect.width) * 100;
      const dyPct = ((ev.clientY - startY) / rect.height) * 100;
      const x = Math.max(0, Math.min(100 - layout.w, start.x + dxPct));
      const y = Math.max(0, Math.min(100 - layout.h, start.y + dyPct));
      workspace.setPanelLayout(id, { x, y });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    const container = root.current?.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { w: layout.w, h: layout.h };
    workspace.bringPanelToFront(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const dwPct = ((ev.clientX - startX) / rect.width) * 100;
      const dhPct = ((ev.clientY - startY) / rect.height) * 100;
      const w = Math.max(10, Math.min(100 - layout.x, start.w + dwPct));
      const h = Math.max(10, Math.min(100 - layout.y, start.h + dhPct));
      workspace.setPanelLayout(id, { w, h });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const displayTitle = layout.title || title;

  return (
    <div
      ref={root}
      className="panel absolute flex flex-col overflow-hidden"
      style={{
        left: `${layout.x}%`,
        top: `${layout.y}%`,
        width: `${layout.w}%`,
        height: `${layout.h}%`,
        zIndex: layout.z,
      }}
      onPointerDown={() => workspace.bringPanelToFront(id)}
    >
      <div
        onPointerDown={onDragStart}
        className="flex h-6 shrink-0 cursor-grab items-center justify-between border-b border-border bg-card/60 px-2 active:cursor-grabbing"
      >
        <span
          className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          title={displayTitle}
        >
          {displayTitle}
        </span>
        <button
          data-no-drag
          onClick={() => {
            if (removable) workspace.removePanelInstance(id);
            else workspace.setPanelVisible(id, false);
          }}
          aria-label={`Close ${displayTitle}`}
          className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      <div
        onPointerDown={onResizeStart}
        className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize"
        style={{
          background:
            "linear-gradient(135deg, transparent 50%, var(--color-border) 50%, var(--color-border) 60%, transparent 60%, transparent 70%, var(--color-border) 70%, var(--color-border) 80%, transparent 80%)",
        }}
      />
    </div>
  );
}
