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
  ChevronDown,
  Calendar,
  FileText,
  Mail,
  AlertTriangle,
  Zap,
  RefreshCw,
  ClipboardX,
  Briefcase,
  CheckCircle2,
} from "lucide-react";
import { SiFacebook, SiLine } from "react-icons/si";
import { LazyMotion, domAnimation, m, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { Navbar } from "@/components/Navbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function CountUp({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1600;
          const start = performance.now();
          const tick = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref} className="tabular-nums inline-flex items-center">
      {count.toLocaleString()}
      {suffix && <span className="text-4xl sm:text-5xl font-bold ml-0.5">{suffix}</span>}
    </span>
  );
}

// June 30, 2026 23:59:59 Bangkok time (UTC+7)
const EARLY_ADOPTER_DEADLINE = new Date("2026-06-30T23:59:59+07:00");

function useCountdown(target: Date) {
  const calc = () => {
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  };
  const [remaining, setRemaining] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(id);
  }, []);
  return remaining;
}

function EarlyAdopterBanner({ lang }: { lang: string }) {
  const { days, hours, minutes, seconds } = useCountdown(EARLY_ADOPTER_DEADLINE);
  const [qrOpen, setQrOpen] = useState(false);

  const pad = (n: number) => String(n).padStart(2, "0");

  const units = [
    { value: pad(days), label: lang === "th" ? "วัน" : "d" },
    { value: pad(hours), label: lang === "th" ? "ชม." : "h" },
    { value: pad(minutes), label: lang === "th" ? "นาที" : "m" },
    { value: pad(seconds), label: lang === "th" ? "วินาที" : "s" },
  ];

  return (
    <>
      <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: "#F8FAFF", border: "1px solid #C3DEFF" }}>
        {/* Top row: label + countdown */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-2.5">
          <div className="flex items-start gap-2 flex-1">
            <span className="text-base leading-snug mt-0.5 shrink-0">🎁</span>
            <span className="font-semibold text-sm sm:text-[15px] leading-snug" style={{ color: "#1A2B4A" }}>
              {lang === "th"
                ? <>Early Adopter — หมดเขต 30 มิ.ย. 2569<br />หรือเมื่อครบ 50 ทีมแรก</>
                : <>Early Adopter — Ends June 30, 2026<br />or first 50 accounts</>}
            </span>
          </div>
          {/* Countdown boxes — fixed width to prevent layout shift */}
          <div className="flex items-center gap-1 shrink-0">
            {units.map((unit, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="flex flex-col items-center rounded-lg py-1.5 w-[52px]" style={{ background: "#F0F4FF", border: "0.5px solid #C3DEFF" }}>
                  <span className="text-2xl sm:text-3xl font-bold tabular-nums leading-none" style={{ color: "#1A2B4A" }}>{unit.value}</span>
                  <span className="text-[11px] sm:text-xs mt-0.5 font-medium" style={{ color: "#64748B" }}>{unit.label}</span>
                </div>
                {i < 3 && <span className="font-bold text-xl px-0.5" style={{ color: "#C3DEFF" }}>:</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200 dark:border-slate-700" />

        {/* Bottom row: price + button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 py-4 bg-white dark:bg-slate-900">
          <div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">฿181</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">{lang === "th" ? "/เดือน ยกเลิกได้ทุกเมื่อ" : "/mo locked-in"}</span>
              <span className="text-sm text-slate-400 line-through">฿259</span>
              <span className="text-xs font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">ลด 30%</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {lang === "th"
                ? "ล็อคราคานี้ตราบใดที่ใช้งานต่อเนื่อง + ฟรี การช่วยตั้งค่าตารางเวรในการใช้งานครั้งแรก"
                : "Price locked as long as you stay subscribed + free first-time schedule setup"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              <Link href="/pricing" className="inline-flex items-center gap-0.5 text-primary hover:text-primary/80 dark:text-primary dark:hover:text-primary/80 font-medium transition-colors">
                {lang === "th" ? "ดูราคาทีมใหญ่กว่าที่หน้าราคา →" : "See larger team pricing →"}
              </Link>
            </p>
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <button
              onClick={() => setQrOpen(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#06C755] hover:bg-[#05b34d] text-white font-semibold text-sm transition-colors shadow-sm min-w-[180px] text-center"
              data-testid="button-banner-line"
            >
              <SiLine className="w-4 h-4 shrink-0" />
              <span className="leading-snug">
                {lang === "th" ? <>แอดไลน์เพื่อจองสิทธิ์<br />Early Adopter</> : <>Add LINE to reserve<br />Early Adopter</>}
              </span>
            </button>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">@shift-optimizer</span>
          </div>
        </div>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle className="text-center">
              {lang === "th" ? "สแกน QR เพื่อแอดไลน์" : "Scan QR to Add LINE"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <img
              src="/line-qr.png"
              alt="LINE QR Code @shift-optimizer"
              className="w-52 h-52 object-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-white"
            />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">@shift-optimizer</span>
            <a
              href="https://line.me/ti/p/~@shift-optimizer"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#06C755] hover:bg-[#05b34d] text-white font-semibold text-sm transition-colors"
            >
              <SiLine className="w-4 h-4 shrink-0" />
              {lang === "th" ? "เปิดใน LINE" : "Open in LINE"}
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

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
        className="w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-left bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
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
            <p className="px-5 sm:px-6 pb-5 sm:pb-6 text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900">{a}</p>
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
  const [showLineQR, setShowLineQR] = useState(false);

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
        const el = document.querySelector(hash);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - 96;
          window.scrollTo({ top, behavior: "smooth" });
        }
      }, 600);
    }
  }, []);

  const painPoints = [
    { icon: Clock, text: "ใช้เวลาหลายชั่วโมงทุกเดือนในการจัดเวร" },
    { icon: AlertTriangle, text: "เวรชน คนไม่พอ ต้องแก้ซ้ำหลายรอบ" },
    { icon: Users, text: "ทีมรู้สึกเวรไม่แฟร์ เกิดข้อร้องเรียน" },
    { icon: RefreshCw, text: "เปลี่ยนเวรฉุกเฉินแล้วกระทบทั้งตาราง" },
    { icon: ClipboardX, text: "ตรวจสอบกฎการทำงานด้วยมือ เสี่ยงผิดพลาด" },
    { icon: Briefcase, text: "หัวหน้าทีมเสียเวลากับงานเอกสาร แทนงานสำคัญกว่า" },
  ];

  const outcomes = [
    {
      icon: Clock,
      title: "ลดเวลาจัดเวรจากหลายชั่วโมงเหลือไม่กี่นาที",
      desc: "ระบบ AI คำนวณตารางที่สมดุลให้โดยอัตโนมัติ คุณแค่ตั้งค่าและกดสร้าง",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      icon: Scale,
      title: "กระจายเวรยุติธรรม ลดข้อร้องเรียน",
      desc: "AI กระจายภาระงานสมดุล ขจัดอคติ ลดข้อร้องเรียน กระจายเวรวันหยุดเท่าเทียมทุกคน",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      icon: Puzzle,
      title: "รองรับกฎและเงื่อนไขซับซ้อน",
      desc: "บล็อกวันลา เวรที่ร้องขอ ห้ามเวรต่อเนื่อง ระดับบุคลากร 5 ระดับ ตั้งครั้งเดียวใช้ได้เลย",
      bg: "bg-violet-50 dark:bg-violet-950/40",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
    {
      icon: FileSpreadsheet,
      title: "ส่งออก Excel พร้อมใช้งานทันที",
      desc: "ส่งออกไฟล์ Excel แยกสีตามเวร รายบุคคล รายแผนก พร้อมพิมพ์แจกทีมทันที",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
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

  const comparisonRows = [
    { topic: "วิธีการทำงานหลัก", excel: "ต้องจัดตารางด้วยตนเอง แล้วค่อยตรวจสอบทีหลังเมื่อมีเวรชน ผิดกฎ หรือคนไม่พอ", ai: "AI ประมวลผลเงื่อนไขทั้งหมด และสร้างตารางที่พร้อมใช้งานทันทีตั้งแต่ต้น" },
    { topic: "การแก้ปัญหาเวรชน / เวรซ้อน", excel: "ระบบอาจแจ้งเตือน แต่ผู้จัดต้องไล่แก้และสลับเวรเองทีละคน", ai: "AI คำนวณความเป็นไปได้จำนวนมาก เพื่อหลีกเลี่ยงเวรชนและหาคำตอบที่เหมาะสมอัตโนมัติ" },
    { topic: "ความยุติธรรมในการจัดเวร", excel: "มักอาศัยประสบการณ์หรือการตัดสินใจของผู้จัด อาจเกิดข้อโต้แย้งเรื่องความไม่เท่าเทียม", ai: "AI กระจายเวรอย่างสมดุล โดยคำนึงถึงภาระงาน OT วันหยุด และความเหมาะสมของแต่ละคน" },
    { topic: "ข้อกำหนดทางกฎหมาย / นโยบายองค์กร", excel: "ต้องสร้างสูตรและตรวจสอบเอง เช่น ชั่วโมงงานสูงสุด หรือวันทำงานต่อเนื่อง", ai: "ตั้งกฎไว้ครั้งเดียว ระบบจะไม่สร้างตารางที่ผิดข้อกำหนด" },
    { topic: "เวลาที่ใช้ในการจัดตาราง", excel: "อาจใช้เวลาหลายชั่วโมงหรือหลายวัน เมื่อทีมใหญ่และเงื่อนไขซับซ้อน", ai: "ใช้เวลาเพียงไม่กี่นาที แม้มีบุคลากรจำนวนมาก" },
    { topic: "การแก้ไขเมื่อมีการเปลี่ยนเวรฉุกเฉิน", excel: "ต้องปรับตารางเองใหม่ เสี่ยงกระทบคนอื่นทั้งระบบ", ai: "AI ช่วยคำนวณตัวเลือกใหม่อย่างรวดเร็ว พร้อมลดผลกระทบต่อทีม" },
    { topic: "รายงาน / เอกสารใช้งานต่อ", excel: "ต้องแยกทำเองหลายไฟล์ หรือคัดลอกข้อมูลซ้ำ", ai: "สร้างตารางรายบุคคล รายแผนก และไฟล์พร้อมใช้งานได้ทันที" },
    { topic: "การเติบโตขององค์กร", excel: "ยิ่งคนเยอะ ยิ่งซับซ้อน และดูแลยาก", ai: "รองรับทีมขนาดเล็กถึงองค์กรขนาดใหญ่ได้อย่างมีประสิทธิภาพ" },
  ];

  return (
    <LazyMotion features={domAnimation}>
    <div className="min-h-screen bg-white dark:bg-slate-950 overflow-x-hidden">
      <Navbar isHomePage />

      <main>
        {/* ── 1. HERO ── */}
        <section className="relative min-h-[100svh] flex flex-col justify-center pt-20 pb-16 px-4 sm:px-6">
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/8 via-transparent to-transparent rounded-full" />
            <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-blue-100/40 dark:bg-blue-900/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-teal-100/40 dark:bg-teal-900/10 rounded-full blur-3xl" />
            <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.08) 1px, transparent 0)", backgroundSize: "40px 40px" }} />
          </div>

          <div className="relative max-w-4xl mx-auto text-center">
            <m.div initial="hidden" animate="visible" variants={staggerContainer}>
              <m.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 bg-primary/8 dark:bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6">
                <CheckCircle2 className="w-4 h-4" />
                ใช้งานแล้วใน 40+ แผนก
              </m.div>

              <m.h1 variants={fadeUp} custom={1} className="text-4xl sm:text-5xl md:text-[3.25rem] lg:text-6xl font-display font-bold text-slate-900 dark:text-white leading-[1.2] tracking-tight text-center" data-testid="text-hero-title">
                <span className="block">โปรแกรมจัดตารางเวรพยาบาลด้วย AI</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">ลดเวลาจัดเวร 90%</span>
              </m.h1>

              <m.p variants={fadeUp} custom={2} className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed" data-testid="text-hero-subtitle">
                แทน Excel ได้ทันที กระจายเวรอย่างยุติธรรม<br className="hidden sm:block" />
                เหมาะสำหรับโรงพยาบาล คลินิก และทีมบุคลากรทางการแพทย์
              </m.p>

              <m.div variants={fadeUp} custom={3} className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center">
                <Link href="/create" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-primary/25 text-base px-7 py-6 text-base font-semibold" data-testid="button-create-schedule">
                    ทดลองใช้ฟรี
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <a
                  href="#how-it-works"
                  onClick={(e) => {
                    e.preventDefault();
                    const el = document.getElementById("how-it-works");
                    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: "smooth" });
                  }}
                  className="w-full sm:w-auto"
                >
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-7 py-6 font-semibold" data-testid="button-how-it-works">
                    ดูวิธีใช้งาน
                  </Button>
                </a>
              </m.div>

              <m.div variants={fadeUp} custom={4} className="mt-8 w-full max-w-3xl mx-auto">
                <EarlyAdopterBanner lang={lang} />
              </m.div>
            </m.div>
          </div>
        </section>

        {/* ── 2. SOCIAL PROOF / STATS ── */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 bg-slate-50 dark:bg-slate-900/60 border-y border-slate-100 dark:border-slate-800/50">
          <div className="max-w-5xl mx-auto">
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={staggerContainer}
            >
              <m.div variants={fadeUp} custom={0} className="text-center mb-10 sm:mb-14">
                <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-slate-400 dark:text-slate-500 mb-2" data-testid="text-stats-label">
                  {t.statsSectionLabel}
                </p>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white" data-testid="text-stats-title">
                  {t.statsSectionTitle}
                </h2>
              </m.div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
                {[
                  { target: parseInt(t.stat1Value), label: t.stat1Label, testId: "stat-departments" },
                  { target: parseInt(t.stat2Value), label: t.stat2Label, testId: "stat-schedules" },
                  { target: parseInt(t.stat3Value), label: t.stat3Label, testId: "stat-mandays" },
                ].map((stat, i) => (
                  <m.div key={i} variants={fadeUp} custom={i + 1} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 flex flex-col items-center gap-3 text-center" data-testid={stat.testId}>
                    <span className="text-6xl sm:text-7xl font-display font-extrabold text-primary leading-none tracking-tight">
                      <CountUp target={stat.target} suffix="+" />
                    </span>
                    <span className="text-sm sm:text-base font-medium text-slate-600 dark:text-slate-300 max-w-[180px] leading-snug">
                      {stat.label.split("\n").map((line: string, j: number) => (
                        <span key={j}>{line}{j < stat.label.split("\n").length - 1 && <br />}</span>
                      ))}
                    </span>
                  </m.div>
                ))}
              </div>
            </m.div>
          </div>
        </section>

        {/* ── 3. PAIN SECTION ── */}
        <section className="py-20 sm:py-28 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={staggerContainer}
            >
              <m.div variants={fadeUp} custom={0} className="text-center mb-12 sm:mb-14">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white mb-4">
                  ยังใช้ Excel จัดตารางเวรอยู่หรือไม่?
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
                  เมื่อทีมโตขึ้น การจัดเวรด้วยมือจะเริ่มเสียเวลา และเกิดปัญหาซ้ำเดิมทุกเดือน
                </p>
              </m.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {painPoints.map((point, i) => (
                  <m.div key={i} variants={fadeUp} custom={i + 1}>
                    <div className="flex items-start gap-4 p-5 sm:p-6 rounded-2xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 hover:border-orange-200 dark:hover:border-orange-800/50 hover:shadow-md hover:shadow-orange-100/50 dark:hover:shadow-orange-900/20 transition-all duration-200 h-full">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0 mt-0.5">
                        <point.icon className="w-5 h-5 text-orange-600 dark:text-orange-400" aria-hidden="true" />
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 text-sm sm:text-base font-medium leading-relaxed">
                        {point.text}
                      </p>
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

        {/* ── 4. BENEFITS / OUTCOMES ── */}
        <section id="features" className="scroll-mt-24 py-20 sm:py-28 px-4 sm:px-6 bg-slate-50/80 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-800/50">
          <div className="max-w-6xl mx-auto">
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
            >
              <m.div variants={fadeUp} custom={0} className="text-center mb-14 sm:mb-16">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white" data-testid="text-features-title">
                  เปลี่ยนงานจัดเวรที่ยุ่งยาก ให้เป็นเรื่องง่าย
                </h2>
                <p className="mt-3 text-slate-600 dark:text-slate-300 text-base sm:text-lg max-w-2xl mx-auto">
                  ระบบที่ออกแบบมาสำหรับโรงพยาบาลโดยเฉพาะ ช่วยลดเวลา ลดความผิดพลาด และลดข้อร้องเรียนในทีม
                </p>
              </m.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {outcomes.map((item, i) => (
                  <m.div key={i} variants={fadeUp} custom={i + 1} data-testid={`card-feature-${i}`}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 h-full hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-shadow duration-300">
                      <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center mb-5`}>
                        <item.icon className={`w-6 h-6 ${item.iconColor}`} aria-hidden="true" />
                      </div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2 leading-snug" data-testid={`text-feature-title-${i}`}>
                        {item.title}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed" data-testid={`text-feature-desc-${i}`}>
                        {item.desc}
                      </p>
                    </div>
                  </m.div>
                ))}
              </div>
              <m.div variants={fadeUp} custom={5} className="mt-10 text-center">
                <Link href="/โปรแกรมจัดเวรพนักงาน" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors" data-testid="link-staff-scheduling">
                  ใช้กับธุรกิจบริการอื่นๆ ได้อีกมาก → ดูทั้งหมด
                </Link>
              </m.div>
            </m.div>
          </div>
        </section>

        {/* ── 5. EXCEL vs AI COMPARISON ── */}
        <section id="about" className="scroll-mt-24 py-20 sm:py-28 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
            >
              <m.div variants={fadeUp} custom={0} className="text-center mb-10 sm:mb-12">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white" data-testid="text-what-is-title">
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
                      <th className="text-left px-4 sm:px-6 py-4 font-semibold text-slate-600 dark:text-slate-300 w-[28%] border-b border-slate-200 dark:border-slate-700">
                        หัวข้อเปรียบเทียบ
                      </th>
                      <th className="text-left px-4 sm:px-6 py-4 font-semibold text-amber-700 dark:text-amber-400 w-[36%] border-b border-slate-200 dark:border-slate-700">
                        <span className="inline-flex items-center gap-2">
                          <span className="text-lg">📊</span> Excel / Google Sheets
                        </span>
                      </th>
                      <th className="text-left px-4 sm:px-6 py-4 font-semibold text-primary w-[36%] border-b border-slate-200 dark:border-slate-700 bg-primary/3 dark:bg-primary/5">
                        <span className="inline-flex items-center gap-2">
                          <span className="text-lg">✨</span> AI Scheduling (Shift Optimizer)
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/60 dark:bg-slate-800/30"}>
                        <td className="px-4 sm:px-6 py-4 font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 align-top text-sm">
                          {row.topic}
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 align-top">
                          <span className="inline-flex gap-2">
                            <span className="text-orange-400 mt-0.5 shrink-0 font-bold">✗</span>
                            <span>{row.excel}</span>
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 align-top bg-primary/2 dark:bg-primary/3">
                          <span className="inline-flex gap-2">
                            <span className="text-emerald-500 mt-0.5 shrink-0 font-bold">✓</span>
                            <span>{row.ai}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </m.div>
            </m.div>
          </div>
        </section>

        {/* ── 6. HOW IT WORKS ── */}
        <section id="how-it-works" className="scroll-mt-24 py-20 sm:py-28 px-4 sm:px-6 bg-slate-50/80 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-800/50">
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
                  <m.div key={i} variants={fadeUp} custom={i + 1} className="relative group">
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

        {/* ── 7. FAQ ── */}
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

        {/* ── ARTICLES ── */}
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

        {/* ── 8. FINAL CTA ── */}
        <section className="py-20 sm:py-28 px-4 sm:px-6 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 dark:from-primary/10 dark:to-accent/10 border-t border-slate-100 dark:border-slate-800/50">
          <div className="max-w-3xl mx-auto text-center">
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
            >
              <m.h2 variants={fadeUp} custom={0} className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white" data-testid="text-cta-title">
                เริ่มจัดตารางเวรอย่างมืออาชีพวันนี้
              </m.h2>
              <m.p variants={fadeUp} custom={1} className="mt-4 text-slate-600 dark:text-slate-300 text-base sm:text-lg">
                ลดเวลา ลดความวุ่นวาย เพิ่มความยุติธรรมให้ทีมของคุณ
              </m.p>
              <m.div variants={fadeUp} custom={2} className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
                <Link href="/create">
                  <Button size="lg" className="shadow-lg shadow-primary/25 text-base px-7 py-6 font-semibold" data-testid="button-cta-bottom">
                    ทดลองใช้ฟรี
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <a
                  href="#contact"
                  onClick={(e) => {
                    e.preventDefault();
                    const el = document.getElementById("contact");
                    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: "smooth" });
                  }}
                >
                  <Button size="lg" variant="outline" className="text-base px-7 py-6 font-semibold" data-testid="button-cta-contact">
                    ติดต่อเรา
                  </Button>
                </a>
              </m.div>
            </m.div>
          </div>
        </section>
      </main>

      {/* ── 9. CONTACT ── */}
      <section id="contact" className="border-t border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/50 py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
          >
            <m.div variants={fadeUp} custom={0} className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white mb-4" data-testid="text-contact-title">
                ติดต่อเรา
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-base sm:text-lg max-w-xl mx-auto">
                มีคำถาม ต้องการเดโม หรือสนใจใช้งานในองค์กร ทีมงานพร้อมช่วยเหลือ
              </p>
            </m.div>

            <m.div variants={fadeUp} custom={1} className="grid sm:grid-cols-3 gap-5 mb-10">
              <a
                href="mailto:contact@shift-optimizer.com"
                className="flex flex-col items-center gap-4 p-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group"
                data-testid="link-contact-email"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Mail className="w-7 h-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-900 dark:text-white mb-1">Email</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">contact@shift-optimizer.com</p>
                </div>
              </a>

              <a
                href="https://www.facebook.com/profile.php?id=61564671372755"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-4 p-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-400/40 transition-all group"
                data-testid="link-contact-facebook"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors">
                  <SiFacebook className="w-7 h-7 text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-900 dark:text-white mb-1">Facebook</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Shift Optimizer</p>
                </div>
              </a>

              <button
                onClick={() => setShowLineQR(true)}
                className="flex flex-col items-center gap-4 p-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-green-400/40 transition-all group"
                data-testid="button-contact-line"
              >
                <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center group-hover:bg-green-100 dark:group-hover:bg-green-900/40 transition-colors">
                  <SiLine className="w-7 h-7 text-green-500" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-900 dark:text-white mb-1">LINE Official</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">@shift-optimizer</p>
                </div>
              </button>
            </m.div>

          </m.div>
        </div>
      </section>

      {/* LINE QR popup */}
      {showLineQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowLineQR(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl max-w-xs w-full mx-4 flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <SiLine className="w-6 h-6 text-green-500" />
                <span className="font-bold text-slate-900 dark:text-white text-lg">LINE Official</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">@shift-optimizer</p>
            </div>
            <img
              src="/line-qr.png"
              alt="LINE QR Code @shift-optimizer"
              className="w-52 h-52 rounded-lg"
            />
            <p className="text-xs text-slate-400 text-center">สแกน QR Code เพื่อเพิ่มเพื่อนใน LINE</p>
            <button
              onClick={() => setShowLineQR(false)}
              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
            >
              ปิด
            </button>
          </div>
        </div>
      )}

      <footer className="border-t border-slate-100 dark:border-slate-800/50 py-6 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="Shift Optimizer" width="20" height="20" className="w-5 h-5 rounded" />
            <span data-testid="text-footer-app-name">{t.appName}</span>
          </div>
          <span data-testid="text-footer-copyright">Copyright &copy; 2026 Shift Optimizer All rights reserved.</span>
        </div>
      </footer>
    </div>
    </LazyMotion>
  );
}
