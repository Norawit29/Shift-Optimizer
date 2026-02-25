import { Link } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAuth } from "@/context/AuthContext";
import { GoogleSignInButton, UserMenu } from "@/components/GoogleSignIn";

export default function ArticlesPage() {
  const { t, lang } = useLanguage();
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <header>
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg border-b border-slate-100 dark:border-slate-800/50" style={{ minHeight: "72px" }} aria-label="Main navigation">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-3 min-w-0 shrink-0">
              <div className="w-10 h-10 shrink-0" data-testid="logo-icon">
                <img src="/favicon.svg" alt="Shift Optimizer Logo" width="40" height="40" className="w-10 h-10 rounded-lg" />
              </div>
              <div className="hidden sm:flex flex-col leading-tight min-w-0" data-testid="text-app-name">
                <span className="font-display font-bold text-base text-slate-900 dark:text-white truncate">{t.appName}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{t.appTagline}</span>
              </div>
            </Link>
            <div className="hidden lg:flex items-center gap-1.5">
              <a href="/#how-it-works" className="px-3.5 py-2 text-[15px] font-medium text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors rounded-lg">
                {t.navHowItWorks}
              </a>
              <a href="/#features" className="px-3.5 py-2 text-[15px] font-medium text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors rounded-lg">
                {t.navFeatures}
              </a>
              <a href="/#about" className="px-3.5 py-2 text-[15px] font-medium text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors rounded-lg">
                {t.navAbout}
              </a>
              <a href="/#faq" className="px-3.5 py-2 text-[15px] font-medium text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors rounded-lg">
                {t.navFaq}
              </a>
              <span className="px-3.5 py-2 text-[15px] font-semibold text-primary rounded-lg" data-testid="nav-link-articles-active">
                {t.navArticles}
              </span>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <LanguageToggle />
              {!loading && (user ? <UserMenu /> : <GoogleSignInButton />)}
            </div>
          </div>
        </nav>
      </header>

      <main className="pt-28 pb-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
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
