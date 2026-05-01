import SEOLandingPage, { SEOPageConfig } from "./SEOLandingPage";
import { m, LazyMotion, domAnimation } from "framer-motion";
import {
  Clock, AlertTriangle, Users, RefreshCw, ClipboardX, Briefcase,
  Scale, FileSpreadsheet, Puzzle, Settings, Download,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] } }),
};
const staggerContainer = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };

// ── Use-case cards section (extraAfterPain) ───────────────────
const useCaseCards = [
  {
    emoji: "🍽️",
    title: "ร้านอาหารและร้านกาแฟ",
    desc: "กำหนดจำนวนพนักงานให้มากขึ้นในช่วงเที่ยง เย็น และวันหยุด พร้อมกระจายเวรเปิดร้านและปิดร้านให้สมดุล",
  },
  {
    emoji: "🏥",
    title: "คลินิกและทีมบริการสุขภาพ",
    desc: "จัดคนให้เพียงพอตามช่วงเวลาคนไข้เยอะ รองรับวันลา และลดปัญหาคนไม่พอหน้าเคาน์เตอร์",
  },
  {
    emoji: "🏨",
    title: "โรงแรมและทีมบริการ",
    desc: "วางเวรเช้า บ่าย ดึก ให้ครอบคลุมการให้บริการตลอดวัน พร้อมลด OT และเวรต่อเนื่อง",
  },
  {
    emoji: "🎧",
    title: "Call Center และทีม Support",
    desc: "จัดกำลังคนตามช่วงเวลาที่มีปริมาณงานสูง และรองรับพนักงานหลายระดับประสบการณ์",
  },
];

function UseCaseSection() {
  return (
    <LazyMotion features={domAnimation}>
      <section className="py-16 sm:py-20 px-4 sm:px-6 border-t border-slate-100 dark:border-slate-800/50">
        <div className="max-w-5xl mx-auto">
          <m.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={staggerContainer}>
            <m.div variants={fadeUp} custom={0} className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white">
                ตัวอย่างการจัดเวรพนักงานที่ Shift Optimizer ช่วยได้
              </h2>
            </m.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {useCaseCards.map((card, i) => (
                <m.div key={i} variants={fadeUp} custom={i + 1}>
                  <div className="flex items-start gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:shadow-md hover:border-primary/30 transition-all h-full">
                    <span className="text-3xl shrink-0 mt-0.5">{card.emoji}</span>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white mb-1.5">{card.title}</h3>
                      <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{card.desc}</p>
                    </div>
                  </div>
                </m.div>
              ))}
            </div>
          </m.div>
        </div>
      </section>
    </LazyMotion>
  );
}

// ── Business-specific comparison rows ─────────────────────────
const businessComparisonRows = [
  {
    topic: "การจัดคนตามช่วงพีค",
    excel: "ต้องไล่ดูด้วยตนเองว่าแต่ละช่วงมีคนพอไหม เสี่ยงพลาดเมื่อมีหลายกะ",
    ai: "กำหนดจำนวนคนขั้นต่ำต่อกะ ระบบจัดให้ครบโดยอัตโนมัติ ไม่มีช่วงไหนขาดคน",
  },
  {
    topic: "การรองรับพนักงาน part-time",
    excel: "ต้องนั่งไล่เช็กวันว่างทีละคน เสี่ยงจัดเวรชนกับเวลาที่พนักงานไม่ว่าง",
    ai: "บันทึกความพร้อมของแต่ละคนไว้ครั้งเดียว ระบบจัดเวรโดยไม่ชนข้อจำกัด",
  },
  {
    topic: "การกระจายเวรเปิดร้าน / ปิดร้าน",
    excel: "มักกระจุกอยู่กับคนไม่กี่คน เพราะขึ้นอยู่กับความสะดวกของผู้จัด",
    ai: "AI กระจายเวรหนักให้ทุกคนสม่ำเสมอ ลดข้อร้องเรียนเรื่องความไม่แฟร์",
  },
  {
    topic: "การควบคุม OT",
    excel: "ต้องนับชั่วโมงเองหลังจัดเสร็จ เสี่ยงให้คนทำงานเกินโดยไม่รู้ตัว",
    ai: "ระบบตรวจสอบชั่วโมงรวมก่อนสร้างตาราง ไม่มีคนเกิน OT โดยไม่ตั้งใจ",
  },
  {
    topic: "การแก้เวรเมื่อมีคนลา",
    excel: "ต้องปรับตารางเองทั้งชุด เสี่ยงกระทบคนอื่นและต้องตรวจใหม่ตั้งแต่ต้น",
    ai: "ปรับคนลาแล้วระบบช่วยหาทางเลือกใหม่ที่สมดุลโดยอัตโนมัติ",
  },
  {
    topic: "การส่งออกตารางไปใช้งานต่อ",
    excel: "ต้องฟอร์แมตเองแยกหลายไฟล์ กินเวลาและเสี่ยงผิดพลาด",
    ai: "ส่งออก Excel พร้อมใช้งาน แยกรายบุคคลและรายทีม ใน 1 คลิก",
  },
  {
    topic: "การขยายทีมหลายสาขา",
    excel: "ยิ่งสาขามาก ยิ่งไฟล์เยอะ ดูแลยาก และเสี่ยงข้อมูลไม่ตรงกัน",
    ai: "รองรับทีมหลายขนาด บริหารจัดการได้จากที่เดียว รองรับการเติบโต",
  },
];

