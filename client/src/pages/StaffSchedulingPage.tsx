import { Link } from "wouter";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { LazyMotion, domAnimation, m, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  ArrowRight, ChevronDown, Settings, Users, FileSpreadsheet, CalendarDays, Mail,
} from "lucide-react";
import { SiFacebook, SiLine } from "react-icons/si";

// ── animation variants ─────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] },
  }),
};
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

// ── inline SVG icons (stroke, 32×32) ──────────────────────────
const IconFork = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#0EA5E9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 4v7a4 4 0 0 0 4 4v13" />
    <path d="M12 4v5" />
    <path d="M8 4v5" />
    <path d="M22 4c0 0 2 3 2 8s-2 7-2 7v9" />
  </svg>
);
const IconHotel = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#0EA5E9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="10" width="24" height="18" rx="1" />
    <path d="M10 28V16h12v12" />
    <path d="M13 20h2M17 20h2M13 24h2M17 24h2" />
    <path d="M10 10V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4" />
    <path d="M16 4v6" />
  </svg>
);
const IconHeadphone = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#0EA5E9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20v-4a12 12 0 0 1 24 0v4" />
    <rect x="4" y="20" width="4" height="7" rx="2" />
    <rect x="24" y="20" width="4" height="7" rx="2" />
  </svg>
);
const IconBag = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#0EA5E9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9h20l-2 17H8L6 9Z" />
    <path d="M11 9V7a5 5 0 0 1 10 0v2" />
  </svg>
);

