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
import { makeTrack } from "../sequencer/types";
import { sequencer } from "../sequencer/engine";
import { midiLearn } from "../midi/learn";
import { chaos } from "../chaos/pad";
import { engine, type TrackKind } from "../audio/engine";
import { applyPalette, setCustomPalettes, type Palette } from "../themes/palettes";
import { songController } from "../song/chain";
import { mediaPlayer } from "../audio/media-player";

export type Mode = "beginner" | "pro";

/**
 * The set of panel kinds the workstation knows how to render. Each panel
 * type can be instantiated zero, one, or many times — the renderer keys by
 * the instance id stored in `layouts`, and looks up the React component by
 * `type`.
 */
export type PanelType =
  | "synth"
  | "chaos"
  | "sequencer"
  | "mixer"
  | "browser"
  | "music"
  | "soundboard"
  | "scenes"
  | "song"
  | "tuner";

/** Backwards-compatible alias — some older callers still import PanelId. */
export type PanelId = PanelType;

export const PANEL_TYPES: PanelType[] = [
  "sequencer",
  "synth",
  "chaos",
  "mixer",
  "browser",
  "music",
  "soundboard",
  "scenes",
  "song",
  "tuner",
];
/** Alias kept for older code that imported PANEL_IDS. */
export const PANEL_IDS = PANEL_TYPES;

/** Human-readable label for a panel type (used by menus and window titles). */
export const PANEL_LABELS: Record<PanelType, string> = {
  sequencer: "Sequencer",
  synth: "Synth",
  chaos: "Chaos Pad",
  mixer: "Mixer",
  browser: "Browser",
  music: "Music Board",
  soundboard: "Soundboard",
  scenes: "Scenes",
  song: "Song Mode",
  tuner: "Tuner & Metronome",
};

/** Per-instance floating-window layout, in % of the workspace container. */
export interface PanelLayout {
  visible: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}

/**
 * A panel *instance* — one floating window. The `id` is the unique key in
 * `layouts`. Multiple instances of the same `type` are allowed; users can
 * spawn a second Synth, Music Board, etc. with their own position and size.
 */
export interface PanelInstance extends PanelLayout {
  id: string;
  type: PanelType;
  /** Optional override of the window title; falls back to PANEL_LABELS[type]. */
  title?: string;
}

// Default layout: Sequencer + Synth + Chaos + Mixer on top, Music + Soundboard
// across the bottom. Instance ids are seeded equal to the panel type so old
// saves migrate cleanly.
export const DEFAULT_LAYOUTS: Record<string, PanelInstance> = {
  sequencer:  { id: "sequencer",  type: "sequencer",  visible: true,  x: 0.3,  y: 0.3,  w: 61.0, h: 60.0, z: 1 },
  synth:      { id: "synth",      type: "synth",      visible: true,  x: 61.6, y: 0.3,  w: 26.0, h: 49.5, z: 1 },
  chaos:      { id: "chaos",      type: "chaos",      visible: true,  x: 61.6, y: 50.2, w: 14.7, h: 49.5, z: 1 },
  mixer:      { id: "mixer",      type: "mixer",      visible: true,  x: 76.6, y: 50.2, w: 23.1, h: 49.5, z: 1 },
  browser:    { id: "browser",    type: "browser",    visible: false, x: 87.7, y: 0.3,  w: 12.0, h: 49.5, z: 1 },
  music:      { id: "music",      type: "music",      visible: true,  x: 0.3,  y: 61.0, w: 36.0, h: 38.5, z: 1 },
  soundboard: { id: "soundboard", type: "soundboard", visible: true,  x: 37.0, y: 61.0, w: 24.0, h: 38.5, z: 1 },
  scenes:     { id: "scenes",     type: "scenes",     visible: false, x: 10,   y: 10,   w: 40,   h: 50,   z: 1 },
  song:       { id: "song",       type: "song",       visible: false, x: 12,   y: 12,   w: 46,   h: 60,   z: 1 },
  tuner:      { id: "tuner",      type: "tuner",      visible: false, x: 20,   y: 15,   w: 38,   h: 60,   z: 1 },
};

/** A streamable, fade-able background music track. */
export interface MusicTrack {
  id: string;
  title: string;
  url: string;
  volume: number; // 0..1
  loop: boolean;
  /** Optional keyboard hotkey (e.g. "q", "Shift+1") to toggle this track. */
  hotkey?: string;
  /** Optional MIDI note (0..127) that toggles this track. */
  midiNote?: number;
  /** Optional MIDI channel filter (0..15); undefined = any channel. */
  midiChannel?: number;
}

