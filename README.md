# Hybrid Music Workstation

A modular, browser-based hybrid music workstation built with React, TypeScript, and the Web Audio API. It combines a drum machine, subtractive synthesizer, Kaoss-style chaos pad, and an Elektron-inspired step sequencer with polymeter, probability, and conditional trigs — all wrapped in a movable, themeable hardware-style UI.

> Status: **MVP foundation.** The core audio engine, sequencer, MIDI layer, chaos pad, and workspace system are functional. Recent additions: undo/redo, command palette (⌘K), per-track 3-band EQ + peak meters, global reverb + delay send buses, per-track swing & humanize, randomized ambient soundboard pads, and synth note-repeat. Piano roll, song-mode pattern chaining, and Cloud-backed workspaces remain on the roadmap.

You can make some music live at https://groove-architect-space.lovable.app/

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [UI Overview](#ui-overview)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Extending the App](#extending-the-app)
- [Persistence](#persistence)
- [Roadmap](#roadmap)
- [License](#license)

---

## Features

### Audio
- **Drum engine** — 12 fully-synthesized voices: `kick`, `snare`, `hat`, `openhat`, `clap`, `rim`, `tom`, `conga`, `cowbell`, `cymbal`, `shaker`, `perc`. All voices follow a `tune` parameter so they can be pitched per-step (sequencer p-lock) or per-key (Synth panel percussion mode).
- **Subtractive synth** — selectable waveform (saw/square/triangle/sine) → resonant lowpass → ADSR amp envelope.
- **Chaos pad** — Kaoss-style XY controller with a continuous oscillator that routes X/Y to filter cutoff/resonance (or any registered macro target).
- **Sample-accurate scheduling** via a lookahead clock on a single shared `AudioContext`.
- **Master bus** with a dynamics compressor acting as a soft limiter.

### Sequencer
- **Polymeter** — each track has its own `length` (1–32 steps).
- **Polyrhythm** — per-track `divisor` (0.25–4) controls how often a track advances.
- **Probability** — 0–100 % per step.
- **Conditional trigs** (Elektron-style): `1:2`, `2:2`, `FILL`, `PRE`, `NEI`.
- **Parameter locks** — per-step overrides for any registered parameter (including `tune` on drum tracks).
- **Dynamic tracks** — add, remove, or swap the instrument on any row at runtime.

### MIDI
- **MIDI 1.0** backend using the Web MIDI API (in/out, CC, note on/off).
- **MIDI 2.0** backend stub — same interface, UMP-ready, drop-in when browsers expose it.
- **MIDI Learn** — right-click any knob to bind it to the next CC received.

### RPG-Oriented Boards
- **Music Board** — DJ-style background music mixer with per-track loop toggle and crossfade. URL or local-file ingestion, auto-titled from ID3 v2 `TIT2` frames, with user overrides preserved.
  - **Playlist mode** queues selected tracks and auto-crossfades between them a few seconds before each track ends (Shuffle optional).
- **Soundboard** — grid of one-shot SFX pads. Each pad is one of:
  - `sample` — audio URL or uploaded file.
  - `midi` — any built-in percussion voice.
  - `synth` — custom note + waveform + ADSR pad.
- **Sidechain ducking** — when a soundboard pad fires, music momentarily dips so the effect cuts through. Amount, attack, hold, and release are tunable in the **Configure** dialog.
- **Scenes** — capture the currently-playing music + master levels as a named snapshot (e.g. "Tavern", "Combat", "Boss"). Tap a scene tile later to crossfade back into that arrangement.
- **Per-pad hotkeys & MIDI triggers** — every music track and every SFX pad can be bound to a keyboard key (with modifier support) and/or an incoming MIDI note. Click **Bind** on a music row, or the key/midi controls inside a pad's edit panel, then press the key or play the note you want to assign.

### UI
- **Hardware/Elektron-inspired dark theme** with JetBrains Mono and 5 swappable palettes (Amber, Phosphor, Cyan, Synthwave, Mono).
- **Movable, resizable, closable panels** with z-order — your layout is saved with the workspace.
- **Windows menu** to show/hide any panel, plus a **Configure** dialog for theme and layout reset.
- **Beginner / Pro modes** that progressively reveal advanced controls.
- **Unified Mixer** — master, music-master, sfx-master, and per-track gain/mute/solo all in one panel.

### Workspace
- The full app state — pattern, layout, palette, mode, MIDI bindings, chaos routes, music & SFX libraries — persists to `localStorage` (and is wired to move to Lovable Cloud).
- Save / load workspace by name.

---

## Tech Stack

- **TanStack Start v1** (React 19, Vite 7, file-based routing)
- **TypeScript** (strict)
- **Tailwind CSS v4** with CSS custom-property design tokens
- **shadcn/ui** + Radix primitives
- **Web Audio API** (no DSP libraries — everything is hand-rolled)
- **Web MIDI API**

---

## Quick Start

```bash
# Install dependencies
bun install

# Start the dev server
bun run dev

# Production build
bun run build
```

Open the printed URL, click anywhere on the page to satisfy the browser's autoplay policy, then hit `Space` to start the sequencer.

> **Tip:** Use Chrome, Edge, or any Chromium-based browser for full Web MIDI support. Firefox and Safari support Web Audio fully but Web MIDI coverage varies.

---

## Keyboard Shortcuts

Shortcuts are ignored while a text input has focus.

### Transport
| Key            | Action                  |
| -------------- | ----------------------- |
| `Space`        | Play / Stop             |
| `F`            | Toggle Fill mode        |
| `B`            | Toggle Beginner / Pro   |
| `⌘ / Ctrl + S` | Save workspace          |
| `⌘ / Ctrl + O` | Load workspace          |

### Drum Pads
| Key      | Action                        |
| -------- | ----------------------------- |
| `1`–`8`  | Trigger drum tracks 1–8       |

### Synth (FL Studio–style keyboard)
| Key | Note   | Key | Note   |
| --- | ------ | --- | ------ |
| `A` | C      | `T` | F♯     |
| `W` | C♯     | `G` | G      |
| `S` | D      | `Y` | G♯     |
| `E` | D♯     | `H` | A      |
| `D` | E      | `U` | A♯     |
| `F` | F      | `J` | B      |
|     |        | `K` | C (next octave) |

| Key | Action          |
| --- | --------------- |
| `Z` | Octave down     |
| `X` | Octave up       |

---

## UI Overview

The workstation defaults to a windowed layout. Every panel is closable, draggable, resizable and persists across sessions.

| Panel        | Purpose                                                      |
| ------------ | ------------------------------------------------------------ |
| **Sequencer** | Pattern grid, per-track instrument selection, conditional trigs, transport. |
| **Synth**    | Two-octave piano keyboard. Instrument selector routes keys to the subtractive synth or any percussion voice (drum voices pitch with the key relative to C4). |
| **Chaos Pad** | XY controller — drag to sweep filter/resonance with live audio. |
| **Mixer**    | Master / Music / SFX masters + per-track gain, mute, solo. |
| **Music Board** | Background music mixer for RPG ambience: per-track faders, loop toggles, crossfade. |
| **Soundboard** | Grid of one-shot SFX pads: sample, MIDI percussion, or custom synth. |
| **Browser**  | Drag-and-drop sample browser (scaffolding for the sampler).  |

> The dedicated **Drums** panel was removed in favour of the Synth panel's percussion-instrument selector plus the Soundboard's MIDI pads — both cover the same use-cases without a duplicate panel.

Every panel can be dragged by its title bar, resized via the bottom-right corner, closed via the `×`, or restored from the **Windows** menu in the top bar. The **Configure** button opens theme selection and layout reset.

---

## Project Structure

```
src/
├── audio/                  Web Audio engine + voices + event bus
│   ├── bus.ts              Central typed event bus
│   ├── engine.ts           AudioContext, master bus, track channels
│   ├── id3.ts              Minimal ID3v2 TIT2 reader (auto-titles for media)
│   ├── media-player.ts     HTMLAudio layer for Music Board / Soundboard samples
│   └── voices/
│       ├── drum-voices.ts  12 synthesized drum voices (pitch-aware via tune/note)
│       └── subtractive.ts  Saw → filter → ADSR synth
├── sequencer/
│   ├── engine.ts           Lookahead step scheduler
│   └── types.ts            Pattern / Track / Step data model
├── midi/
│   ├── types.ts            MidiBackend interface
│   ├── midi1-backend.ts    Web MIDI implementation
│   ├── midi2-backend.ts    MIDI 2.0 / UMP stub
│   └── learn.ts            MIDI learn binding system
├── chaos/
│   └── pad.ts              XY pad state + continuous oscillator + macros
├── state/
│   ├── workspace.ts        Workspace store (useSyncExternalStore)
│   └── setup.ts            Boot sequence (audio + MIDI init)
├── themes/
│   └── palettes.ts         Theme presets injected as CSS variables
├── presets/
│   └── defaults.ts         Default pattern + kit
├── hooks/
│   └── use-keyboard-shortcuts.ts
├── components/workstation/ All UI panels and chrome
└── routes/                 TanStack Start file-based routes
```

---

## Architecture

### Event-bus contract

All subsystems communicate through the typed bus in `src/audio/bus.ts`. This decouples the sequencer, MIDI, chaos pad, and UI from each other.

| Event              | Emitter           | Subscriber(s)                  |
| ------------------ | ----------------- | ------------------------------ |
| `step:trigger`     | Sequencer, keyboard, MIDI | Audio engine            |
| `transport:step`   | Sequencer         | UI playhead                    |
| `transport:state`  | Sequencer         | UI transport indicator         |
| `chaos:xy`         | Chaos pad         | Audio engine, UI               |
| `param:change`     | MIDI router, chaos macros | Anything observing params |
| `midi:message`     | MIDI backend      | Learn system, router           |
| `midi:learn`       | Learn system      | UI                             |

### Audio engine

- Single `AudioContext` created lazily on first user gesture (autoplay policy).
- `engine.syncTracks(...)` reconciles audio channels with the current pattern's tracks — adding, removing, and swapping voices.
- Each track owns a `gain` → `filter` → master chain. Voices schedule themselves on the shared clock.
- The chaos pad writes to `engine.chaosCutoff` / `engine.chaosResonance`, applied to all tracks.

### Sequencer

A lookahead scheduler runs every 25 ms and schedules any step due in the next 100 ms. This keeps timing sample-accurate even while the main thread is busy. Tracks advance independently (polymeter / polyrhythm) and steps are filtered through probability and condition predicates before emitting `step:trigger`.

### State

`src/state/workspace.ts` is a tiny store built on `useSyncExternalStore`. It exposes:

- `get()` — current snapshot.
- `set(updater)` — full update; re-syncs sequencer + audio + MIDI subsystems.
- `patch(updater)` — UI-only update; no audio resync.
- Granular helpers: `addTrack`, `removeTrack`, `setTrackKind`, `setPanelVisible`, `setPanelLayout`, `setPalette`, `save`, `load`, …

### Theming

Themes are plain objects in `src/themes/palettes.ts`. `applyPalette(id)` writes CSS custom properties (`--bg`, `--fg`, `--accent`, …) onto `:root`. Components consume those tokens through Tailwind utilities or shadcn variants — never hardcoded hex.

---

## Extending the App

### Add a new drum/synth voice

1. Add a factory in `src/audio/voices/` returning `{ gain, filter, trigger(time, opts) }`.
2. Append the kind to `TrackKind` / `ALL_TRACK_KINDS` in `src/audio/engine.ts`.
3. Wire the kind in `engine.addTrack`'s switch.

The new instrument is now available in the sequencer's per-row dropdown automatically.

### Add a MIDI backend

1. Implement the `MidiBackend` interface from `src/midi/types.ts`.
2. Attach it via `midiLearn.attach(backend)`.
3. Optionally call `switchMidiBackend()` from `src/state/setup.ts`.

### Add a chaos macro target

Register the parameter id in `chaos.routes` (or via the UI), then have your subsystem subscribe to `param:change` and apply the value.

### Add a panel

1. Build a component under `src/components/workstation/`.
2. Add an id to `PanelId` and a default layout in `DEFAULT_LAYOUTS` (`src/state/workspace.ts`).
3. Mount it inside `Workstation.tsx` wrapped in `<PanelWindow id="…">`.

It will inherit dragging, resizing, hide/show via the Windows menu, and workspace persistence for free.

### Add a theme

Add an entry to the `PALETTES` map in `src/themes/palettes.ts`. It shows up in the Configure dialog automatically.

---

## Persistence

Workspaces are serialised to `localStorage` under `hmw.workspace.v1:<name>`. The shape is a plain JSON snapshot of `WorkspaceState`, so it is forward-compatible with a Cloud-backed `workspaces` table when authentication lands.

`workspace.save(name?)` and `workspace.load(name?)` are wired to `⌘/Ctrl + S` and `⌘/Ctrl + O`.

---

## Roadmap

Tracked in `docs/ARCHITECTURE.md` under **Deferred**:

- Lovable Cloud auth + Cloud-backed workspaces, presets, samples
- Wavetable & FM voice DSP
- Modulation matrix UI (data model exists in chaos macros)
- Automation curve editor
- Song mode / pattern chaining
- Full MIDI 2.0 send path
- XY automation playback / recording

---

## License

MIT. See `LICENSE` if present, otherwise treat as MIT until a license file is added.