// ── Custom how-it-works steps ──────────────────────────────────
const customSteps = [
  {
    icon: Settings,
    title: "กำหนดช่วงเวลาและจำนวนคนที่ต้องการ",
    desc: "ตั้งค่ากะ เช่น เปิดร้าน ช่วงพีค ปิดร้าน หรือเวรเช้า บ่าย ดึก พร้อมจำนวนพนักงานที่ต้องการในแต่ละช่วง",
    num: "01",
  },
  {
    icon: Users,
    title: "เพิ่มพนักงานและความพร้อมในการทำงาน",
    desc: "ใส่รายชื่อพนักงาน full-time / part-time วันลา วันว่าง และข้อจำกัดเฉพาะของแต่ละคน",
    num: "02",
  },
  {
    icon: Download,
    title: "ให้ AI สร้างตารางเวรและส่งออก Excel",
    desc: "ระบบคำนวณตารางที่สมดุล ลดเวรชน ลด OT และส่งออกไฟล์ Excel เพื่อใช้งานต่อได้ทันที",
    num: "03",
  },
];

const config: SEOPageConfig = {
  seoTitle: "โปรแกรมจัดเวรพนักงานสำหรับธุรกิจบริการ | Shift Optimizer",
  metaDescription: "โปรแกรมจัดเวรพนักงานด้วย AI สำหรับร้านอาหาร คลินิก โรงแรม ร้านกาแฟ ร้านค้าปลีก และทีมบริการ ช่วยจัดคนให้พอช่วงพีค ลด OT และส่งออก Excel ได้ทันที",
  canonicalPath: "/โปรแกรมจัดเวรพนักงาน",
  badge: "สำหรับธุรกิจบริการทุกขนาด",
  h1Line1: "โปรแกรมจัดเวรพนักงานสำหรับธุรกิจบริการ",
  h1Gradient: "จัดเวรให้พอช่วงพีค ลด OT ด้วย AI",
  subtitle: "เหมาะสำหรับร้านอาหาร คลินิก โรงแรม ร้านกาแฟ ร้านค้าปลีก Call Center และทีมบริการที่ต้องจัดคนให้พอดีกับเวลางานจริง",
  primaryCTA: "ทดลองใช้ฟรี",
  primaryHref: "/create",
  secondaryCTA: "ดูราคาและแผน",
  painTitle: "ยังใช้ Excel จัดเวรพนักงานอยู่หรือไม่?",
  painSubtitle: "เมื่อทีมโตขึ้นหรือมีเวลาพีคที่ต้องการคนต่างกัน การจัดเวรด้วยมือจะเริ่มกินเวลาและเกิดปัญหาซ้ำเดิม",
  painPoints: [
    { icon: Clock, text: "คนไม่พอช่วงพีค เช่น เที่ยง เย็น วันหยุด หรือช่วงลูกค้าเยอะ" },
    { icon: Users, text: "พนักงาน part-time มีเวลาว่างไม่ตรงกัน ต้องไล่เช็กทีละคน" },
    { icon: AlertTriangle, text: "เวรเปิดร้าน ปิดร้าน หรือวันหยุดกระจุกอยู่ที่คนเดิม" },
    { icon: RefreshCw, text: "เปลี่ยนเวรกะทันหันแล้วกระทบทั้งตาราง" },
    { icon: ClipboardX, text: "OT เพิ่มขึ้นเพราะวางจำนวนคนไม่พอดีกับงานจริง" },
    { icon: Briefcase, text: "ผู้จัดการเสียเวลาหลายชั่วโมงกับ Excel แทนการดูแลทีมและลูกค้า" },
  ],
  solutionTitle: "ระบบจัดเวรพนักงานที่คิดตามเงื่อนไขของธุรกิจจริง",
  solutionSubtitle: "ไม่ใช่แค่จัดเวรให้ครบ — แต่จัดให้พอดีกับปริมาณงาน ความพร้อมของพนักงาน และความเป็นธรรมในทีม",
  outcomes: [
    {
      icon: Clock,
      title: "จัดคนให้พอดีกับช่วงเวลางาน",
      desc: "กำหนดจำนวนพนักงานที่ต้องการในแต่ละกะ เช่น ช่วงเปิดร้าน ช่วงพีค และช่วงปิดร้าน",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      icon: Puzzle,
      title: "รองรับพนักงาน full-time และ part-time",
      desc: "เพิ่มวันว่าง วันลา และข้อจำกัดของแต่ละคน เพื่อให้ระบบจัดเวรโดยไม่ชนเงื่อนไข",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      icon: Scale,
      title: "ลด OT และการกระจายเวรที่ไม่แฟร์",
      desc: "AI ช่วยกระจายภาระงาน เวรวันหยุด และเวรปิดร้านให้สมดุลมากขึ้น",
      bg: "bg-violet-50 dark:bg-violet-950/40",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
    {
      icon: FileSpreadsheet,
      title: "ส่งออก Excel เพื่อใช้งานต่อได้ทันที",
      desc: "ได้ตารางเวรที่พร้อมส่งต่อให้ทีม ใช้พิมพ์ แชร์ หรือปรับต่อใน Excel ได้",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
  ],
  extraAfterPain: <UseCaseSection />,
  showComparison: true,
  customComparisonTitle: "Excel vs AI Scheduling สำหรับธุรกิจบริการ",
  customComparisonRows: businessComparisonRows,
  customHowItWorksTitle: "เริ่มจัดเวรพนักงานได้ใน 3 ขั้นตอน",
  customHowItWorksDesc: "ตั้งค่าครั้งเดียว จัดเวรทุกเดือนได้ภายในไม่กี่นาที",
  customHowItWorksSteps: customSteps,
  faqs: [
    {
      q: "โปรแกรมจัดเวรพนักงานนี้เหมาะกับธุรกิจแบบไหน?",
      a: "เหมาะกับธุรกิจที่มีพนักงานทำงานเป็นกะ เช่น ร้านอาหาร ร้านกาแฟ คลินิก โรงแรม ร้านค้าปลีก Call Center และทีมบริการทุกรูปแบบ รองรับทั้งพนักงาน full-time และ part-time",
    },
    {
      q: "รองรับพนักงาน part-time หรือไม่?",
      a: "รองรับครับ สามารถกำหนดวันว่าง ชั่วโมงสูงสุดต่อสัปดาห์ และข้อจำกัดของพนักงาน part-time ได้ ระบบจะจัดเวรโดยไม่เกินขอบเขตที่กำหนด",
    },
    {
      q: "สามารถกำหนดจำนวนคนในช่วงพีคได้ไหม?",
      a: "ได้ครับ กำหนดจำนวนพนักงานขั้นต่ำสำหรับแต่ละกะได้อิสระ เช่น กะเที่ยงต้องการ 5 คน กะเช้า 3 คน ระบบจะจัดให้ครบตามที่กำหนดโดยอัตโนมัติ",
    },
    {
      q: "ส่งออกตารางเวรเป็น Excel ได้หรือไม่?",
      a: "ได้เลยครับ ส่งออกเป็นไฟล์ .xlsx พร้อมสีตามประเภทกะ รองรับทั้งรูปแบบรายบุคคลและรายทีม สามารถพิมพ์แจกหรือแชร์ผ่าน LINE ได้ทันที",
    },
    {
      q: "ใช้กับธุรกิจขนาดเล็กหรือร้านเดียวได้ไหม?",
      a: "ได้ครับ มีแผนฟรีสำหรับทีมสูงสุด 10 คน ไม่ต้องใส่บัตรเครดิต เหมาะสำหรับร้านขนาดเล็กที่อยากเริ่มจัดเวรอย่างเป็นระบบ",
    },
    {
      q: "ถ้ามีพนักงานลา ระบบช่วยปรับตารางได้หรือไม่?",
      a: "ช่วยได้ครับ เพิ่มวันลาของพนักงานเข้าระบบ แล้วสร้างตารางใหม่ ระบบจะจัดคนที่เหลือให้ครอบคลุมเวรนั้นโดยอัตโนมัติ ลดภาระการแก้ตารางด้วยมือ",
    },
  ],
};

export default function StaffSchedulingPage() {
  return <SEOLandingPage config={config} />;
}
