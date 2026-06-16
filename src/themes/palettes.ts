/**
 * UI palettes. Each palette overrides a subset of CSS custom properties
 * defined in src/styles.css. Apply with applyPalette(id).
 */

export interface Palette {
  id: string;
  name: string;
  description: string;
  /** Swatches shown in the Configure dialog. */
  swatch: string[];
  vars: Record<string, string>;
}

export const PALETTES: Palette[] = [
  {
    id: "amber",
    name: "Amber (Elektron)",
    description: "OLED black, amber primary, red accent, phosphor green readout",
    swatch: ["#0a0a0a", "#f0a830", "#e94f3a", "#9ef07a"],
    vars: {
      "--background": "oklch(0.12 0 0)",
      "--card": "oklch(0.16 0 0)",
      "--primary": "oklch(0.78 0.15 75)",
      "--primary-foreground": "oklch(0.12 0 0)",
      "--accent": "oklch(0.62 0.22 25)",
      "--ring": "oklch(0.78 0.15 75)",
      "--panel": "oklch(0.155 0 0)",
      "--step-active": "oklch(0.78 0.15 75)",
      "--step-playing": "oklch(0.62 0.22 25)",
      "--readout": "oklch(0.85 0.18 145)",
    },
  },
  {
    id: "phosphor",
    name: "Phosphor",
    description: "All-green CRT terminal feel",
    swatch: ["#050a05", "#9ef07a", "#4ad04a", "#bff5a8"],
    vars: {
      "--background": "oklch(0.1 0.02 145)",
      "--card": "oklch(0.14 0.02 145)",
      "--primary": "oklch(0.85 0.18 145)",
      "--primary-foreground": "oklch(0.1 0.02 145)",
      "--accent": "oklch(0.72 0.2 150)",
      "--ring": "oklch(0.85 0.18 145)",
      "--panel": "oklch(0.13 0.02 145)",
      "--step-active": "oklch(0.85 0.18 145)",
      "--step-playing": "oklch(0.72 0.2 150)",
      "--readout": "oklch(0.9 0.2 145)",
    },
  },
  {
    id: "cyan",
    name: "Cyan Lab",
    description: "Cold blue / cyan accents",
    swatch: ["#06121a", "#3fd0ff", "#ff5a8a", "#9be7ff"],
    vars: {
      "--background": "oklch(0.12 0.02 240)",
      "--card": "oklch(0.16 0.02 240)",
      "--primary": "oklch(0.78 0.14 220)",
      "--primary-foreground": "oklch(0.1 0.02 240)",
      "--accent": "oklch(0.7 0.22 350)",
      "--ring": "oklch(0.78 0.14 220)",
      "--panel": "oklch(0.155 0.02 240)",
      "--step-active": "oklch(0.78 0.14 220)",
      "--step-playing": "oklch(0.7 0.22 350)",
      "--readout": "oklch(0.88 0.14 220)",
    },
  },
  {
    id: "magenta",
    name: "Synthwave",
    description: "Magenta / violet neon",
    swatch: ["#10071a", "#ff4fd1", "#7d5cff", "#ffd166"],
    vars: {
      "--background": "oklch(0.12 0.04 300)",
      "--card": "oklch(0.16 0.04 300)",
      "--primary": "oklch(0.72 0.25 330)",
      "--primary-foreground": "oklch(0.1 0.02 300)",
      "--accent": "oklch(0.68 0.22 285)",
      "--ring": "oklch(0.72 0.25 330)",
      "--panel": "oklch(0.155 0.04 300)",
      "--step-active": "oklch(0.72 0.25 330)",
      "--step-playing": "oklch(0.68 0.22 285)",
      "--readout": "oklch(0.88 0.18 90)",
    },
  },
  {
    id: "mono",
    name: "Mono",
    description: "Neutral monochrome, low distraction",
    swatch: ["#0a0a0a", "#e5e5e5", "#888888", "#ffffff"],
    vars: {
      "--background": "oklch(0.11 0 0)",
      "--card": "oklch(0.15 0 0)",
      "--primary": "oklch(0.92 0 0)",
      "--primary-foreground": "oklch(0.1 0 0)",
      "--accent": "oklch(0.65 0 0)",
      "--ring": "oklch(0.92 0 0)",
      "--panel": "oklch(0.14 0 0)",
      "--step-active": "oklch(0.92 0 0)",
      "--step-playing": "oklch(0.7 0 0)",
      "--readout": "oklch(0.95 0 0)",
    },
  },
];

export function applyPalette(id: string) {
  const p = PALETTES.find((x) => x.id === id) ?? PALETTES[0];
  const root = document.documentElement;
  for (const [k, v] of Object.entries(p.vars)) {
    root.style.setProperty(k, v);
  }
}

export function paletteById(id: string): Palette {
  return PALETTES.find((x) => x.id === id) ?? PALETTES[0];
}
