import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import { AuthProvider } from "@/context/AuthContext";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/HomePage";
import { lazy, Suspense, startTransition, useEffect, useState } from "react";

const LazyWizardPage = lazy(() => import("@/pages/WizardPage"));
const LazyArticlesPage = lazy(() => import("@/pages/ArticlesPage"));
const LazyArticlePage = lazy(() => import("@/pages/ArticlePage"));
const LazyCaseStudiesPage = lazy(() => import("@/pages/CaseStudiesPage"));
const LazyCaseStudyPage = lazy(() => import("@/pages/CaseStudyPage"));
const LazyHistoryPage = lazy(() => import("@/pages/HistoryPage"));
const LazyScheduleDetailPage = lazy(() => import("@/pages/ScheduleDetailPage"));

const BASE_URL = "https://shift-optimizer.com";

function HeadManager() {
  const [location] = useLocation();
  const { lang } = useLanguage();

  useEffect(() => {
    const path = location === "/" ? "/" : location;
    const thUrl = `${BASE_URL}${path}`;
    const enUrl = `${BASE_URL}${path}?lang=en`;
    const canonicalUrl = lang === "en" ? enUrl : thUrl;

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical) {
      canonical.href = canonicalUrl;
    }

    let hreflangTh = document.querySelector('link[hreflang="th"]') as HTMLLinkElement | null;
    if (hreflangTh) hreflangTh.href = thUrl;

    let hreflangEn = document.querySelector('link[hreflang="en"]') as HTMLLinkElement | null;
    if (hreflangEn) hreflangEn.href = enUrl;

    let hreflangDefault = document.querySelector('link[hreflang="x-default"]') as HTMLLinkElement | null;
    if (hreflangDefault) hreflangDefault.href = thUrl;

    document.documentElement.lang = lang === "en" ? "en" : "th";
  }, [location, lang]);

  return null;
}

function WizardPageLoader() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    startTransition(() => setReady(true));
  }, []);
  if (!ready) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
      <LazyWizardPage exportOnly />
    </Suspense>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/create" component={WizardPageLoader} />
      <Route path="/articles">{() => <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}><LazyArticlesPage /></Suspense>}</Route>
      <Route path="/articles/:slug">{() => <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}><LazyArticlePage /></Suspense>}</Route>
      <Route path="/case-studies">{() => <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}><LazyCaseStudiesPage /></Suspense>}</Route>
      <Route path="/case-studies/:slug">{() => <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}><LazyCaseStudyPage /></Suspense>}</Route>
      <Route path="/history">{() => <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}><LazyHistoryPage /></Suspense>}</Route>
      <Route path="/schedule/:id">{() => <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}><LazyScheduleDetailPage /></Suspense>}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <HeadManager />
            <Router />
          </TooltipProvider>
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
