import { useEffect, useRef, useState } from "react";
import { engine } from "@/audio/engine";
import { mediaPlayer } from "@/audio/media-player";
import { useWorkspace, workspace } from "@/state/workspace";
import type { Track } from "@/sequencer/types";

/**
 * Mixer panel.
 *
 * Layout (left → right):
 *   MAST / MUSIC / SFX masters
 *   FX bus controls (reverb size+mix, delay time+feedback+mix)
 *   One channel strip per sequencer track:
 *     • 3-band EQ (low / mid / high, ±12 dB)
 *     • Reverb + Delay sends
 *     • Vertical fader + Mute / Solo
 *     • Live peak meter (driven by AnalyserNode in the engine)
 */

const FaderColumn = ({
  label,
  value,
  onChange,
  accent = "primary",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  accent?: "primary" | "accent";
}) => (
  <div className="flex w-14 shrink-0 flex-col items-center gap-2 rounded border border-border bg-background p-2">
    <div className="readout text-[9px]">{label}</div>
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`h-24 ${accent === "primary" ? "accent-[var(--color-primary)]" : "accent-[var(--color-accent)]"}`}
      style={{ writingMode: "vertical-lr" as never, direction: "rtl" }}
    />
    <div className="readout text-[9px]">{Math.round(value * 100)}</div>
  </div>
);

const MiniKnob = ({
  label,
  value,
  min,
  max,
  step,
  fmt,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  onChange: (v: number) => void;
}) => (
  <label className="flex flex-col items-stretch gap-0.5">
    <span className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="accent-[var(--color-primary)]"
    />
    <span className="readout text-right text-[9px]">{fmt(value)}</span>
  </label>
);

