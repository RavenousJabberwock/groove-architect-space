# Hybrid Music Workstation

Modular browser-based music workstation. MVP foundation: working drum
machine, subtractive synth, Kaoss-style chaos pad, polymeter sequencer with
probability and conditional trigs, MIDI 1.0 (with a MIDI 2.0 backend stub),
and localStorage-backed workspaces.

## Architecture

```
src/audio/        Web Audio engine, central event bus, voices
src/sequencer/    Pattern data model + lookahead step scheduler
src/midi/         MidiBackend interface, MIDI 1.0 impl, MIDI 2.0 stub, learn
src/chaos/        XY pad state, macro routing, recording
src/state/        Workspace store (zustand-free useSyncExternalStore)
src/presets/      Default kits/patches/patterns
src/components/workstation/  UI panels (TopBar, Sequencer, Drums, Synth, ChaosPad, Mixer, Browser)
```

### Event bus contract

All subsystems communicate through `src/audio/bus.ts`:

- `step:trigger` — sequencer fires a note (audio engine subscribes)
- `transport:step` / `transport:state` — UI playhead + transport state
- `chaos:xy` — XY pad movement (audio engine + UI subscribe)
- `param:change` — generic modulation (MIDI router, chaos macros)
- `midi:message` — raw incoming MIDI
- `midi:learn` — completed MIDI learn binding

### Adding a new voice

Implement `createXVoice(ctx: AudioContext, dest: AudioNode, opts)` in
`src/audio/voices/`. Register it in `engine.addTrack`'s switch on `kind`.

### Adding a new MIDI backend

Implement the `MidiBackend` interface in `src/midi/types.ts`. Pass an
instance to `midiLearn.attach(backend)` and call `switchMidiBackend()` from
the boot module.

## Deferred (next iterations)

- Lovable Cloud auth + Cloud-backed workspaces, presets, samples
- Wavetable & FM voice DSP
- Modulation matrix UI (data model exists in chaos macros)
- Automation curve editor (data model in `sequencer/automation.ts`)
- Song mode / pattern chaining
- Full MIDI 2.0 (interface ready, send stubbed)
- XY automation playback
