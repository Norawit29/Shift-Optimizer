import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Scale,
  FileSpreadsheet,
  Settings,
  Users,
  Download,
  Clock,
  Puzzle,
  Globe,
  ChevronDown,
  Calendar,
  FileText,
  Mail,
} from "lucide-react";
import { SiFacebook } from "react-icons/si";
import { LazyMotion, domAnimation, m, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { Navbar } from "@/components/Navbar";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

function FAQItem({ q, a, testId }: { q: string; a: string; testId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden" data-testid={testId}>
      <button
        className="w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        data-testid={`${testId}-toggle`}
      >
        <h3 className="font-semibold text-base text-slate-900 dark:text-white">{q}</h3>
        <ChevronDown className={`w-5 h-5 shrink-0 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-5 sm:px-6 pb-5 sm:pb-6 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{a}</p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface Article {
  _id: string;
  title: string;
  slug: { current: string };
  excerpt?: string;
  coverImage?: string;
  publishedAt?: string;
}

export default function HomePage() {
  const { t, lang } = useLanguage();

  const { data: articles } = useQuery<Article[]>({
    queryKey: ["/api/articles"],
  });

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d MMM yyyy", { locale: lang === "th" ? th : enUS });
    } catch {
      return dateStr;
    }
  };

  const latestArticles = (articles || []).slice(0, 3);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, []);

  const features = [
    { icon: Clock, title: t.benefit1Title, desc: t.benefit1Desc, bg: "bg-amber-50 dark:bg-amber-950/40", iconColor: "text-amber-600 dark:text-amber-400" },
    { icon: Scale, title: t.benefit2Title, desc: t.benefit2Desc, bg: "bg-blue-50 dark:bg-blue-950/40", iconColor: "text-blue-600 dark:text-blue-400" },
    { icon: Puzzle, title: t.benefit3Title, desc: t.benefit3Desc, bg: "bg-violet-50 dark:bg-violet-950/40", iconColor: "text-violet-600 dark:text-violet-400" },
    { icon: FileSpreadsheet, title: t.featureExportTitle, desc: t.featureExportDesc, bg: "bg-emerald-50 dark:bg-emerald-950/40", iconColor: "text-emerald-600 dark:text-emerald-400" },
    { icon: Globe, title: t.benefit4Title, desc: t.benefit4Desc, bg: "bg-teal-50 dark:bg-teal-950/40", iconColor: "text-teal-600 dark:text-teal-400" },
  ];

  const steps = [
    { icon: Settings, title: t.howStep1Title, desc: t.howStep1Desc, num: "01" },
    { icon: Users, title: t.howStep2Title, desc: t.howStep2Desc, num: "02" },
    { icon: Download, title: t.howStep3Title, desc: t.howStep3Desc, num: "03" },
  ];

  const faqs = [
    { q: t.faq1Q, a: t.faq1A },
    { q: t.faq2Q, a: t.faq2A },
    { q: t.faq3Q, a: t.faq3A },
    { q: t.faq4Q, a: t.faq4A },
    { q: t.faq5Q, a: t.faq5A },
  ];

  return (
    <LazyMotion features={domAnimation}>
    <div className="min-h-screen bg-white dark:bg-slate-950 overflow-x-hidden">
      <Navbar isHomePage />

      <main>
        <section className="relative min-h-[100svh] flex flex-col justify-center pt-20 pb-10 px-4 sm:px-6">
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/8 via-transparent to-transparent rounded-full" />
            <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-blue-100/40 dark:bg-blue-900/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-teal-100/40 dark:bg-teal-900/10 rounded-full blur-3xl" />
            <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.08) 1px, transparent 0)", backgroundSize: "40px 40px" }} />
          </div>

          <div className="relative max-w-4xl mx-auto text-center">
            <m.div initial="hidden" animate="visible" variants={staggerContainer}>
              <m.h1 variants={fadeUp} custom={1} className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold text-slate-900 dark:text-white leading-[1.1] tracking-tight" data-testid="text-hero-title">
                {t.heroTitle1}
              </m.h1>

              <m.p variants={fadeUp} custom={2} className="mt-4 text-lg sm:text-xl md:text-2xl font-medium text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent" data-testid="text-hero-subtitle">
                {t.heroTitle2}
              </m.p>

              <m.p variants={fadeUp} custom={3} className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed" data-testid="text-hero-desc">
                {t.heroDesc.split("\n").map((line: string, i: number) => (
                  <span key={i}>{line}{i < t.heroDesc.split("\n").length - 1 && <br />}</span>
                ))}
              </m.p>

              <m.div variants={fadeUp} custom={4} className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center flex-wrap">
                <Link href="/create" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-primary/25 text-base px-5" data-testid="button-create-schedule">
                    {t.getStartedFree}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </m.div>

            </m.div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 min-h-screen flex flex-col justify-center py-16 sm:py-20 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
            >
              <m.div variants={fadeUp} custom={0} className="text-center mb-14 sm:mb-16">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white" data-testid="text-how-it-works-title">
                  {t.howItWorksTitle}
                </h2>
                <p className="mt-3 text-slate-600 dark:text-slate-300 text-base sm:text-lg max-w-xl mx-auto">
                  {t.howItWorksDesc}
                </p>
              </m.div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
                {steps.map((step, i) => (
                  <m.div
                    key={i}
                    variants={fadeUp}
                    custom={i + 1}
                    className="relative group"
                  >
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-7 sm:p-8 h-full transition-shadow duration-300 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50">
                      <div className="flex items-start gap-4 mb-4">
                        <span className="text-4xl font-display font-bold text-slate-200 dark:text-slate-700 select-none leading-none" aria-hidden="true" data-testid={`text-step-num-${step.num}`}>
                          {step.num}
                        </span>
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
                          <step.icon className="w-5 h-5 text-white" aria-hidden="true" />
                        </div>
                      </div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2" data-testid={`text-step-title-${step.num}`}>
                        {step.title}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed" data-testid={`text-step-desc-${step.num}`}>
                        {step.desc}
                      </p>
                    </div>
                    {i < steps.length - 1 && (
                      <div className="hidden md:block absolute top-1/2 -right-4 sm:-right-5 w-8 sm:w-10 h-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
                    )}
                  </m.div>
                ))}
              </div>
            </m.div>
          </div>
        </section>

        <section id="features" className="scroll-mt-24 min-h-screen flex flex-col justify-center py-16 sm:py-20 px-4 sm:px-6 bg-slate-50/80 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-800/50">
          <div className="max-w-6xl mx-auto">
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
            >
              <m.div variants={fadeUp} custom={0} className="text-center mb-14 sm:mb-16">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white" data-testid="text-features-title">
                  {t.featureSectionTitle}
                </h2>
                <p className="mt-3 text-slate-600 dark:text-slate-300 text-base sm:text-lg max-w-xl mx-auto">
                  {t.featureSectionDesc}
                </p>
              </m.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {features.slice(0, 3).map((feature, i) => (
                  <m.div
                    key={i}
                    variants={fadeUp}
                    custom={i}
                    data-testid={`card-feature-${i}`}
                  >
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-7 sm:p-8 h-full transition-shadow duration-300 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50">
                      <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-5`}>
                        <feature.icon className={`w-6 h-6 ${feature.iconColor}`} aria-hidden="true" />
                      </div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2" data-testid={`text-feature-title-${i}`}>
                        {feature.title}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed" data-testid={`text-feature-desc-${i}`}>
                        {feature.desc}
                      </p>
                    </div>
                  </m.div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 justify-center mt-6 sm:mt-8">
                {features.slice(3).map((feature, i) => (
                  <m.div
                    key={i + 3}
                    variants={fadeUp}
                    custom={i + 3}
                    className="w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.333rem)]"
                    data-testid={`card-feature-${i + 3}`}
                  >
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-7 sm:p-8 h-full transition-shadow duration-300 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50">
                      <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-5`}>
                        <feature.icon className={`w-6 h-6 ${feature.iconColor}`} aria-hidden="true" />
                      </div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2" data-testid={`text-feature-title-${i + 3}`}>
                        {feature.title}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed" data-testid={`text-feature-desc-${i + 3}`}>
                        {feature.desc}
                      </p>
                    </div>
                  </m.div>
                ))}
              </div>
            </m.div>
          </div>
        </section>

        <section id="about" className="scroll-mt-24 min-h-screen flex flex-col justify-center py-20 sm:py-28 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
            >
              <m.div variants={fadeUp} custom={0} className="text-center mb-10 sm:mb-12">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white" data-testid="text-what-is-title">
                  {t.whatIsTitle}
                </h2>
              </m.div>
              <m.div variants={fadeUp} custom={1} className="space-y-5 text-slate-700 dark:text-slate-300 text-base sm:text-lg leading-relaxed max-w-3xl mx-auto">
                <p data-testid="text-what-is-desc">{t.whatIsDesc}</p>
                <p data-testid="text-what-is-desc2">{t.whatIsDesc2}</p>
                <p data-testid="text-what-is-desc3">{t.whatIsDesc3}</p>
              </m.div>
            </m.div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 py-20 sm:py-28 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
            >
              <m.div variants={fadeUp} custom={0} className="text-center mb-10 sm:mb-12">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white" data-testid="text-faq-title">
                  {t.faqTitle}
                </h2>
              </m.div>

              <m.div variants={fadeUp} custom={1} className="space-y-3">
                {faqs.map((faq, i) => (
                  <FAQItem key={i} q={faq.q} a={faq.a} testId={`faq-item-${i}`} />
                ))}
              </m.div>
            </m.div>
          </div>
        </section>

        {latestArticles.length > 0 && (
          <section className="py-16 sm:py-20 px-4 sm:px-6 border-t border-slate-100 dark:border-slate-800/50">
            <div className="max-w-5xl mx-auto">
              <m.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={staggerContainer}
              >
                <m.div variants={fadeUp} custom={0} className="text-center mb-10 sm:mb-14">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white" data-testid="text-articles-section-title">
                    {t.homeArticlesTitle}
                  </h2>
                  <p className="mt-3 text-slate-600 dark:text-slate-300 text-base sm:text-lg">
                    {t.homeArticlesDesc}
                  </p>
                </m.div>

                <m.div variants={fadeUp} custom={1} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {latestArticles.map((article) => (
                    <Link
                      key={article._id}
                      href={`/articles/${article.slug?.current || ""}`}
                      className="block group"
                      data-testid={`home-article-card-${article._id}`}
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
                          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 group-hover:text-primary transition-colors line-clamp-2">
                            {article.title}
                          </h3>
                          {article.excerpt && (
                            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-3 line-clamp-2 flex-1">
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
                </m.div>

                <m.div variants={fadeUp} custom={2} className="text-center mt-8">
                  <Link href="/articles">
                    <Button variant="outline" size="lg" className="text-base px-5" data-testid="button-view-all-articles">
                      {t.homeArticlesViewAll}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </m.div>
              </m.div>
            </div>
          </section>
        )}

        <section className="py-16 sm:py-20 px-4 sm:px-6 bg-slate-50/80 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800/50">
          <div className="max-w-3xl mx-auto text-center">
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
            >
              <m.h2 variants={fadeUp} custom={0} className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white" data-testid="text-cta-title">
                {t.ctaTitle}
              </m.h2>
              <m.p variants={fadeUp} custom={1} className="mt-4 text-slate-600 dark:text-slate-300 text-base sm:text-lg">
                {t.ctaDesc}
              </m.p>
              <m.div variants={fadeUp} custom={2} className="mt-8">
                <Link href="/create">
                  <Button size="lg" className="shadow-lg shadow-primary/25 text-base px-5" data-testid="button-cta-bottom">
                    {t.ctaBottomButton}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </m.div>
            </m.div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 dark:border-slate-800/50 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 flex-wrap text-sm text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6">
              <img src="/favicon.svg" alt="โปรแกรมจัดตารางเวร Shift Optimizer" width="24" height="24" className="w-6 h-6 rounded-md" />
            </div>
            <span className="font-medium" data-testid="text-footer-app-name">{t.appName}</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="mailto:contact@shift-optimizer.com"
              className="flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              data-testid="link-footer-email"
            >
              <Mail className="w-4 h-4" />
              <span>contact@shift-optimizer.com</span>
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=61564671372755"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              data-testid="link-footer-facebook"
            >
              <SiFacebook className="w-4 h-4" />
              <span>Facebook</span>
            </a>
          </div>
          <span data-testid="text-footer-copyright">Copyright &copy; 2026 Shift Optimizer All rights reserved.</span>
        </div>
      </footer>
    </div>
    </LazyMotion>
  );
}
