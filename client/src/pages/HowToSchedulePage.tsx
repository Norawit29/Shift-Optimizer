import SEOLandingPage, { SEOPageConfig } from "./SEOLandingPage";
import { m, LazyMotion, domAnimation } from "framer-motion";
import { Clock, AlertTriangle, Users, RefreshCw, ClipboardX, Briefcase, Scale, FileSpreadsheet, Puzzle, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] } }),
};
const staggerContainer = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };

const guideSteps = [
  {
    num: "01",
    title: "กำหนดจำนวนกะและจำนวนคนที่ต้องการในแต่ละช่วงเวลา",
    desc: "ระบุประเภทกะ (เช้า บ่าย ดึก) จำนวนชั่วโมงต่อเวร และจำนวนพนักงานขั้นต่ำในแต่ละกะ เพื่อให้ครอบคลุมชั่วโมงทำงานทั้งหมด",
  },
  {
    num: "02",
    title: "รวบรวมวันลา วันหยุด และข้อจำกัดของพนักงาน",
    desc: "รับวันลาล่วงหน้า บันทึกวันหยุดสาธารณะ และข้อกำหนดส่วนตัว เช่น ไม่รับเวรดึก หรือต้องการวันหยุดเฉพาะเจาะจง",
  },
  {
    num: "03",
    title: "กระจายเวรให้ยุติธรรม ไม่ให้บางคนได้เวรหนักเกินไป",
    desc: "ตรวจสอบว่าแต่ละคนได้จำนวนชั่วโมงและเวรกะพิเศษ (ดึก/วันหยุด) ใกล้เคียงกัน เพื่อป้องกันข้อร้องเรียน",
  },
  {
    num: "04",
    title: "ตรวจสอบเวรชน เวรต่อเนื่อง และ OT",
    desc: "ไล่ตรวจว่าไม่มีพนักงานคนไหนต้องทำงานสองเวรติดกัน หรือมีชั่วโมงรวมเกินกำหนด ก่อนประกาศตาราง",
  },
  {
    num: "05",
    title: "ส่งออกตารางเวรและสื่อสารกับทีม",
    desc: "แปลงตารางเป็นไฟล์ Excel หรือ PDF แล้วแชร์ให้ทีมล่วงหน้าอย่างน้อย 2 สัปดาห์ เพื่อให้ทุกคนมีเวลาเตรียมตัว",
  },
  {
    num: "06",
    title: "วิธีใช้ Shift Optimizer ช่วยลดขั้นตอนทั้งหมดนี้",
    desc: "ตั้งค่าทีม กะ และกฎไว้ครั้งเดียว แล้วให้ AI จัดเวรแทนคุณ ระบบตรวจสอบทุกเงื่อนไขและสร้างตารางที่พร้อมใช้งานในไม่กี่นาที",
  },
];

function GuideSection() {
  return (
    <LazyMotion features={domAnimation}>
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-slate-50/80 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-800/50">
        <div className="max-w-3xl mx-auto">
          <m.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={staggerContainer}>
            <m.div variants={fadeUp} custom={0} className="text-center mb-14">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white">
                ขั้นตอนจัดตารางเวรพนักงานแบบ Step-by-step
              </h2>
            </m.div>

            <div className="space-y-6">
              {guideSteps.map((step, i) => (
                <m.div key={i} variants={fadeUp} custom={i + 1}>
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7">
                    <div className="flex items-start gap-5">
                      <span className="text-4xl font-display font-bold text-slate-200 dark:text-slate-700 select-none leading-none shrink-0">{step.num}</span>
                      <div>
                        <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white mb-2">{step.title}</h3>
                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  </div>

                  {/* Inline CTA after step 03 and 06 */}
                  {(i === 2 || i === 5) && (
                    <m.div variants={fadeUp} custom={i + 2} className="mt-4 bg-gradient-to-r from-primary/5 to-accent/5 dark:from-primary/10 dark:to-accent/10 border border-primary/20 rounded-2xl px-6 py-5 text-center">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mb-3 text-sm sm:text-base">
                        ไม่อยากจัดเองทีละคน? ลองให้ AI ช่วยจัดเวรฟรี
                      </p>
                      <Link href="/create">
                        <Button size="sm" className="shadow-md shadow-primary/20 font-semibold" data-testid={`button-guide-inline-cta-${i}`}>
                          ลองฟรีเลย
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </m.div>
                  )}
                </m.div>
              ))}
            </div>
          </m.div>
        </div>
      </section>
    </LazyMotion>
  );
}

