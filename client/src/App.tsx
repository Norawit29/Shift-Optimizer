import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import { AuthProvider } from "@/context/AuthContext";
import { CookieBanner } from "@/components/CookieBanner";
import { FloatingLineButton } from "@/components/FloatingLineButton";
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
const LazyPricingPage = lazy(() => import("@/pages/PricingPage"));
const LazyPrivacyPolicyPage = lazy(() => import("@/pages/PrivacyPolicyPage"));
const LazyStaffSchedulingPage = lazy(() => import("@/pages/StaffSchedulingPage"));
const LazyStaffExcelPage = lazy(() => import("@/pages/StaffExcelPage"));
const LazyHowToSchedulePage = lazy(() => import("@/pages/HowToSchedulePage"));
const LazyRestaurantShiftPage = lazy(() => import("@/pages/RestaurantShiftPage"));

const BASE_URL = "https://shift-optimizer.com";

function HeadManager() {
  const [location] = useLocation();
  const { lang } = useLanguage();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("lang")) {
      params.delete("lang");
      const newSearch = params.toString();
      const cleanUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
      window.history.replaceState(null, "", cleanUrl);
    }
  }, [location]);

  useEffect(() => {
    const path = location === "/" ? "/" : location;
    const thUrl = `${BASE_URL}${path}`;

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical) canonical.href = thUrl;

    let hreflangTh = document.querySelector('link[hreflang="th"]') as HTMLLinkElement | null;
    if (hreflangTh) hreflangTh.href = thUrl;

    document.documentElement.lang = "th";
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
      <Route path="/pricing">{() => <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}><LazyPricingPage /></Suspense>}</Route>
      <Route path="/privacy-policy">{() => <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}><LazyPrivacyPolicyPage /></Suspense>}</Route>
      <Route path="/%E0%B9%82%E0%B8%9B%E0%B8%A3%E0%B9%81%E0%B8%81%E0%B8%A3%E0%B8%A1%E0%B8%88%E0%B8%B1%E0%B8%94%E0%B9%80%E0%B8%A7%E0%B8%A3%E0%B8%9E%E0%B8%99%E0%B8%B1%E0%B8%81%E0%B8%87%E0%B8%B2%E0%B8%99">{() => <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}><LazyStaffSchedulingPage /></Suspense>}</Route>
      <Route path="/โปรแกรมจัดเวรพนักงาน">{() => <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}><LazyStaffSchedulingPage /></Suspense>}</Route>
      <Route path="/%E0%B8%95%E0%B8%B2%E0%B8%A3%E0%B8%B2%E0%B8%87%E0%B9%80%E0%B8%A7%E0%B8%A3%E0%B8%9E%E0%B8%99%E0%B8%B1%E0%B8%81%E0%B8%87%E0%B8%B2%E0%B8%99-excel">{() => <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}><LazyStaffExcelPage /></Suspense>}</Route>
      <Route path="/ตารางเวรพนักงาน-excel">{() => <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}><LazyStaffExcelPage /></Suspense>}</Route>
      <Route path="/%E0%B8%A7%E0%B8%B4%E0%B8%98%E0%B8%B5%E0%B8%88%E0%B8%B1%E0%B8%94%E0%B8%95%E0%B8%B2%E0%B8%A3%E0%B8%B2%E0%B8%87%E0%B9%80%E0%B8%A7%E0%B8%A3%E0%B8%9E%E0%B8%99%E0%B8%B1%E0%B8%81%E0%B8%87%E0%B8%B2%E0%B8%99">{() => <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}><LazyHowToSchedulePage /></Suspense>}</Route>
      <Route path="/วิธีจัดตารางเวรพนักงาน">{() => <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}><LazyHowToSchedulePage /></Suspense>}</Route>
      <Route path="/%E0%B8%95%E0%B8%B2%E0%B8%A3%E0%B8%B2%E0%B8%87%E0%B9%80%E0%B8%A7%E0%B8%A3%E0%B8%A3%E0%B9%89%E0%B8%B2%E0%B8%99%E0%B8%AD%E0%B8%B2%E0%B8%AB%E0%B8%B2%E0%B8%A3">{() => <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}><LazyRestaurantShiftPage /></Suspense>}</Route>
      <Route path="/ตารางเวรร้านอาหาร">{() => <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}><LazyRestaurantShiftPage /></Suspense>}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function FloatingHelper() {
  const [location] = useLocation();
  if (!location.startsWith("/create")) return null;
  return <FloatingLineButton />;
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
            <FloatingHelper />
            <CookieBanner />
          </TooltipProvider>
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
