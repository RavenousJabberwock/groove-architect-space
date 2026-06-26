/**
 * Song mode controller.
 *
 * Subscribes to sequencer transport and swaps the active pattern at bar
 * boundaries according to the workspace's `song.items` chain.
 *
 * A "bar" is fixed at 16 master 16th steps. Each chain item specifies how
 * many bars to hold that pattern before advancing to the next item. The
 * chain loops back to item 0 after the last item finishes.
 *
 * Only the chain advance lives here — the sequencer itself stays unaware
 * of the chain. Patterns are swapped via `sequencer.swapPattern()` so
 * timing (nextStepTime / masterStep) is preserved across the boundary.
 */

import { bus } from "../audio/bus";
import { sequencer } from "../sequencer/engine";

const STEPS_PER_BAR = 16;

interface ChainState {
  cursor: number;
  barsInCurrent: number;
  lastStep: number;
}

class SongController {
  private state: ChainState = { cursor: 0, barsInCurrent: 0, lastStep: -1 };
  private getSnapshot: (() => {
    enabled: boolean;
    items: { patternId: string; bars: number }[];
    patternById: (id: string) => unknown;
  }) | null = null;

  attach(getSnapshot: SongController["getSnapshot"]) {
    this.getSnapshot = getSnapshot;
    bus.on("transport:state", (e) => {
      if (e.playing) this.reset();
    });
    bus.on("transport:step", (e) => this.onStep(e.step));
  }

  reset() {
    this.state = { cursor: 0, barsInCurrent: 0, lastStep: -1 };
    const snap = this.getSnapshot?.();
    if (!snap?.enabled || snap.items.length === 0) return;
    const first = snap.items[0];
    if (!first) return;
    const p = snap.patternById(first.patternId) as ReturnType<typeof sequencer["swapPattern"]> | unknown;
    if (p) sequencer.swapPattern(p as Parameters<typeof sequencer.swapPattern>[0]);
  }

  /** Returns the current chain cursor (read by SongMode panel UI). */
  cursor() {
    return this.state.cursor;
  }

  private onStep(step: number) {
    const snap = this.getSnapshot?.();
    if (!snap?.enabled || snap.items.length === 0) return;
    // Bar boundary: every 16 steps.
    if (step === this.state.lastStep) return;
    this.state.lastStep = step;
    if (step === 0) {
      // start of playback handled by reset()
      this.state.barsInCurrent = 0;
      return;
    }
    if (step % STEPS_PER_BAR !== 0) return;

    this.state.barsInCurrent += 1;
    const item = snap.items[this.state.cursor];
    if (!item) return;
    if (this.state.barsInCurrent < item.bars) return;

    // Advance to next chain item (loop).
    this.state.cursor = (this.state.cursor + 1) % snap.items.length;
    this.state.barsInCurrent = 0;
    const next = snap.items[this.state.cursor];
    if (!next) return;
    const p = snap.patternById(next.patternId);
    if (p) sequencer.swapPattern(p as Parameters<typeof sequencer.swapPattern>[0]);
  }
}

export const songController = new SongController();