const config: SEOPageConfig = {
  seoTitle: "วิธีจัดตารางเวรพนักงานให้แฟร์ | Step-by-step",
  metaDescription: "วิธีจัดตารางเวรพนักงานแบบเป็นระบบ ตั้งแต่กำหนดกะ วันลา จำนวนคนต่อเวร ไปจนถึงการตรวจสอบความยุติธรรม พร้อมตัวช่วย AI ลดเวลาจัดเวร",
  canonicalPath: "/วิธีจัดตารางเวรพนักงาน",
  badge: "คู่มือสำหรับหัวหน้าทีม",
  h1Line1: "วิธีจัดตารางเวรพนักงานให้แฟร์",
  h1Gradient: "Step-by-step สำหรับหัวหน้าทีม",
  subtitle: "คู่มือจัดเวรพนักงานแบบ Step-by-step สำหรับหัวหน้าทีม ผู้จัดการร้าน และฝ่ายบุคคล พร้อมตัวช่วย AI ที่ลดเวลาจัดเวรได้มากกว่า 90%",
  primaryCTA: "ลองให้ AI จัดเวรฟรี",
  primaryHref: "/create",
  secondaryCTA: "อ่านขั้นตอน",
  painTitle: "ปัญหาที่หัวหน้าทีมเจอเมื่อจัดเวรด้วยมือ",
  painSubtitle: "การจัดเวรพนักงานให้ยุติธรรมไม่ใช่เรื่องง่าย โดยเฉพาะเมื่อทีมใหญ่ขึ้นและเงื่อนไขซับซ้อน",
  painPoints: [
    { icon: Clock, text: "ใช้เวลาหลายชั่วโมงต่อเดือนในการจัดเวร" },
    { icon: AlertTriangle, text: "ยากที่จะกระจายเวรให้ยุติธรรมเมื่อมีคนหลายคน" },
    { icon: Users, text: "เวรชนหรือคนไม่พอในช่วงเวลาสำคัญ" },
    { icon: RefreshCw, text: "พนักงานลาแล้วต้องปรับตารางใหม่ทั้งหมด" },
    { icon: ClipboardX, text: "OT เพิ่มโดยไม่รู้ตัวจากการกระจายเวรไม่สมดุล" },
    { icon: Briefcase, text: "เสียเวลาประชุมหรือต่อรองเรื่องเวรทุกเดือน" },
  ],
  solutionTitle: "Shift Optimizer ช่วยลดทุกขั้นตอนให้อัตโนมัติ",
  solutionSubtitle: "ตั้งค่าทีมและกฎครั้งเดียว ให้ AI จัดการที่เหลือทั้งหมด",
  outcomes: [
    { icon: Clock, title: "จัดเวรเสร็จในไม่กี่นาที", desc: "ระบบ AI ประมวลผลทุกเงื่อนไขและสร้างตารางที่พร้อมใช้งานทันที", bg: "bg-amber-50 dark:bg-amber-950/40", iconColor: "text-amber-600 dark:text-amber-400" },
    { icon: Scale, title: "กระจายเวรยุติธรรมอัตโนมัติ", desc: "AI คำนวณภาระงาน OT และเวรพิเศษให้สมดุลทุกคน ไม่ต้องนั่งนับเอง", bg: "bg-blue-50 dark:bg-blue-950/40", iconColor: "text-blue-600 dark:text-blue-400" },
    { icon: Puzzle, title: "รองรับวันลาและกฎซับซ้อน", desc: "บล็อกวันลา เวรที่ขอ ห้ามเวรต่อเนื่อง ตั้งครั้งเดียวระบบจำให้", bg: "bg-violet-50 dark:bg-violet-950/40", iconColor: "text-violet-600 dark:text-violet-400" },
    { icon: FileSpreadsheet, title: "ส่งออก Excel พร้อมแจกทีม", desc: "ส่งออกไฟล์ Excel แยกสีตามเวร รายบุคคลและรายแผนก พร้อมพิมพ์ได้ทันที", bg: "bg-emerald-50 dark:bg-emerald-950/40", iconColor: "text-emerald-600 dark:text-emerald-400" },
  ],
  extraAfterPain: <GuideSection />,
  showComparison: true,
  faqs: [
    { q: "จัดตารางเวรพนักงานอย่างไรให้แฟร์?", a: "ต้องกระจายเวรกะพิเศษ (ดึก/วันหยุด) ให้ทุกคนได้จำนวนใกล้เคียงกัน และคำนึงถึงวันลาและข้อจำกัดส่วนตัว ระบบ AI อย่าง Shift Optimizer ช่วยคำนวณสิ่งเหล่านี้โดยอัตโนมัติ" },
    { q: "ควรกำหนดกะยังไง?", a: "ขึ้นอยู่กับชั่วโมงเปิดทำการ โดยทั่วไปแบ่งเป็นกะเช้า บ่าย และดึก โดยกำหนดจำนวนพนักงานขั้นต่ำที่ต้องการในแต่ละกะตามปริมาณงาน" },
    { q: "จะลด OT จากการจัดเวรได้อย่างไร?", a: "ต้องกระจายชั่วโมงงานให้สม่ำเสมอ ไม่ให้คนใดคนหนึ่งทำงานเกินโควต้า ระบบ AI จะตรวจสอบและแจ้งเตือนเมื่อชั่วโมงงานเกินกำหนด" },
    { q: "ใช้ AI จัดเวรแทนคนได้จริงไหม?", a: "ได้ครับ Shift Optimizer ใช้ AI ที่เข้าใจเงื่อนไขที่ซับซ้อน สามารถจัดตารางที่ผ่านกฎทุกข้อ และสมดุลสำหรับทุกคนในทีมได้ภายในไม่กี่นาที" },
    { q: "ต้องใช้เวลาตั้งค่านานไหม?", a: "ตั้งค่าครั้งแรกใช้เวลาประมาณ 15-30 นาที หลังจากนั้นการสร้างตารางแต่ละเดือนใช้เวลาเพียงไม่กี่นาที ระบบจำกฎและทีมของคุณไว้ให้เสมอ" },
  ],
};

export default function HowToSchedulePage() {
  return <SEOLandingPage config={config} />;
}
