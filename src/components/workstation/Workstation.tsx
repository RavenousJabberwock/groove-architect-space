import { useEffect, type ReactElement } from "react";
import { TopBar } from "./TopBar";
import { SequencerPanel } from "./Sequencer";
import { ChaosPadPanel } from "./ChaosPad";
import { MixerPanel } from "./Mixer";
import { SynthPanel } from "./Synth";
import { BrowserPanel } from "./Browser";
import { MusicBoardPanel } from "./MusicBoard";
import { SoundboardPanel } from "./Soundboard";
import { ScenesPanel } from "./Scenes";
import { PanelWindow } from "./PanelWindow";
import {
  workspace,
  useWorkspace,
  PANEL_LABELS,
  type PanelType,
  type PanelInstance,
} from "@/state/workspace";
import { applyPalette } from "@/themes/palettes";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { usePadTriggers } from "@/hooks/use-pad-triggers";

/** Map panel type → React component. Used by the dynamic renderer below. */
const PANEL_COMPONENTS: Record<PanelType, (instanceId: string) => ReactElement> = {
  sequencer: () => <SequencerPanel />,
  synth: (instanceId) => <SynthPanel instanceId={instanceId} />,
  chaos: () => <ChaosPadPanel />,
  mixer: () => <MixerPanel />,
  browser: () => <BrowserPanel />,
  music: () => <MusicBoardPanel />,
  soundboard: () => <SoundboardPanel />,
  scenes: () => <ScenesPanel />,
};

/** Returns true if the given instance id is one of the "default" singleton ids. */
function isDefaultInstance(inst: PanelInstance): boolean {
  return inst.id === inst.type;
}

/**
 * Workspace canvas. Renders every panel instance from workspace.layouts.
 * Multiple instances of the same type can coexist (each with its own
 * position, size, and title).
 */
export function Workstation() {
  useKeyboardShortcuts();
  useEffect(() => {
    workspace.load();
    applyPalette(workspace.get().palette);
  }, []);

  const layouts = useWorkspace((s) => s.layouts);
  const instances = Object.values(layouts);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar />
      <div className="relative flex-1 overflow-hidden p-2">
        <div className="relative h-full w-full">
          {instances.map((inst) => {
            const render = PANEL_COMPONENTS[inst.type];
            if (!render) return null;
            return (
              <PanelWindow
                key={inst.id}
                id={inst.id}
                title={PANEL_LABELS[inst.type]}
                removable={!isDefaultInstance(inst)}
              >
                {render(inst.id)}
              </PanelWindow>
            );
          })}
        </div>
      </div>
    </div>
  );
}
