import { useEffect } from "react";
import { TopBar } from "./TopBar";
import { SequencerPanel } from "./Sequencer";
import { ChaosPadPanel } from "./ChaosPad";
import { MixerPanel } from "./Mixer";
import { SynthPanel } from "./Synth";
import { BrowserPanel } from "./Browser";
import { MusicBoardPanel } from "./MusicBoard";
import { SoundboardPanel } from "./Soundboard";
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

/** Map panel type → React component. Used by the dynamic renderer below. */
const PANEL_COMPONENTS: Record<PanelType, (props: { instanceId: string }) => JSX.Element> = {
  sequencer: () => <SequencerPanel />,
  synth: ({ instanceId }) => <SynthPanel instanceId={instanceId} />,
  chaos: () => <ChaosPadPanel />,
  mixer: () => <MixerPanel />,
  browser: () => <BrowserPanel />,
  music: () => <MusicBoardPanel />,
  soundboard: () => <SoundboardPanel />,
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
            const Comp = PANEL_COMPONENTS[inst.type];
            if (!Comp) return null;
            return (
              <PanelWindow
                key={inst.id}
                id={inst.id}
                title={PANEL_LABELS[inst.type]}
                removable={!isDefaultInstance(inst)}
              >
                <Comp instanceId={inst.id} />
              </PanelWindow>
            );
          })}
        </div>
      </div>
    </div>
  );
}
