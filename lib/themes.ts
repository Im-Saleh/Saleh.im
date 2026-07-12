export type ThemeMode = "dark" | "light";

export type Theme = {
  id: string;
  name: string;
  nameFa: string;
  mode: ThemeMode;
  /** [background, foreground, accent] swatch preview */
  swatch: [string, string, string];
  blurb: string;
  blurbFa: string;
};

export const THEMES: Theme[] = [
  {
    id: "carbon",
    name: "Carbon",
    nameFa: "کربن",
    mode: "dark",
    swatch: ["#0b0c0e", "#eef1f4", "#b9ff3a"],
    blurb: "Charcoal + acid lime",
    blurbFa: "زغالی + سبز لیمویی",
  },
  {
    id: "paper",
    name: "Paper",
    nameFa: "کاغذ",
    mode: "light",
    swatch: ["#f2eee4", "#1a1611", "#e5432a"],
    blurb: "Warm cream + vermillion",
    blurbFa: "کرم گرم + شنگرف",
  },
];

export const DEFAULT_THEME = "carbon";
export const STORAGE_KEY = "saleh-theme";

/** Inline script (runs before paint) — no flash of wrong theme. */
export const NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var ok=${JSON.stringify(
  THEMES.map((t) => t.id)
)};if(!t||ok.indexOf(t)<0){t='${DEFAULT_THEME}';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','${DEFAULT_THEME}');}})();`;
