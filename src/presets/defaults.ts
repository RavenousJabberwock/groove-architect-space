/**
 * Default kit, synth patch, and pattern bundled with the app.
 */

import { emptyStep, makeTrack, type Pattern, type Step } from "../sequencer/types";

const onStep = (overrides: Partial<Step> = {}): Step => ({
  ...emptyStep(),
  active: true,
  ...overrides,
});

export function defaultPattern(): Pattern {
  const kick = makeTrack("t-kick", "KICK", "kick", 36, 10);
  kick.steps = [
    onStep(), emptyStep(), emptyStep(), emptyStep(),
    onStep(), emptyStep(), emptyStep(), emptyStep(),
    onStep(), emptyStep(), emptyStep(), emptyStep(),
    onStep(), emptyStep(), emptyStep(), emptyStep(),
  ];

  const snare = makeTrack("t-snare", "SNARE", "snare", 38, 10);
  snare.steps = [
    emptyStep(), emptyStep(), emptyStep(), emptyStep(),
    onStep(), emptyStep(), emptyStep(), emptyStep(),
    emptyStep(), emptyStep(), emptyStep(), emptyStep(),
    onStep(), emptyStep(), emptyStep(), emptyStep(),
  ];

  const hat = makeTrack("t-hat", "HAT", "hat", 42, 10);
  hat.steps = Array.from({ length: 16 }, (_, i) =>
    i % 2 === 0 ? onStep({ velocity: 0.6, probability: 90 }) : emptyStep(),
  );

  const clap = makeTrack("t-clap", "CLAP", "clap", 39, 10);
  const tom = makeTrack("t-tom", "TOM", "tom", 41, 10);
  const perc = makeTrack("t-perc", "PERC", "perc", 75, 10);

  const synth = makeTrack("t-synth", "SYNTH", "synth", 48, 1);
  synth.length = 16;
  synth.steps = [
    onStep({ note: 48 }), emptyStep(), emptyStep(), onStep({ note: 55 }),
    emptyStep(), emptyStep(), onStep({ note: 51, condition: "1:2" }), emptyStep(),
    onStep({ note: 48 }), emptyStep(), emptyStep(), onStep({ note: 60, probability: 60 }),
    emptyStep(), onStep({ note: 58 }), emptyStep(), emptyStep(),
  ];

  return {
    id: "p-default",
    name: "INIT",
    bpm: 120,
    swing: 0.08,
    tracks: [kick, snare, hat, clap, tom, perc, synth],
  };
}