/** Vertical peak meter driven by an AnalyserNode in the engine. */
function PeakMeter({ trackId }: { trackId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const holdRef = useRef({ peak: 0, ts: 0 });
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const level = engine.getTrackLevel(trackId);
      const now = performance.now();
      if (level > holdRef.current.peak) {
        holdRef.current = { peak: level, ts: now };
      } else if (now - holdRef.current.ts > 700) {
        // Decay the peak hold.
        holdRef.current.peak = Math.max(level, holdRef.current.peak * 0.92);
      }
      if (ref.current) {
        const h = Math.min(100, Math.round(level * 130));
        const ph = Math.min(100, Math.round(holdRef.current.peak * 130));
        ref.current.style.setProperty("--lvl", `${h}%`);
        ref.current.style.setProperty("--hold", `${ph}%`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [trackId]);
  return (
    <div
      ref={ref}
      className="relative h-16 w-2 overflow-hidden rounded border border-border bg-background"
      style={{ ["--lvl" as never]: "0%", ["--hold" as never]: "0%" }}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-[linear-gradient(to_top,var(--color-primary),var(--color-accent))] transition-[height] duration-75"
        style={{ height: "var(--lvl)" }}
      />
      <div
        className="absolute left-0 right-0 h-px bg-accent"
        style={{ bottom: "var(--hold)" }}
      />
    </div>
  );
}

function TrackStrip({ t }: { t: Track }) {
  const eq = t.eq ?? { low: 0, mid: 0, high: 0 };
  const sends = t.sends ?? { reverb: 0, delay: 0 };
  return (
    <div className="flex w-20 shrink-0 flex-col items-stretch gap-1.5 rounded border border-border bg-background p-1.5">
      <div className="readout truncate text-[9px]" title={t.name}>{t.name}</div>

      <MiniKnob
        label="Hi" value={eq.high} min={-12} max={12} step={0.5}
        fmt={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}`}
        onChange={(v) => workspace.setTrackEqBand(t.id, "high", v)}
      />
      <MiniKnob
        label="Mid" value={eq.mid} min={-12} max={12} step={0.5}
        fmt={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}`}
        onChange={(v) => workspace.setTrackEqBand(t.id, "mid", v)}
      />
      <MiniKnob
        label="Lo" value={eq.low} min={-12} max={12} step={0.5}
        fmt={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}`}
        onChange={(v) => workspace.setTrackEqBand(t.id, "low", v)}
      />
      <MiniKnob
        label="Rev" value={sends.reverb} min={0} max={1} step={0.01}
        fmt={(v) => `${Math.round(v * 100)}`}
        onChange={(v) => workspace.setTrackSendLevel(t.id, "reverb", v)}
      />
      <MiniKnob
        label="Dly" value={sends.delay} min={0} max={1} step={0.01}
        fmt={(v) => `${Math.round(v * 100)}`}
        onChange={(v) => workspace.setTrackSendLevel(t.id, "delay", v)}
      />

      <div className="flex items-end justify-center gap-1">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.8}
          onChange={(e) => engine.setTrackGain(t.id, Number(e.target.value))}
          className="h-16 accent-[var(--color-primary)]"
          style={{ writingMode: "vertical-lr" as never, direction: "rtl" }}
        />
        <PeakMeter trackId={t.id} />
      </div>

      <div className="flex justify-center gap-1">
        <button
          onClick={() =>
            workspace.set((s) => ({
              ...s,
              pattern: {
                ...s.pattern,
                tracks: s.pattern.tracks.map((x) => (x.id === t.id ? { ...x, mute: !x.mute } : x)),
              },
            }))
          }
          className={`rounded px-1 py-0.5 text-[8px] uppercase ${t.mute ? "bg-accent text-accent-foreground" : "bg-secondary"}`}
        >M</button>
        <button
          onClick={() =>
            workspace.set((s) => ({
              ...s,
              pattern: {
                ...s.pattern,
                tracks: s.pattern.tracks.map((x) => (x.id === t.id ? { ...x, solo: !x.solo } : x)),
              },
            }))
          }
          className={`rounded px-1 py-0.5 text-[8px] uppercase ${t.solo ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
        >S</button>
      </div>
    </div>
  );
}

export function MixerPanel() {
  const pattern = useWorkspace((s) => s.pattern);
  const musicMaster = useWorkspace((s) => s.musicMaster);
  const sfxMaster = useWorkspace((s) => s.sfxMaster);
  const [master, setMaster] = useState(0.8);

  // FX bus state (engine-owned; mirrored in local state for the sliders).
  const [reverbMix, setReverbMix] = useState(0.9);
  const [reverbDecay, setReverbDecay] = useState(2.4);
  const [delayTime, setDelayTime] = useState(0.33);
  const [delayFb, setDelayFb] = useState(0.38);
  const [delayMix, setDelayMix] = useState(0.9);

  useEffect(() => {
    setMaster(engine.getMasterGain());
  }, []);

  // Reflect music-master changes onto any tracks already playing.
  useEffect(() => {
    for (const tr of workspace.get().musicTracks) {
      if (mediaPlayer.isPlaying(tr.id)) {
        mediaPlayer.setVolume(tr.id, tr.volume * musicMaster);
      }
    }
  }, [musicMaster]);

  return (
    <div className="flex h-full flex-col p-3">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Mixer</h2>
      <div className="flex flex-1 gap-2 overflow-auto">
        <FaderColumn label="MAST" value={master} onChange={(v) => { setMaster(v); engine.setMasterGain(v); }} accent="accent" />
        <FaderColumn label="MUSIC" value={musicMaster} onChange={(v) => workspace.setMusicMaster(v)} accent="accent" />
        <FaderColumn label="SFX" value={sfxMaster} onChange={(v) => workspace.setSfxMaster(v)} accent="accent" />

        <div className="w-px shrink-0 self-stretch bg-border" />

        {/* Global FX bus controls */}
        <div className="flex w-24 shrink-0 flex-col gap-1 rounded border border-border bg-background p-1.5">
          <div className="readout text-center text-[9px] uppercase tracking-wider text-primary">FX</div>
          <MiniKnob
            label="Rev decay" value={reverbDecay} min={0.3} max={6} step={0.1}
            fmt={(v) => `${v.toFixed(1)}s`}
            onChange={(v) => { setReverbDecay(v); engine.setReverbDecay(v); }}
          />
          <MiniKnob
            label="Rev mix" value={reverbMix} min={0} max={1.5} step={0.01}
            fmt={(v) => `${Math.round(v * 100)}`}
            onChange={(v) => { setReverbMix(v); engine.setReverbMix(v); }}
          />
          <MiniKnob
            label="Dly time" value={delayTime} min={0.03} max={1.2} step={0.01}
            fmt={(v) => `${Math.round(v * 1000)}ms`}
            onChange={(v) => { setDelayTime(v); engine.setDelayTime(v); }}
          />
          <MiniKnob
            label="Dly fb" value={delayFb} min={0} max={0.9} step={0.01}
            fmt={(v) => `${Math.round(v * 100)}`}
            onChange={(v) => { setDelayFb(v); engine.setDelayFeedback(v); }}
          />
          <MiniKnob
            label="Dly mix" value={delayMix} min={0} max={1.5} step={0.01}
            fmt={(v) => `${Math.round(v * 100)}`}
            onChange={(v) => { setDelayMix(v); engine.setDelayMix(v); }}
          />
        </div>

        <div className="w-px shrink-0 self-stretch bg-border" />

        {pattern.tracks.map((t) => <TrackStrip key={t.id} t={t} />)}
      </div>
    </div>
  );
}
