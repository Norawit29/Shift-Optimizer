import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortableText } from "@portabletext/react";
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
  body?: any[];
  publishedAt?: string;
  language?: string;
}

const portableTextComponents = {
  types: {
    image: ({ value }: { value: any }) => {
      if (!value?.asset?.url && !value?.asset?._ref) return null;
      const url = value.asset?.url || "";
      return (
        <figure className="my-8">
          <img
            src={url}
            alt={value.alt || ""}
            className="rounded-xl w-full"
            loading="lazy"
          />
          {value.caption && (
            <figcaption className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
              {value.caption}
            </figcaption>
          )}
        </figure>
      );
    },
  },
  block: {
    h1: ({ children }: any) => <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-10 mb-4">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-8 mb-3">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-6 mb-2">{children}</h3>,
    normal: ({ children }: any) => <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">{children}</p>,
    blockquote: ({ children }: any) => <blockquote className="border-l-4 border-primary/30 pl-4 italic text-slate-600 dark:text-slate-400 my-6">{children}</blockquote>,
  },
  list: {
    bullet: ({ children }: any) => <ul className="list-disc pl-6 mb-4 space-y-1 text-slate-700 dark:text-slate-300">{children}</ul>,
    number: ({ children }: any) => <ol className="list-decimal pl-6 mb-4 space-y-1 text-slate-700 dark:text-slate-300">{children}</ol>,
  },
  marks: {
    link: ({ children, value }: any) => (
      <a href={value?.href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
        {children}
      </a>
    ),
    strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
    code: ({ children }: any) => <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>,
  },
};

export default function ArticlePage() {
  const { t, lang } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const params = useParams<{ slug: string }>();

  const { data: article, isLoading, error } = useQuery<Article>({
    queryKey: ["/api/articles", params.slug],
    queryFn: async () => {
      const res = await fetch(`/api/articles/${params.slug}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!params.slug,
  });

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d MMMM yyyy", { locale: lang === "th" ? th : enUS });
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
              <a href="/articles" className="px-3.5 py-2 text-[15px] font-semibold text-primary rounded-lg">
                {t.navArticles}
              </a>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <LanguageToggle />
              {!authLoading && (user ? <UserMenu /> : <GoogleSignInButton />)}
            </div>
          </div>
        </nav>
      </header>

      <main className="pt-28 pb-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/articles">
            <Button variant="ghost" size="sm" className="mb-6 gap-1.5" data-testid="button-back-articles">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              {t.articlesBackToList}
            </Button>
          </Link>

          {isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
              <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl mt-6" />
              <div className="space-y-3 mt-6">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
              </div>
            </div>
          ) : error || !article ? (
            <div className="text-center py-20">
              <p className="text-lg text-slate-500 dark:text-slate-400" data-testid="text-article-not-found">
                {lang === "th" ? "ไม่พบบทความ" : "Article not found"}
              </p>
            </div>
          ) : (
            <article data-testid="article-content">
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 dark:text-white mb-4" data-testid="text-article-title">
                {article.title}
              </h1>

              {article.publishedAt && (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-8">
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                  <span>{t.articlesPublishedAt} {formatDate(article.publishedAt)}</span>
                </div>
              )}

              {article.coverImage && (
                <img
                  src={article.coverImage}
                  alt={article.title}
                  className="w-full rounded-2xl mb-10 shadow-lg"
                  data-testid="img-article-cover"
                />
              )}

              {article.body && (
                <div className="prose-custom" data-testid="article-body">
                  <PortableText value={article.body} components={portableTextComponents} />
                </div>
              )}
            </article>
          )}
        </div>
      </main>
    </div>
  );
}
