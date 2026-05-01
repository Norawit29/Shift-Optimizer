import SEOLandingPage, { SEOPageConfig } from "./SEOLandingPage";
import { m, LazyMotion, domAnimation } from "framer-motion";
import { Clock, AlertTriangle, Users, RefreshCw, ClipboardX, Briefcase, Scale, FileSpreadsheet, Puzzle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] } }),
};
const staggerContainer = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };

const excelLimitations = [
  { icon: Clock, title: "ใช้เวลามาก", desc: "การสร้างสูตรและตรวจสอบเวรชนด้วยตนเองในแต่ละเดือนใช้เวลาหลายชั่วโมง" },
  { icon: AlertTriangle, title: "เสี่ยงผิดพลาด", desc: "สูตรซับซ้อน อ้างอิงหลาย cell ทำให้เกิดข้อผิดพลาดได้ง่าย โดยเฉพาะเมื่อมีการเปลี่ยนแปลง" },
  { icon: Users, title: "ไม่รองรับทีมใหญ่", desc: "ยิ่งพนักงานมาก ยิ่งซับซ้อน ไฟล์ใหญ่ขึ้น ช้าลง และดูแลยาก" },
  { icon: RefreshCw, title: "แก้ยากเมื่อเปลี่ยนเวร", desc: "เปลี่ยนเวรคนเดียวอาจกระทบทั้งตาราง ต้องนั่งเช็คใหม่ตั้งแต่ต้น" },
];

function ExtraContent() {
  return (
    <LazyMotion features={domAnimation}>
      <section className="py-16 sm:py-20 px-4 sm:px-6 border-t border-slate-100 dark:border-slate-800/50">
        <div className="max-w-5xl mx-auto">
          <m.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={staggerContainer}>
            <m.div variants={fadeUp} custom={0} className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white mb-4">
                ข้อจำกัดของการใช้ Excel จัดเวรพนักงาน
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
                Excel ใช้งานได้ดีสำหรับทีมเล็ก แต่เมื่อทีมโตขึ้น ปัญหาเหล่านี้จะเริ่มปรากฏ
              </p>
            </m.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {excelLimitations.map((item, i) => (
                <m.div key={i} variants={fadeUp} custom={i + 1}>
                  <div className="flex items-start gap-4 p-6 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 h-full">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 mt-0.5">
                      <item.icon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white mb-1">{item.title}</h3>
                      <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </m.div>
              ))}
            </div>

            <m.div variants={fadeUp} custom={5} className="mt-10 text-center">
              <div className="inline-block bg-gradient-to-r from-primary/5 to-accent/5 dark:from-primary/10 dark:to-accent/10 border border-primary/20 dark:border-primary/30 rounded-2xl px-8 py-6">
                <p className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
                  ไม่อยากแก้สูตร Excel อีกต่อไป? ให้ AI ช่วยจัดเวรแทน
                </p>
                <Link href="/create">
                  <Button size="lg" className="shadow-lg shadow-primary/25 text-base px-7 py-3 font-semibold" data-testid="button-excel-inline-cta">
                    ลองจัดเวรด้วย AI ฟรี
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </m.div>
          </m.div>
        </div>
      </section>
    </LazyMotion>
  );
}

