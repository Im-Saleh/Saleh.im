"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_LANG, LANG_KEY, dict, type Lang } from "@/lib/i18n";

type Ctx = {
  lang: Lang;
  dir: "rtl" | "ltr";
  t: (typeof dict)[Lang];
  setLang: (l: Lang) => void;
  toggle: () => void;
};

const LangCtx = createContext<Ctx>({
  lang: DEFAULT_LANG,
  dir: "ltr",
  t: dict[DEFAULT_LANG],
  setLang: () => {},
  toggle: () => {},
});

export function useLang() {
  return useContext(LangCtx);
}

function apply(lang: Lang) {
  const el = document.documentElement;
  el.setAttribute("lang", lang);
  el.setAttribute("dir", lang === "fa" ? "rtl" : "ltr");
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {}
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    const cur = (document.documentElement.getAttribute("lang") as Lang) || DEFAULT_LANG;
    setLangState(cur === "fa" ? "fa" : "en");
  }, []);

  const setLang = useCallback((l: Lang) => {
    apply(l);
    setLangState(l);
  }, []);

  const toggle = useCallback(() => {
    setLangState((prev) => {
      const next: Lang = prev === "fa" ? "en" : "fa";
      apply(next);
      return next;
    });
  }, []);

  return (
    <LangCtx.Provider
      value={{ lang, dir: lang === "fa" ? "rtl" : "ltr", t: dict[lang], setLang, toggle }}
    >
      {children}
    </LangCtx.Provider>
  );
}
