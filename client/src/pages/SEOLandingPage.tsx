import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import {
  ArrowRight,
  ChevronDown,
  Settings,
  Users,
  Download,
  CheckCircle2,
  Scale,
  FileSpreadsheet,
  Puzzle,
  Clock,
} from "lucide-react";
import { LazyMotion, domAnimation, m, AnimatePresence } from "framer-motion";
import { useState, useEffect, ReactNode } from "react";

// ── animation variants ──────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] },
  }),
};
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

// ── FAQ accordion ──────────────────────────────────────────────
function FAQItem({ q, a, i }: { q: string; a: string; i: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden" data-testid={`seo-faq-item-${i}`}>
      <button
        className="w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-left bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        data-testid={`seo-faq-toggle-${i}`}
      >
        <h3 className="font-semibold text-base text-slate-900 dark:text-white">{q}</h3>
        <ChevronDown className={`w-5 h-5 shrink-0 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
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
            <p className="px-5 sm:px-6 pb-5 sm:pb-6 text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900">{a}</p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── shared comparison table data ───────────────────────────────
const comparisonRows = [
  { topic: "วิธีการทำงานหลัก", excel: "ต้องจัดตารางด้วยตนเอง แล้วค่อยตรวจสอบทีหลังเมื่อมีเวรชน ผิดกฎ หรือคนไม่พอ", ai: "AI ประมวลผลเงื่อนไขทั้งหมด และสร้างตารางที่พร้อมใช้งานทันทีตั้งแต่ต้น" },
  { topic: "การแก้ปัญหาเวรชน / เวรซ้อน", excel: "ระบบอาจแจ้งเตือน แต่ผู้จัดต้องไล่แก้และสลับเวรเองทีละคน", ai: "AI คำนวณความเป็นไปได้จำนวนมาก เพื่อหลีกเลี่ยงเวรชนและหาคำตอบที่เหมาะสมอัตโนมัติ" },
  { topic: "ความยุติธรรมในการจัดเวร", excel: "มักอาศัยประสบการณ์หรือการตัดสินใจของผู้จัด อาจเกิดข้อโต้แย้งเรื่องความไม่เท่าเทียม", ai: "AI กระจายเวรอย่างสมดุล โดยคำนึงถึงภาระงาน OT วันหยุด และความเหมาะสมของแต่ละคน" },
  { topic: "ข้อกำหนด / นโยบายองค์กร", excel: "ต้องสร้างสูตรและตรวจสอบเอง เช่น ชั่วโมงงานสูงสุด หรือวันทำงานต่อเนื่อง", ai: "ตั้งกฎไว้ครั้งเดียว ระบบจะไม่สร้างตารางที่ผิดข้อกำหนด" },
  { topic: "เวลาที่ใช้ในการจัดตาราง", excel: "อาจใช้เวลาหลายชั่วโมงหรือหลายวัน เมื่อทีมใหญ่และเงื่อนไขซับซ้อน", ai: "ใช้เวลาเพียงไม่กี่นาที แม้มีบุคลากรจำนวนมาก" },
  { topic: "การแก้ไขเมื่อเปลี่ยนเวรฉุกเฉิน", excel: "ต้องปรับตารางเองใหม่ เสี่ยงกระทบคนอื่นทั้งระบบ", ai: "AI ช่วยคำนวณตัวเลือกใหม่อย่างรวดเร็ว พร้อมลดผลกระทบต่อทีม" },
  { topic: "รายงาน / เอกสารใช้งานต่อ", excel: "ต้องแยกทำเองหลายไฟล์ หรือคัดลอกข้อมูลซ้ำ", ai: "สร้างตารางรายบุคคล รายแผนก และไฟล์พร้อมใช้งานได้ทันที" },
  { topic: "การเติบโตขององค์กร", excel: "ยิ่งคนเยอะ ยิ่งซับซ้อน และดูแลยาก", ai: "รองรับทีมขนาดเล็กถึงองค์กรขนาดใหญ่ได้อย่างมีประสิทธิภาพ" },
];

// ── shared how-it-works steps ───────────────────────────────────
const howItWorksSteps = [
  { icon: Settings, title: "ตั้งค่าทีมและกะ", desc: "กำหนดประเภทกะ จำนวนคนต่อเวร และกฎเฉพาะขององค์กร ตั้งครั้งเดียว ใช้ได้ทุกเดือน", num: "01" },
  { icon: Users, title: "เพิ่มบุคลากรและเงื่อนไข", desc: "บันทึกรายชื่อ ระดับ วันลา และข้อจำกัดส่วนตัว ระบบจะคำนึงถึงทุกเงื่อนไขโดยอัตโนมัติ", num: "02" },
  { icon: Download, title: "สร้างและส่งออกตาราง", desc: "กด Generate แล้วได้ตารางที่ผ่านการตรวจสอบทุกกฎ ส่งออก Excel แจกทีมได้ทันที", num: "03" },
];

// ── internal links ─────────────────────────────────────────────
const internalLinks = [
  { href: "/โปรแกรมจัดเวรพนักงาน", label: "โปรแกรมจัดเวรพนักงาน" },
  { href: "/ตารางเวรพนักงาน-excel", label: "ตารางเวรพนักงาน Excel" },
  { href: "/วิธีจัดตารางเวรพนักงาน", label: "วิธีจัดตารางเวรพนักงาน" },
  { href: "/ตารางเวรร้านอาหาร", label: "ตารางเวรร้านอาหาร" },
  { href: "/", label: "โปรแกรมจัดตารางเวรพยาบาลด้วย AI" },
];

// ── types ──────────────────────────────────────────────────────
export interface PainPoint { icon: React.ElementType; text: string }
export interface OutcomeCard { icon: React.ElementType; title: string; desc: string; bg: string; iconColor: string }
export interface FAQEntry { q: string; a: string }

export interface SEOPageConfig {
  seoTitle: string;
  metaDescription: string;
  canonicalPath: string;
  badge?: string;
  h1Line1: string;
  h1Gradient?: string;
  subtitle: string;
  primaryCTA: string;
  primaryHref: string;
  secondaryCTA: string;
  painTitle: string;
  painSubtitle?: string;
  painPoints: PainPoint[];
  solutionTitle: string;
  solutionSubtitle?: string;
  outcomes: OutcomeCard[];
  faqs: FAQEntry[];
  useCasesTitle?: string;
  useCases?: string[];
  showComparison?: boolean;
  extraAfterPain?: ReactNode;
  extraAfterSolution?: ReactNode;
}

// ── main component ─────────────────────────────────────────────
export default function SEOLandingPage({ config }: { config: SEOPageConfig }) {
  const {
    seoTitle, metaDescription, canonicalPath,
    badge, h1Line1, h1Gradient, subtitle,
    primaryCTA, primaryHref, secondaryCTA,
    painTitle, painSubtitle, painPoints,
    solutionTitle, solutionSubtitle, outcomes,
    faqs, useCasesTitle, useCases,
    showComparison = true,
    extraAfterPain, extraAfterSolution,
  } = config;

  // Set SEO head
  useEffect(() => {
    document.title = seoTitle;
    let metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (metaDesc) metaDesc.content = metaDescription;
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical) canonical.href = `https://shift-optimizer.com${canonicalPath}`;
  }, [seoTitle, metaDescription, canonicalPath]);

  // Inject FAQ JSON-LD schema
  useEffect(() => {
    const id = "seo-faq-schema";
    let existing = document.getElementById(id);
    if (existing) existing.remove();
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(({ q, a }) => ({
        "@type": "Question",
        "name": q,
        "acceptedAnswer": { "@type": "Answer", "text": a },
      })),
    };
    const script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
    return () => { document.getElementById(id)?.remove(); };
  }, [faqs]);

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen bg-white dark:bg-slate-950 overflow-x-hidden">
        <Navbar isHomePage />

        <main>
          {/* ── HERO ── */}
          <section className="relative min-h-[80svh] flex flex-col justify-center pt-24 pb-16 px-4 sm:px-6">
            <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
              <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/8 via-transparent to-transparent rounded-full" />
              <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-blue-100/40 dark:bg-blue-900/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-teal-100/40 dark:bg-teal-900/10 rounded-full blur-3xl" />
              <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.08) 1px, transparent 0)", backgroundSize: "40px 40px" }} />
            </div>

            <div className="relative max-w-4xl mx-auto text-center">
              <m.div initial="hidden" animate="visible" variants={staggerContainer}>
                {badge && (
                  <m.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 bg-primary/8 dark:bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6">
                    <CheckCircle2 className="w-4 h-4" />
                    {badge}
                  </m.div>
                )}

                <m.h1
                  variants={fadeUp}
                  custom={1}
                  className="text-4xl sm:text-5xl md:text-[3.25rem] lg:text-6xl font-display font-bold text-slate-900 dark:text-white leading-[1.2] tracking-tight"
                  data-testid="text-seo-hero-title"
                >
                  <span className="block">{h1Line1}</span>
                  {h1Gradient && (
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                      {h1Gradient}
                    </span>
                  )}
                </m.h1>

                <m.p
                  variants={fadeUp}
                  custom={2}
                  className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed"
                  data-testid="text-seo-hero-subtitle"
                >
                  {subtitle}
                </m.p>

                <m.div variants={fadeUp} custom={3} className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <Link href={primaryHref} className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-primary/25 text-base px-7 py-6 font-semibold" data-testid="button-seo-primary-cta">
                      {primaryCTA}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/pricing" className="w-full sm:w-auto">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-7 py-6 font-semibold" data-testid="button-seo-secondary-cta">
                      {secondaryCTA}
                    </Button>
                  </Link>
                </m.div>
              </m.div>
            </div>
          </section>

          {/* ── PAIN ── */}
          <section className="py-20 sm:py-28 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
              <m.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={staggerContainer}>
                <m.div variants={fadeUp} custom={0} className="text-center mb-12 sm:mb-14">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white mb-4">
                    {painTitle}
                  </h2>
                  {painSubtitle && (
                    <p className="text-slate-500 dark:text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">{painSubtitle}</p>
                  )}
                </m.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {painPoints.map((point, i) => (
                    <m.div key={i} variants={fadeUp} custom={i + 1}>
                      <div className="flex items-start gap-4 p-5 sm:p-6 rounded-2xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 hover:border-orange-200 dark:hover:border-orange-800/50 hover:shadow-md hover:shadow-orange-100/50 transition-all duration-200 h-full">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0 mt-0.5">
                          <point.icon className="w-5 h-5 text-orange-600 dark:text-orange-400" aria-hidden="true" />
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 text-sm sm:text-base font-medium leading-relaxed">{point.text}</p>
                      </div>
                    </m.div>
                  ))}
                </div>

                <m.div variants={fadeUp} custom={7} className="mt-10 sm:mt-12 text-center">
                  <div className="inline-block bg-gradient-to-r from-primary/5 to-accent/5 dark:from-primary/10 dark:to-accent/10 border border-primary/20 dark:border-primary/30 rounded-2xl px-8 py-5">
                    <p className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200">
                      <span className="text-primary">Shift Optimizer</span> ช่วยเปลี่ยนงานจัดเวรที่วุ่นวาย ให้เป็นระบบอัตโนมัติภายในไม่กี่นาที
                    </p>
                  </div>
                </m.div>
              </m.div>
            </div>
          </section>

          {extraAfterPain}

          {/* ── SOLUTION CARDS ── */}
          <section className="py-20 sm:py-28 px-4 sm:px-6 bg-slate-50/80 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-800/50">
            <div className="max-w-6xl mx-auto">
              <m.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer}>
                <m.div variants={fadeUp} custom={0} className="text-center mb-14 sm:mb-16">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white">
                    {solutionTitle}
                  </h2>
                  {solutionSubtitle && (
                    <p className="mt-3 text-slate-600 dark:text-slate-300 text-base sm:text-lg max-w-2xl mx-auto">{solutionSubtitle}</p>
                  )}
                </m.div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {outcomes.map((item, i) => (
                    <m.div key={i} variants={fadeUp} custom={i + 1}>
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 h-full hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-shadow duration-300">
                        <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center mb-5`}>
                          <item.icon className={`w-6 h-6 ${item.iconColor}`} aria-hidden="true" />
                        </div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2 leading-snug">{item.title}</h3>
                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{item.desc}</p>
                      </div>
                    </m.div>
                  ))}
                </div>
              </m.div>
            </div>
          </section>

          {extraAfterSolution}

          {/* ── USE CASES ── */}
          {useCases && useCases.length > 0 && (
            <section className="py-16 sm:py-20 px-4 sm:px-6">
              <div className="max-w-4xl mx-auto text-center">
                <m.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={staggerContainer}>
                  <m.h2 variants={fadeUp} custom={0} className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white mb-8">
                    {useCasesTitle || "เหมาะสำหรับ"}
                  </m.h2>
                  <m.div variants={fadeUp} custom={1} className="flex flex-wrap justify-center gap-3">
                    {useCases.map((uc, i) => (
                      <span key={i} className="px-4 py-2 rounded-full bg-primary/8 dark:bg-primary/15 text-primary font-medium text-sm">
                        {uc}
                      </span>
                    ))}
                  </m.div>
                </m.div>
              </div>
            </section>
          )}

          {/* ── COMPARISON TABLE ── */}
          {showComparison && (
            <section className="py-20 sm:py-28 px-4 sm:px-6 bg-slate-50/80 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-800/50">
              <div className="max-w-5xl mx-auto">
                <m.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer}>
                  <m.div variants={fadeUp} custom={0} className="text-center mb-10 sm:mb-12">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white">
                      Excel / Google Sheets vs AI Scheduling
                    </h2>
                    <p className="mt-3 text-slate-600 dark:text-slate-300 text-base sm:text-lg max-w-xl mx-auto">
                      เปรียบเทียบวิธีการจัดเวรแบบเดิมกับระบบ Shift Optimizer
                    </p>
                  </m.div>
                  <m.div variants={fadeUp} custom={1} className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <table className="w-full text-sm sm:text-base border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/60">
                          <th className="text-left px-4 sm:px-6 py-4 font-semibold text-slate-600 dark:text-slate-300 w-[28%] border-b border-slate-200 dark:border-slate-700">หัวข้อเปรียบเทียบ</th>
                          <th className="text-left px-4 sm:px-6 py-4 font-semibold text-amber-700 dark:text-amber-400 w-[36%] border-b border-slate-200 dark:border-slate-700">
                            <span className="inline-flex items-center gap-2"><span className="text-lg">📊</span> Excel / Google Sheets</span>
                          </th>
                          <th className="text-left px-4 sm:px-6 py-4 font-semibold text-primary w-[36%] border-b border-slate-200 dark:border-slate-700 bg-primary/3 dark:bg-primary/5">
                            <span className="inline-flex items-center gap-2"><span className="text-lg">✨</span> AI Scheduling (Shift Optimizer)</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonRows.map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/60 dark:bg-slate-800/30"}>
                            <td className="px-4 sm:px-6 py-4 font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 align-top text-sm">{row.topic}</td>
                            <td className="px-4 sm:px-6 py-4 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 align-top">
                              <span className="inline-flex gap-2"><span className="text-orange-400 mt-0.5 shrink-0 font-bold">✗</span><span>{row.excel}</span></span>
                            </td>
                            <td className="px-4 sm:px-6 py-4 text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 align-top bg-primary/2 dark:bg-primary/3">
                              <span className="inline-flex gap-2"><span className="text-emerald-500 mt-0.5 shrink-0 font-bold">✓</span><span>{row.ai}</span></span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </m.div>
                </m.div>
              </div>
            </section>
          )}

          {/* ── HOW IT WORKS ── */}
          <section className="py-20 sm:py-28 px-4 sm:px-6">
            <div className="max-w-6xl mx-auto">
              <m.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer}>
                <m.div variants={fadeUp} custom={0} className="text-center mb-14 sm:mb-16">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white">
                    เริ่มใช้งานได้ใน 3 ขั้นตอน
                  </h2>
                  <p className="mt-3 text-slate-600 dark:text-slate-300 text-base sm:text-lg max-w-xl mx-auto">
                    ไม่ต้องติดตั้งโปรแกรม ไม่ต้องเรียนรู้นาน เริ่มจัดเวรได้ทันที
                  </p>
                </m.div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
                  {howItWorksSteps.map((step, i) => (
                    <m.div key={i} variants={fadeUp} custom={i + 1} className="relative">
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-7 sm:p-8 h-full transition-shadow duration-300 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50">
                        <div className="flex items-start gap-4 mb-4">
                          <span className="text-4xl font-display font-bold text-slate-200 dark:text-slate-700 select-none leading-none" aria-hidden="true">{step.num}</span>
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
                            <step.icon className="w-5 h-5 text-white" aria-hidden="true" />
                          </div>
                        </div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">{step.title}</h3>
                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{step.desc}</p>
                      </div>
                      {i < howItWorksSteps.length - 1 && (
                        <div className="hidden md:block absolute top-1/2 -right-4 sm:-right-5 w-8 sm:w-10 h-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
                      )}
                    </m.div>
                  ))}
                </div>
              </m.div>
            </div>
          </section>

          {/* ── FAQ ── */}
          <section className="py-20 sm:py-28 px-4 sm:px-6 bg-slate-50/80 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800/50">
            <div className="max-w-3xl mx-auto">
              <m.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer}>
                <m.div variants={fadeUp} custom={0} className="text-center mb-10 sm:mb-12">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white">
                    คำถามที่พบบ่อย
                  </h2>
                </m.div>
                <m.div variants={fadeUp} custom={1} className="space-y-3">
                  {faqs.map((faq, i) => (
                    <FAQItem key={i} q={faq.q} a={faq.a} i={i} />
                  ))}
                </m.div>
              </m.div>
            </div>
          </section>

          {/* ── INTERNAL LINKS ── */}
          <section className="py-14 sm:py-16 px-4 sm:px-6 border-t border-slate-100 dark:border-slate-800/50">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-5 text-center">
                อ่านต่อเกี่ยวกับการจัดเวร
              </h2>
              <div className="flex flex-wrap justify-center gap-3">
                {internalLinks
                  .filter((l) => l.href !== canonicalPath)
                  .map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:border-primary/40 hover:text-primary dark:hover:text-primary transition-colors"
                      data-testid={`link-internal-${link.href.replace(/[^a-z0-9]/gi, "-")}`}
                    >
                      {link.label}
                    </Link>
                  ))}
              </div>
            </div>
          </section>

          {/* ── FINAL CTA ── */}
          <section className="py-20 sm:py-28 px-4 sm:px-6 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 dark:from-primary/10 dark:to-accent/10 border-t border-slate-100 dark:border-slate-800/50">
            <div className="max-w-3xl mx-auto text-center">
              <m.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer}>
                <m.h2 variants={fadeUp} custom={0} className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white">
                  เริ่มจัดตารางเวรอย่างมืออาชีพวันนี้
                </m.h2>
                <m.p variants={fadeUp} custom={1} className="mt-4 text-slate-600 dark:text-slate-300 text-base sm:text-lg">
                  ลดเวลา ลดความวุ่นวาย เพิ่มความยุติธรรมให้ทีมของคุณ
                </m.p>
                <m.div variants={fadeUp} custom={2} className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <Link href={primaryHref}>
                    <Button size="lg" className="shadow-lg shadow-primary/25 text-base px-7 py-6 font-semibold" data-testid="button-seo-cta-bottom">
                      {primaryCTA}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/pricing">
                    <Button size="lg" variant="outline" className="text-base px-7 py-6 font-semibold" data-testid="button-seo-pricing">
                      ดูราคา
                    </Button>
                  </Link>
                </m.div>
              </m.div>
            </div>
          </section>
        </main>

        {/* ── FOOTER ── */}
        <footer className="border-t border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/50 py-10 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Shift Optimizer</span>
            <span>© {new Date().getFullYear()} Shift Optimizer. สงวนลิขสิทธิ์</span>
            <Link href="/privacy-policy" className="hover:text-primary transition-colors">นโยบายความเป็นส่วนตัว</Link>
          </div>
        </footer>
      </div>
    </LazyMotion>
  );
}
