import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Scale,
  Zap,
  FileSpreadsheet,
  Settings,
  Users,
  Download,
  Clock,
  ShieldCheck,
  Puzzle,
  Globe,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAuth } from "@/context/AuthContext";
import { GoogleSignInButton, UserMenu } from "@/components/GoogleSignIn";

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
        data-testid={`${testId}-toggle`}
      >
        <h3 className="font-semibold text-base text-slate-900 dark:text-white">{q}</h3>
        <ChevronDown className={`w-5 h-5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-5 sm:px-6 pb-5 sm:pb-6 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function HomePage() {
  const { t } = useLanguage();
  const { user, loading } = useAuth();

  const features = [
    {
      icon: Scale,
      title: t.featureFairTitle,
      desc: t.featureFairDesc,
      bg: "bg-blue-50 dark:bg-blue-950/40",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      icon: Zap,
      title: t.featureSmartTitle,
      desc: t.featureSmartDesc,
      bg: "bg-amber-50 dark:bg-amber-950/40",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      icon: FileSpreadsheet,
      title: t.featureExportTitle,
      desc: t.featureExportDesc,
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  const steps = [
    { icon: Settings, title: t.howStep1Title, desc: t.howStep1Desc, num: "01" },
    { icon: Users, title: t.howStep2Title, desc: t.howStep2Desc, num: "02" },
    { icon: Download, title: t.howStep3Title, desc: t.howStep3Desc, num: "03" },
  ];

  const benefits = [
    { icon: Clock, title: t.benefit1Title, desc: t.benefit1Desc },
    { icon: Scale, title: t.benefit2Title, desc: t.benefit2Desc },
    { icon: Puzzle, title: t.benefit3Title, desc: t.benefit3Desc },
    { icon: Globe, title: t.benefit4Title, desc: t.benefit4Desc },
  ];

  const faqs = [
    { q: t.faq1Q, a: t.faq1A },
    { q: t.faq2Q, a: t.faq2A },
    { q: t.faq3Q, a: t.faq3A },
    { q: t.faq4Q, a: t.faq4A },
    { q: t.faq5Q, a: t.faq5A },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg border-b border-slate-100 dark:border-slate-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 shrink-0" data-testid="logo-icon">
              <img src="/favicon.svg" alt="Shift Optimizer Logo" className="w-8 h-8 rounded-lg" />
            </div>
            <span className="font-display font-bold text-lg text-slate-900 dark:text-white hidden sm:inline truncate" data-testid="text-app-name">
              {t.appName}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <LanguageToggle />
            {!loading && (user ? <UserMenu /> : <GoogleSignInButton />)}
          </div>
        </div>
      </nav>

      <section className="relative min-h-screen flex flex-col justify-center pt-20 pb-10 px-4 sm:px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/8 via-transparent to-transparent rounded-full" />
          <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-blue-100/40 dark:bg-blue-900/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-teal-100/40 dark:bg-teal-900/10 rounded-full blur-3xl" />
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.08) 1px, transparent 0)", backgroundSize: "40px 40px" }} />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
            <motion.h1 variants={fadeUp} custom={1} className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold text-slate-900 dark:text-white leading-[1.1] tracking-tight" data-testid="text-hero-title">
              {t.heroTitle1}
            </motion.h1>

            <motion.p variants={fadeUp} custom={2} className="mt-4 text-lg sm:text-xl md:text-2xl font-medium text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent" data-testid="text-hero-subtitle">
              {t.heroTitle2}
            </motion.p>

            <motion.p variants={fadeUp} custom={3} className="mt-6 text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed" data-testid="text-hero-desc">
              {t.heroDesc.split("\n").map((line: string, i: number) => (
                <span key={i}>{line}{i < t.heroDesc.split("\n").length - 1 && <br />}</span>
              ))}
            </motion.p>

            <motion.div variants={fadeUp} custom={4} className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center flex-wrap">
              <Link href="/create" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-primary/25" data-testid="button-create-schedule">
                  {t.getStartedFree}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </motion.div>

          </motion.div>
        </div>
      </section>

      <section id="how-it-works" className="min-h-screen flex flex-col justify-center py-16 sm:py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeUp} custom={0} className="text-center mb-14 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white" data-testid="text-how-it-works-title">
                {t.howItWorksTitle}
              </h2>
              <p className="mt-3 text-slate-500 dark:text-slate-400 text-base sm:text-lg max-w-xl mx-auto">
                {t.howItWorksDesc}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {steps.map((step, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  custom={i + 1}
                  className="relative group"
                >
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-7 sm:p-8 h-full transition-shadow duration-300 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50">
                    <div className="flex items-start gap-4 mb-4">
                      <span className="text-4xl font-display font-bold text-slate-100 dark:text-slate-800 select-none leading-none" data-testid={`text-step-num-${step.num}`}>
                        {step.num}
                      </span>
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
                        <step.icon className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2" data-testid={`text-step-title-${step.num}`}>
                      {step.title}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed" data-testid={`text-step-desc-${step.num}`}>
                      {step.desc}
                    </p>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-4 sm:-right-5 w-8 sm:w-10 h-px bg-slate-200 dark:bg-slate-700" />
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="min-h-screen flex flex-col justify-center py-16 sm:py-20 px-4 sm:px-6 bg-slate-50/80 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeUp} custom={0} className="text-center mb-14 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white" data-testid="text-features-title">
                {t.featureSectionTitle}
              </h2>
              <p className="mt-3 text-slate-500 dark:text-slate-400 text-base sm:text-lg max-w-xl mx-auto">
                {t.featureSectionDesc}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  custom={i}
                  data-testid={`card-feature-${i}`}
                >
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-7 sm:p-8 h-full transition-shadow duration-300 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50">
                    <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-5`}>
                      <feature.icon className={`w-6 h-6 ${feature.iconColor}`} />
                    </div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2" data-testid={`text-feature-title-${i}`}>
                      {feature.title}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed" data-testid={`text-feature-desc-${i}`}>
                      {feature.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeUp} custom={0} className="text-center mb-10 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white" data-testid="text-what-is-title">
                {t.whatIsTitle}
              </h2>
            </motion.div>
            <motion.div variants={fadeUp} custom={1} className="space-y-5 text-slate-600 dark:text-slate-400 text-base sm:text-lg leading-relaxed max-w-3xl mx-auto">
              <p data-testid="text-what-is-desc">{t.whatIsDesc}</p>
              <p data-testid="text-what-is-desc2">{t.whatIsDesc2}</p>
              <p data-testid="text-what-is-desc3">{t.whatIsDesc3}</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-slate-50/80 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeUp} custom={0} className="text-center mb-14 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white" data-testid="text-benefits-title">
                {t.benefitsTitle}
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
              {benefits.map((b, i) => (
                <motion.div key={i} variants={fadeUp} custom={i + 1} data-testid={`card-benefit-${i}`}>
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 h-full flex gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 dark:bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                      <b.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1" data-testid={`text-benefit-title-${i}`}>{b.title}</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed" data-testid={`text-benefit-desc-${i}`}>{b.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <motion.div variants={fadeUp} custom={0} className="text-center mb-10 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white" data-testid="text-faq-title">
                {t.faqTitle}
              </h2>
            </motion.div>

            <motion.div variants={fadeUp} custom={1} className="space-y-3">
              {faqs.map((faq, i) => (
                <FAQItem key={i} q={faq.q} a={faq.a} testId={`faq-item-${i}`} />
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-slate-50/80 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800/50">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white" data-testid="text-cta-title">
              {t.heroTitle1}
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="mt-4 text-slate-500 dark:text-slate-400 text-base sm:text-lg">
              {t.heroTitle2}
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="mt-8">
              <Link href="/create">
                <Button size="lg" className="shadow-lg shadow-primary/25" data-testid="button-cta-bottom">
                  {t.getStartedFree}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-slate-100 dark:border-slate-800/50 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 flex-wrap text-sm text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6">
              <img src="/favicon.svg" alt="Shift Optimizer Logo" className="w-6 h-6 rounded-md" />
            </div>
            <span className="font-medium" data-testid="text-footer-app-name">{t.appName}</span>
          </div>
          <span data-testid="text-footer-copyright">&copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