/** A one-shot sound effect cue. */
export type SfxKind = "sample" | "midi" | "synth";

export interface SfxAdsr {
  a: number;
  d: number;
  s: number;
  r: number;
}

export interface SoundEffect {
  id: string;
  title: string;
  volume: number; // 0..1
  color?: string; // optional pad color hint
  /** How this pad makes sound. Defaults to "sample". */
  kind?: SfxKind;
  /** sample: audio file or stream URL (also legacy field). */
  url?: string;
  /** midi: which drum voice to trigger. */
  midiKind?: string;
  /** synth: MIDI note number to play. */
  note?: number;
  /** synth: ADSR envelope (seconds, sustain 0..1). */
  adsr?: SfxAdsr;
  /** synth: oscillator waveform. */
  wave?: OscillatorType;
  /** Optional keyboard hotkey to fire this pad. */
  hotkey?: string;
  /** Optional MIDI note that fires this pad. */
  midiNote?: number;
  midiChannel?: number;
  /** Randomized auto-trigger schedule (ambient pads). */
  auto?: { enabled: boolean; minMs: number; maxMs: number };
}

/** Sidechain ducking settings — music dips when soundboard pads fire. */
export interface DuckSettings {
  enabled: boolean;
  amount: number; // 0..1, how much to dip
  attackMs: number;
  holdMs: number;
  releaseMs: number;
}

const DEFAULT_DUCK: DuckSettings = {
  enabled: true,
  amount: 0.5,
  attackMs: 30,
  holdMs: 120,
  releaseMs: 400,
};

/** Playlist auto-crossfade settings. */
export interface PlaylistSettings {
  enabled: boolean;
  trackIds: string[];
  shuffle: boolean;
}

/** A named snapshot of music + master state for one-tap scene recall. */
export interface Scene {
  id: string;
  name: string;
  music: { id: string; volume: number }[];
  musicMaster: number;
  sfxMaster: number;
  capturedAt: number;
}

/** A chain step in song mode. */
export interface SongItem { patternId: string; bars: number }
export interface SongState { enabled: boolean; items: SongItem[] }

export interface WorkspaceState {
  pattern: Pattern;
  /** Pattern library — saved patterns available to song mode. */
  patterns: Pattern[];
  /** Song mode: ordered chain of patterns + bars-per-step. */
  song: SongState;
  mode: Mode;
  midiBindings: typeof midiLearn.bindings;
  chaosRoutes: typeof chaos.routes;
  selectedTrackId: string;
  /** Keyed by instance id; each value carries its panel type. */
  layouts: Record<string, PanelInstance>;
  palette: string;
  /** User-defined palettes appended after the built-ins. */
  customPalettes: Palette[];
  musicTracks: MusicTrack[];
  soundEffects: SoundEffect[];
  musicMaster: number; // 0..1
  sfxMaster: number; // 0..1
  fadeMs: number; // default crossfade duration
  duck: DuckSettings;
  playlist: PlaylistSettings;
  scenes: Scene[];
  activeSceneId?: string;
}

