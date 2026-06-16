
# Hybrid Music Workstation — MVP Foundation

A modular browser-based workstation with a working drum machine, basic synth, chaos pad, 16-step sequencer with probability/conditional trigs, MIDI 1.0 (with MIDI 2.0 interface stubs), and Lovable Cloud-backed workspaces & presets. Dark Elektron-inspired UI.

## Scope for this iteration

In:
- Project skeleton with isolated subsystems and a central event bus
- Real-time Web Audio engine (low latency, single AudioContext, shared transport clock)
- Drum machine: 8 tracks, synthesized voices (kick, snare, hat, clap, tom, perc) + sample slot per track
- Synth: subtractive voice (osc + filter + ADSR) — wavetable/FM scaffolded as voice modules but only subtractive is audible
- Chaos pad: XY controller mapped to filter cutoff + resonance (with macro routing system), touch + mouse
- Sequencer: 16 steps × N tracks, per-track length (polymeter), per-step probability and basic conditional trigs (1:2, 2:2, FILL), play/stop, BPM, swing
- MIDI: Web MIDI input/output, MIDI learn, note-out on triggers. A `MidiBackend` interface with `Midi1Backend` implemented and `Midi2Backend` stub
- UI shell: dark hardware aesthetic, movable/dockable panels (drum, synth, chaos, sequencer, mixer-lite, browser), beginner/pro toggle
- Workspaces: save full app state to Cloud per user; list / load / delete; auth (email+password + Google)
- Presets: kits, synth patches, chaos macros, patterns — stored in Cloud with public/private flag
- Sample upload via drag-and-drop into Cloud Storage; per-user `samples` bucket

Out (explicitly deferred):
- Wavetable & FM voice DSP (interfaces only)
- Visual modulation matrix UI (data model only)
- Automation lanes with curves (data model only; no editor)
- Song mode / pattern chaining UI (data model only)
- Full MIDI 2.0 (interface + stub backend only)
- XY automation recording playback (recording stub; no playback editor)

## Architecture

```text
src/
  audio/
    engine.ts             # AudioContext, master bus, transport clock (lookahead scheduler)
    bus.ts                # typed event bus (pub/sub)
    voices/
      drum-voices.ts      # synthesized kick/snare/hat/clap/tom
      sample-voice.ts     # buffer playback
      subtractive.ts      # osc+filter+amp ADSR
      wavetable.ts        # stub
      fm.ts               # stub
    fx/
      filter.ts           # shared SVF used by chaos pad
  sequencer/
    types.ts              # Pattern, Track, Step, Conditional
    engine.ts             # step scheduler, polymeter, probability, conditionals
    automation.ts         # lane data model (no UI)
  midi/
    types.ts              # MidiBackend interface, MidiMessage
    midi1-backend.ts      # Web MIDI 1.0
    midi2-backend.ts      # stub, same interface
    learn.ts              # MIDI learn registry
    router.ts             # routes messages → params
  chaos/
    pad.ts                # XY state, macro routing, recording stub
  state/
    workspace.ts          # zustand store: kits, patches, patterns, panels, theme, mode
    serialize.ts          # toJSON / fromJSON for workspaces
  presets/
    kits.ts               # default kit definitions
    patches.ts            # default synth patches
    patterns.ts           # demo patterns
  components/
    workstation/
      Workstation.tsx     # panel container, drag layout
      Panel.tsx           # movable panel wrapper
      TopBar.tsx          # transport, BPM, mode toggle, workspace menu
      DrumMachine.tsx
      Synth.tsx
      ChaosPad.tsx
      Sequencer.tsx
      Mixer.tsx
      Browser.tsx         # presets + samples drag/drop
      ModeToggle.tsx      # beginner ↔ pro
    ui/                   # shadcn (existing)
  lib/
    workspace.functions.ts # createServerFn: save/load/list/delete workspace
    presets.functions.ts   # createServerFn: list/save presets
    samples.functions.ts   # signed upload URLs for samples bucket
  routes/
    __root.tsx            # providers, theme, audio engine boot
    index.tsx             # marketing/landing → "Open Workstation"
    auth.tsx              # email + Google sign-in
    _authenticated/
      route.tsx           # managed gate
      studio.tsx          # main workstation
      browse.tsx          # community presets
  styles.css              # dark hardware tokens (OLED black, amber/red accents, mono readouts)
```

