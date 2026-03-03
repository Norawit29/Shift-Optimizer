import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortableText } from "@portabletext/react";
import { useLanguage } from "@/context/LanguageContext";
import { Navbar } from "@/components/Navbar";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";

interface CaseStudy {
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

export default function CaseStudyPage() {
  const { t, lang } = useLanguage();
  const params = useParams<{ slug: string }>();

  const { data: caseStudy, isLoading, error } = useQuery<CaseStudy>({
    queryKey: ["/api/case-studies", params.slug],
    queryFn: async () => {
      const res = await fetch(`/api/case-studies/${params.slug}`);
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
      <Navbar />

      <main className="pt-28 pb-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/case-studies">
            <Button variant="ghost" size="default" className="mb-8 gap-2 text-base px-4 py-2" data-testid="button-back-case-studies">
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              {t.caseStudiesBackToList}
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
          ) : error || !caseStudy ? (
            <div className="text-center py-20">
              <p className="text-lg text-slate-500 dark:text-slate-400" data-testid="text-case-study-not-found">
                {t.caseStudyNotFound}
              </p>
            </div>
          ) : (
            <article data-testid="case-study-content">
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 dark:text-white mb-4" data-testid="text-case-study-title">
                {caseStudy.title}
              </h1>

              {caseStudy.publishedAt && (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-8">
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                  <span>{t.articlesPublishedAt} {formatDate(caseStudy.publishedAt)}</span>
                </div>
              )}

              {caseStudy.coverImage && (
                <img
                  src={caseStudy.coverImage}
                  alt={caseStudy.title}
                  className="w-full rounded-2xl mb-10 shadow-lg"
                  data-testid="img-case-study-cover"
                />
              )}

              {caseStudy.body && (
                <div className="prose-custom" data-testid="case-study-body">
                  <PortableText value={caseStudy.body} components={portableTextComponents} />
                </div>
              )}
            </article>
          )}
        </div>
      </main>
    </div>
  );
}
