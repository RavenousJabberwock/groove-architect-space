import { useEffect } from "react";
import { TopBar } from "./TopBar";
import { SequencerPanel } from "./Sequencer";
import { ChaosPadPanel } from "./ChaosPad";
import { MixerPanel } from "./Mixer";
import { DrumMachinePanel } from "./DrumMachine";
import { SynthPanel } from "./Synth";
import { BrowserPanel } from "./Browser";
import { MusicBoardPanel } from "./MusicBoard";
import { SoundboardPanel } from "./Soundboard";
import { PanelWindow } from "./PanelWindow";
import { workspace } from "@/state/workspace";
import { applyPalette } from "@/themes/palettes";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

/**
 * Workspace canvas. Each panel is a floating, draggable, closeable window
 * positioned in % of this container. Default layout mirrors the legacy grid.
 */
export function Workstation() {
  useKeyboardShortcuts();
  useEffect(() => {
    workspace.load();
    applyPalette(workspace.get().palette);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar />
      <div className="relative flex-1 overflow-hidden p-2">
        <div className="relative h-full w-full">
          <PanelWindow id="sequencer" title="Sequencer">
            <SequencerPanel />
          </PanelWindow>
          <PanelWindow id="drum" title="Drums">
            <DrumMachinePanel />
          </PanelWindow>
          <PanelWindow id="synth" title="Synth">
            <SynthPanel />
          </PanelWindow>
          <PanelWindow id="chaos" title="Chaos Pad">
            <ChaosPadPanel />
          </PanelWindow>
          <PanelWindow id="mixer" title="Mixer">
            <MixerPanel />
          </PanelWindow>
          <PanelWindow id="browser" title="Browser">
            <BrowserPanel />
          </PanelWindow>
          <PanelWindow id="music" title="Music Board">
            <MusicBoardPanel />
          </PanelWindow>
          <PanelWindow id="soundboard" title="Soundboard">
            <SoundboardPanel />
          </PanelWindow>
        </div>
      </div>
    </div>
  );
}
