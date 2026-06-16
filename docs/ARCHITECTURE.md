# Architecture

Detailed design notes for the Hybrid Music Workstation. For the user-facing overview, feature list, and setup steps, see the top-level [`README.md`](../README.md).

---

## Module map

```
src/audio/        Web Audio engine, central event bus, voices
src/sequencer/    Pattern data model + lookahead step scheduler
src/midi/         MidiBackend interface, MIDI 1.0 impl, MIDI 2.0 stub, learn
src/chaos/        XY pad state, continuous oscillator, macro routing
src/state/        Workspace store (useSyncExternalStore) + boot sequence
src/themes/       Palette presets applied as CSS variables
src/presets/      Default kits / patches / patterns
src/hooks/        Reusable React hooks (keyboard shortcuts, …)
src/components/workstation/  UI panels and chrome
```

---

## Event bus contract

All subsystems communicate through `src/audio/bus.ts`. Keep payloads small and serializable.

| Event              | Payload                                                                        | Notes |
| ------------------ | ------------------------------------------------------------------------------ | ----- |
| `step:trigger`     | `{ trackId, time, velocity, note, pLocks? }`                                   | Audio engine subscribes; sequencer + keyboard + MIDI emit. |
| `transport:step`   | `{ step, time }`                                                               | UI playhead. |
| `transport:state`  | `{ playing }`                                                                  | UI transport state. |
| `chaos:xy`         | `{ x, y }` (0..1)                                                              | Audio engine + UI. |
| `param:change`     | `{ target, value }`                                                            | Generic modulation routing. |
| `midi:message`     | `{ status, data1, data2, portId? }`                                            | Raw inbound MIDI. |
| `midi:learn`       | `{ cc, channel }`                                                              | Learn capture complete. |

---

## Audio engine (`src/audio/engine.ts`)

- One shared `AudioContext` created on first user gesture (autoplay policy).
- Master chain: `master GainNode` → `DynamicsCompressorNode` (soft limiter) → `destination`.
- Per-track channel: `gain → filter → master`. A voice factory provides the `trigger(time, opts)` callback that schedules a note on the shared clock.
- `engine.syncTracks(tracks)` reconciles channels with the current pattern after any track add / remove / kind change.
- `engine.chaosCutoff` / `engine.chaosResonance` are global modulation slots written by the chaos pad and applied to every voice's filter.

### Adding a voice

```ts
// src/audio/voices/my-voice.ts
export function createMyVoice(ctx: AudioContext, dest: AudioNode) {
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  gain.connect(filter).connect(dest);
  return {
    gain, filter,
    trigger(time: number, opts: { note: number; velocity: number }) {
      // schedule oscillators / envelopes on `time`
    },
  };
}
```

Then add the kind to `TrackKind` / `ALL_TRACK_KINDS` and the switch in `engine.addTrack`.

---

## Sequencer (`src/sequencer/engine.ts`)

- Lookahead scheduler: every 25 ms, schedule any step due in the next 100 ms.
- Each `Track` carries its own `length` (polymeter) and `divisor` (polyrhythm).
- Step playback predicates, in order:
  1. `step.active`
  2. probability (0..100 %)
  3. condition: `1:2`, `2:2`, `FILL`, `PRE`, `NEI`
- On pass, emit `step:trigger` with the resolved velocity, note, and parameter locks.

### Conditional trigs

| Condition | Fires when                              |
| --------- | --------------------------------------- |
| `1:2`     | first pass of a 2-pass cycle            |
| `2:2`     | second pass of a 2-pass cycle           |
| `FILL`    | fill mode is engaged                    |
| `PRE`     | previous step in this track fired       |
| `NEI`     | previous (neighbouring) track fired     |

---

## MIDI layer (`src/midi/`)

`MidiBackend` is the only contract the rest of the app sees:

```ts
interface MidiBackend {
  readonly version: 1 | 2;
  init(): Promise<void>;
  inputs(): MidiPort[];
  outputs(): MidiPort[];
  onMessage(cb: (msg: MidiMessage) => void): () => void;
  send(msg: MidiMessage): void;
}
```

