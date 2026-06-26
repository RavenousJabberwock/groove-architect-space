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
import { mediaPlayer } from "../audio/media-player";

export type Mode = "beginner" | "pro";
export type PanelId =
  | "drum"
  | "synth"
  | "chaos"
  | "sequencer"
  | "mixer"
  | "browser"
  | "music"
  | "soundboard";

export const PANEL_IDS: PanelId[] = [
  "sequencer",
  "drum",
  "synth",
  "chaos",
  "mixer",
  "browser",
  "music",
  "soundboard",
];

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
  sequencer:  { visible: true,  x: 0.3,  y: 0.3,  w: 61.0, h: 60.0, z: 1 },
  drum:       { visible: true,  x: 61.6, y: 0.3,  w: 18.7, h: 49.5, z: 1 },
  synth:      { visible: true,  x: 80.6, y: 0.3,  w: 19.1, h: 49.5, z: 1 },
  chaos:      { visible: true,  x: 61.6, y: 50.2, w: 14.7, h: 49.5, z: 1 },
  mixer:      { visible: true,  x: 76.6, y: 50.2, w: 11.8, h: 49.5, z: 1 },
  browser:    { visible: false, x: 88.7, y: 50.2, w: 11.0, h: 49.5, z: 1 },
  music:      { visible: true,  x: 0.3,  y: 61.0, w: 36.0, h: 38.5, z: 1 },
  soundboard: { visible: true,  x: 37.0, y: 61.0, w: 24.0, h: 38.5, z: 1 },
};

/** A streamable, fade-able background music track. */
export interface MusicTrack {
  id: string;
  title: string;
  url: string;
  volume: number; // 0..1
  loop: boolean;
}

/** A one-shot sound effect cue. */
export interface SoundEffect {
  id: string;
  title: string;
  url: string;
  volume: number; // 0..1
  color?: string; // optional pad color hint
}

export interface WorkspaceState {
  pattern: Pattern;
  mode: Mode;
  panelOrder: PanelId[];
  midiBindings: typeof midiLearn.bindings;
  chaosRoutes: typeof chaos.routes;
  selectedTrackId: string;
  layouts: Record<PanelId, PanelLayout>;
  palette: string;
  musicTracks: MusicTrack[];
  soundEffects: SoundEffect[];
  musicMaster: number; // 0..1
  sfxMaster: number; // 0..1
  fadeMs: number; // default crossfade duration
}

const DEFAULT_MUSIC: MusicTrack[] = [
  {
    id: "m-tavern",
    title: "Tavern Ambience",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    volume: 0.7,
    loop: true,
  },
  {
    id: "m-journey",
    title: "Overworld Journey",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
    volume: 0.7,
    loop: true,
  },
  {
    id: "m-battle",
    title: "Battle Theme",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    volume: 0.8,
    loop: true,
  },
  {
    id: "m-dungeon",
    title: "Dungeon Depths",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
    volume: 0.6,
    loop: true,
  },
];

const DEFAULT_SFX: SoundEffect[] = [
  { id: "s-sword", title: "Sword Clash", url: "", volume: 0.9 },
  { id: "s-door", title: "Door Creak", url: "", volume: 0.9 },
  { id: "s-thunder", title: "Thunder", url: "", volume: 0.9 },
  { id: "s-spell", title: "Magic Spell", url: "", volume: 0.9 },
  { id: "s-coin", title: "Coin Drop", url: "", volume: 0.9 },
  { id: "s-roar", title: "Monster Roar", url: "", volume: 0.9 },
];

const STORAGE_KEY = "hmw.workspace.v1";

function initial(): WorkspaceState {
  const pattern = defaultPattern();
  return {
    pattern,
    mode: "beginner",
    panelOrder: ["sequencer", "drum", "synth", "chaos", "mixer", "browser", "music", "soundboard"],
    midiBindings: [],
    chaosRoutes: chaos.routes,
    selectedTrackId: pattern.tracks[0]!.id,
    layouts: structuredClone(DEFAULT_LAYOUTS),
    palette: "amber",
    musicTracks: structuredClone(DEFAULT_MUSIC),
    soundEffects: structuredClone(DEFAULT_SFX),
    musicMaster: 0.8,
    sfxMaster: 0.9,
    fadeMs: 2000,
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

  // ===== Music Board =====
  addMusic(t: Omit<MusicTrack, "id"> & { id?: string }) {
    const id = t.id ?? `m-${Math.random().toString(36).slice(2, 8)}`;
    workspace.patch((s) => ({
      ...s,
      musicTracks: [...s.musicTracks, { volume: 0.7, loop: true, ...t, id }],
    }));
  },
  updateMusic(id: string, patch: Partial<MusicTrack>) {
    workspace.patch((s) => ({
      ...s,
      musicTracks: s.musicTracks.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  },
  removeMusic(id: string) {
    mediaPlayer.dispose(id);
    workspace.patch((s) => ({ ...s, musicTracks: s.musicTracks.filter((m) => m.id !== id) }));
  },
  setMusicMaster(v: number) {
    workspace.patch((s) => ({ ...s, musicMaster: Math.max(0, Math.min(1, v)) }));
  },
  setFadeMs(ms: number) {
    workspace.patch((s) => ({ ...s, fadeMs: Math.max(0, ms) }));
  },

  // ===== Soundboard =====
  addSfx(t: Omit<SoundEffect, "id"> & { id?: string }) {
    const id = t.id ?? `s-${Math.random().toString(36).slice(2, 8)}`;
    workspace.patch((s) => ({
      ...s,
      soundEffects: [...s.soundEffects, { volume: 0.9, ...t, id }],
    }));
  },
  updateSfx(id: string, patch: Partial<SoundEffect>) {
    workspace.patch((s) => ({
      ...s,
      soundEffects: s.soundEffects.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  },
  removeSfx(id: string) {
    mediaPlayer.dispose(id);
    workspace.patch((s) => ({ ...s, soundEffects: s.soundEffects.filter((m) => m.id !== id) }));
  },
  setSfxMaster(v: number) {
    workspace.patch((s) => ({ ...s, sfxMaster: Math.max(0, Math.min(1, v)) }));
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
      const parsed = JSON.parse(raw) as { state: Partial<WorkspaceState> };
      // Merge with defaults for forward compatibility with older saves.
      const merged: WorkspaceState = {
        ...initial(),
        ...parsed.state,
        layouts: { ...structuredClone(DEFAULT_LAYOUTS), ...(parsed.state.layouts ?? {}) },
        palette: parsed.state.palette ?? "amber",
      };
      workspace.set(() => merged);
      applyPalette(merged.palette);
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
