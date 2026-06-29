import { create } from "zustand";
import type { Lang } from "../lib/i18n";

function getInitialLang(): Lang {
  const stored = localStorage.getItem("wf-nexus-lang");
  if (stored === "en" || stored === "ru") return stored;
  return "en";
}

interface LangStore {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLangStore = create<LangStore>((set) => ({
  lang: getInitialLang(),
  setLang: (lang: Lang) => {
    localStorage.setItem("wf-nexus-lang", lang);
    set({ lang });
  },
}));
