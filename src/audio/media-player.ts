/**
 * MediaPlayer: lightweight HTMLAudioElement-based playback layer used by
 * the Music Board and Soundboard. Independent of the WebAudio sequencer
 * graph so long-form tracks and cross-fades don't compete for the
 * scheduler. Volumes are tweened on rAF to avoid zipper noise.
 *
 * Also supports a global "duck" multiplier applied on top of every per-track
 * volume, used by the sidechain feature (music dips when SFX fires).
 */

type FadeHandle = { raf: number; from: number; to: number; start: number; ms: number };

class MediaPlayer {
  private els = new Map<string, HTMLAudioElement>();
  /** Per-id "intended" volume (what the user set), before duck multiplier. */
  private targetVolumes = new Map<string, number>();
  private fades = new Map<string, FadeHandle>();
  /** Global multiplier 0..1 applied on top of every track's volume. */
  private duckMul = 1;
  private duckRaf = 0;

  /** Get or create the audio element for a given id. */
  ensure(id: string, src: string, loop = false): HTMLAudioElement {
    let el = this.els.get(id);
    if (!el) {
      el = new Audio();
      el.preload = "auto";
      // Do NOT set crossOrigin — many hosts (soundhelix etc.) don't send
      // CORS headers and "anonymous" mode would block the load.
      this.els.set(id, el);
    }
    if (el.src !== src && src) {
      try {
        el.src = src;
      } catch {
        /* ignore invalid src */
      }
    }
    el.loop = loop;
    return el;
  }

  isPlaying(id: string): boolean {
    const el = this.els.get(id);
    return !!el && !el.paused && !el.ended;
  }

  /** Underlying <audio> element, exposed for the playlist auto-crossfade watcher. */
  element(id: string): HTMLAudioElement | undefined {
    return this.els.get(id);
  }

  async play(id: string, src: string, opts: { volume: number; loop?: boolean; fadeMs?: number }) {
    const el = this.ensure(id, src, !!opts.loop);
    const target = clamp01(opts.volume);
    this.targetVolumes.set(id, target);
    const fadeMs = Math.max(0, opts.fadeMs ?? 0);
    if (fadeMs > 0) {
      el.volume = 0;
      this.tween(id, 0, target * this.duckMul, fadeMs);
    } else {
      el.volume = target * this.duckMul;
    }
    try {
      await el.play();
    } catch (e) {
      console.warn("[media] play failed", id, e);
    }
  }

  stop(id: string, fadeMs = 0) {
    const el = this.els.get(id);
    if (!el) return;
    if (fadeMs > 0 && !el.paused) {
      this.tween(id, el.volume, 0, fadeMs, () => {
        el.pause();
        el.currentTime = 0;
        this.targetVolumes.delete(id);
      });
    } else {
      el.pause();
      el.currentTime = 0;
      this.cancelFade(id);
      this.targetVolumes.delete(id);
    }
  }

  pause(id: string, fadeMs = 0) {
    const el = this.els.get(id);
    if (!el) return;
    if (fadeMs > 0 && !el.paused) {
      this.tween(id, el.volume, 0, fadeMs, () => el.pause());
    } else {
      el.pause();
      this.cancelFade(id);
    }
  }

  /** One-shot trigger: rewind and play from start. Used by Soundboard. */
  async trigger(id: string, src: string, volume: number) {
    const el = this.ensure(id, src, false);
    try {
      el.currentTime = 0;
      el.volume = clamp01(volume); // one-shots ignore duck (they're the source of it)
      await el.play();
    } catch (e) {
      console.warn("[media] trigger failed", id, e);
    }
  }

  setVolume(id: string, v: number) {
    const el = this.els.get(id);
    if (!el) return;
    this.cancelFade(id);
    this.targetVolumes.set(id, clamp01(v));
    el.volume = clamp01(v) * this.duckMul;
  }

  /** Crossfade out → in between two ids. */
  crossfade(fromId: string | null, toId: string, toSrc: string, toVolume: number, ms: number, loop = true) {
    if (fromId && fromId !== toId) this.stop(fromId, ms);
    void this.play(toId, toSrc, { volume: toVolume, loop, fadeMs: ms });
  }

  /**
   * Sidechain duck: dip every currently-playing track's volume by `amount`
   * (0..1) for the duration of the envelope, then ramp back. Called by the
   * Soundboard when a pad fires.
   */
  duck(opts: { amount: number; attackMs?: number; holdMs?: number; releaseMs?: number }) {
    const amount = clamp01(opts.amount);
    if (amount <= 0.001) return;
    const attack = Math.max(1, opts.attackMs ?? 30);
    const hold = Math.max(0, opts.holdMs ?? 120);
    const release = Math.max(1, opts.releaseMs ?? 400);
    const floor = 1 - amount;

    if (this.duckRaf) cancelAnimationFrame(this.duckRaf);
    const startMul = this.duckMul;
    const t0 = performance.now();
    const tHoldStart = t0 + attack;
    const tHoldEnd = tHoldStart + hold;
    const tEnd = tHoldEnd + release;

    const step = () => {
      const now = performance.now();
      let mul: number;
      if (now < tHoldStart) {
        const k = (now - t0) / attack;
        mul = startMul + (floor - startMul) * k;
      } else if (now < tHoldEnd) {
        mul = floor;
      } else if (now < tEnd) {
        const k = (now - tHoldEnd) / release;
        mul = floor + (1 - floor) * k;
      } else {
        mul = 1;
      }
      this.duckMul = mul;
      this.applyDuckToAll();
      if (now < tEnd) {
        this.duckRaf = requestAnimationFrame(step);
      } else {
        this.duckRaf = 0;
      }
    };
    this.duckRaf = requestAnimationFrame(step);
  }

  private applyDuckToAll() {
    for (const [id, el] of this.els) {
      const target = this.targetVolumes.get(id);
      if (target === undefined) continue;
      // Skip if a fade is in flight — the tween reads `duckMul` as it runs.
      if (this.fades.has(id)) continue;
      el.volume = clamp01(target * this.duckMul);
    }
  }

  /** Dispose of an element (e.g., when a track is removed). */
  dispose(id: string) {
    this.cancelFade(id);
    const el = this.els.get(id);
    if (el) {
      el.pause();
      el.src = "";
    }
    this.els.delete(id);
    this.targetVolumes.delete(id);
  }

  private tween(id: string, from: number, to: number, ms: number, onDone?: () => void) {
    this.cancelFade(id);
    const el = this.els.get(id);
    if (!el) return;
    const start = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / ms);
      el.volume = clamp01(from + (to - from) * t);
      if (t < 1) {
        const h = this.fades.get(id);
        if (h) h.raf = requestAnimationFrame(step);
      } else {
        this.fades.delete(id);
        onDone?.();
      }
    };
    const raf = requestAnimationFrame(step);
    this.fades.set(id, { raf, from, to, start, ms });
  }

  private cancelFade(id: string) {
    const h = this.fades.get(id);
    if (h) cancelAnimationFrame(h.raf);
    this.fades.delete(id);
  }
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export const mediaPlayer = new MediaPlayer();
