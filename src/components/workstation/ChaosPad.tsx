import { useEffect, useRef, useState } from "react";
import { chaos } from "@/chaos/pad";
import { Circle } from "lucide-react";

export function ChaosPadPanel() {
  const ref = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const [recording, setRecording] = useState(false);
  const trail = useRef<Array<{ x: number; y: number; t: number }>>([]);

  useEffect(() => {
    const cv = canvasRef.current!;
    let raf = 0;
    const draw = () => {
      const ctx = cv.getContext("2d")!;
      const { width: w, height: h } = cv;
      ctx.clearRect(0, 0, w, h);
      // Grid
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      for (let i = 0; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo((i * w) / 8, 0);
        ctx.lineTo((i * w) / 8, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, (i * h) / 8);
        ctx.lineTo(w, (i * h) / 8);
        ctx.stroke();
      }
      // Trail
      const now = performance.now();
      trail.current = trail.current.filter((p) => now - p.t < 800);
      for (const p of trail.current) {
        const age = (now - p.t) / 800;
        ctx.fillStyle = `oklch(0.78 0.15 75 / ${1 - age})`;
        ctx.beginPath();
        ctx.arc(p.x * w, (1 - p.y) * h, 3 * (1 - age), 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const handle = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
    setPos({ x, y });
    chaos.setXY(x, y);
    trail.current.push({ x, y, t: performance.now() });
  };

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Chaos Pad</h2>
        <button
          onClick={() => {
            if (recording) {
              chaos.stopRecording();
              setRecording(false);
            } else {
              chaos.startRecording();
              setRecording(true);
            }
          }}
          className={`flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
            recording ? "bg-accent text-accent-foreground" : "bg-background"
          }`}
        >
          <Circle className="h-2 w-2 fill-current" /> Rec
        </button>
      </div>
      <div
        ref={ref}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          chaos.engage();
          handle(e);
        }}
        onPointerUp={() => chaos.release()}
        onPointerCancel={() => chaos.release()}
        onPointerLeave={(e) => {
          if (e.buttons === 0) chaos.release();
        }}
        onPointerMove={(e) => {
          if (e.buttons) handle(e);
        }}
        className="relative aspect-square flex-1 cursor-crosshair touch-none rounded border border-border bg-background"
      >
        <canvas
          ref={canvasRef}
          width={480}
          height={480}
          className="absolute inset-0 h-full w-full"
        />
        <div
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_20px_var(--color-primary)]"
          style={{ left: `${pos.x * 100}%`, top: `${(1 - pos.y) * 100}%` }}
        />
      </div>
      <div className="readout mt-2 flex justify-between text-[10px]">
        <span>X CUTOFF {Math.round(pos.x * 100)}</span>
        <span>Y RESON {Math.round(pos.y * 100)}</span>
      </div>
    </div>
  );
}
