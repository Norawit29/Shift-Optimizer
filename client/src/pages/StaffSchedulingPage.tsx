import SEOLandingPage, { SEOPageConfig } from "./SEOLandingPage";
import { Clock, AlertTriangle, Users, RefreshCw, ClipboardX, Briefcase, Scale, FileSpreadsheet, Puzzle } from "lucide-react";

const config: SEOPageConfig = {
  seoTitle: "โปรแกรมจัดเวรพนักงานด้วย AI | Shift Optimizer",
  metaDescription: "โปรแกรมจัดเวรพนักงานด้วย AI ช่วยลดเวลาจัดตารางเวร ลด OT กระจายเวรอย่างยุติธรรม เหมาะสำหรับร้านอาหาร คลินิก โรงแรม และทีมบริการ",
  canonicalPath: "/โปรแกรมจัดเวรพนักงาน",
  badge: "ลดเวลาจัดเวรถึง 90%",
  h1Line1: "โปรแกรมจัดเวรพนักงานด้วย AI",
  h1Gradient: "กระจายเวรยุติธรรม ลด OT ได้เลย",
  subtitle: "ลดเวลาจัดเวร 90% แทน Excel ได้ทันที กระจายเวรอย่างยุติธรรม เหมาะสำหรับร้านอาหาร คลินิก โรงแรม และธุรกิจบริการ",
  primaryCTA: "ทดลองใช้ฟรี",
  primaryHref: "/create",
  secondaryCTA: "ดูวิธีใช้งาน",
  painTitle: "ยังใช้ Excel จัดเวรพนักงานอยู่หรือไม่?",
  painSubtitle: "เมื่อทีมโตขึ้น การจัดเวรด้วยมือจะเริ่มเสียเวลา และเกิดปัญหาซ้ำเดิมทุกเดือน",
  painPoints: [
    { icon: Clock, text: "ใช้เวลาหลายชั่วโมงทุกเดือนในการจัดเวร" },
    { icon: Users, text: "พนักงานไม่พอในช่วงเวลาที่งานเยอะ" },
    { icon: AlertTriangle, text: "เวรไม่แฟร์ เกิดข้อร้องเรียนในทีม" },
    { icon: RefreshCw, text: "เปลี่ยนเวรกะทันหันแล้วกระทบทั้งตาราง" },
    { icon: ClipboardX, text: "OT เพิ่มขึ้นโดยไม่รู้ตัว" },
    { icon: Briefcase, text: "หัวหน้าทีมเสียเวลากับงานเอกสารแทนงานสำคัญ" },
  ],
  solutionTitle: "Shift Optimizer ช่วยจัดเวรพนักงานให้อัตโนมัติในไม่กี่นาที",
  solutionSubtitle: "ระบบที่ออกแบบมาสำหรับธุรกิจทุกขนาด ช่วยลดเวลา ลดความผิดพลาด และลดข้อร้องเรียนในทีม",
  outcomes: [
    { icon: Clock, title: "ลดเวลาจัดเวรจากหลายชั่วโมงเหลือไม่กี่นาที", desc: "ระบบ AI คำนวณตารางที่สมดุลให้โดยอัตโนมัติ คุณแค่ตั้งค่าและกดสร้าง", bg: "bg-amber-50 dark:bg-amber-950/40", iconColor: "text-amber-600 dark:text-amber-400" },
    { icon: Scale, title: "กระจายเวรยุติธรรม ลดข้อร้องเรียน", desc: "AI กระจายภาระงานสมดุล ขจัดอคติ ลดข้อร้องเรียน กระจายเวรวันหยุดเท่าเทียมทุกคน", bg: "bg-blue-50 dark:bg-blue-950/40", iconColor: "text-blue-600 dark:text-blue-400" },
    { icon: Puzzle, title: "รองรับวันลา วันหยุด และเงื่อนไขของแต่ละคน", desc: "บล็อกวันลา เวรที่ร้องขอ ห้ามเวรต่อเนื่อง ตั้งครั้งเดียวใช้ได้เลย", bg: "bg-violet-50 dark:bg-violet-950/40", iconColor: "text-violet-600 dark:text-violet-400" },
    { icon: FileSpreadsheet, title: "ส่งออก Excel พร้อมใช้งานทันที", desc: "ส่งออกไฟล์ Excel แยกสีตามเวร รายบุคคล รายแผนก พร้อมพิมพ์แจกทีมทันที", bg: "bg-emerald-50 dark:bg-emerald-950/40", iconColor: "text-emerald-600 dark:text-emerald-400" },
  ],
  useCasesTitle: "เหมาะสำหรับธุรกิจทุกประเภท",
  useCases: ["ร้านอาหาร", "โรงแรม", "คลินิก", "ร้านกาแฟ", "ร้านค้าปลีก", "Call Center", "โรงพยาบาล", "ทีมบริการ"],
  showComparison: true,
  faqs: [
    { q: "โปรแกรมจัดเวรพนักงานนี้ใช้ฟรีไหม?", a: "มีแผน Free ให้ใช้งานฟรีสำหรับทีมสูงสุด 10 คน รองรับฟีเจอร์พื้นฐานครบถ้วน หากต้องการทีมใหญ่ขึ้นหรือฟีเจอร์เพิ่มเติม สามารถอัปเกรดเป็นแผน Pro ได้" },
    { q: "รองรับพนักงานได้กี่คน?", a: "แผน Free รองรับสูงสุด 10 คน แผน Pro เริ่มต้นที่ 15 คน และปรับขึ้นได้สูงสุด 50 คนต่อทีม หากมีทีมขนาดใหญ่กว่านั้น ติดต่อเราเพื่อแผน Enterprise ได้เลย" },
    { q: "ส่งออกเป็น Excel ได้ไหม?", a: "ได้เลย ทุกแผนรองรับการส่งออก Excel (.xlsx) ทั้งรายบุคคลและรายแผนก พร้อมใช้งานได้ทันที" },
    { q: "ใช้แทน Google Sheets ได้หรือไม่?", a: "ได้ครับ Shift Optimizer ออกแบบมาให้แทนที่การจัดเวรด้วย Excel หรือ Google Sheets โดยเพิ่มความสามารถ AI และระบบตรวจสอบกฎโดยอัตโนมัติ" },
    { q: "เหมาะกับธุรกิจขนาดเล็กไหม?", a: "เหมาะมากครับ มีแผนฟรีที่ใช้งานได้ทันทีโดยไม่ต้องใส่ข้อมูลบัตรเครดิต และสามารถอัปเกรดได้เมื่อทีมโตขึ้น" },
  ],
};

export default function StaffSchedulingPage() {
  return <SEOLandingPage config={config} />;
}
