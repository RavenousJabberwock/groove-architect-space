/**
 * MediaPlayer: lightweight HTMLAudioElement-based playback layer used by
 * the Music Board and Soundboard. Independent of the WebAudio sequencer
 * graph so long-form tracks and cross-fades don't compete for the
 * scheduler. Volumes are tweened on rAF to avoid zipper noise.
 */

type FadeHandle = { raf: number; from: number; to: number; start: number; ms: number };

class MediaPlayer {
  private els = new Map<string, HTMLAudioElement>();
  private fades = new Map<string, FadeHandle>();

  /** Get or create the audio element for a given id. */
  ensure(id: string, src: string, loop = false): HTMLAudioElement {
    let el = this.els.get(id);
    if (!el) {
      el = new Audio();
      el.preload = "auto";
      // Note: do NOT set crossOrigin for plain playback. Many media hosts
      // (e.g. soundhelix.com) don't send CORS headers, and requesting
      // "anonymous" mode forces a CORS check that blocks the load.
      this.els.set(id, el);
    }
    if (el.src !== src && src) {
      try {
        el.src = src;
      } catch {
        // ignore invalid src
      }
    }
    el.loop = loop;
    return el;
  }

  isPlaying(id: string): boolean {
    const el = this.els.get(id);
    return !!el && !el.paused && !el.ended;
  }

  async play(id: string, src: string, opts: { volume: number; loop?: boolean; fadeMs?: number }) {
    const el = this.ensure(id, src, !!opts.loop);
    const target = clamp01(opts.volume);
    const fadeMs = Math.max(0, opts.fadeMs ?? 0);
    if (fadeMs > 0) {
      el.volume = 0;
      this.tween(id, 0, target, fadeMs);
    } else {
      el.volume = target;
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
      });
    } else {
      el.pause();
      el.currentTime = 0;
      this.cancelFade(id);
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
      el.volume = clamp01(volume);
      await el.play();
    } catch (e) {
      console.warn("[media] trigger failed", id, e);
    }
  }

  setVolume(id: string, v: number) {
    const el = this.els.get(id);
    if (!el) return;
    this.cancelFade(id);
    el.volume = clamp01(v);
  }

  /** Crossfade out → in between two ids. */
  crossfade(fromId: string | null, toId: string, toSrc: string, toVolume: number, ms: number, loop = true) {
    if (fromId && fromId !== toId) this.stop(fromId, ms);
    void this.play(toId, toSrc, { volume: toVolume, loop, fadeMs: ms });
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
