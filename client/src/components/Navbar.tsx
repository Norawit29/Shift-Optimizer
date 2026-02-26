import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { LazyMotion, domAnimation, AnimatePresence, m } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAuth } from "@/context/AuthContext";
import { GoogleSignInButton, UserMenu } from "@/components/GoogleSignIn";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  isHomePage?: boolean;
}

export function Navbar({ isHomePage }: NavbarProps) {
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  const isArticlesActive = location.startsWith("/articles");

  const sectionLinks = [
    { label: t.navHowItWorks, href: "#how-it-works", id: "how-it-works" },
    { label: t.navFeatures, href: "#features", id: "features" },
    { label: t.navAbout, href: "#about", id: "about" },
    { label: t.navFaq, href: "#faq", id: "faq" },
  ];

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  const handleSectionClick = (e: React.MouseEvent, href: string, sectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const wasMobileOpen = mobileMenuOpen;
    setMobileMenuOpen(false);
    if (isHomePage) {
      history.replaceState(null, "", href);
      const delay = wasMobileOpen ? 350 : 0;
      setTimeout(() => {
        scrollToSection(sectionId);
      }, delay);
    } else {
      window.location.href = `/${href}`;
    }
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    if (isHomePage) {
      e.preventDefault();
      history.replaceState(null, "", window.location.pathname);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <header>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg border-b border-slate-100 dark:border-slate-800/50" style={{ minHeight: "72px" }} aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between gap-6">
          {isHomePage ? (
            <a href="#" onClick={handleLogoClick} className="flex items-center gap-3 min-w-0 shrink-0">
              <div className="w-10 h-10 shrink-0" data-testid="logo-icon">
                <img src="/favicon.svg" alt="โปรแกรมจัดตารางเวร Shift Optimizer" width="40" height="40" className="w-10 h-10 rounded-lg" />
              </div>
              <div className="hidden sm:flex flex-col leading-tight min-w-0" data-testid="text-app-name">
                <span className="font-display font-bold text-base text-slate-900 dark:text-white truncate">{t.appName}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{t.appTagline}</span>
              </div>
            </a>
          ) : (
            <Link href="/" className="flex items-center gap-3 min-w-0 shrink-0">
              <div className="w-10 h-10 shrink-0" data-testid="logo-icon">
                <img src="/favicon.svg" alt="โปรแกรมจัดตารางเวร Shift Optimizer" width="40" height="40" className="w-10 h-10 rounded-lg" />
              </div>
              <div className="hidden sm:flex flex-col leading-tight min-w-0" data-testid="text-app-name">
                <span className="font-display font-bold text-base text-slate-900 dark:text-white truncate">{t.appName}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{t.appTagline}</span>
              </div>
            </Link>
          )}

          <div className="hidden lg:flex items-center gap-1.5">
            {sectionLinks.map((item) => (
              <a
                key={item.id}
                href={isHomePage ? item.href : `/${item.href}`}
                onClick={(e) => handleSectionClick(e, item.href, item.id)}
                className="px-3.5 py-2 text-[15px] font-medium text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors rounded-lg"
                data-testid={`nav-link-${item.id}`}
              >
                {item.label}
              </a>
            ))}
            {isArticlesActive ? (
              <span className="px-3.5 py-2 text-[15px] font-semibold text-primary rounded-lg" data-testid="nav-link-articles-active">
                {t.navArticles}
              </span>
            ) : (
              <Link href="/articles" className="px-3.5 py-2 text-[15px] font-medium text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors rounded-lg" data-testid="nav-link-articles">
                {t.navArticles}
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle menu"
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <LanguageToggle />
            {!loading && (user ? <UserMenu /> : <GoogleSignInButton />)}
            <Link href="/create" className="hidden sm:block">
              <Button size="lg" className="shadow-lg shadow-primary/25 text-base px-5" data-testid="button-nav-cta">
                {t.getStartedFree}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <LazyMotion features={domAnimation}>
          <AnimatePresence>
            {mobileMenuOpen && (
              <m.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="lg:hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-lg border-t border-slate-100 dark:border-slate-800/50 overflow-hidden"
              >
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-1">
                  {sectionLinks.map((item) => (
                    <a
                      key={item.id}
                      href={isHomePage ? item.href : `/${item.href}`}
                      onClick={(e) => handleSectionClick(e, item.href, item.id)}
                      className="px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors rounded-lg"
                    >
                      {item.label}
                    </a>
                  ))}
                  {isArticlesActive ? (
                    <span className="px-3 py-2.5 text-sm font-semibold text-primary rounded-lg">
                      {t.navArticles}
                    </span>
                  ) : (
                    <Link href="/articles" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors rounded-lg">
                      {t.navArticles}
                    </Link>
                  )}
                  <Link href="/create" onClick={() => setMobileMenuOpen(false)} className="mt-2">
                    <Button size="sm" className="w-full shadow-sm" data-testid="button-nav-cta-mobile">
                      {t.getStartedFree}
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </LazyMotion>
      </nav>
    </header>
  );
}
