export type Lang = "en" | "th";

const translations = {
  en: {
    appName: "Hospital Shift Scheduler v1.0",
    schedulerWizard: "Scheduler Wizard",
    step: "Step",

    // HomePage
    heroTitle1: "Fair Schedules,",
    heroTitle2: "Happier Staff.",
    heroDesc: "Automate your duty roster creation with our AI-powered constraint solver. Ensure fairness, handle requests, and save hours of manual work.",
    createNewSchedule: "Create New Schedule",
    viewHistory: "View History",
    featureFairTitle: "Fair Distribution",
    featureFairDesc: "Automatically balances shifts across all available staff members.",
    featureSmartTitle: "Smart Constraints",
    featureSmartDesc: "Respects rest periods, consecutive shift rules, and blocked dates.",
    featureExportTitle: "Instant Export",
    featureExportDesc: "Generate a clean, printable view of the monthly roster in seconds.",

    // Step 1
    basicConfig: "Basic Configuration",
    basicConfigDesc: "Set up the timeline and shift structure for your roster.",
    shiftsPerDay: "Shifts per Day",
    shiftPerDay: "shift per day",
    shiftsPerDayPlural: "shifts per day",
    timeline: "Timeline",
    monthLabel: "Month",
    yearLabel: "Year",
    scheduleMode: "Schedule Mode",
    fullMonth: "Full Month",
    customRange: "Custom Range",
    startDate: "Start Date",
    endDate: "End Date",
    customRangeDesc: "Select a custom date range for your schedule",
    shiftDetails: "Shift Details",
    nameLabel: "Name",
    staffReq: "Staff Req.",
    nextStep: "Next Step",

    // Step 2
    staffAvailability: "Staff & Availability",
    staffAvailabilityDesc: "Add your team members and mark their unavailable dates on the calendar.",
    staff: "Staff",
    add: "Add",
    maxShifts: "Max Shifts",
    blocked: "blocked",
    selectStaffMember: "Select a Staff Member",
    selectStaffMemberDesc: "Click on a staff member from the list to view and edit their availability calendar.",
    availability: "Availability",
    clickDatesToBlock: "Click dates to block/unblock. Blocked dates appear in red.",
    clearAll: "Clear All",
    blockSpecificShifts: "Block specific shifts",
    blockSpecificShiftsDesc: "Click a shift badge to toggle blocking that specific shift on a date.",
    noBlockedDates: "No blocked dates. Click calendar dates above to add.",
    allDay: "All Day",
    sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat",

    // Step 3
    rulesConstraints: "Rules & Constraints",
    rulesConstraintsDesc: "Define fairness rules and consecutive shift patterns.",
    consecutiveShiftRules: "Consecutive Shift Rules",
    consecutiveDesc: "Prevent staff from working specific shift combinations on consecutive days (e.g., Night followed by Morning).",
    no: "NO",
    followedBy: "followed by",
    addNewRule: "Add new rule...",
    blockRule: "Block",
    holidayWeekendBalancing: "Holiday / Weekend Balancing",
    balanceWeekendHoliday: "Balance weekend/holiday shifts separately",
    balanceDesc: "Distribute holiday and weekend shifts fairly across all staff, tracked separately from weekday shifts.",
    customHolidays: "Custom Holidays",
    clickHolidays: "Click dates to mark as holidays. Saturdays and Sundays are automatically included.",
    customHolidaysLabel: "Custom holidays:",
    satSunAuto: "Sat/Sun = auto holiday",
    customHolidayLabel: "Custom holiday",
    readyToOptimize: "Ready to Optimize?",
    optimizeDesc: "Our algorithm will attempt to find the fairest distribution of shifts while respecting all your constraints.",
    optimizing: "Optimizing...",
    generateSchedule: "Generate Schedule",

    // Step 4
    generatedSchedule: "Generated Schedule",
    scheduleName: "Schedule Name",
    adjustRules: "Adjust Rules",
    regenerate: "Regenerate",
    calendarView: "Calendar View",
    summary: "Summary",
    statistics: "Statistics",
    saveSchedule: "Save Schedule",
    overallSummary: "Overall Summary",
    staffName: "Staff Name",
    total: "Total",
    holidayWeekend: "Holiday/Weekend",
    shiftBreakdown: "Shift Breakdown",
    includesSatSun: "Includes Saturdays, Sundays, and custom holidays",
    weekday: "Weekday",
    excludesHolidays: "Weekday shifts only (excludes holidays/weekends)",

    // ScheduleView
    date: "Date",
    day: "Day",

    // StatsCard
    workloadDistribution: "Workload Distribution",
    fairnessScore: "Fairness Score",
    range: "Range",
    lowerRangeFairer: "Lower range means fairer distribution.",
    status: "Status",
    optimized: "Optimized",
    rulesRespected: "Rules respected",
    imbalanced: "Imbalanced",
    someStaffMore: "Some staff have significantly more shifts",
    activeMembers: "Active members",

    // HistoryPage
    savedSchedules: "Saved Schedules",
    managePastRosters: "Manage your past rosters",
    noSchedulesFound: "No schedules found",
    createFirstRoster: "Create your first roster to see it here.",
    createSchedule: "Create Schedule",
    created: "Created",
    view: "View",
    areYouSure: "Are you sure?",
    deleteConfirm: "This action cannot be undone. This will permanently delete the schedule.",
    cancel: "Cancel",
    delete: "Delete",
    saved: "Saved",

    // ScheduleDetailsPage
    exportExcel: "Export Excel",
    scheduleView: "Schedule View",
    scheduleNotFound: "Schedule not found",

    // Toasts
    scheduleGenerated: "Schedule Generated",
    optimizationComplete: "Optimization complete!",
    optimizationFailed: "Optimization Failed",

    // Partial result
    partialScheduleWarning: "Partial Schedule",
    partialScheduleDesc: "Could not fill all slots. Unfilled positions are highlighted in red for you to assign manually.",
    unfilledSlots: "Unfilled Slots",
    unfilledSlotDetail: "needs {required} staff but only {assigned} assigned",
    vacancy: "VACANT",

    // Months
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],

    // Language
    language: "Language",
  },
  th: {
    appName: "ระบบจัดตารางเวร รพ. v1.0",
    schedulerWizard: "ตัวช่วยจัดตารางเวร",
    step: "ขั้นตอน",

    // HomePage
    heroTitle1: "ตารางเวรยุติธรรม",
    heroTitle2: "บุคลากรมีความสุข",
    heroDesc: "สร้างตารางเวรอัตโนมัติด้วยระบบจัดสรรอัจฉริยะ กระจายเวรอย่างยุติธรรม จัดการคำขอ และประหยัดเวลาทำงาน",
    createNewSchedule: "สร้างตารางเวรใหม่",
    viewHistory: "ดูประวัติ",
    featureFairTitle: "กระจายเวรยุติธรรม",
    featureFairDesc: "กระจายเวรให้สมดุลระหว่างบุคลากรทุกคนโดยอัตโนมัติ",
    featureSmartTitle: "เงื่อนไขอัจฉริยะ",
    featureSmartDesc: "เคารพช่วงพักผ่อน กฎเวรต่อเนื่อง และวันที่บล็อก",
    featureExportTitle: "ส่งออกทันที",
    featureExportDesc: "สร้างมุมมองตารางเวรรายเดือนที่พิมพ์ได้ในไม่กี่วินาที",

    // Step 1
    basicConfig: "ตั้งค่าพื้นฐาน",
    basicConfigDesc: "กำหนดช่วงเวลาและโครงสร้างเวรสำหรับตารางของคุณ",
    shiftsPerDay: "จำนวนเวรต่อวัน",
    shiftPerDay: "เวรต่อวัน",
    shiftsPerDayPlural: "เวรต่อวัน",
    timeline: "ช่วงเวลา",
    monthLabel: "เดือน",
    yearLabel: "ปี",
    scheduleMode: "รูปแบบตาราง",
    fullMonth: "เต็มเดือน",
    customRange: "กำหนดช่วงเอง",
    startDate: "วันเริ่มต้น",
    endDate: "วันสิ้นสุด",
    customRangeDesc: "เลือกช่วงวันที่ที่ต้องการจัดตารางเวร",
    shiftDetails: "รายละเอียดเวร",
    nameLabel: "ชื่อเวร",
    staffReq: "จำนวนคน",
    nextStep: "ขั้นตอนถัดไป",

    // Step 2
    staffAvailability: "บุคลากรและวันว่าง",
    staffAvailabilityDesc: "เพิ่มสมาชิกในทีมและกำหนดวันที่ไม่สะดวกบนปฏิทิน",
    staff: "บุคลากร",
    add: "เพิ่ม",
    maxShifts: "เวรสูงสุด",
    blocked: "บล็อก",
    selectStaffMember: "เลือกบุคลากร",
    selectStaffMemberDesc: "คลิกที่ชื่อบุคลากรจากรายการเพื่อดูและแก้ไขปฏิทินวันว่าง",
    availability: "วันว่าง",
    clickDatesToBlock: "คลิกวันที่เพื่อบล็อก/ยกเลิกบล็อก วันที่บล็อกจะแสดงเป็นสีแดง",
    clearAll: "ล้างทั้งหมด",
    blockSpecificShifts: "บล็อกเวรเฉพาะ",
    blockSpecificShiftsDesc: "คลิกป้ายเวรเพื่อสลับการบล็อกเวรนั้นในวันที่เลือก",
    noBlockedDates: "ไม่มีวันที่บล็อก คลิกวันที่บนปฏิทินด้านบนเพื่อเพิ่ม",
    allDay: "ทั้งวัน",
    sun: "อา.", mon: "จ.", tue: "อ.", wed: "พ.", thu: "พฤ.", fri: "ศ.", sat: "ส.",

    // Step 3
    rulesConstraints: "กฎและเงื่อนไข",
    rulesConstraintsDesc: "กำหนดกฎความยุติธรรมและรูปแบบเวรต่อเนื่อง",
    consecutiveShiftRules: "กฎเวรต่อเนื่อง",
    consecutiveDesc: "ป้องกันบุคลากรทำเวรบางประเภทต่อเนื่องกัน (เช่น เวรดึกตามด้วยเวรเช้า)",
    no: "ห้าม",
    followedBy: "ตามด้วย",
    addNewRule: "เพิ่มกฎใหม่...",
    blockRule: "บล็อก",
    holidayWeekendBalancing: "การเกลี่ยเวรวันหยุด / สุดสัปดาห์",
    balanceWeekendHoliday: "เกลี่ยเวรวันหยุด/สุดสัปดาห์แยกต่างหาก",
    balanceDesc: "กระจายเวรวันหยุดและสุดสัปดาห์อย่างยุติธรรม แยกนับจากเวรวันธรรมดา",
    customHolidays: "วันหยุดพิเศษ",
    clickHolidays: "คลิกวันที่เพื่อกำหนดเป็นวันหยุด วันเสาร์และอาทิตย์ถูกกำหนดโดยอัตโนมัติ",
    customHolidaysLabel: "วันหยุดพิเศษ:",
    satSunAuto: "ส.-อา. = วันหยุดอัตโนมัติ",
    customHolidayLabel: "วันหยุดพิเศษ",
    readyToOptimize: "พร้อมจัดตารางเวร?",
    optimizeDesc: "ระบบจะพยายามหาการจัดสรรเวรที่ยุติธรรมที่สุด โดยเคารพเงื่อนไขทั้งหมดของคุณ",
    optimizing: "กำลังจัดเวร...",
    generateSchedule: "สร้างตารางเวร",

    // Step 4
    generatedSchedule: "ตารางเวรที่สร้างแล้ว",
    scheduleName: "ชื่อตารางเวร",
    adjustRules: "ปรับกฎ",
    regenerate: "สร้างใหม่",
    calendarView: "มุมมองปฏิทิน",
    summary: "สรุป",
    statistics: "สถิติ",
    saveSchedule: "บันทึกตารางเวร",
    overallSummary: "สรุปภาพรวม",
    staffName: "ชื่อบุคลากร",
    total: "รวม",
    holidayWeekend: "วันหยุด/สุดสัปดาห์",
    shiftBreakdown: "รายละเอียดเวร",
    includesSatSun: "รวมวันเสาร์ อาทิตย์ และวันหยุดพิเศษ",
    weekday: "วันธรรมดา",
    excludesHolidays: "เฉพาะเวรวันธรรมดา (ไม่รวมวันหยุด/สุดสัปดาห์)",

    // ScheduleView
    date: "วันที่",
    day: "วัน",

    // StatsCard
    workloadDistribution: "การกระจายภาระงาน",
    fairnessScore: "คะแนนความยุติธรรม",
    range: "ช่วง",
    lowerRangeFairer: "ช่วงน้อยหมายถึงการกระจายที่ยุติธรรมกว่า",
    status: "สถานะ",
    optimized: "จัดเวรแล้ว",
    rulesRespected: "เป็นไปตามกฎทั้งหมด",
    imbalanced: "ไม่สมดุล",
    someStaffMore: "บุคลากรบางคนมีเวรมากกว่าอย่างมีนัยสำคัญ",
    activeMembers: "สมาชิกที่ใช้งาน",

    // HistoryPage
    savedSchedules: "ตารางเวรที่บันทึก",
    managePastRosters: "จัดการตารางเวรที่ผ่านมา",
    noSchedulesFound: "ไม่พบตารางเวร",
    createFirstRoster: "สร้างตารางเวรแรกของคุณเพื่อดูที่นี่",
    createSchedule: "สร้างตารางเวร",
    created: "สร้างเมื่อ",
    view: "ดู",
    areYouSure: "คุณแน่ใจหรือไม่?",
    deleteConfirm: "การดำเนินการนี้ไม่สามารถย้อนกลับได้ ตารางเวรจะถูกลบอย่างถาวร",
    cancel: "ยกเลิก",
    delete: "ลบ",
    saved: "บันทึกแล้ว",

    // ScheduleDetailsPage
    exportExcel: "ส่งออก Excel",
    scheduleView: "มุมมองตารางเวร",
    scheduleNotFound: "ไม่พบตารางเวร",

    // Toasts
    scheduleGenerated: "สร้างตารางเวรแล้ว",
    optimizationComplete: "จัดเวรเสร็จสมบูรณ์!",
    optimizationFailed: "จัดเวรล้มเหลว",

    // Partial result
    partialScheduleWarning: "ตารางเวรไม่สมบูรณ์",
    partialScheduleDesc: "ไม่สามารถจัดคนลงได้ครบทุกช่อง ช่องที่ยังไม่มีคนจะแสดงเป็นสีแดง ให้ท่านจัดเองต่อได้",
    unfilledSlots: "ช่องที่ยังขาดคน",
    unfilledSlotDetail: "ต้องการ {required} คน แต่จัดได้ {assigned} คน",
    vacancy: "ว่าง",

    // Months
    months: ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"],

    // Language
    language: "ภาษา",
  },
};

export type TranslationKey = keyof typeof translations.en;
export type Translations = typeof translations.en;

export function getTranslations(lang: Lang): Translations {
  return translations[lang] as Translations;
}

export function getDayNames(lang: Lang): string[] {
  const t = translations[lang];
  return [t.sun, t.mon, t.tue, t.wed, t.thu, t.fri, t.sat];
}
