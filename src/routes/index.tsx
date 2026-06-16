import { createFileRoute } from "@tanstack/react-router";
import { Workstation } from "@/components/workstation/Workstation";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hybrid Music Workstation" },
      {
        name: "description",
        content:
          "Modular browser-based music workstation — drum machine, synth, chaos pad, polymeter sequencer, MIDI.",
      },
      { property: "og:title", content: "Hybrid Music Workstation" },
      {
        property: "og:description",
        content: "Drum machine, synth, chaos pad, polymeter sequencer and MIDI in your browser.",
      },
    ],
  }),
  component: Workstation,
});
