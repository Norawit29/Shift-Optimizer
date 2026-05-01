import { Link } from "wouter";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { LazyMotion, domAnimation, m, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  ArrowRight, ChevronDown, Settings, Users, FileSpreadsheet, CalendarDays,
} from "lucide-react";
import { SiLine } from "react-icons/si";

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
    emoji: "🍽️",
    title: "ร้านอาหาร ร้านกาแฟ และธุรกิจ F&B",
    problem: "ช่วงพีคเที่ยงและเย็นคือหัวใจของธุรกิจ แต่การจัดคนให้พอทุกช่วงโดยไม่ให้ใครแบกเวรหนักเกินไปเป็นเรื่องยาก โดยเฉพาะเมื่อมีพนักงาน part-time ที่เวลาว่างไม่ตรงกัน",
    solution: "Shift Optimizer ช่วยกำหนดจำนวนคนขั้นต่ำในแต่ละช่วง กระจายเวรเปิด-ปิดร้านให้ทั่วถึง และจัดตารางโดยไม่ชนวันว่างของใคร",
  },
  {
    emoji: "🏨",
    title: "โรงแรม รีสอร์ท และทีม Hospitality",
    problem: "ธุรกิจโรงแรมต้องให้บริการตลอด 24 ชั่วโมง การจัดเวร front desk, housekeeping และทีมอาหารเช้าให้สอดคล้องกันโดยไม่มี OT สะสมเป็นงานที่ซับซ้อนกว่าที่ Excel จะรับไหว",
    solution: "Shift Optimizer จัดเวรครอบคลุมทุกกะ ลด OT และแจ้งเตือนเมื่อมีช่วงที่คนไม่พอก่อนที่จะเป็นปัญหา",
  },
  {
    emoji: "🎧",
    title: "Call Center และทีม Customer Support",
    problem: "ปริมาณงานขึ้นลงตามช่วงเวลา การจัดคนให้พอในช่วง volume สูงโดยไม่ให้ทีมรู้สึกว่าเวรไม่แฟร์เป็นสิ่งที่ผู้จัดต้องแบกรับทุกเดือน",
    solution: "Shift Optimizer กระจายภาระงานอย่างสมดุล รองรับพนักงานหลาย skill level และปรับตารางได้ทันทีเมื่อมีคนลากะทันหัน",
  },
  {
    emoji: "🏪",
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
    q: "ถ้ากะงานไม่ได้แบ่งเป็นเช้า-บ่าย-ดึก ปรับชื่อเองได้ไหม?",
    a: "ได้ครับ จะตั้งเป็น Open/Mid/Close, A/B/C หรือชื่ออื่นใดก็ได้ ระบบยึดตามที่คุณกำหนด ไม่ใช่ template ตายตัว",
  },
  {
    q: "มีพนักงาน part-time และ full-time ปนกัน ระบบรองรับได้ไหม?",
    a: "รองรับครับ บันทึกวันว่างและข้อจำกัดของแต่ละคนแยกกันได้ AI จะจัดเวรโดยไม่ชนเงื่อนไขของใครเลย",
  },
  {
    q: "แตกต่างจากโปรแกรมจัดเวรพยาบาลอย่างไร?",
    a: "โปรแกรมสำหรับโรงพยาบาลเน้นเงื่อนไขเฉพาะทาง เช่น on-call ระดับบุคลากร 5 ระดับ และกฎสภาการพยาบาล หน้านี้เหมาะสำหรับธุรกิจบริการทั่วไปที่ต้องการความยืดหยุ่นในการตั้งค่าเอง",
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
    canonical.href = `${window.location.origin}/โปรแกรมจัดเวรพนักงาน`;
  }, []);

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen bg-white dark:bg-slate-950 overflow-x-hidden">
        <Navbar isHomePage logoSubtitle="ระบบจัดตารางเวร" />

        <main>
          {/* ── HERO ── */}
          <section className="relative min-h-[80svh] flex flex-col justify-center pt-24 pb-16 px-4 sm:px-6">
            <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
              <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/8 via-transparent to-transparent rounded-full" />
              <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-blue-100/40 dark:bg-blue-900/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-violet-100/30 dark:bg-violet-900/8 rounded-full blur-3xl" />
              <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.08) 1px, transparent 0)", backgroundSize: "40px 40px" }} />
            </div>
            <div className="relative max-w-4xl mx-auto text-center">
              <m.div initial="hidden" animate="visible" variants={staggerContainer}>
                <m.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 bg-primary/8 dark:bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6">
                  ✦ สำหรับธุรกิจบริการทุกประเภทที่มีกะและเวร
                </m.div>
                <m.h1
                  variants={fadeUp} custom={1}
                  className="text-4xl sm:text-5xl md:text-[3.25rem] lg:text-6xl font-display font-bold text-slate-900 dark:text-white leading-[1.2] tracking-tight"
                  data-testid="text-hero-title"
                >
                  <span className="block">โปรแกรมจัดเวรพนักงาน</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                    สำหรับทุกธุรกิจที่มีกะและเวร
                  </span>
                </m.h1>
                <m.p
                  variants={fadeUp} custom={2}
                  className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed"
                  data-testid="text-hero-subtitle"
                >
                  ไม่ว่าทีมคุณจะเป็นพนักงานร้านอาหาร สตาฟโรงแรม หรือเจ้าหน้าที่ Call Center — ปัญหาจัดเวรเหมือนกันทุกที่ Shift Optimizer แก้ได้ทุก vertical ด้วย AI ตัวเดียว
                </m.p>
                <m.div variants={fadeUp} custom={3} className="mt-10 flex flex-col sm:flex-row gap-3 justify-center items-center">
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
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-7 sm:p-8 h-full flex flex-col hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 hover:border-primary/30 transition-all duration-300">
                        <div className="text-4xl mb-4">{card.emoji}</div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-3 leading-snug">{card.title}</h3>
                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-3">{card.problem}</p>
                        {card.solution && (
                          <p className="text-primary font-medium text-sm leading-relaxed mb-5">{card.solution}</p>
                        )}
                        <div className="mt-auto pt-2">
                          <Link href="/create">
                            <Button size="sm" className="w-full font-semibold" data-testid={`button-vertical-cta-${i}`}>
                              ทดลองใช้ฟรี <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                            </Button>
                          </Link>
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

          {/* ── CLOSING CTA ── */}
          <section id="contact" className="py-20 sm:py-28 px-4 sm:px-6 border-t border-slate-100 dark:border-slate-800/50">
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
                  <Link href="/" className="text-primary hover:underline font-medium">
                    ดูที่นี่
                  </Link>
                </m.p>
              </m.div>
            </div>
          </section>
        </main>

        {/* ── LINE QR popup ── */}
        {showLineQR && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowLineQR(false)}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl max-w-xs w-full mx-4 flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <SiLine className="w-6 h-6 text-green-500" />
                  <span className="font-bold text-slate-900 dark:text-white text-lg">LINE Official</span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">@shift-optimizer</p>
              </div>
              <img src="/line-qr.png" alt="LINE QR Code @shift-optimizer" className="w-52 h-52 rounded-lg" />
              <p className="text-xs text-slate-400 text-center">สแกน QR Code เพื่อเพิ่มเพื่อนใน LINE</p>
              <button onClick={() => setShowLineQR(false)} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline">ปิด</button>
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