Central event bus decouples subsystems: sequencer emits `step:trigger`, chaos pad emits `param:change`, MIDI router emits `midi:note`/`midi:cc`. The audio engine, UI meters, and recording subsystems subscribe.

## Audio engine

- One `AudioContext`, master limiter, per-track gain.
- Transport: 25 ms lookahead scheduler (Chris Wilson pattern) using `currentTime` for sample-accurate step timing.
- Voices implement `trigger(time, params)` and own teardown; drum voices are stateless one-shots.
- Chaos pad writes into shared `filterCutoffParam` / `filterResonanceParam` via `setTargetAtTime`.

## Sequencer logic

- Per track: `steps[]`, `length` (1–32), `divisor` (for polyrhythm), `pageOffset`.
- Per step: `active`, `velocity`, `probability` (0–100), `condition` (`null | "1:2" | "2:2" | "FILL" | "PRE" | "NEI"`), `pLock` map.
- On each tick: increment per-track step counter independently → polymeter; gate by probability + condition; emit trigger to event bus.

## MIDI

- `MidiBackend` interface: `init()`, `inputs()`, `outputs()`, `onMessage(cb)`, `send(msg)`.
- `Midi1Backend` uses `navigator.requestMIDIAccess()`.
- `Midi2Backend` exposes the same surface but throws `NotImplemented` on `send` with a UMP payload; selectable in settings, future-ready.
- MIDI learn: click a control → arm → next incoming CC binds; mapping persisted in workspace.

## Chaos pad

- Square XY area, finger/mouse tracking, trail visualization on canvas.
- Macros: each axis maps to up to 4 destinations with depth (modulation matrix data structure under the hood — UI is the pad, not a matrix yet).
- Recording stub: captures `(t, x, y)` to an array; playback wired for later iteration.

## UI / styling

- Dark hardware Elektron-inspired: OLED black `oklch(0.12 0 0)` background, panel surfaces `oklch(0.16 0 0)`, amber primary `oklch(0.78 0.15 75)`, red accent `oklch(0.62 0.22 25)`.
- JetBrains Mono for readouts, Inter for labels, all defined in `@theme` in `src/styles.css`.
- Movable panels via simple grid-slot drag (no heavy lib): drag handle on panel header swaps slot index. Stored in workspace.
- Beginner mode hides: probability, conditionals, MIDI learn, polymeter length, p-locks. Pro mode reveals everything.

## Workspace & presets (Lovable Cloud)

Tables (RLS on, scoped to `auth.uid()`):
- `workspaces (id, user_id, name, data jsonb, updated_at)`
- `presets (id, user_id, kind enum['kit','patch','pattern','chaos'], name, data jsonb, is_public bool, created_at)`
- `samples (id, user_id, name, storage_path, duration_ms, created_at)`

Storage: private `samples` bucket; signed URLs via server fn.

Server fns in `src/lib/*.functions.ts` using `requireSupabaseAuth`:
- `saveWorkspace`, `loadWorkspace`, `listWorkspaces`, `deleteWorkspace`
- `savePreset`, `listPresets` (own + public)
- `createSampleUploadUrl`, `listSamples`

Auth: email + password and Google (via Lovable broker). Studio lives under `_authenticated/`.

## Deliverables this iteration

1. Cloud enabled, auth wired, tables + RLS + storage bucket created.
2. Audio engine + sequencer + drum voices + subtractive synth + chaos pad audible end-to-end.
3. MIDI 1.0 in/out + learn working; MIDI 2.0 backend stub selectable.
4. Studio UI with movable panels, beginner/pro toggle, dark hardware theme.
5. Workspace save/load, default kits/patches/patterns, sample drag-and-drop upload.
6. README in `docs/` describing architecture, event bus contract, and how to add a new voice/backend.

After you approve, I'll enable Lovable Cloud, scaffold the files, and build the MVP. Subsequent iterations can layer in wavetable/FM DSP, automation curve editor, modulation matrix UI, song mode, and full MIDI 2.0.