// ── FAQ accordion ──────────────────────────────────────────────
function FAQItem({ q, a, i }: { q: string; a: string; i: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-left bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        data-testid={`faq-toggle-${i}`}
      >
        <h3 className="font-semibold text-base text-slate-900 dark:text-white">{q}</h3>
        <ChevronDown className={`w-5 h-5 shrink-0 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
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

// ── data ───────────────────────────────────────────────────────
const verticalCards = [
  {
    Icon: IconFork,
    title: "ร้านอาหาร ร้านกาแฟ และธุรกิจ F&B",
    problem: "ช่วงพีคเที่ยงและเย็นคือหัวใจของธุรกิจ แต่การจัดคนให้พอทุกช่วงโดยไม่ให้ใครแบกเวรหนักเกินไปเป็นเรื่องยาก โดยเฉพาะเมื่อมีพนักงาน part-time ที่เวลาว่างไม่ตรงกัน",
    solution: "Shift Optimizer ช่วยกำหนดจำนวนคนขั้นต่ำในแต่ละช่วง กระจายเวรเปิด-ปิดร้านให้ทั่วถึง และจัดตารางโดยไม่ชนวันว่างของใคร",
  },
  {
    Icon: IconHotel,
    title: "โรงแรม รีสอร์ท และทีม Hospitality",
    problem: "ธุรกิจโรงแรมต้องให้บริการตลอด 24 ชั่วโมง การจัดเวร front desk, housekeeping และทีมอาหารเช้าให้สอดคล้องกันโดยไม่มี OT สะสมเป็นงานที่ซับซ้อนกว่าที่ Excel จะรับไหว",
    solution: "Shift Optimizer จัดเวรครอบคลุมทุกกะ ลด OT และแจ้งเตือนเมื่อมีช่วงที่คนไม่พอก่อนที่จะเป็นปัญหา",
  },
  {
    Icon: IconHeadphone,
    title: "Call Center และทีม Customer Support",
    problem: "ปริมาณงานขึ้นลงตามช่วงเวลา การจัดคนให้พอในช่วง volume สูงโดยไม่ให้ทีมรู้สึกว่าเวรไม่แฟร์เป็นสิ่งที่ผู้จัดต้องแบกรับทุกเดือน",
    solution: "Shift Optimizer กระจายภาระงานอย่างสมดุล รองรับพนักงานหลาย skill level และปรับตารางได้ทันทีเมื่อมีคนลากะทันหัน",
  },
  {
    Icon: IconBag,
    title: "ร้านค้าปลีก และทีมบริการอื่นๆ",
    problem: "ไม่ว่าธุรกิจของคุณจะเรียกกะว่าอะไร และมีเงื่อนไขแบบไหน ระบบปรับชื่อกะ จำนวนคน และกฎได้เองทั้งหมด ไม่มี template ตายตัว",
    solution: null,
  },
];

const features = [
  {
    icon: Settings,
    title: "ตั้งชื่อกะได้เอง ไม่มี template ตายตัว",
    desc: "ระบบไม่บังคับว่ากะต้องชื่ออะไร คุณกำหนดเองได้ทั้งหมดให้ตรงกับการทำงานจริง",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    icon: CalendarDays,
    title: "จัดคนต่างจำนวนตามวัน",
    desc: "วันธรรมดาต้องการ 3 คน วันหยุดต้องการ 5 คน ตั้งได้แยกกันโดยไม่ต้องแก้ตารางเองทุกสัปดาห์",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    icon: Users,
    title: "รองรับทีมผสม full-time และ part-time",
    desc: "บันทึกวันว่างและข้อจำกัดของแต่ละคนแยกกัน AI จัดเวรโดยไม่ชนเงื่อนไขของใครเลย",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: FileSpreadsheet,
    title: "ส่งออก Excel พร้อมแจกทีมทันที",
    desc: "ได้ไฟล์พร้อมใช้งาน แยกรายคนและรายทีม ใน 1 คลิก ไม่ต้องฟอร์แมตเอง",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
];

const faqs = [
  {
    q: "ใช้กับธุรกิจที่ไม่ใช่โรงพยาบาลได้จริงไหม?",
    a: "ได้ครับ ระบบไม่ได้ผูกกับคำศัพท์ทางการแพทย์ คุณตั้งชื่อกะ กำหนดจำนวนคน และใส่เงื่อนไขได้เองทั้งหมด ธุรกิจบริการทุกประเภทที่มีกะหมุนเวียนใช้ได้เลย",
  },
  {
    q: "พนักงานขอเลือกวันหยุดหรือวันที่อยากอยู่เวรเองได้ไหม?",
    a: "ได้ครับ ผู้จัดสามารถบันทึกคำขอของแต่ละคนไว้ล่วงหน้าได้ ทั้งวันที่ขอหยุดและวันที่อยากอยู่เวร AI จะพยายามจัดให้ตามที่ขอ โดยไม่กระทบความสมดุลของตาราง",
  },
  {
    q: "มีพนักงาน part-time และ full-time ปนกัน ระบบรองรับได้ไหม?",
    a: "รองรับครับ บันทึกวันว่างและข้อจำกัดของแต่ละคนแยกกันได้ AI จะจัดเวรโดยไม่ชนเงื่อนไขของใครเลย",
  },
  {
    q: "โปรแกรมรองรับพนักงานได้สูงสุดกี่คน?",
    a: "รองรับได้สูงสุด 50 คนต่อทีมครับ เหมาะสำหรับธุรกิจบริการตั้งแต่ร้านขนาดเล็กไปจนถึงทีมขนาดกลางที่มีหลายกะหมุนเวียน",
  },
];

// ── page ───────────────────────────────────────────────────────
export default function StaffSchedulingPage() {
  const [showLineQR, setShowLineQR] = useState(false);

  useEffect(() => {
    document.title = "โปรแกรมจัดเวรพนักงาน สำหรับทุกธุรกิจที่มีกะและเวร | Shift Optimizer";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", "โปรแกรมจัดเวรพนักงานด้วย AI เหมาะสำหรับร้านอาหาร โรงแรม Call Center และธุรกิจบริการทุกประเภท จัดเวรอัตโนมัติ ลด OT กระจายเวรยุติธรรม ส่งออก Excel ได้ทันที");
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = "https://shift-optimizer.com/";
  }, []);

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen bg-white dark:bg-slate-950 overflow-x-hidden">
        <Navbar isHomePage logoSubtitle="ระบบจัดตารางเวร" />

        <main>
          {/* ── HERO ── */}
          <section
            className="relative min-h-[80svh] flex flex-col justify-center pt-24 pb-16 px-4 sm:px-6"
            style={{ background: "#FFFFFF" }}
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
              <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.06) 1px, transparent 0)", backgroundSize: "40px 40px" }} />
            </div>
            <div className="relative max-w-4xl mx-auto text-center">
              <m.div initial="hidden" animate="visible" variants={staggerContainer}>
                <m.h1
                  variants={fadeUp} custom={0}
                  className="text-4xl sm:text-5xl md:text-[3.25rem] lg:text-6xl font-display font-bold text-slate-900 leading-[1.2] tracking-tight"
                  data-testid="text-hero-title"
                >
                  <span className="block">โปรแกรมจัดเวรพนักงาน</span>
                  <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg, #F5A623 0%, #F97316 100%)" }}>
                    สำหรับทุกธุรกิจที่มีกะและเวร
                  </span>
                </m.h1>
                <m.p
                  variants={fadeUp} custom={1}
                  className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed"
                  data-testid="text-hero-subtitle"
                >
                  ไม่ว่าทีมคุณจะเป็นพนักงานร้านอาหาร สตาฟโรงแรม หรือเจ้าหน้าที่ Call Center — ปัญหาจัดเวรเหมือนกันทุกที่ Shift Optimizer แก้ได้ทุก vertical ด้วย AI ตัวเดียว
                </m.p>
                <m.div variants={fadeUp} custom={2} className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <Link href="/create" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-primary/25 text-base px-7 py-6 font-semibold" data-testid="button-hero-primary">
                      ทดลองใช้ฟรี <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/pricing" className="w-full sm:w-auto">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-7 py-6 font-semibold" data-testid="button-hero-pricing">
                      ดูราคาและแผน
                    </Button>
                  </Link>
                </m.div>
              </m.div>
            </div>
          </section>

          {/* ── VERTICAL CARDS ── */}
          <section id="features" className="py-20 sm:py-28 px-4 sm:px-6 bg-slate-50/80 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-800/50">
            <div className="max-w-5xl mx-auto">
              <m.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={staggerContainer}>
                <m.div variants={fadeUp} custom={0} className="text-center mb-12">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white">
                    ธุรกิจของคุณอยู่ในกลุ่มไหน?
                  </h2>
                  <p className="mt-3 text-slate-600 dark:text-slate-300 text-base sm:text-lg max-w-2xl mx-auto">
                    แต่ละธุรกิจมีชื่อกะ จำนวนคน และเงื่อนไขที่ต่างกัน Shift Optimizer ปรับได้ทั้งหมด ไม่ต้องง้อโปรแกรมเฉพาะทาง
                  </p>
                </m.div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {verticalCards.map((card, i) => (
                    <m.div key={i} variants={fadeUp} custom={i + 1}>
                      <div
                        className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden h-full flex flex-col"
                        style={{ transition: "transform 0.2s ease, box-shadow 0.2s ease" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 32px rgba(0,0,0,0.10)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
                      >
                        {/* top accent bar */}
                        <div style={{ height: "4px", background: "#F5A623" }} />
                        <div className="p-7 sm:p-8 flex flex-col flex-1">
                          <div className="mb-4">
                            <card.Icon />
                          </div>
                          <h3 className="mb-3 leading-snug" style={{ fontWeight: 700, fontSize: "18px", color: "#1A1A2E" }}>
                            {card.title}
                          </h3>
                          <p className="mb-3 leading-relaxed" style={{ color: "#4B5563", fontSize: "15px", lineHeight: 1.7 }}>
                            {card.problem}
                          </p>
                          {card.solution && (
                            <p className="font-medium mb-5 leading-relaxed text-sm" style={{ color: "#0EA5E9" }}>
                              {card.solution}
                            </p>
                          )}
                          <div className="mt-auto pt-2">
                            <Link href="/create" className="block w-full">
                              <button
                                className="w-full py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-1.5"
                                style={{ background: "#0EA5E9", borderRadius: "8px" }}
                                data-testid={`button-vertical-cta-${i}`}
                              >
                                ทดลองใช้ฟรี <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </m.div>
                  ))}
                </div>
              </m.div>
            </div>
          </section>

          {/* ── FEATURES ── */}
          <section id="how-it-works" className="py-20 sm:py-28 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
              <m.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={staggerContainer}>
                <m.div variants={fadeUp} custom={0} className="text-center mb-14">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white">
                    ระบบเดียว ปรับได้ทุกธุรกิจ
                  </h2>
                  <p className="mt-3 text-slate-600 dark:text-slate-300 text-base sm:text-lg max-w-2xl mx-auto">
                    ไม่ว่ากะของคุณจะชื่อ "เช้า-บ่าย-ดึก" หรือ "Open-Mid-Close" หรือ "A-B-C" — ระบบรองรับได้ทั้งหมด คุณเป็นคนกำหนดกฎ AI เป็นคนคำนวณ
                  </p>
                </m.div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {features.map((f, i) => (
                    <m.div key={i} variants={fadeUp} custom={i + 1}>
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 h-full hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-shadow duration-300">
                        <div className={`w-12 h-12 rounded-xl ${f.bg} flex items-center justify-center mb-5`}>
                          <f.icon className={`w-6 h-6 ${f.iconColor}`} />
                        </div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2 leading-snug">{f.title}</h3>
                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{f.desc}</p>
                      </div>
                    </m.div>
                  ))}
                </div>
              </m.div>
            </div>
          </section>

          {/* ── ABOUT ── */}
          <section id="about" className="py-20 sm:py-28 px-4 sm:px-6 border-t border-slate-100 dark:border-slate-800/50">
            <div className="max-w-3xl mx-auto">
              <m.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={staggerContainer}>
                <m.h2 variants={fadeUp} custom={0} className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white mb-6">
                  ทำไม Shift Optimizer ถึงเข้าใจปัญหาจัดเวรจริงๆ
                </m.h2>
                <m.p variants={fadeUp} custom={1} className="text-slate-600 dark:text-slate-300 text-base sm:text-lg leading-relaxed mb-5">
                  Shift Optimizer สร้างขึ้นจากประสบการณ์ตรงในการทำงานกับทีมที่ต้องจัดเวรหมุนเวียนทุกเดือน เราเห็นว่าปัญหาเดิมเกิดซ้ำในทุกธุรกิจ — ไม่ว่าจะเป็นร้านอาหาร โรงแรม หรือ Call Center — คือเวลาที่หายไปกับ Excel และความไม่แฟร์ที่ทีมรู้สึกได้
                </m.p>
                <m.p variants={fadeUp} custom={2} className="text-slate-600 dark:text-slate-300 text-base sm:text-lg leading-relaxed">
                  เราจึงสร้างระบบที่คุณเป็นคนกำหนดกฎ แล้วให้ AI คำนวณแทน ไม่มี template ตายตัว ไม่บังคับว่าธุรกิจคุณต้องเป็นแบบไหน
                </m.p>
              </m.div>
            </div>
          </section>

          {/* ── FAQ ── */}
          <section id="faq" className="py-20 sm:py-28 px-4 sm:px-6 bg-slate-50/80 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800/50">
            <div className="max-w-3xl mx-auto">
              <m.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={staggerContainer}>
                <m.div variants={fadeUp} custom={0} className="text-center mb-10">
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

          {/* ── CONTACT ── */}
          <section id="contact" className="border-t border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/50 py-20 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto">
              <m.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={staggerContainer}>
                <m.div variants={fadeUp} custom={0} className="text-center mb-12">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white mb-4">
                    ติดต่อเรา
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-base sm:text-lg max-w-xl mx-auto">
                    มีคำถาม ต้องการเดโม หรือสนใจใช้งานในองค์กร ทีมงานพร้อมช่วยเหลือ
                  </p>
                </m.div>
                <m.div variants={fadeUp} custom={1} className="grid sm:grid-cols-3 gap-5">
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

          {/* ── CLOSING CTA ── */}
          <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-slate-100 dark:border-slate-800/50">
            <div className="max-w-3xl mx-auto text-center">
              <m.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={staggerContainer}>
                <m.h2 variants={fadeUp} custom={0} className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white">
                  เริ่มจัดเวรอย่างมืออาชีพวันนี้
                </m.h2>
                <m.p variants={fadeUp} custom={1} className="mt-4 text-slate-600 dark:text-slate-300 text-base sm:text-lg">
                  ทดลองใช้ฟรี ไม่ต้องใส่บัตรเครดิต ตั้งค่าได้ภายใน 15 นาที
                </m.p>
                <m.div variants={fadeUp} custom={2} className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <Link href="/create">
                    <Button size="lg" className="shadow-lg shadow-primary/25 text-base px-7 py-6 font-semibold" data-testid="button-cta-bottom">
                      ทดลองใช้ฟรี <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </m.div>
                <m.p variants={fadeUp} custom={3} className="mt-6 text-sm text-slate-500 dark:text-slate-400">
                  สำหรับโรงพยาบาลและคลินิก →{" "}
                  <Link
                    href="/"
                    className="text-primary hover:underline font-medium"
                    onClick={() => window.scrollTo({ top: 0, behavior: "instant" })}
                  >
                    ดูที่นี่
                  </Link>
                </m.p>
              </m.div>
            </div>
          </section>
        </main>

        {/* ── LINE QR popup ── */}
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
              <img src="/line-qr.png" alt="LINE QR Code @shift-optimizer" className="w-52 h-52 rounded-lg" />
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

        {/* ── FOOTER ── */}
        <footer className="border-t border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/50 py-10 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <img src="/favicon.svg" alt="" className="w-5 h-5 rounded" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">Shift Optimizer</span>
            </div>
            <span>© {new Date().getFullYear()} Shift Optimizer All rights reserved.</span>
            <Link href="/privacy-policy" className="hover:text-primary transition-colors">นโยบายความเป็นส่วนตัว</Link>
          </div>
        </footer>
      </div>
    </LazyMotion>
  );
}
