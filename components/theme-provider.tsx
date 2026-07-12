"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_THEME, STORAGE_KEY, THEMES } from "@/lib/themes";

type Ctx = {
  theme: string;
  setTheme: (id: string) => void;
  cycle: () => void;
  toggleMode: () => void;
};

const ThemeCtx = createContext<Ctx>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  cycle: () => {},
  toggleMode: () => {},
});

export function useThemeScene() {
  return useContext(ThemeCtx);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<string>(DEFAULT_THEME);

  useEffect(() => {
    const current =
      document.documentElement.getAttribute("data-theme") || DEFAULT_THEME;
    setThemeState(current);
  }, []);

  const setTheme = useCallback((id: string) => {
    document.documentElement.setAttribute("data-theme", id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
    setThemeState(id);
  }, []);

  const cycle = useCallback(() => {
    setThemeState((prev) => {
      const idx = THEMES.findIndex((t) => t.id === prev);
      const next = THEMES[(idx + 1) % THEMES.length];
      document.documentElement.setAttribute("data-theme", next.id);
      try {
        localStorage.setItem(STORAGE_KEY, next.id);
      } catch {}
      return next.id;
    });
  }, []);

  const toggleMode = useCallback(() => {
    setThemeState((prev) => {
      const cur = THEMES.find((t) => t.id === prev) ?? THEMES[0];
      // jump to the first theme of the opposite mode
      const target =
        THEMES.find((t) => t.mode !== cur.mode) ?? THEMES[0];
      document.documentElement.setAttribute("data-theme", target.id);
      try {
        localStorage.setItem(STORAGE_KEY, target.id);
      } catch {}
      return target.id;
    });
  }, []);

  return (
    <ThemeCtx.Provider value={{ theme, setTheme, cycle, toggleMode }}>
      {children}
    </ThemeCtx.Provider>
  );
}
