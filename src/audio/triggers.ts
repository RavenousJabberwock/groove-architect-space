/**
 * Shared trigger helpers used by both the on-screen UI (Soundboard / Music
 * Board buttons) and the global hotkey / MIDI router. Centralising the
 * playback semantics here keeps every entry-point behaving identically.
 */

import { engine, type TrackKind } from "./engine";
import { mediaPlayer } from "./media-player";
import { boot } from "@/state/setup";
import { workspace, type MusicTrack, type SoundEffect } from "@/state/workspace";

const DEFAULT_ADSR = { a: 0.01, d: 0.14, s: 0.5, r: 0.45 };

/**
 * Fire a soundboard pad. Also applies sidechain ducking to the music bus
 * when enabled. Returns true if the cue was actually triggered.
 */
export async function triggerSfx(sfx: SoundEffect): Promise<boolean> {
  const state = workspace.get();
  const vol = sfx.volume * state.sfxMaster;
  const kind = sfx.kind ?? "sample";

  if (kind === "sample") {
    if (!sfx.url) return false;
    void mediaPlayer.trigger(sfx.id, sfx.url, vol);
  } else {
    await boot();
    if (kind === "midi") {
      if (!sfx.midiKind) return false;
      engine.triggerOneShot(sfx.midiKind as TrackKind, { velocity: vol });
    } else {
      engine.triggerOneShot("synth", {
        note: sfx.note ?? 60,
        velocity: vol,
        adsr: sfx.adsr ?? DEFAULT_ADSR,
        wave: sfx.wave ?? "sawtooth",
      });
    }
  }

  // Sidechain — dip music while the effect plays.
  if (state.duck.enabled) {
    mediaPlayer.duck({
      amount: state.duck.amount,
      attackMs: state.duck.attackMs,
      holdMs: state.duck.holdMs,
      releaseMs: state.duck.releaseMs,
    });
  }
  return true;
}

/**
 * Toggle a music track's playback with crossfade. If the track is already
 * playing it stops (with fade-out); otherwise it starts (with fade-in).
 */
export async function toggleMusic(track: MusicTrack): Promise<boolean> {
  if (!track.url) return false;
  const state = workspace.get();
  if (mediaPlayer.isPlaying(track.id)) {
    mediaPlayer.stop(track.id, state.fadeMs);
  } else {
    await mediaPlayer.play(track.id, track.url, {
      volume: track.volume * state.musicMaster,
      loop: track.loop,
      fadeMs: state.fadeMs,
    });
  }
  return true;
}

/**
 * Crossfade-style trigger: stop every *other* playing music track, then
 * play `track`. Used by the Music Board "XFade" button and by playlist
 * advancement.
 */
export async function crossfadeMusic(track: MusicTrack): Promise<boolean> {
  if (!track.url) return false;
  const state = workspace.get();
  for (const other of state.musicTracks) {
    if (other.id !== track.id && mediaPlayer.isPlaying(other.id)) {
      mediaPlayer.stop(other.id, state.fadeMs);
    }
  }
  await mediaPlayer.play(track.id, track.url, {
    volume: track.volume * state.musicMaster,
    loop: track.loop,
    fadeMs: state.fadeMs,
  });
  return true;
}
