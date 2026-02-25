import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";

export default function ArticlesPage() {
  const { t, lang } = useLanguage();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg border-b border-slate-100 dark:border-slate-800/50" style={{ minHeight: "64px" }} aria-label="Main navigation">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 min-w-0 shrink-0">
            <div className="w-8 h-8 shrink-0">
              <img src="/favicon.svg" alt="Shift Optimizer Logo" width="32" height="32" className="w-8 h-8 rounded-lg" />
            </div>
            <div className="hidden sm:flex flex-col leading-tight min-w-0">
              <span className="font-display font-bold text-sm text-slate-900 dark:text-white truncate">{t.appName}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{t.appTagline}</span>
            </div>
          </Link>
          <LanguageToggle />
        </div>
      </nav>

      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6 gap-1.5" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              {t.appName}
            </Button>
          </Link>

          <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 dark:text-white mb-8" data-testid="text-articles-title">
            {t.navArticles}
          </h1>

          <div className="text-center py-20 text-slate-500 dark:text-slate-400">
            <p className="text-lg" data-testid="text-articles-coming-soon">
              {lang === "th" ? "เร็วๆ นี้..." : "Coming soon..."}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
