# Feature batch: Scenes, Ducking, Playlist, Triggers

## 1. Scenes / snapshots (RPG one-click recall)

A scene captures: which music tracks are playing + their volumes, music/sfx master levels, and (optionally) the current pattern. Recall fades old music out and new music in over the global Fade time.

**Data model (`src/state/workspace.ts`):**
```ts
interface Scene {
  id: string;
  name: string;       // "Tavern", "Combat", "Boss"
  music: { id: string; volume: number }[];  // tracks to play
  musicMaster: number;
  sfxMaster: number;
  capturedAt: number;
}
state.scenes: Scene[];
state.activeSceneId?: string;
```

**Methods:** `captureScene(name)`, `recallScene(id)` (stops non-listed music with fadeMs, starts listed music with crossfade), `renameScene`, `removeScene`.

**UI:** New `Scenes` panel (`src/components/workstation/Scenes.tsx`) registered as a new `PanelType`. Grid of named tiles — click to recall, long-press/edit to rename, "Capture current" button at top. Active scene highlighted.

## 2. Sidechain ducking (music dips when SFX fires)

When any soundboard pad triggers, briefly lower the music master so the effect cuts through.

**Engine (`src/audio/media-player.ts`):** add a `duckMultiplier` (0..1, default 1) applied on top of per-track volume. `mediaPlayer.duck({ amount, attackMs, holdMs, releaseMs })` schedules: ramp multiplier from 1→`1-amount` over attack, hold, then ramp back. While ducked, `setVolume` calls keep multiplier intact.

**Wire-up (`src/components/workstation/Soundboard.tsx`):** call `mediaPlayer.duck(...)` inside `trigger()` using workspace settings.

**Settings (`src/state/workspace.ts` + `ConfigDialog.tsx`):**
```ts
duck: { enabled: boolean; amount: number; attackMs: number; holdMs: number; releaseMs: number }
```
Sliders in Configure dialog under a new "Sidechain Ducking" section.

## 3. Playlist with auto-crossfade

Music Board gains a `Playlist` toggle. When on, the player listens for `ended` (or near-end timeupdate, since `loop` overrides `ended`) and crossfades to the next track in `playlist.trackIds`. Loop is forced off while playlist mode is active.

**Data model:**
```ts
state.playlist: { enabled: boolean; trackIds: string[]; shuffle: boolean }
```

**Implementation:** `MusicBoard.tsx` watches the playing track's element via `timeupdate`; when `duration - currentTime < fadeMs/1000`, it crossfades to the next track in `trackIds` (advancing the cursor, wrapping at end, shuffling once per cycle). A toggle button in the header turns it on/off; a drag-to-reorder list (simple up/down arrows for v1) under the toggle controls order.

## 4. Per-pad hotkeys + MIDI note triggers

Every Music track and every SFX pad can be bound to a keyboard key and/or a MIDI note. Pressing the key (or receiving note-on) triggers the pad. SFX = one-shot; Music = toggle play/stop with crossfade.

**Data model additions:**
```ts
MusicTrack: { hotkey?: string; midiNote?: number; midiChannel?: number }
SoundEffect: { hotkey?: string; midiNote?: number; midiChannel?: number }
```

**Router (`src/hooks/use-pad-triggers.ts`):** new global hook mounted from `Workstation.tsx`. Listens to:
- `window` keydown — match against `hotkey` strings (e.g. `"q"`, `"Shift+1"`); ignore while typing in inputs.
- `bus.on("midi:message")` for note-on (`status & 0xf0 === 0x90`, velocity > 0) — match against `midiNote` (+optional channel).

When matched: SFX → call the same trigger logic Soundboard uses (extract to `src/audio/triggers.ts` so both can share); Music → toggle via mediaPlayer with crossfade.

**Learn UI:**
- `MusicBoard.tsx` row gains a compact "K: Q · M: ―" pill with a "Learn" button. Click → next keypress / midi note is captured and stored. Esc cancels.
- `Soundboard.tsx` edit panel gains the same Hotkey + MIDI Learn fields.

**MIDI capture:** extend `midi/learn.ts` with an `armNote(target)` method (parallel to existing `arm` for CC), and have the router subscribe to a new `bus` event `midi:learn-note`.

## 5. Shared trigger helper

`src/audio/triggers.ts` — pure function `triggerSfx(sfx)` and `toggleMusic(track)` consolidated from current Soundboard / MusicBoard logic so the new global hook and existing UI both call the same code.

## Files

**New:** `src/components/workstation/Scenes.tsx`, `src/audio/triggers.ts`, `src/hooks/use-pad-triggers.ts`

**Edited:** `src/state/workspace.ts` (Scene, Playlist, Duck, hotkey/midiNote fields + methods), `src/audio/media-player.ts` (duck), `src/midi/learn.ts` (armNote), `src/audio/bus.ts` (midi:learn-note event), `src/components/workstation/Workstation.tsx` (mount hook, register Scenes panel), `src/components/workstation/MusicBoard.tsx` (playlist toggle, hotkey UI, use shared trigger), `src/components/workstation/Soundboard.tsx` (hotkey UI, use shared trigger, duck call), `src/components/workstation/ConfigDialog.tsx` (Ducking section), `src/components/workstation/TopBar.tsx` (scene quick-recall dropdown — optional), `README.md` (document).

## Out of scope for this batch
Randomized ambient triggers, per-track EQ/meters, undo/redo, command palette, drag-to-reorder polish. Easy follow-ups once this lands.
