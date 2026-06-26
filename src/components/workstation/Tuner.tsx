import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Play, Square } from "lucide-react";

/**
 * Tuner + Metronome panel.
 *
 *  - Metronome: scheduled OscillatorNode clicks at chosen BPM, time
 *    signature, with an accented downbeat. Uses Wilson-style lookahead.
 *
 *  - Tuner: mic-driven pitch detection via autocorrelation (no extra deps).
 *    Reports the nearest target note from the selected instrument preset
 *    plus a cents offset and ↑/↓ arrow indicating tightening direction.
 */

// ===== Instrument tuning presets =====
// MIDI note numbers for each open string.
const TUNING_PRESETS: Array<{ id: string; name: string; notes: number[] }> = [
  { id: "guitar-std", name: "Guitar — Standard EADGBE", notes: [40, 45, 50, 55, 59, 64] },
  { id: "guitar-dropd", name: "Guitar — Drop D",        notes: [38, 45, 50, 55, 59, 64] },
  { id: "guitar-halfdown", name: "Guitar — ½ Step Down", notes: [39, 44, 49, 54, 58, 63] },
  { id: "bass-std", name: "Bass — Standard EADG",       notes: [28, 33, 38, 43] },
  { id: "bass-5",   name: "Bass — 5-String BEADG",      notes: [23, 28, 33, 38, 43] },
  { id: "ukulele",  name: "Ukulele — GCEA",             notes: [67, 60, 64, 69] },
  { id: "violin",   name: "Violin — GDAE",              notes: [55, 62, 69, 76] },
  { id: "viola",    name: "Viola — CGDA",               notes: [48, 55, 62, 69] },
  { id: "cello",    name: "Cello — CGDA",               notes: [36, 43, 50, 57] },
  { id: "mandolin", name: "Mandolin — GDAE",            notes: [55, 62, 69, 76] },
  { id: "banjo",    name: "Banjo — gDGBD",              notes: [67, 50, 55, 59, 62] },
  { id: "chromatic", name: "Chromatic",                 notes: [] },
];

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function midiToName(midi: number): string {
  const n = NOTE_NAMES[((midi % 12) + 12) % 12];
  const oct = Math.floor(midi / 12) - 1;
  return `${n}${oct}`;
}
function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

/** Autocorrelation pitch detection (Chris Wilson pattern). */
function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  let SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = SIZE - 1; const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  buf = buf.slice(r1, r2);
  SIZE = buf.length;

  const c = new Array(SIZE).fill(0);
  for (let i = 0; i < SIZE; i++)
    for (let j = 0; j < SIZE - i; j++)
      c[i] = c[i] + buf[j] * buf[j + i];

  let d = 0; while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }
  let T0 = maxpos;
  if (T0 <= 0) return -1;
  const x1 = c[T0 - 1] ?? 0, x2 = c[T0] ?? 0, x3 = c[T0 + 1] ?? 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);
  return sampleRate / T0;
}

