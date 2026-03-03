import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Building2, AlertTriangle, Lightbulb, BarChart3, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortableText } from "@portabletext/react";
import { useLanguage } from "@/context/LanguageContext";
import { Navbar } from "@/components/Navbar";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";

interface CaseStudy {
  _id: string;
  hospitalName?: string;
  title: string;
  slug: { current: string };
  department?: string;
  problem?: string;
  solution?: string;
  results?: any[];
  kpis?: { url?: string; caption?: string };
  testimonial?: { quote?: string; name?: string; position?: string };
  coverImage?: string;
  publishedAt?: string;
  isFeatured?: boolean;
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

function SectionHeading({ icon: Icon, children }: { icon: any; children: any }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">{children}</h2>
    </div>
  );
}

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
            <article data-testid="case-study-content" className="space-y-10">
              <div>
                <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 dark:text-white mb-4" data-testid="text-case-study-title">
                  {caseStudy.title}
                </h1>

                {caseStudy.publishedAt && (
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Calendar className="w-4 h-4" aria-hidden="true" />
                    <span>{t.articlesPublishedAt} {formatDate(caseStudy.publishedAt)}</span>
                  </div>
                )}
              </div>

              {caseStudy.coverImage && (
                <img
                  src={caseStudy.coverImage}
                  alt={caseStudy.title}
                  className="w-full rounded-2xl shadow-lg"
                  data-testid="img-case-study-cover"
                />
              )}

              {(caseStudy.hospitalName || caseStudy.department) && (
                <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6" data-testid="section-hospital-setting">
                  <SectionHeading icon={Building2}>{t.caseStudyHospitalSetting}</SectionHeading>
                  <div className="flex flex-wrap gap-x-8 gap-y-2 text-slate-700 dark:text-slate-300">
                    {caseStudy.hospitalName && (
                      <div>
                        <span className="text-sm text-slate-500 dark:text-slate-400">{lang === "th" ? "โรงพยาบาล" : "Hospital"}</span>
                        <p className="font-medium text-lg">{caseStudy.hospitalName}</p>
                      </div>
                    )}
                    {caseStudy.department && (
                      <div>
                        <span className="text-sm text-slate-500 dark:text-slate-400">{lang === "th" ? "แผนก" : "Department"}</span>
                        <p className="font-medium text-lg">{caseStudy.department}</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {caseStudy.problem && (
                <section data-testid="section-problem">
                  <SectionHeading icon={AlertTriangle}>{t.caseStudyProblem}</SectionHeading>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{caseStudy.problem}</p>
                </section>
              )}

              {caseStudy.solution && (
                <section data-testid="section-solution">
                  <SectionHeading icon={Lightbulb}>{t.caseStudySolution}</SectionHeading>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{caseStudy.solution}</p>
                </section>
              )}

              {caseStudy.results && caseStudy.results.length > 0 && (
                <section data-testid="section-results">
                  <SectionHeading icon={BarChart3}>{t.caseStudyResults}</SectionHeading>
                  <div className="prose-custom">
                    <PortableText value={caseStudy.results} components={portableTextComponents} />
                  </div>
                </section>
              )}

              {caseStudy.kpis?.url && (
                <section data-testid="section-kpis">
                  <SectionHeading icon={TrendingUp}>{t.caseStudyKpis}</SectionHeading>
                  <figure>
                    <img
                      src={caseStudy.kpis.url}
                      alt={caseStudy.kpis.caption || t.caseStudyKpis}
                      className="w-full rounded-xl shadow-md"
                      loading="lazy"
                      data-testid="img-case-study-kpis"
                    />
                    {caseStudy.kpis.caption && (
                      <figcaption className="text-center text-sm text-slate-500 dark:text-slate-400 mt-3">
                        {caseStudy.kpis.caption}
                      </figcaption>
                    )}
                  </figure>
                </section>
              )}

              {caseStudy.testimonial?.quote && (
                <section className="mt-12 pl-6 border-l-2 border-slate-200 dark:border-slate-700" data-testid="section-testimonial">
                  <p className="italic text-lg text-slate-700 dark:text-slate-300 leading-relaxed">
                    "{caseStudy.testimonial.quote}"
                  </p>

                  <div className="mt-6">
                    {caseStudy.testimonial.name && (
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {caseStudy.testimonial.name}
                      </div>
                    )}
                    {caseStudy.testimonial.position && (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {caseStudy.testimonial.position}
                      </div>
                    )}
                  </div>
                </section>
              )}
            </article>
          )}
        </div>
      </main>
    </div>
  );
}