const DEFAULT_MUSIC: MusicTrack[] = [
  { id: "m-tavern",  title: "Tavern Ambience",   url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", volume: 0.7, loop: true },
  { id: "m-journey", title: "Overworld Journey", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3", volume: 0.7, loop: true },
  { id: "m-battle",  title: "Battle Theme",      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", volume: 0.8, loop: true },
  { id: "m-dungeon", title: "Dungeon Depths",    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3", volume: 0.6, loop: true },
];

const DEFAULT_SFX: SoundEffect[] = [
  { id: "s-kick", title: "Kick", kind: "midi", midiKind: "kick", volume: 0.9 },
  { id: "s-snare", title: "Snare", kind: "midi", midiKind: "snare", volume: 0.9 },
  { id: "s-hat", title: "Hi-Hat", kind: "midi", midiKind: "hat", volume: 0.8 },
  { id: "s-clap", title: "Clap", kind: "midi", midiKind: "clap", volume: 0.9 },
  { id: "s-cowbell", title: "Cowbell", kind: "midi", midiKind: "cowbell", volume: 0.8 },
  { id: "s-zap", title: "Synth Zap", kind: "synth", note: 72, wave: "square",
    adsr: { a: 0.001, d: 0.08, s: 0.0, r: 0.05 }, volume: 0.7 },
  { id: "s-stab", title: "Synth Stab", kind: "synth", note: 60, wave: "sawtooth",
    adsr: { a: 0.005, d: 0.3, s: 0.0, r: 0.2 }, volume: 0.7 },
  { id: "s-sword", title: "Sword Clash", kind: "sample", url: "", volume: 0.9 },
  { id: "s-thunder", title: "Thunder", kind: "sample", url: "", volume: 0.9 },
];

const STORAGE_KEY = "hmw.workspace.v1";

function initial(): WorkspaceState {
  const pattern = defaultPattern();
  return {
    pattern,
    patterns: [structuredClone(pattern)],
    song: { enabled: false, items: [] },
    mode: "beginner",
    midiBindings: [],
    chaosRoutes: chaos.routes,
    selectedTrackId: pattern.tracks[0]!.id,
    layouts: structuredClone(DEFAULT_LAYOUTS),
    palette: "amber",
    customPalettes: [],
    musicTracks: structuredClone(DEFAULT_MUSIC),
    soundEffects: structuredClone(DEFAULT_SFX),
    musicMaster: 0.8,
    sfxMaster: 0.9,
    fadeMs: 2000,
    duck: { ...DEFAULT_DUCK },
    playlist: { enabled: false, trackIds: [], shuffle: false },
    scenes: [],
    activeSceneId: undefined,
  };
}

let state: WorkspaceState = initial();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

// ===== Undo / redo history =====
// Snapshot strategy: every full `set` (heavy edit) pushes the *previous* state
// onto the past stack. `patch` mutations (panel drags, slider scrubs) are
// noisy and intentionally NOT recorded; explicit `pushHistory()` is available
// when a patch represents a meaningful change (delete pad, capture scene, …).
const HISTORY_LIMIT = 80;
const past: WorkspaceState[] = [];
const future: WorkspaceState[] = [];

function recordHistory(prev: WorkspaceState) {
  past.push(prev);
  if (past.length > HISTORY_LIMIT) past.shift();
  future.length = 0; // any new edit truncates the redo branch
}

/**
 * Migrate a legacy `layouts` object (keyed by PanelType with no `id`/`type`
 * fields) into the new shape. Safe to call on already-migrated values.
 */
function migrateLayouts(input: unknown): Record<string, PanelInstance> {
  const out: Record<string, PanelInstance> = structuredClone(DEFAULT_LAYOUTS);
  if (!input || typeof input !== "object") return out;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Partial<PanelInstance> & PanelLayout;
    const type = (v.type ?? (PANEL_TYPES.includes(key as PanelType) ? (key as PanelType) : null));
    if (!type) continue;
    out[key] = {
      id: v.id ?? key,
      type,
      title: v.title,
      visible: v.visible ?? true,
      x: v.x ?? 5,
      y: v.y ?? 5,
      w: v.w ?? 30,
      h: v.h ?? 30,
      z: v.z ?? 1,
    };
  }
  return out;
}
/** Push every track's EQ + send levels back into the live audio engine. */
function syncMixToEngine() {
  for (const t of state.pattern.tracks) {
    if (t.eq) {
      engine.setTrackEq(t.id, "low", t.eq.low);
      engine.setTrackEq(t.id, "mid", t.eq.mid);
      engine.setTrackEq(t.id, "high", t.eq.high);
    }
    if (t.sends) {
      engine.setTrackSend(t.id, "reverb", t.sends.reverb);
      engine.setTrackSend(t.id, "delay", t.sends.delay);
    }
  }
}

export const workspace = {
  get(): WorkspaceState {
    return state;
  },
  set(updater: (s: WorkspaceState) => WorkspaceState) {
    const prev = state;
    state = updater(state);
    if (state !== prev) recordHistory(prev);
    sequencer.load(state.pattern);
    midiLearn.bindings = state.midiBindings;
    chaos.routes = state.chaosRoutes;
    engine.syncTracks(state.pattern.tracks.map((t) => ({ id: t.id, kind: t.kind as TrackKind })));
    syncMixToEngine();
    notify();
  },
  /** Lightweight update that does not re-sync audio/sequencer subsystems. */
  patch(updater: (s: WorkspaceState) => WorkspaceState) {
    state = updater(state);
    notify();
  },
  /** Explicitly push the current state onto the undo stack (use before a meaningful patch). */
  pushHistory() {
    recordHistory(state);
  },
  canUndo(): boolean {
    return past.length > 0;
  },
  canRedo(): boolean {
    return future.length > 0;
  },
  undo(): boolean {
    const prev = past.pop();
    if (!prev) return false;
    future.push(state);
    state = prev;
    sequencer.load(state.pattern);
    midiLearn.bindings = state.midiBindings;
    chaos.routes = state.chaosRoutes;
    engine.syncTracks(state.pattern.tracks.map((t) => ({ id: t.id, kind: t.kind as TrackKind })));
    syncMixToEngine();
    notify();
    return true;
  },
  redo(): boolean {
    const next = future.pop();
    if (!next) return false;
    past.push(state);
    state = next;
    sequencer.load(state.pattern);
    midiLearn.bindings = state.midiBindings;
    chaos.routes = state.chaosRoutes;
    engine.syncTracks(state.pattern.tracks.map((t) => ({ id: t.id, kind: t.kind as TrackKind })));
    syncMixToEngine();
    notify();
    return true;
  },

  // ===== Panel instances =====
  setPanelVisible(id: string, visible: boolean) {
    workspace.patch((s) => {
      const cur = s.layouts[id];
      if (!cur) return s;
      return { ...s, layouts: { ...s.layouts, [id]: { ...cur, visible } } };
    });
  },
  setPanelLayout(id: string, patch: Partial<PanelLayout>) {
    workspace.patch((s) => {
      const cur = s.layouts[id];
      if (!cur) return s;
      return { ...s, layouts: { ...s.layouts, [id]: { ...cur, ...patch } } };
    });
  },
  setPanelTitle(id: string, title: string) {
    workspace.patch((s) => {
      const cur = s.layouts[id];
      if (!cur) return s;
      return { ...s, layouts: { ...s.layouts, [id]: { ...cur, title } } };
    });
  },
  bringPanelToFront(id: string) {
    workspace.patch((s) => {
      const cur = s.layouts[id];
      if (!cur) return s;
      const maxZ = Math.max(...Object.values(s.layouts).map((l) => l.z));
      if (cur.z === maxZ) return s;
      return { ...s, layouts: { ...s.layouts, [id]: { ...cur, z: maxZ + 1 } } };
    });
  },
  /** Spawn a new panel instance of the given type at a cascaded offset. */
  addPanelInstance(type: PanelType): string {
    const id = `${type}-${Math.random().toString(36).slice(2, 7)}`;
    workspace.patch((s) => {
      const existing = Object.values(s.layouts).filter((l) => l.type === type).length;
      const maxZ = Math.max(0, ...Object.values(s.layouts).map((l) => l.z));
      const offset = (existing * 3) % 30;
      const seed = DEFAULT_LAYOUTS[type] ?? DEFAULT_LAYOUTS.synth;
      const inst: PanelInstance = {
        id,
        type,
        title: `${PANEL_LABELS[type]} ${existing + 1}`,
        visible: true,
        x: Math.min(70, (seed.x + offset)),
        y: Math.min(70, (seed.y + offset)),
        w: seed.w,
        h: seed.h,
        z: maxZ + 1,
      };
      return { ...s, layouts: { ...s.layouts, [id]: inst } };
    });
    return id;
  },
  removePanelInstance(id: string) {
    workspace.patch((s) => {
      if (!s.layouts[id]) return s;
      const next = { ...s.layouts };
      delete next[id];
      return { ...s, layouts: next };
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
  /** Mutate one field on one track in place (no sequencer reload). */
  updateTrack(id: string, patch: Partial<Track>) {
    workspace.patch((s) => ({
      ...s,
      pattern: {
        ...s.pattern,
        tracks: s.pattern.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      },
    }));
  },
  setTrackSwing(id: string, v: number) {
    workspace.updateTrack(id, { swing: Math.max(0, Math.min(0.66, v)) });
  },
  setTrackHumanize(id: string, ms: number) {
    workspace.updateTrack(id, { humanize: Math.max(0, Math.min(80, ms)) });
  },
  setTrackEqBand(id: string, band: "low" | "mid" | "high", dB: number) {
    const cur = workspace.get().pattern.tracks.find((t) => t.id === id);
    const eq = { low: 0, mid: 0, high: 0, ...(cur?.eq ?? {}), [band]: dB };
    workspace.updateTrack(id, { eq });
    engine.setTrackEq(id, band, dB);
  },
  setTrackSendLevel(id: string, target: "reverb" | "delay", v: number) {
    const cur = workspace.get().pattern.tracks.find((t) => t.id === id);
    const sends = { reverb: 0, delay: 0, ...(cur?.sends ?? {}), [target]: v };
    workspace.updateTrack(id, { sends });
    engine.setTrackSend(id, target, v);
  },

  // ===== Music Board =====
  addMusic(t: Partial<MusicTrack> & { title: string; url: string }) {
    const id = t.id ?? `m-${Math.random().toString(36).slice(2, 8)}`;
    const track: MusicTrack = {
      id,
      title: t.title,
      url: t.url,
      volume: t.volume ?? 0.7,
      loop: t.loop ?? true,
    };
    workspace.patch((s) => ({ ...s, musicTracks: [...s.musicTracks, track] }));
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
  addSfx(t: Partial<SoundEffect> & { title: string }) {
    const id = t.id ?? `s-${Math.random().toString(36).slice(2, 8)}`;
    const sfx: SoundEffect = {
      id,
      title: t.title,
      kind: t.kind ?? "sample",
      url: t.url ?? "",
      midiKind: t.midiKind,
      note: t.note,
      adsr: t.adsr,
      wave: t.wave,
      volume: t.volume ?? 0.9,
      color: t.color,
    };
    workspace.patch((s) => ({ ...s, soundEffects: [...s.soundEffects, sfx] }));
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

  // ===== Sidechain ducking =====
  setDuck(patch: Partial<DuckSettings>) {
    workspace.patch((s) => ({ ...s, duck: { ...s.duck, ...patch } }));
  },

  // ===== Playlist =====
  setPlaylist(patch: Partial<PlaylistSettings>) {
    workspace.patch((s) => ({ ...s, playlist: { ...s.playlist, ...patch } }));
  },

  // ===== Scenes =====
  /**
   * Capture the currently-playing music + master state as a named scene.
   * If `name` matches an existing scene, that scene is overwritten.
   */
  captureScene(name: string): string {
    const s = workspace.get();
    const playing = s.musicTracks
      .filter((t) => mediaPlayer.isPlaying(t.id))
      .map((t) => ({ id: t.id, volume: t.volume }));
    const existing = s.scenes.find((x) => x.name === name);
    const id = existing?.id ?? `scene-${Math.random().toString(36).slice(2, 8)}`;
    const scene: Scene = {
      id,
      name,
      music: playing,
      musicMaster: s.musicMaster,
      sfxMaster: s.sfxMaster,
      capturedAt: Date.now(),
    };
    workspace.patch((cur) => {
      const without = cur.scenes.filter((x) => x.id !== id);
      return { ...cur, scenes: [...without, scene], activeSceneId: id };
    });
    return id;
  },
  renameScene(id: string, name: string) {
    workspace.patch((s) => ({
      ...s,
      scenes: s.scenes.map((x) => (x.id === id ? { ...x, name } : x)),
    }));
  },
  removeScene(id: string) {
    workspace.patch((s) => ({
      ...s,
      scenes: s.scenes.filter((x) => x.id !== id),
      activeSceneId: s.activeSceneId === id ? undefined : s.activeSceneId,
    }));
  },
  /**
   * Recall a scene: stop any music not in the scene (with fadeMs), start
   * scene tracks (with crossfade). Master levels are restored.
   */
  recallScene(id: string) {
    const s = workspace.get();
    const scene = s.scenes.find((x) => x.id === id);
    if (!scene) return;
    const fadeMs = s.fadeMs;
    const wantIds = new Set(scene.music.map((m) => m.id));
    for (const tr of s.musicTracks) {
      if (mediaPlayer.isPlaying(tr.id) && !wantIds.has(tr.id)) {
        mediaPlayer.stop(tr.id, fadeMs);
      }
    }
    workspace.patch((cur) => ({
      ...cur,
      musicMaster: scene.musicMaster,
      sfxMaster: scene.sfxMaster,
      activeSceneId: id,
    }));
    for (const cue of scene.music) {
      const tr = s.musicTracks.find((m) => m.id === cue.id);
      if (!tr || !tr.url) continue;
      void mediaPlayer.play(tr.id, tr.url, {
        volume: cue.volume * scene.musicMaster,
        loop: tr.loop,
        fadeMs,
      });
    }
  },

  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
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
      const base = initial();
      const merged: WorkspaceState = {
        ...base,
        ...parsed.state,
        layouts: migrateLayouts(parsed.state.layouts),
        palette: parsed.state.palette ?? "amber",
        duck: { ...base.duck, ...(parsed.state.duck ?? {}) },
        playlist: { ...base.playlist, ...(parsed.state.playlist ?? {}) },
        scenes: parsed.state.scenes ?? [],
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
