import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { type Lang, type Translations, getTranslations, getDayNames } from "@/lib/i18n";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translations;
  dayNames: string[];
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("app-lang");
    return (saved === "th" ? "th" : "en") as Lang;
  });

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem("app-lang", newLang);
  }, []);

  const t = getTranslations(lang);
  const dayNames = getDayNames(lang);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dayNames }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