export function TunerPanel() {
  // ---------- Metronome ----------
  const [bpm, setBpm] = useState(100);
  const [beats, setBeats] = useState(4);
  const [running, setRunning] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const nextNoteTime = useRef(0);
  const beatCount = useRef(0);
  const [tickIdx, setTickIdx] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------- Tuner ----------
  const [presetId, setPresetId] = useState("guitar-std");
  const preset = TUNING_PRESETS.find((p) => p.id === presetId) ?? TUNING_PRESETS[0];
  const [listening, setListening] = useState(false);
  const [pitch, setPitch] = useState<{ hz: number; midi: number; cents: number; target: number } | null>(null);
  const tunerCtx = useRef<AudioContext | null>(null);
  const tunerStream = useRef<MediaStream | null>(null);
  const tunerNode = useRef<AnalyserNode | null>(null);
  const tunerRAF = useRef<number | null>(null);
  const presetRef = useRef(preset);
  presetRef.current = preset;

  // ===== Metronome scheduler =====
  useEffect(() => {
    if (!running) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      beatCount.current = 0;
      setTickIdx(-1);
      return;
    }
    const ctx = ctxRef.current ?? new AudioContext();
    ctxRef.current = ctx;
    if (ctx.state === "suspended") void ctx.resume();
    nextNoteTime.current = ctx.currentTime + 0.05;
    beatCount.current = 0;

    const scheduleClick = (time: number, accent: boolean) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.value = accent ? 1500 : 900;
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(accent ? 0.7 : 0.4, time + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
      osc.connect(g).connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.06);
    };

    timerRef.current = setInterval(() => {
      const spb = 60 / bpm;
      while (nextNoteTime.current < ctx.currentTime + 0.1) {
        const idx = beatCount.current % beats;
        scheduleClick(nextNoteTime.current, idx === 0);
        const ahead = nextNoteTime.current - ctx.currentTime;
        const capture = idx;
        setTimeout(() => setTickIdx(capture), Math.max(0, ahead * 1000));
        nextNoteTime.current += spb;
        beatCount.current += 1;
      }
    }, 25);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [running, bpm, beats]);

  // ===== Tuner mic loop =====
  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      tunerStream.current = stream;
      const ctx = new AudioContext();
      tunerCtx.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      src.connect(an);
      tunerNode.current = an;
      setListening(true);

      const buf = new Float32Array(an.fftSize);
      const loop = () => {
        if (!tunerNode.current) return;
        tunerNode.current.getFloatTimeDomainData(buf);
        const hz = autoCorrelate(buf, ctx.sampleRate);
        if (hz > 0 && hz < 2000) {
          const midiF = hzToMidi(hz);
          const nearest = Math.round(midiF);
          let target = nearest;
          const pr = presetRef.current;
          if (pr && pr.notes.length > 0) {
            target = pr.notes.reduce((a, b) =>
              Math.abs(b - midiF) < Math.abs(a - midiF) ? b : a,
            );
          }
          const cents = (midiF - target) * 100;
          setPitch({ hz, midi: nearest, cents, target });
        }
        tunerRAF.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      console.warn("Tuner mic error", e);
      setListening(false);
    }
  };
  const stopListening = () => {
    setListening(false);
    if (tunerRAF.current) cancelAnimationFrame(tunerRAF.current);
    tunerRAF.current = null;
    tunerStream.current?.getTracks().forEach((t) => t.stop());
    tunerStream.current = null;
    void tunerCtx.current?.close();
    tunerCtx.current = null;
    tunerNode.current = null;
    setPitch(null);
  };
  useEffect(() => () => stopListening(), []);

  const cents = pitch?.cents ?? 0;
  const inTune = !!pitch && Math.abs(cents) < 5;
  const direction = cents > 0 ? "↓ tune down" : cents < 0 ? "↑ tune up" : "in tune";
  const meterPct = Math.max(-50, Math.min(50, cents)) + 50;

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Tuner &amp; Metronome</h2>
      </div>

      {/* ===== Metronome ===== */}
      <section className="rounded border border-border bg-background p-3">
        <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Metronome</div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setRunning((v) => !v)}
            className="flex items-center gap-1 rounded border border-border bg-secondary px-2 py-1 text-xs uppercase tracking-wider hover:bg-primary hover:text-primary-foreground"
          >
            {running ? <><Square className="h-3 w-3" /> Stop</> : <><Play className="h-3 w-3" /> Start</>}
          </button>
          <label className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
            BPM
            <input
              type="number" min={30} max={300} value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="readout w-14 rounded border border-border bg-background px-1 py-0.5 text-right text-xs"
            />
          </label>
          <label className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
            Beats
            <select
              value={beats} onChange={(e) => setBeats(Number(e.target.value))}
              className="readout rounded border border-border bg-background px-1 py-0.5 text-xs"
            >
              {[2,3,4,5,6,7,8].map((n) => <option key={n} value={n}>{n}/4</option>)}
            </select>
          </label>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: beats }).map((_, i) => (
            <div
              key={i}
              className={`h-3 flex-1 rounded transition ${
                tickIdx === i
                  ? i === 0 ? "bg-accent shadow-[0_0_10px_var(--color-accent)]" : "bg-primary"
                  : "bg-secondary"
              }`}
            />
          ))}
        </div>
      </section>

      {/* ===== Tuner ===== */}
      <section className="rounded border border-border bg-background p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Instrument tuner</div>
          <button
            onClick={() => (listening ? stopListening() : void startListening())}
            className="flex items-center gap-1 rounded border border-border bg-secondary px-2 py-1 text-xs uppercase tracking-wider hover:bg-primary hover:text-primary-foreground"
          >
            {listening ? <><MicOff className="h-3 w-3" /> Stop mic</> : <><Mic className="h-3 w-3" /> Listen</>}
          </button>
        </div>
        <select
          value={presetId}
          onChange={(e) => setPresetId(e.target.value)}
          className="readout mb-3 w-full rounded border border-border bg-background px-2 py-1 text-xs"
        >
          {TUNING_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {!listening && (
          <p className="text-[10px] text-muted-foreground">
            Click &quot;Listen&quot; and grant microphone access. Play one string at a time;
            the tuner snaps to the nearest string in the selected preset and shows
            how many cents to adjust.
          </p>
        )}

        {listening && (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <div className="readout text-3xl font-bold leading-none text-primary">
                  {pitch ? midiToName(pitch.target) : "—"}
                </div>
                <div className="mt-1 text-[10px] uppercase text-muted-foreground">
                  Target {pitch ? `${midiToHz(pitch.target).toFixed(2)} Hz` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="readout text-xl">
                  {pitch ? `${pitch.hz.toFixed(1)} Hz` : "—"}
                </div>
                <div className={`text-[11px] uppercase tracking-wider ${inTune ? "text-primary" : "text-accent"}`}>
                  {pitch ? `${cents > 0 ? "+" : ""}${cents.toFixed(0)}¢ ${inTune ? "✓" : direction}` : "play a note"}
                </div>
              </div>
            </div>

            <div className="relative h-4 rounded border border-border bg-background">
              <div className="absolute inset-y-0 left-1/2 w-px bg-muted-foreground/60" />
              {[10,20,30,40].map((p) => (
                <div key={`l${p}`} className="absolute inset-y-1 w-px bg-muted-foreground/30" style={{ left: `${50 - p}%` }} />
              ))}
              {[10,20,30,40].map((p) => (
                <div key={`r${p}`} className="absolute inset-y-1 w-px bg-muted-foreground/30" style={{ left: `${50 + p}%` }} />
              ))}
              {pitch && (
                <div
                  className={`absolute top-0 h-full w-1 rounded ${inTune ? "bg-primary shadow-[0_0_8px_var(--color-primary)]" : "bg-accent"}`}
                  style={{ left: `calc(${meterPct}% - 2px)` }}
                />
              )}
            </div>
            <div className="flex justify-between text-[9px] uppercase text-muted-foreground">
              <span>-50¢</span><span>flat</span><span>0</span><span>sharp</span><span>+50¢</span>
            </div>
            {pitch && Math.abs(cents) >= 5 && (
              <p className="text-[11px] text-muted-foreground">
                Adjust ~<strong className="text-foreground">{Math.abs(cents).toFixed(0)} cents</strong>{" "}
                {cents > 0 ? "down (loosen)" : "up (tighten)"} to reach {midiToName(pitch.target)}.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
