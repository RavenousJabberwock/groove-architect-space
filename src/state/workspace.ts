/**
 * Workspace store.
 *
 * Holds the entire app state: pattern, panel layout, theme, mode, MIDI
 * bindings, chaos macros. Persists to localStorage today; the same JSON shape
 * will move to Lovable Cloud (`workspaces` table) when auth lands.
 */

import { useSyncExternalStore } from "react";
import { defaultPattern } from "../presets/defaults";
import type { Pattern, Track } from "../sequencer/types";
import { emptyStep, makeTrack } from "../sequencer/types";
import { sequencer } from "../sequencer/engine";
import { midiLearn } from "../midi/learn";
import { chaos } from "../chaos/pad";
import { engine, type TrackKind } from "../audio/engine";
import { applyPalette } from "../themes/palettes";

export type Mode = "beginner" | "pro";
export type PanelId = "drum" | "synth" | "chaos" | "sequencer" | "mixer" | "browser";

export const PANEL_IDS: PanelId[] = ["sequencer", "drum", "synth", "chaos", "mixer", "browser"];

/** Per-panel floating-window layout, in % of the workspace container. */
export interface PanelLayout {
  visible: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}

export const DEFAULT_LAYOUTS: Record<PanelId, PanelLayout> = {
  sequencer: { visible: true, x: 0.3, y: 0.3, w: 61.0, h: 99.4, z: 1 },
  drum:      { visible: true, x: 61.6, y: 0.3, w: 18.7, h: 49.5, z: 1 },
  synth:     { visible: true, x: 80.6, y: 0.3, w: 19.1, h: 49.5, z: 1 },
  chaos:     { visible: true, x: 61.6, y: 50.2, w: 14.7, h: 49.5, z: 1 },
  mixer:     { visible: true, x: 76.6, y: 50.2, w: 11.8, h: 49.5, z: 1 },
  browser:   { visible: true, x: 88.7, y: 50.2, w: 11.0, h: 49.5, z: 1 },
};

export interface WorkspaceState {
  pattern: Pattern;
  mode: Mode;
  panelOrder: PanelId[];
  midiBindings: typeof midiLearn.bindings;
  chaosRoutes: typeof chaos.routes;
  selectedTrackId: string;
  layouts: Record<PanelId, PanelLayout>;
  palette: string;
}

const STORAGE_KEY = "hmw.workspace.v1";

function initial(): WorkspaceState {
  const pattern = defaultPattern();
  return {
    pattern,
    mode: "beginner",
    panelOrder: ["sequencer", "drum", "synth", "chaos", "mixer", "browser"],
    midiBindings: [],
    chaosRoutes: chaos.routes,
    selectedTrackId: pattern.tracks[0]!.id,
    layouts: structuredClone(DEFAULT_LAYOUTS),
    palette: "amber",
  };
}

let state: WorkspaceState = initial();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export const workspace = {
  get(): WorkspaceState {
    return state;
  },
  set(updater: (s: WorkspaceState) => WorkspaceState) {
    state = updater(state);
    // Reflect into runtime subsystems where relevant.
    sequencer.load(state.pattern);
    midiLearn.bindings = state.midiBindings;
    chaos.routes = state.chaosRoutes;
    engine.syncTracks(state.pattern.tracks.map((t) => ({ id: t.id, kind: t.kind as TrackKind })));
    notify();
  },
  /** Lightweight update that does not re-sync audio/sequencer subsystems. */
  patch(updater: (s: WorkspaceState) => WorkspaceState) {
    state = updater(state);
    notify();
  },
  setPanelVisible(id: PanelId, visible: boolean) {
    workspace.patch((s) => ({
      ...s,
      layouts: { ...s.layouts, [id]: { ...s.layouts[id], visible } },
    }));
  },
  setPanelLayout(id: PanelId, patch: Partial<PanelLayout>) {
    workspace.patch((s) => ({
      ...s,
      layouts: { ...s.layouts, [id]: { ...s.layouts[id], ...patch } },
    }));
  },
  bringPanelToFront(id: PanelId) {
    workspace.patch((s) => {
      const maxZ = Math.max(...Object.values(s.layouts).map((l) => l.z));
      if (s.layouts[id].z === maxZ) return s;
      return {
        ...s,
        layouts: { ...s.layouts, [id]: { ...s.layouts[id], z: maxZ + 1 } },
      };
    });
  },
  resetLayouts() {
    workspace.patch((s) => ({ ...s, layouts: structuredClone(DEFAULT_LAYOUTS) }));
  },
  setPalette(id: string) {
    applyPalette(id);
    workspace.patch((s) => ({ ...s, palette: id }));
  },
  /** Add a new track of the given kind. */
  addTrack(kind: TrackKind) {
    const id = `t-${kind}-${Math.random().toString(36).slice(2, 7)}`;
    const name = kind.toUpperCase();
    const note = kind === "synth" ? 48 : 36;
    const channel = kind === "synth" ? 1 : 10;
    const track: Track = makeTrack(id, name, kind, note, channel);
    workspace.set((s) => ({
      ...s,
      pattern: { ...s.pattern, tracks: [...s.pattern.tracks, track] },
      selectedTrackId: id,
    }));
  },
  removeTrack(id: string) {
    workspace.set((s) => {
      const tracks = s.pattern.tracks.filter((t) => t.id !== id);
      return {
        ...s,
        pattern: { ...s.pattern, tracks },
        selectedTrackId: s.selectedTrackId === id ? (tracks[0]?.id ?? "") : s.selectedTrackId,
      };
    });
  },
  /** Change a track's instrument kind, preserving steps. */
  setTrackKind(id: string, kind: TrackKind) {
    workspace.set((s) => ({
      ...s,
      pattern: {
        ...s.pattern,
        tracks: s.pattern.tracks.map((t) =>
          t.id === id
            ? {
                ...t,
                kind,
                name: kind.toUpperCase(),
                // Reset notes to a sensible default when toggling synth/drum.
                steps: t.steps.map((st) =>
                  kind === "synth" && st.note === undefined ? { ...st, note: 48 } : st,
                ),
              }
            : t,
        ),
      },
    }));
  },
  renameTrack(id: string, name: string) {
    workspace.set((s) => ({
      ...s,
      pattern: {
        ...s.pattern,
        tracks: s.pattern.tracks.map((t) => (t.id === id ? { ...t, name } : t)),
      },
    }));
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Persist current workspace. */
  save(name = "default") {
    try {
      const payload = { name, savedAt: Date.now(), state };
      localStorage.setItem(STORAGE_KEY + ":" + name, JSON.stringify(payload));
    } catch (e) {
      console.warn("Workspace save failed", e);
    }
  },
  load(name = "default") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY + ":" + name);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { state: WorkspaceState };
      workspace.set(() => parsed.state);
      return true;
    } catch (e) {
      console.warn("Workspace load failed", e);
      return false;
    }
  },
  list(): string[] {
    if (typeof localStorage === "undefined") return [];
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_KEY + ":"))
      .map((k) => k.slice(STORAGE_KEY.length + 1));
  },
  remove(name: string) {
    localStorage.removeItem(STORAGE_KEY + ":" + name);
  },
};

// Boot sequencer with default pattern immediately so the UI has a pattern.
sequencer.load(state.pattern);

export function useWorkspace<T>(selector: (s: WorkspaceState) => T): T {
  return useSyncExternalStore(
    (cb) => workspace.subscribe(cb),
    () => selector(workspace.get()),
    () => selector(state),
  );
}