- `midi1-backend.ts` — Web MIDI API.
- `midi2-backend.ts` — interface-compatible stub; UMP framing scaffolded for when browsers expose MIDI 2.0.
- `learn.ts` — captures the next CC for a target id and persists the binding in the workspace.

Swap backends in `src/state/setup.ts` via `switchMidiBackend()`.

---

## Chaos pad (`src/chaos/pad.ts`)

- Tracks normalized `{ x, y }` (0..1).
- Owns a continuous voice: `OscillatorNode (saw) → BiquadFilterNode → GainNode → master`. `engage()` ramps gain up on pointer-down, `release()` ramps down on pointer-up.
- Maintains a `routes` table mapping axis → parameter target. Emits both `chaos:xy` and `param:change`.
- Macro recording is scaffolded; playback is on the roadmap.

---

## Workspace store (`src/state/workspace.ts`)

A `useSyncExternalStore`-based store. Snapshot shape:

```ts
interface WorkspaceState {
  pattern: Pattern;
  mode: "beginner" | "pro";
  panelOrder: PanelId[];
  midiBindings: MidiBinding[];
  chaosRoutes: ChaosRoute[];
  selectedTrackId: string;
  layouts: Record<PanelId, PanelLayout>;  // x/y/w/h in %, z-index, visible
  palette: string;
}
```

### Update paths

| Call                 | Re-syncs sequencer + audio + MIDI | Use for                          |
| -------------------- | --------------------------------- | -------------------------------- |
| `workspace.set(fn)`  | yes                               | pattern / track / kind changes   |
| `workspace.patch(fn)`| no                                | UI-only state (layout, palette)  |

### Persistence

- `save(name?)` / `load(name?)` use `localStorage` under `hmw.workspace.v1:<name>`.
- Snapshot is plain JSON — ready to migrate to a Cloud `workspaces` table when auth is added.
- `load()` merges legacy snapshots with `DEFAULT_LAYOUTS` so older saves still open after schema additions.

---

## UI panels & windowing (`src/components/workstation/`)

- `Workstation.tsx` mounts every panel inside a `PanelWindow`.
- `PanelWindow.tsx` adds a draggable title bar, bottom-right resize handle, close button, and z-order bring-to-front. Coordinates are stored in percentages so layouts survive viewport changes.
- `WindowsMenu.tsx` toggles `layouts[id].visible`.
- `ConfigDialog.tsx` exposes theme selection and **Reset Layout** (`workspace.resetLayouts()`).

### Adding a panel

1. Create the component under `src/components/workstation/`.
2. Add the id to `PanelId` and a default layout to `DEFAULT_LAYOUTS`.
3. Mount it in `Workstation.tsx` wrapped in `<PanelWindow id="…" title="…">`.

---

## Theming (`src/themes/palettes.ts`)

`applyPalette(id)` writes CSS custom properties on `:root`. All components reference tokens (e.g. `bg-[hsl(var(--bg))]`) instead of hardcoded colors. Add a new palette by appending to the `PALETTES` record — it appears in the Configure dialog automatically.

---

## Boot sequence (`src/state/setup.ts`)

`boot()` is idempotent and runs on the first user gesture:

1. `engine.init()` — create `AudioContext`, master, limiter.
2. `engine.syncTracks(...)` — build channels for the current pattern.
3. `sequencer.load(pattern)` — load the pattern into the scheduler.
4. `midiBackend.init()` + `midiLearn.attach(backend)`.
5. `chaos.attach(engine)`.

Every shortcut handler and transport control awaits `boot()` so users never get silent failures from an uninitialized context.

---

## Deferred (next iterations)

- Lovable Cloud auth + Cloud-backed workspaces, presets, samples
- Wavetable & FM voice DSP
- Modulation matrix UI (data model exists in chaos macros)
- Automation curve editor (data model in `sequencer/automation.ts`)
- Song mode / pattern chaining
- Full MIDI 2.0 send path (interface ready)
- XY automation playback / recording
- Sampler (drag-and-drop already scaffolded in `Browser.tsx`)
