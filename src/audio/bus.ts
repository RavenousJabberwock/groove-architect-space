/**
 * Central typed event bus.
 *
 * All subsystems (sequencer, MIDI, chaos pad, UI) talk through this bus to
 * stay decoupled. Keep payloads small and serializable where possible.
 */

export type BusEvents = {
  /** Sequencer fired a step. */
  "step:trigger": { trackId: string; time: number; velocity: number; note: number; pLocks?: Record<string, number> };
  /** Sequencer transport tick (UI playhead). */
  "transport:step": { step: number; time: number };
  /** Transport play/stop. */
  "transport:state": { playing: boolean };
  /** XY pad position change (normalized 0..1). */
  "chaos:xy": { x: number; y: number };
  /** Generic parameter change (modulation, automation, MIDI). */
  "param:change": { target: string; value: number };
  /** MIDI input message. */
  "midi:message": { status: number; data1: number; data2: number; portId?: string };
  /** MIDI learn capture event. */
  "midi:learn": { cc: number; channel: number };
  /** MIDI learn capture event for note-on (pad triggers). */
  "midi:learn-note": { note: number; channel: number };
};

type Handler<K extends keyof BusEvents> = (payload: BusEvents[K]) => void;

class EventBus {
  private listeners = new Map<keyof BusEvents, Set<Handler<keyof BusEvents>>>();

  on<K extends keyof BusEvents>(event: K, handler: Handler<K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as Handler<keyof BusEvents>);
    return () => set!.delete(handler as Handler<keyof BusEvents>);
  }

  emit<K extends keyof BusEvents>(event: K, payload: BusEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const h of set) (h as Handler<K>)(payload);
  }
}

export const bus = new EventBus();
