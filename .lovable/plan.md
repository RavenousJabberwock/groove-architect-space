Tackling every remaining enhancement from the earlier list across three batches. Each batch is self-contained so the build stays green between them.

## Batch 1 — Workflow polish

**Undo/redo**
- Wrap `workspace.set` in `src/state/workspace.ts` with a 50-entry ring buffer. Add `undo()` / `redo()` and `canUndo` / `canRedo` selectors.
- Coalesce rapid edits (slider drags) by debouncing pushes 250 ms.
- Bind ⌘Z / ⌘⇧Z (and Ctrl variants) in `src/hooks/use-keyboard-shortcuts.ts`; ignore while typing.
- Toast "Undid <last action label>" using an action tag passed to `workspace.set`.

**Command palette (⌘K)**
- New `src/components/workstation/CommandPalette.tsx` using a shadcn `Command` dialog.
- Registry built from live state: open/close any panel, recall any scene, trigger any music track or SFX pad, run global actions (capture scene, toggle playlist/shuffle, undo/redo, master volume presets).
- Global hotkey ⌘K / Ctrl K mounted from `Workstation.tsx`.

**Per-track EQ + meters in Mixer**
- Extend `src/audio/media-player.ts` to route each element through a `MediaElementAudioSourceNode → BiquadFilter (low shelf) → Biquad (peaking mid) → Biquad (high shelf) → Gain → AnalyserNode → destination`. Lazy-build the graph on first play.
- Store `eq: { low: number; mid: number; high: number }` per `MusicTrack` and `SoundEffect` in workspace.
- Mixer strips gain three compact dB knobs + a vertical peak meter driven by rAF reading `getFloatTimeDomainData`. Meter peak-hold for 800 ms.

## Batch 2 — Sound design

**Reverb + delay send buses**
- New `src/audio/buses.ts`: build a shared `ConvolverNode` (synthesized impulse) for reverb and a `DelayNode` + feedback `Gain` for delay, both terminated at master.
- Each track's `MediaElementAudioSourceNode` gets two extra `Gain` taps feeding the buses. Per-track `sends: { reverb: number; delay: number }` controls.
- Mixer adds two small send knobs per strip and a global "FX" section with reverb size/decay and delay time/feedback sliders.

**Randomized ambient triggers**
- `SoundEffect` gains `auto?: { enabled: boolean; minMs: number; maxMs: number }`.
- `src/hooks/use-pad-triggers.ts` schedules a per-pad `setTimeout` in `[minMs, maxMs]` whenever `auto.enabled` is true, calling `triggerSfx` then rescheduling.
- Soundboard pad editor exposes Auto toggle + min/max sliders.

**Note repeat / roll**
- `Synth.tsx` adds a "Repeat" toggle with rate selector (1/4, 1/8T, 1/16, 1/32) and gate %.
- While held, an interval retriggers `engine.triggerOneShot` using the currently held key/velocity. Releasing the key stops its interval.
- Plays nicely with the existing pitch-adjusted MIDI percussion path.

## Batch 3 — Composition depth

**Per-pattern swing + quantize**
- Add `swing: number` (0–0.66) and `humanize: number` (ms jitter) to `Pattern` in `src/sequencer/types.ts`.
- `src/sequencer/engine.ts` offsets every other 16th by `swing * stepDur` and adds ± random `humanize` ms inside the existing scheduler.
- Sequencer panel header gains two compact sliders.

**Pattern chaining / song mode**
- Workspace gains `song: { enabled: boolean; steps: { patternId: string; bars: number }[]; cursor: number }`.
- Sequencer engine, when `song.enabled`, switches the active pattern at bar boundaries based on `steps`.
- New `SongMode.tsx` panel: ordered list of pattern chips with bar counts, add/remove/reorder, play/stop. Registered as a new `PanelType`.

**Piano roll for the synth**
- Promote each synth instance to own a `notes: { startStep, durSteps, midi, velocity }[]` array stored on the panel's instance state (extend `PanelInstance` in `workspace.ts`).
- New `PianoRoll.tsx` panel showing a scrollable grid (vertical = MIDI 36–96, horizontal = 32 steps). Click-drag to place, drag edges to resize, right-click to delete.
- The sequencer scheduler plays these notes through `engine.triggerOneShot("synth", …)` using the instance's preset.
- Existing fixed-step trigger row stays for users who prefer it; piano roll is opened from the synth panel's header button "Roll".

## Technical notes

- All new state slices are additive — existing serialized workspaces deserialize fine because missing fields default in `state/workspace.ts` migrations.
- Audio graph upgrade in batch 1 is the riskiest piece; it changes how `<audio>` elements feed master. I'll keep the legacy `el.volume` path as the fallback when `AudioContext` isn't unlocked yet (some browsers require a user gesture) and switch to graph mode after the first `boot()`.
- Send buses and meters share the same audio graph upgrade, so batch 2 builds directly on batch 1.
- No new external deps required; everything uses existing WebAudio + shadcn `Command`.

## Out of scope (kept from earlier list for later)

Streaming sources (YouTube/SoundCloud embeds), cloud share/export, themeable per-panel colors, velocity layers/aftertouch on the soundboard.