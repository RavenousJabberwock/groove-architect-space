import { engine } from "@/audio/engine";
import { bus } from "@/audio/bus";
import { boot } from "@/state/setup";
import { useWorkspace } from "@/state/workspace";

export function DrumMachinePanel() {
  const pattern = useWorkspace((s) => s.pattern);
  const drums = pattern.tracks.filter((t) => t.kind !== "synth");

  const hit = async (id: string, note: number) => {
    await boot();
    bus.emit("step:trigger", { trackId: id, time: engine.now(), velocity: 1, note });
  };

  return (
    <div className="flex h-full flex-col p-3">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Drums</h2>
      <div className="grid grid-cols-3 gap-2">
        {drums.map((t) => (
          <button
            key={t.id}
            onPointerDown={() => hit(t.id, t.midiNote)}
            className="readout aspect-square rounded border border-border bg-background text-xs uppercase shadow-inner transition active:scale-95 active:border-accent active:bg-accent active:text-accent-foreground active:shadow-[0_0_16px_var(--color-accent)]"
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}
