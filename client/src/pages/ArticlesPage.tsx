import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Calendar } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAuth } from "@/context/AuthContext";
import { GoogleSignInButton, UserMenu } from "@/components/GoogleSignIn";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";

interface Article {
  _id: string;
  title: string;
  slug: { current: string };
  excerpt?: string;
  coverImage?: string;
  publishedAt?: string;
  language?: string;
}

export default function ArticlesPage() {
  const { t, lang } = useLanguage();
  const { user, loading } = useAuth();

  const { data: articles, isLoading } = useQuery<Article[]>({
    queryKey: ["/api/articles"],
  });

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d MMM yyyy", { locale: lang === "th" ? th : enUS });
    } catch {
      return dateStr;
    }
  };

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
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 dark:text-white mb-10" data-testid="text-articles-title">
            {t.navArticles}
          </h1>

          {isLoading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="flex flex-col sm:flex-row">
                    <div className="sm:w-56 h-40 sm:h-auto bg-slate-200 dark:bg-slate-800 shrink-0" />
                    <div className="p-6 flex-1 space-y-3">
                      <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full" />
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : !articles || articles.length === 0 ? (
            <div className="text-center py-20 text-slate-500 dark:text-slate-400">
              <p className="text-lg" data-testid="text-articles-empty">{t.articlesEmpty}</p>
            </div>
          ) : (
            <div className="space-y-6" data-testid="articles-list">
              {articles.map((article) => (
                <Link
                  key={article._id}
                  href={`/articles/${article.slug?.current || ""}`}
                  className="block group"
                  data-testid={`article-card-${article._id}`}
                >
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-shadow duration-300 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 bg-white dark:bg-slate-900">
                    <div className="flex flex-col sm:flex-row">
                      {article.coverImage && (
                        <div className="sm:w-56 h-48 sm:h-auto shrink-0 overflow-hidden">
                          <img
                            src={article.coverImage}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="p-6 flex-1 flex flex-col justify-center">
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-primary transition-colors" data-testid={`article-title-${article._id}`}>
                          {article.title}
                        </h2>
                        {article.excerpt && (
                          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-3 line-clamp-2" data-testid={`article-excerpt-${article._id}`}>
                            {article.excerpt}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-auto">
                          {article.publishedAt && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                              {formatDate(article.publishedAt)}
                            </span>
                          )}
                          <span className="text-sm font-medium text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                            {t.articlesReadMore}
                            <ArrowRight className="w-4 h-4" aria-hidden="true" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