const config: SEOPageConfig = {
  seoTitle: "ตารางเวรพนักงาน Excel ฟรี พร้อมตัวอย่าง | Shift Optimizer",
  metaDescription: "ดาวน์โหลดและดูตัวอย่างตารางเวรพนักงาน Excel พร้อมเรียนรู้ข้อจำกัดของ Excel และวิธีใช้ AI ช่วยจัดเวรอัตโนมัติให้เร็วและยุติธรรมกว่าเดิม",
  canonicalPath: "/ตารางเวรพนักงาน-excel",
  badge: "Excel + AI Scheduling",
  h1Line1: "ตารางเวรพนักงาน Excel ฟรี",
  h1Gradient: "พร้อมทางเลือก AI ที่เร็วกว่า",
  subtitle: "ตัวอย่างตารางเวรสำหรับทีมพนักงาน พร้อมทางเลือก AI สำหรับจัดเวรอัตโนมัติ ลดเวลา ลดเวรชน และลดข้อผิดพลาด",
  primaryCTA: "ลองจัดเวรด้วย AI ฟรี",
  primaryHref: "/create",
  secondaryCTA: "ดูราคาและแผน",
  painTitle: "ตารางเวร Excel ใช้กับทีมแบบไหนได้บ้าง?",
  painSubtitle: "Excel เหมาะสำหรับทีมเล็ก แต่เมื่อจำนวนพนักงานและเงื่อนไขซับซ้อนขึ้น ปัญหาเหล่านี้จะเริ่มปรากฏ",
  painPoints: [
    { icon: Clock, text: "ต้องนั่งพิมพ์ชื่อ-เวรทีละคนทุกเดือน" },
    { icon: AlertTriangle, text: "เวรชนหรือคนไม่พอ ไม่มีระบบแจ้งเตือนอัตโนมัติ" },
    { icon: Users, text: "เมื่อพนักงานเกิน 15 คน ไฟล์เริ่มหนักและจัดการยาก" },
    { icon: RefreshCw, text: "เปลี่ยนเวรแล้วต้องตรวจสอบทั้งตารางใหม่ตั้งแต่ต้น" },
    { icon: ClipboardX, text: "ไม่รองรับกฎซับซ้อน เช่น ห้ามเวรต่อเนื่อง หรือวันหยุดพิเศษ" },
    { icon: Briefcase, text: "ใช้เวลาจัดเวรนานกว่าจะเสร็จในแต่ละเดือน" },
  ],
  solutionTitle: "ถ้าไม่อยากแก้สูตรเอง ให้ AI ช่วยจัดเวรแทน",
  solutionSubtitle: "Shift Optimizer ทำสิ่งที่ Excel ทำไม่ได้ — จัดเวรอัตโนมัติ ตรวจกฎทันที และส่งออก Excel พร้อมใช้งาน",
  outcomes: [
    { icon: Clock, title: "จัดเวรเสร็จในไม่กี่นาที", desc: "ไม่ต้องนั่งพิมพ์ทีละคน AI ประมวลผลและสร้างตารางให้ทันที", bg: "bg-amber-50 dark:bg-amber-950/40", iconColor: "text-amber-600 dark:text-amber-400" },
    { icon: Scale, title: "ตรวจสอบกฎอัตโนมัติ 100%", desc: "ไม่มีเวรชน ไม่ผิดกฎ ระบบตรวจสอบทุกเงื่อนไขก่อนสร้างตาราง", bg: "bg-blue-50 dark:bg-blue-950/40", iconColor: "text-blue-600 dark:text-blue-400" },
    { icon: Puzzle, title: "รองรับเงื่อนไขซับซ้อน", desc: "วันลา วันหยุดพิเศษ เวรที่ขอ เวรต่อเนื่อง — ตั้งครั้งเดียวจบ", bg: "bg-violet-50 dark:bg-violet-950/40", iconColor: "text-violet-600 dark:text-violet-400" },
    { icon: FileSpreadsheet, title: "ส่งออก Excel ได้ทันที", desc: "ไฟล์ .xlsx พร้อมใช้ แยกสีตามเวร รายบุคคลและรายแผนก", bg: "bg-emerald-50 dark:bg-emerald-950/40", iconColor: "text-emerald-600 dark:text-emerald-400" },
  ],
  showComparison: true,
  extraAfterSolution: <ExtraContent />,
  faqs: [
    { q: "ตารางเวรพนักงาน Excel เหมาะกับทีมกี่คน?", a: "Excel ใช้งานได้ดีสำหรับทีมไม่เกิน 10-15 คนและเงื่อนไขไม่ซับซ้อน หากทีมใหญ่กว่านั้นหรือมีกฎหลายอย่าง แนะนำให้ใช้ระบบ AI เพื่อประหยัดเวลาและลดข้อผิดพลาด" },
    { q: "Excel มีข้อจำกัดอะไรเมื่อทีมใหญ่ขึ้น?", a: "เมื่อทีมใหญ่ขึ้น Excel จะหนักและช้าลง การตรวจสอบเวรชนต้องทำเอง สูตรซับซ้อนขึ้น และเสี่ยงผิดพลาดมากขึ้น ทำให้ใช้เวลาจัดเวรหลายชั่วโมงต่อเดือน" },
    { q: "Shift Optimizer ส่งออก Excel ได้ไหม?", a: "ได้ครับ ส่งออกเป็นไฟล์ .xlsx ได้ทันที ทั้งรูปแบบรายบุคคลและรายแผนก พร้อมสีตามประเภทเวร สามารถพิมพ์แจกทีมหรือแชร์ต่อได้เลย" },
    { q: "ต้องติดตั้งโปรแกรมไหม?", a: "ไม่ต้องติดตั้งใดๆ ทั้งสิ้น ใช้งานผ่านเบราว์เซอร์ได้เลย รองรับทั้ง Chrome, Safari, Firefox บน Windows, Mac และ iOS/Android" },
    { q: "ใช้บนมือถือได้หรือไม่?", a: "ได้ครับ Shift Optimizer ออกแบบ responsive รองรับการใช้งานบนมือถือและแท็บเล็ตได้อย่างสะดวก" },
  ],
};

export default function StaffExcelPage() {
  return <SEOLandingPage config={config} />;
}
