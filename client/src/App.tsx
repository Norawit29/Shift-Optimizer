import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/context/LanguageContext";
import { AuthProvider } from "@/context/AuthContext";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/HomePage";
import { lazy, Suspense, startTransition, useEffect, useState } from "react";

const LazyWizardPage = lazy(() => import("@/pages/WizardPage"));
const LazyArticlesPage = lazy(() => import("@/pages/ArticlesPage"));
const LazyArticlePage = lazy(() => import("@/pages/ArticlePage"));
const LazyHistoryPage = lazy(() => import("@/pages/HistoryPage"));
const LazyScheduleDetailPage = lazy(() => import("@/pages/ScheduleDetailPage"));

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
            <Router />
          </TooltipProvider>
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
