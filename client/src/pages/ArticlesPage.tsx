import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Calendar, FileText } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Navbar } from "@/components/Navbar";
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
      <Navbar />

      <main className="pt-28 pb-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 dark:text-white mb-10" data-testid="text-articles-title">
            {t.navArticles}
          </h1>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="aspect-[16/10] bg-slate-200 dark:bg-slate-800" />
                  <div className="p-5 space-y-3">
                    <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full" />
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : !articles || articles.length === 0 ? (
            <div className="text-center py-20 text-slate-500 dark:text-slate-400">
              <p className="text-lg" data-testid="text-articles-empty">{t.articlesEmpty}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="articles-list">
              {articles.map((article) => (
                <Link
                  key={article._id}
                  href={`/articles/${article.slug?.current || ""}`}
                  className="block group"
                  data-testid={`article-card-${article._id}`}
                >
                  <div className="h-full rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-shadow duration-300 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 bg-white dark:bg-slate-900 flex flex-col">
                    <div className="aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-slate-800">
                      {article.coverImage ? (
                        <img
                          src={article.coverImage}
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                          <FileText className="w-12 h-12" />
                        </div>
                      )}
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2 group-hover:text-primary transition-colors line-clamp-2" data-testid={`article-title-${article._id}`}>
                        {article.title}
                      </h2>
                      {article.excerpt && (
                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-3 line-clamp-2 flex-1" data-testid={`article-excerpt-${article._id}`}>
                          {article.excerpt}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-auto pt-2">
                        {article.publishedAt && (
                          <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                            {formatDate(article.publishedAt)}
                          </span>
                        )}
                        <span className="text-sm font-medium text-primary flex items-center gap-1 group-hover:gap-2 transition-all ml-auto">
                          {t.articlesReadMore}
                          <ArrowRight className="w-4 h-4" aria-hidden="true" />
                        </span>
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
