/**
 * Command Palette (⌘K / Ctrl+K).
 *
 * Single fuzzy-search surface for everything in the workstation:
 *  - Open / hide any window
 *  - Recall / capture scenes
 *  - Toggle music tracks and fire SFX pads
 *  - Global actions: undo / redo, toggle playlist, transport play/stop
 *
 * Built on the shadcn `Command` dialog. Mounted globally from Workstation.
 */

import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useWorkspace, workspace, PANEL_LABELS } from "@/state/workspace";
import { sequencer } from "@/sequencer/engine";
import { boot } from "@/state/setup";
import { triggerSfx, toggleMusic } from "@/audio/triggers";
import { toast } from "sonner";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const layouts = useWorkspace((s) => s.layouts);
  const music = useWorkspace((s) => s.musicTracks);
  const sfx = useWorkspace((s) => s.soundEffects);
  const scenes = useWorkspace((s) => s.scenes);
  const playlist = useWorkspace((s) => s.playlist);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = (fn: () => void) => {
    setOpen(false);
    // Defer slightly so the dialog can close cleanly before the action runs.
    setTimeout(fn, 0);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search actions, tracks, pads, scenes…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Transport">
          <CommandItem onSelect={() => run(async () => {
            await boot();
            sequencer.isPlaying() ? sequencer.stop() : sequencer.start();
          })}>
            {sequencer.isPlaying() ? "Stop" : "Play"} sequencer
          </CommandItem>
          <CommandItem onSelect={() => run(() => {
            const ok = workspace.undo();
            toast(ok ? "Undo" : "Nothing to undo", { duration: 600 });
          })}>
            Undo
          </CommandItem>
          <CommandItem onSelect={() => run(() => {
            const ok = workspace.redo();
            toast(ok ? "Redo" : "Nothing to redo", { duration: 600 });
          })}>
            Redo
          </CommandItem>
          <CommandItem onSelect={() => run(() => {
            workspace.setPlaylist({ enabled: !playlist.enabled });
            toast(`Playlist ${!playlist.enabled ? "ON" : "OFF"}`);
          })}>
            Toggle playlist mode
          </CommandItem>
          <CommandItem onSelect={() => run(() => { workspace.save(); toast.success("Saved"); })}>
            Save workspace
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Windows">
          {Object.values(layouts).map((inst) => (
            <CommandItem
              key={inst.id}
              onSelect={() => run(() => workspace.setPanelVisible(inst.id, !inst.visible))}
            >
              {inst.visible ? "Hide" : "Show"} {inst.title || PANEL_LABELS[inst.type]}
            </CommandItem>
          ))}
        </CommandGroup>

        {scenes.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Scenes">
              {scenes.map((sc) => (
                <CommandItem key={sc.id} onSelect={() => run(() => workspace.recallScene(sc.id))}>
                  Recall scene — {sc.name}
                </CommandItem>
              ))}
              <CommandItem onSelect={() => run(() => {
                const name = `Scene ${scenes.length + 1}`;
                workspace.captureScene(name);
                toast.success(`Captured "${name}"`);
              })}>
                Capture current as new scene
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {music.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Music">
              {music.map((m) => (
                <CommandItem key={m.id} onSelect={() => run(() => { void toggleMusic(m); })}>
                  Toggle — {m.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {sfx.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Soundboard">
              {sfx.map((s) => (
                <CommandItem key={s.id} onSelect={() => run(() => { void triggerSfx(s); })}>
                  Fire — {s.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
