import { useEffect } from "react";
import { TopBar } from "./TopBar";
import { SequencerPanel } from "./Sequencer";
import { ChaosPadPanel } from "./ChaosPad";
import { MixerPanel } from "./Mixer";
import { DrumMachinePanel } from "./DrumMachine";
import { SynthPanel } from "./Synth";
import { BrowserPanel } from "./Browser";
import { workspace } from "@/state/workspace";

/** Grid layout — panels can be reordered by mutating workspace.panelOrder. */
export function Workstation() {
  useEffect(() => {
    workspace.load();
  }, []);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar />
      <div className="grid flex-1 gap-2 overflow-hidden p-2 [grid-template-columns:1.6fr_1fr] [grid-template-rows:minmax(0,1fr)_minmax(0,1fr)]">
        <div className="row-span-2 min-h-0">
          <SequencerPanel />
        </div>
        <div className="grid min-h-0 grid-cols-2 gap-2">
          <DrumMachinePanel />
          <SynthPanel />
        </div>
        <div className="grid min-h-0 grid-cols-[1.2fr_1fr_0.8fr] gap-2">
          <ChaosPadPanel />
          <MixerPanel />
          <BrowserPanel />
        </div>
      </div>
    </div>
  );
}
