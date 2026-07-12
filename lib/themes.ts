export type ThemeMode = "dark" | "light";

export type Theme = {
  id: string;
  name: string;
  mode: ThemeMode;
  /** [background, foreground, accent] swatch preview */
  swatch: [string, string, string];
  blurb: string;
};

export const THEMES: Theme[] = [
  {
    id: "carbon",
    name: "Carbon",
    mode: "dark",
    swatch: ["#0b0c0e", "#eef1f4", "#b9ff3a"],
    blurb: "Charcoal + acid lime",
  },
  {
    id: "ember",
    name: "Ember",
    mode: "dark",
    swatch: ["#100b08", "#f6ede6", "#ff6a3d"],
    blurb: "Warm black + molten orange",
  },
  {
    id: "cobalt",
    name: "Cobalt",
    mode: "dark",
    swatch: ["#070a12", "#e9effd", "#38e1ff"],
    blurb: "Deep ink + electric cyan",
  },
  {
    id: "plum",
    name: "Plum",
    mode: "dark",
    swatch: ["#0c0812", "#f3ecfb", "#cf90ff"],
    blurb: "Midnight + violet",
  },
  {
    id: "paper",
    name: "Paper",
    mode: "light",
    swatch: ["#f2eee4", "#1a1611", "#e5432a"],
    blurb: "Warm cream + vermillion",
  },
  {
    id: "bone",
    name: "Bone",
    mode: "light",
    swatch: ["#ffffff", "#0a0a0a", "#0a0a0a"],
    blurb: "Clean mono white",
  },
];

export const DEFAULT_THEME = "carbon";
export const STORAGE_KEY = "saleh-theme";

/** Inline script (runs before paint) — no flash of wrong theme. */
export const NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var ok=${JSON.stringify(
  THEMES.map((t) => t.id)
)};if(!t||ok.indexOf(t)<0){t='${DEFAULT_THEME}';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','${DEFAULT_THEME}');}})();`;
