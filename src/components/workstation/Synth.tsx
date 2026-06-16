import { engine } from "@/audio/engine";
import { bus } from "@/audio/bus";
import { boot } from "@/state/setup";
import { useWorkspace } from "@/state/workspace";
import { midiLearn } from "@/midi/learn";
import { toast } from "sonner";

const KEYS = [
  { n: 48, l: "C3" }, { n: 50, l: "D" }, { n: 52, l: "E" }, { n: 53, l: "F" },
  { n: 55, l: "G" }, { n: 57, l: "A" }, { n: 59, l: "B" }, { n: 60, l: "C4" },
];

export function SynthPanel() {
  const pattern = useWorkspace((s) => s.pattern);
  const mode = useWorkspace((s) => s.mode);
  const synth = pattern.tracks.find((t) => t.kind === "synth");

  const play = async (note: number) => {
    if (!synth) return;
    await boot();
    bus.emit("step:trigger", { trackId: synth.id, time: engine.now(), velocity: 0.9, note });
  };

  return (
    <div className="panel flex h-full flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Synth</h2>
        <span className="readout text-[10px]">SUBTRACTIVE</span>
      </div>
      <div className="grid flex-1 grid-cols-8 gap-1">
        {KEYS.map((k) => (
          <button
            key={k.n}
            onPointerDown={() => play(k.n)}
            className="readout flex flex-col items-center justify-end rounded border border-border bg-background pb-2 text-[10px] uppercase transition active:bg-primary active:text-primary-foreground"
          >
            {k.l}
          </button>
        ))}
      </div>
      {mode === "pro" && (
        <button
          onClick={() => {
            midiLearn.arm("synth.cutoff");
            toast("MIDI learn armed: move a CC for synth.cutoff");
          }}
          className="mt-2 rounded border border-border bg-background py-1 text-[10px] uppercase tracking-wider hover:bg-secondary"
        >
          MIDI Learn — Cutoff
        </button>
      )}
    </div>
  );
}
