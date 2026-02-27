import { useState, useMemo, useEffect, useCallback } from "react";
import { useCreateSchedule } from "@/hooks/use-schedules";
import { type StaffMember, type SchedulerConfig, type OptimizerResult, type DaySchedule } from "@shared/schema";
import { useAuth } from "@/context/AuthContext";
import { GoogleSignInButton, UserMenu } from "@/components/GoogleSignIn";
import { runOptimizerInWorker } from "@/lib/workerRunner";
import { WizardStep } from "@/components/WizardStep";
import { ScheduleView } from "@/components/ScheduleView";
import { ScheduleEditor } from "@/components/ScheduleEditor";
import { cn } from "@/lib/utils";
import { StatsCard } from "@/components/StatsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Users, 
  Calendar as CalendarIcon, 
  Settings2, 
  PlayCircle,
  Plus,
  Minus,
  X,
  Save,
  Loader2,
  Activity,
  History,
  Trash2,
  CalendarDays,
  FileSpreadsheet,
  Layers,
  AlertTriangle,
  Upload,
  Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { nanoid } from "nanoid";
import { Link, useLocation } from "wouter";
import { getDaysInMonth, format, setDate, parseISO, differenceInCalendarDays, addDays } from "date-fns";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import ExcelJS from "exceljs";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { WalkthroughOverlay, useWalkthrough } from "@/components/WalkthroughOverlay";
import type { WalkthroughStep } from "@/components/WalkthroughOverlay";

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

const getInitialConfig = (lang: string): SchedulerConfig => ({
  shiftsPerDay: 3,
  shiftNames: lang === "th" ? ["เช้า", "บ่าย", "ดึก"] : ["Morning", "Evening", "Night"],
  staffPerShift: [3, 3, 3],
  consecutiveRules: [
    { from: 2, to: 0 },
    { from: 1, to: 2, type: 'sameDay' as const },
    { from: 0, to: 1, type: 'sameDay' as const },
  ],
  maxConsecutiveRules: [{ shifts: [2], maxDays: 3 }],
});

const INITIAL_STAFF: StaffMember[] = [
  { id: "1", name: "Dr. Smith", maxShifts: 20, blocked: [] },
  { id: "2", name: "Nurse Joy", maxShifts: 20, blocked: [] },
  { id: "3", name: "Dr. House", maxShifts: 20, blocked: [] },
  { id: "4", name: "Nurse Jackie", maxShifts: 20, blocked: [] },
  { id: "5", name: "Dr. Grey", maxShifts: 20, blocked: [] },
];

const SHIFT_COLORS = [
  "B3D9FF", "B3FFB3", "D9B3FF", "FFE0B3", "FFB3B3",
];

function blendColors(c1: string, c2: string): string {
  const r = Math.round((parseInt(c1.slice(0, 2), 16) + parseInt(c2.slice(0, 2), 16)) / 2);
  const g = Math.round((parseInt(c1.slice(2, 4), 16) + parseInt(c2.slice(2, 4), 16)) / 2);
  const b = Math.round((parseInt(c1.slice(4, 6), 16) + parseInt(c2.slice(4, 6), 16)) / 2);
  return r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");
}

async function exportToExcel(
  name: string,
  month: number,
  year: number,
  result: DaySchedule[],
  config: SchedulerConfig,
  staff: StaffMember[],
  labels: { date: string; day: string; staffName: string; total: string; summary: string; schedule: string; staffSchedule: string; level: string },
  lang: string
) {
  const isCustomRange = config.useCustomRange && config.customStartDate;
  const baseDate = isCustomRange
    ? parseISO(config.customStartDate!)
    : new Date(year, month - 1, 1);
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name || "Unknown";
  const getDateForIdx = (dayIndex: number): Date => {
    if (isCustomRange) return addDays(parseISO(config.customStartDate!), dayIndex - 1);
    return setDate(baseDate, dayIndex);
  };

  const wb = new ExcelJS.Workbook();

  const maxPerShift: number[] = config.shiftNames.map((_, shiftIdx) => {
    let max = config.staffPerShift[shiftIdx] || 1;
    for (const day of result) {
      const count = day.shifts[shiftIdx]?.length || 0;
      if (count > max) max = count;
    }
    return max;
  });

  const schedHeaders: string[] = [labels.date, labels.day];
  config.shiftNames.forEach((shiftName, shiftIdx) => {
    for (let p = 0; p < maxPerShift[shiftIdx]; p++) {
      schedHeaders.push(maxPerShift[shiftIdx] === 1 ? shiftName : `${shiftName} ${p + 1}`);
    }
  });

  const ws1 = wb.addWorksheet(labels.schedule);
  const ws1HeaderRow = ws1.addRow(schedHeaders);
  ws1HeaderRow.font = { bold: true };
  ws1HeaderRow.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
  });
  const ws1ShiftColMap: { colStart: number; colEnd: number; colorIdx: number }[] = [];
  let ws1Col = 3;
  config.shiftNames.forEach((_, shiftIdx) => {
    const start = ws1Col;
    for (let p = 0; p < maxPerShift[shiftIdx]; p++) {
      ws1HeaderRow.getCell(ws1Col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + SHIFT_COLORS[shiftIdx % SHIFT_COLORS.length] } };
      ws1Col++;
    }
    ws1ShiftColMap.push({ colStart: start, colEnd: ws1Col - 1, colorIdx: shiftIdx });
  });

  result.forEach((day) => {
    const currentDate = getDateForIdx(day.date);
    const row: string[] = [format(currentDate, "MMM d"), format(currentDate, "EEEE")];
    config.shiftNames.forEach((_, shiftIdx) => {
      const names = day.shifts[shiftIdx]?.map(id => getStaffName(String(id))).filter(n => n !== "Unknown") || [];
      for (let p = 0; p < maxPerShift[shiftIdx]; p++) {
        row.push(names[p] || "");
      }
    });
    const exRow = ws1.addRow(row);
    for (const mapping of ws1ShiftColMap) {
      const bgColor = SHIFT_COLORS[mapping.colorIdx % SHIFT_COLORS.length];
      for (let c = mapping.colStart; c <= mapping.colEnd; c++) {
        const cell = exRow.getCell(c);
        if (cell.value && String(cell.value).length > 0) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + bgColor } };
        }
      }
    }
  });
  ws1.getColumn(1).width = 8;
  ws1.getColumn(2).width = 12;
  for (let i = 3; i <= schedHeaders.length; i++) ws1.getColumn(i).width = 18;

  const hasLevels = config.staffLevels && config.staffLevels.length > 0;

  const colLetter = (colNum: number): string => {
    let result = "";
    let n = colNum;
    while (n > 0) {
      n--;
      result = String.fromCharCode(65 + (n % 26)) + result;
      n = Math.floor(n / 26);
    }
    return result;
  };

  const dateHeaders = result.map((day) => format(getDateForIdx(day.date), "d MMM"));
  const ws3 = wb.addWorksheet(labels.staffSchedule);
  const matrixHeaders = hasLevels
    ? [labels.staffName, labels.level, ...dateHeaders, ...config.shiftNames, labels.total]
    : [labels.staffName, ...dateHeaders, ...config.shiftNames, labels.total];
  const headerRow = ws3.addRow(matrixHeaders);
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
  });

  const shiftColors = config.shiftNames.map((_, i) => SHIFT_COLORS[i % SHIFT_COLORS.length]);
  const ws3ColOffset = hasLevels ? 1 : 0;

  staff.forEach(s => {
    const levelLabel = hasLevels ? (config.staffLevels![(s.level ?? 0)] || "") : "";
    const rowValues: (string | number)[] = hasLevels ? [s.name, levelLabel] : [s.name];
    let grandTotal = 0;
    const shiftTotals = config.shiftNames.map(() => 0);
    const dayCellInfo: { shiftIndices: number[] }[] = [];

    result.forEach((day) => {
      const matchedShifts: number[] = [];
      config.shiftNames.forEach((_, shiftIdx) => {
        const assigned = day.shifts[shiftIdx]?.map(String) || [];
        if (assigned.includes(s.id)) {
          matchedShifts.push(shiftIdx);
          shiftTotals[shiftIdx]++;
          grandTotal++;
        }
      });
      const cellText = matchedShifts.map(si => config.shiftNames[si]).join("/");
      rowValues.push(cellText);
      dayCellInfo.push({ shiftIndices: matchedShifts });
    });

    config.shiftNames.forEach(() => rowValues.push(0));
    rowValues.push(0);

    const excelRow = ws3.addRow(rowValues);

    const excelRowNum = excelRow.number;
    const dayColStart = 2 + ws3ColOffset;
    const dayColEnd = dateHeaders.length + 1 + ws3ColOffset;
    const dayStartLetter = colLetter(dayColStart);
    const dayEndLetter = colLetter(dayColEnd);

    config.shiftNames.forEach((shiftName, shiftIdx) => {
      const shiftCountCol = dateHeaders.length + 2 + ws3ColOffset + shiftIdx;
      const cell = excelRow.getCell(shiftCountCol);
      cell.value = { formula: `COUNTIF(${dayStartLetter}${excelRowNum}:${dayEndLetter}${excelRowNum},"*${shiftName}*")`, result: shiftTotals[shiftIdx] } as any;
    });

    const totalCol = dateHeaders.length + 2 + ws3ColOffset + config.shiftNames.length;
    const firstShiftLetter = colLetter(dateHeaders.length + 2 + ws3ColOffset);
    const lastShiftLetter = colLetter(totalCol - 1);
    const totalCell = excelRow.getCell(totalCol);
    totalCell.value = { formula: `SUM(${firstShiftLetter}${excelRowNum}:${lastShiftLetter}${excelRowNum})`, result: grandTotal } as any;

    dayCellInfo.forEach((info, ci) => {
      const dayDate = result[ci].date;
      const hasFullDayBlock = s.blocked.some(b => b.date === dayDate && b.shift === -1);
      const allShiftsBlocked = hasFullDayBlock || config.shiftNames.every((_, shiftIdx) =>
        s.blocked.some(b => b.date === dayDate && b.shift === shiftIdx)
      );
      const hasRequested = (s.requested || []).some(r => r.date === dayDate && info.shiftIndices.includes(r.shift));
      const cell = excelRow.getCell(ci + 2 + ws3ColOffset);
      if (allShiftsBlocked) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF4444" } };
        cell.font = { color: { argb: "FFFFFFFF" } };
        return;
      }
      if (hasRequested && info.shiftIndices.length > 0) {
        cell.border = { top: { style: "medium", color: { argb: "FF10B981" } }, bottom: { style: "medium", color: { argb: "FF10B981" } }, left: { style: "medium", color: { argb: "FF10B981" } }, right: { style: "medium", color: { argb: "FF10B981" } } };
      }
      if (info.shiftIndices.length === 0) return;
      let bgColor: string;
      if (info.shiftIndices.length === 1) {
        bgColor = shiftColors[info.shiftIndices[0]];
      } else {
        bgColor = info.shiftIndices.reduce((acc, si) => blendColors(acc, shiftColors[si]), shiftColors[info.shiftIndices[0]]);
      }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + bgColor } };
    });
  });

  ws3.getColumn(1).width = 20;
  if (hasLevels) ws3.getColumn(2).width = 14;
  for (let i = 2 + ws3ColOffset; i <= dateHeaders.length + 1 + ws3ColOffset; i++) ws3.getColumn(i).width = 10;
  for (let i = dateHeaders.length + 2 + ws3ColOffset; i <= dateHeaders.length + 1 + ws3ColOffset + config.shiftNames.length; i++) ws3.getColumn(i).width = 12;
  ws3.getColumn(matrixHeaders.length).width = 8;

  if (hasLevels) {
    ws3.addRow([]);
    ws3.addRow([]);

    const levelNames = config.staffLevels!;
    const totalLabel = lang === "th" ? "รวม" : "Total";
    const staffFirstRow = 2;
    const staffLastRow = 1 + staff.length;
    const levelColLetter = colLetter(2);

    config.shiftNames.forEach((shiftName, shiftIdx) => {
      const shiftColor = SHIFT_COLORS[shiftIdx % SHIFT_COLORS.length];
      const shiftHeaderRow = ws3.addRow([shiftName, ""]);
      shiftHeaderRow.getCell(1).font = { bold: true, size: 12 };
      shiftHeaderRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + shiftColor } };

      const levelRowNumbers: number[] = [];

      levelNames.forEach((lvlName, lvlIdx) => {
        const minReq = config.minStaffPerLevel?.[shiftIdx]?.[lvlIdx] ?? 0;
        const displayName = minReq > 0 ? `${lvlName} >=${minReq}` : lvlName;
        const rowValues: (string | number)[] = ["", displayName];
        const staticCounts: number[] = [];
        result.forEach((day) => {
          const assignedIds = day.shifts[shiftIdx]?.map(String) || [];
          const count = assignedIds.filter(id => {
            const member = staff.find(s => s.id === id);
            return member && (member.level ?? 0) === lvlIdx;
          }).length;
          rowValues.push(0);
          staticCounts.push(count);
        });
        const lvlRow = ws3.addRow(rowValues);
        const lvlRowNum = lvlRow.number;
        levelRowNumbers.push(lvlRowNum);
        lvlRow.getCell(2).font = { bold: true };

        for (let ci = 0; ci < result.length; ci++) {
          const excelCol = ci + 2 + ws3ColOffset;
          const dayColL = colLetter(excelCol);
          const cell = lvlRow.getCell(excelCol);
          const cachedVal = staticCounts[ci];
          cell.value = { formula: `COUNTIFS($${levelColLetter}$${staffFirstRow}:$${levelColLetter}$${staffLastRow},"${lvlName}",${dayColL}$${staffFirstRow}:${dayColL}$${staffLastRow},"*${shiftName}*")`, result: cachedVal } as any;
          if (minReq > 0 && cachedVal < minReq) {
            cell.font = { bold: true, color: { argb: "FFFF0000" } };
          } else if (cachedVal > 0) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } };
            cell.font = { bold: true };
          }
          cell.alignment = { horizontal: "center" };
        }
      });

      const totalRowValues: (string | number)[] = ["", totalLabel];
      const staticTotals: number[] = [];
      result.forEach((day) => {
        const count = (day.shifts[shiftIdx] || []).filter(id => id && id.length > 0).length;
        totalRowValues.push(0);
        staticTotals.push(count);
      });
      const totRow = ws3.addRow(totalRowValues);
      const totRowNum = totRow.number;
      totRow.getCell(2).font = { bold: true };

      for (let ci = 0; ci < result.length; ci++) {
        const excelCol = ci + 2 + ws3ColOffset;
        const cell = totRow.getCell(excelCol);
        if (levelRowNumbers.length > 0) {
          const sumParts = levelRowNumbers.map(rn => `${colLetter(excelCol)}${rn}`).join(",");
          cell.value = { formula: `SUM(${sumParts})`, result: staticTotals[ci] } as any;
        }
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + shiftColor } };
        cell.font = { bold: true };
        cell.alignment = { horizontal: "center" };
      }

      ws3.addRow([]);
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const rangeLabel = isCustomRange
    ? `${config.customStartDate}_to_${config.customEndDate}`
    : `${month}_${year}`;
  a.download = `${name.replace(/[^a-zA-Z0-9]/g, "_")}_${rangeLabel}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function WizardPage(props: { exportOnly?: boolean } & Record<string, any>) {
  const exportOnly = props.exportOnly ?? false;
  const [step, setStep] = useState(1);
  const walkthrough = useWalkthrough(step);

  const walkthroughStep1: WalkthroughStep[] = [
    { targetSelector: '[data-walkthrough="shifts-per-day"]', titleKey: "wkShiftsPerDayTitle", descKey: "wkShiftsPerDayDesc", position: "right" },
    { targetSelector: '[data-walkthrough="timeline"]', titleKey: "wkTimelineTitle", descKey: "wkTimelineDesc", position: "right" },
    { targetSelector: '[data-walkthrough="shift-details"]', titleKey: "wkShiftDetailsTitle", descKey: "wkShiftDetailsDesc", position: "left" },
    { targetSelector: '[data-walkthrough="holiday-toggle"]', titleKey: "wkHolidayToggleTitle", descKey: "wkHolidayToggleDesc", position: "left" },
    { targetSelector: '[data-walkthrough="staff-levels"]', titleKey: "wkStaffLevelsTitle", descKey: "wkStaffLevelsDesc", position: "top" },
    { targetSelector: '[data-testid="button-next-step"]', titleKey: "wkNextStepTitle", descKey: "wkNextStepDesc", position: "top" },
  ];

  const walkthroughStep2: WalkthroughStep[] = [
    { targetSelector: '[data-walkthrough="add-staff-buttons"]', titleKey: "wk2AddStaffTitle", descKey: "wk2AddStaffDesc", position: "bottom" },
    { targetSelector: '[data-walkthrough="staff-list"]', titleKey: "wk2StaffListTitle", descKey: "wk2StaffListDesc", position: "right" },
    { targetSelector: '[data-walkthrough="max-shifts-global"]', titleKey: "wk2MaxShiftsTitle", descKey: "wk2MaxShiftsDesc", position: "right" },
    { targetSelector: '[data-walkthrough="calendar-panel"]', titleKey: "wk2CalendarTitle", descKey: "wk2CalendarDesc", position: "left" },
    { targetSelector: '[data-walkthrough="block-request-mode"]', titleKey: "wk2BlockRequestTitle", descKey: "wk2BlockRequestDesc", position: "left" },
  ];

  const walkthroughStep3: WalkthroughStep[] = [
    { targetSelector: '[data-walkthrough="consecutive-rules"]', titleKey: "wk3ConsecutiveTitle", descKey: "wk3ConsecutiveDesc", position: "right" },
    { targetSelector: '[data-walkthrough="max-consecutive-rules"]', titleKey: "wk3MaxConsecutiveTitle", descKey: "wk3MaxConsecutiveDesc", position: "right" },
    { targetSelector: '[data-walkthrough="holiday-balancing"]', titleKey: "wk3HolidayBalancingTitle", descKey: "wk3HolidayBalancingDesc", position: "right" },
    { targetSelector: '[data-walkthrough="optimize-button"]', titleKey: "wk3OptimizeTitle", descKey: "wk3OptimizeDesc", position: "left" },
  ];

  const walkthroughStep4: WalkthroughStep[] = [
    { targetSelector: '[data-walkthrough="version-selector"]', titleKey: "wk4VersionTitle", descKey: "wk4VersionDesc", position: "bottom" },
    { targetSelector: '[data-walkthrough="view-tabs"]', titleKey: "wk4ViewTabsTitle", descKey: "wk4ViewTabsDesc", position: "bottom" },
    { targetSelector: '[data-walkthrough="regenerate-btn"]', titleKey: "wk4RegenerateTitle", descKey: "wk4RegenerateDesc", position: "bottom" },
    { targetSelector: '[data-walkthrough="export-btn"]', titleKey: "wk4ExportTitle", descKey: "wk4ExportDesc", position: "bottom" },
  ];
  const [month, setMonth] = useState(() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return next.getMonth() + 1;
  });
  const [year, setYear] = useState(() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return next.getFullYear();
  });
  const [config, setConfig] = useState<SchedulerConfig>(() => getInitialConfig(localStorage.getItem("app-lang") || "th"));
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STAFF);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [bulkStartNum, setBulkStartNum] = useState(1);
  const [bulkMaxShifts, setBulkMaxShifts] = useState(20);
  const [bulkLevel, setBulkLevel] = useState(0);
  const [globalMaxShifts, setGlobalMaxShifts] = useState(20);
  const [results, setResults] = useState<OptimizerResult[]>([]);
  const [selectedVersion, setSelectedVersion] = useState(0);
  const [scheduleName, setScheduleName] = useState("My Schedule");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveVersion, setSaveVersion] = useState(0);
  const [optimizeProgress, setOptimizeProgress] = useState(0);
  const [optimizeTotal, setOptimizeTotal] = useState(3);
  const result = results.length > 0 ? results[selectedVersion] : null;
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const handleScheduleEdit = useCallback((updatedSchedule: DaySchedule[]) => {
    if (results.length === 0) return;
    const isCustom = useCustomRange && customStartDate;
    const base = isCustom
      ? new Date(customStartDate)
      : new Date(year, month - 1, 1);
    const hols = new Set(config.holidays || []);

    const getDate = (idx: number) => {
      if (isCustom) {
        const d = new Date(customStartDate);
        d.setDate(d.getDate() + idx - 1);
        return d;
      }
      const d = new Date(base);
      d.setDate(idx);
      return d;
    };

    const perStaff = staff.map((s) => {
      const byShift = new Array(config.shiftsPerDay).fill(0);
      const weekdayByShift = new Array(config.shiftsPerDay).fill(0);
      const holidayByShift = new Array(config.shiftsPerDay).fill(0);
      let total = 0, weekdayTotal = 0, holidayTotal = 0;
      for (const day of updatedSchedule) {
        const dt = getDate(day.date);
        const isHol = dt.getDay() === 0 || dt.getDay() === 6 || hols.has(day.date);
        for (let si = 0; si < day.shifts.length; si++) {
          if (day.shifts[si].includes(s.id)) {
            byShift[si]++;
            total++;
            if (isHol) { holidayByShift[si]++; holidayTotal++; }
            else { weekdayByShift[si]++; weekdayTotal++; }
          }
        }
      }
      return { name: s.name, total, byShift, weekdayTotal, weekdayByShift, holidayTotal, holidayByShift };
    });

    const totals = perStaff.map(s => s.total);
    const range = totals.length > 0 ? Math.max(...totals) - Math.min(...totals) : 0;

    const updated = { ...results[selectedVersion], schedule: updatedSchedule, metrics: { range, perStaff } };
    const newResults = [...results];
    newResults[selectedVersion] = updated;
    setResults(newResults);
  }, [results, selectedVersion, config, staff, month, year, useCustomRange, customStartDate]);

  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [loginPromptReason, setLoginPromptReason] = useState<"next" | "save">("next");
  const [presetLoaded, setPresetLoaded] = useState(false);
  const [showLevelWarning, setShowLevelWarning] = useState(false);
  const [levelWarnings, setLevelWarnings] = useState<string[]>([]);
  const [showPreCheckWarning, setShowPreCheckWarning] = useState(false);
  const [preCheckWarnings, setPreCheckWarnings] = useState<string[]>([]);
  const [preCheckConflicts, setPreCheckConflicts] = useState<string[]>([]);
  const [hasExported, setHasExported] = useState(false);
  const { user } = useAuth();

  const handleModeSwitch = (mode: string) => {
    const newMode = mode === "custom";
    if (newMode !== useCustomRange) {
      setUseCustomRange(newMode);
      setStaff(prev => prev.map(s => ({ ...s, blocked: [], requested: [] })));
      setConfig(prev => ({ ...prev, holidays: [] }));
    }
  };
  
  const createMutation = useCreateSchedule();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { t, dayNames, lang } = useLanguage();

  const defaultShiftNamesTh = ["เช้า", "บ่าย", "ดึก"];
  const defaultShiftNamesEn = ["Morning", "Evening", "Night"];
  useEffect(() => {
    setConfig(prev => {
      const isDefaultTh = prev.shiftNames.length === 3 && prev.shiftNames.every((n, i) => n === defaultShiftNamesTh[i]);
      const isDefaultEn = prev.shiftNames.length === 3 && prev.shiftNames.every((n, i) => n === defaultShiftNamesEn[i]);
      if (isDefaultTh || isDefaultEn) {
        const newNames = lang === "th" ? defaultShiftNamesTh : defaultShiftNamesEn;
        if (prev.shiftNames.every((n, i) => n === newNames[i])) return prev;
        return { ...prev, shiftNames: newNames };
      }
      return prev;
    });
  }, [lang]);

  useEffect(() => {
    if (user && showLoginPrompt) {
      setShowLoginPrompt(false);
      if (loginPromptReason === "save") {
        savePreset();
      } else {
        setStep(s => Math.min(s + 1, 4));
      }
    }
  }, [user, showLoginPrompt, loginPromptReason]);

  useEffect(() => {
    if (!user) {
      setPresetLoaded(false);
      return;
    }
    if (presetLoaded) return;
    fetch("/api/presets")
      .then(r => {
        if (!r.ok) throw new Error("Not authenticated");
        return r.json();
      })
      .then(presets => {
        if (Array.isArray(presets) && presets.length > 0) {
          const p = presets[0];
          if (p.config) setConfig(p.config);
          if (p.staff && p.staff.length > 0) {
            setStaff(p.staff.map((s: StaffMember) => ({ ...s, blocked: s.blocked || [], requested: s.requested || [] })));
          }
          toast({ title: lang === "th" ? "โหลดข้อมูลสตาฟสำเร็จ" : "Staff data loaded", description: lang === "th" ? "ข้อมูลสตาฟและการตั้งค่าจากครั้งก่อนถูกโหลดแล้ว" : "Your saved staff and config have been loaded" });
        }
        setPresetLoaded(true);
      })
      .catch(() => {});
  }, [user, presetLoaded]);

  const savePreset = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: scheduleName, config, staff }),
      });
      if (res.ok) {
        toast({
          title: lang === "th" ? "บันทึกสำเร็จ" : "Saved successfully",
          description: lang === "th" ? "ข้อมูลการตั้งค่าและรายชื่อบุคลากรถูกบันทึกแล้ว" : "Your settings and staff data have been saved",
        });
      }
    } catch {}
  }, [user, config, staff, scheduleName, toast, lang]);

  const daysInMonth = useMemo(() => {
    if (useCustomRange && customStartDate && customEndDate) {
      try {
        const start = parseISO(customStartDate);
        const end = parseISO(customEndDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
        const diff = differenceInCalendarDays(end, start) + 1;
        return diff > 0 ? diff : 0;
      } catch {
        return 0;
      }
    }
    return getDaysInMonth(new Date(year, month - 1));
  }, [month, year, useCustomRange, customStartDate, customEndDate]);

  const handleSavePresetClick = () => {
    if (!user) {
      setLoginPromptReason("save");
      setShowLoginPrompt(true);
      return;
    }
    savePreset();
  };

  const handleNext = () => {
    if (step === 2 && !user) {
      setLoginPromptReason("next");
      setShowLoginPrompt(true);
      return;
    }
    setStep(s => Math.min(s + 1, 4));
  };
  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  const updateShiftName = (idx: number, name: string) => {
    const newNames = [...config.shiftNames];
    newNames[idx] = name;
    setConfig({ ...config, shiftNames: newNames });
  };

  const updateStaffCount = (idx: number, count: number) => {
    const newCounts = [...config.staffPerShift];
    newCounts[idx] = count;
    setConfig({ ...config, staffPerShift: newCounts });
  };

  const updateHolidayStaffCount = (idx: number, count: number) => {
    const newCounts = [...(config.holidayStaffPerShift || config.staffPerShift)];
    newCounts[idx] = Math.max(0, count);
    setConfig({ ...config, holidayStaffPerShift: newCounts });
  };

  const addStaffLevel = () => {
    const levels = config.staffLevels || [];
    if (levels.length >= 5) return;
    const defaultNames = lang === "th" 
      ? ["พยาบาล", "ผู้ช่วยพยาบาล", "คนงาน", "ระดับ 4", "ระดับ 5"]
      : ["Nurse", "Assistant", "Worker", "Level 4", "Level 5"];
    const newName = defaultNames[levels.length] || `Level ${levels.length + 1}`;
    const newLevels = [...levels, newName];
    const newMinPerLevel = (config.minStaffPerLevel || config.shiftNames.map(() => [])).map(row => [...row, 0]);
    setConfig({ ...config, staffLevels: newLevels, minStaffPerLevel: newMinPerLevel });
  };

  const removeStaffLevel = (idx: number) => {
    const levels = [...(config.staffLevels || [])];
    levels.splice(idx, 1);
    const newMinPerLevel = (config.minStaffPerLevel || []).map(row => {
      const newRow = [...row];
      newRow.splice(idx, 1);
      return newRow;
    });
    setStaff(staff.map(s => {
      if ((s.level ?? 0) === idx) return { ...s, level: 0 };
      if ((s.level ?? 0) > idx) return { ...s, level: (s.level ?? 0) - 1 };
      return s;
    }));
    if (levels.length === 0) {
      setConfig({ ...config, staffLevels: undefined, minStaffPerLevel: undefined });
    } else {
      setConfig({ ...config, staffLevels: levels, minStaffPerLevel: newMinPerLevel });
    }
  };

  const updateStaffLevelName = (idx: number, name: string) => {
    const levels = [...(config.staffLevels || [])];
    levels[idx] = name;
    setConfig({ ...config, staffLevels: levels });
  };

  const updateMinStaffPerLevel = (shiftIdx: number, levelIdx: number, val: number) => {
    const current = config.minStaffPerLevel || config.shiftNames.map(() => (config.staffLevels || []).map(() => 0));
    const newMin = current.map((row, si) => si === shiftIdx ? row.map((v, li) => li === levelIdx ? Math.max(0, val) : v) : [...row]);
    setConfig({ ...config, minStaffPerLevel: newMin });
  };

  const toggleSeparateHolidayConfig = (checked: boolean) => {
    if (checked) {
      setConfig({
        ...config,
        separateHolidayConfig: true,
        holidayStaffPerShift: [...config.staffPerShift],
      });
    } else {
      setConfig({
        ...config,
        separateHolidayConfig: false,
        holidayStaffPerShift: undefined,
      });
    }
  };

  const setShiftsPerDay = (val: number) => {
    if (val < 1 || val > 5) return;
    const newNames = [...config.shiftNames];
    const newCounts = [...config.staffPerShift];
    const newHolCounts = config.holidayStaffPerShift ? [...config.holidayStaffPerShift] : undefined;
    let newMinPerLevel = config.minStaffPerLevel ? config.minStaffPerLevel.map(row => [...row]) : undefined;
    if (val > config.shiftsPerDay) {
      for (let i = config.shiftsPerDay; i < val; i++) {
        newNames.push(`Shift ${i + 1}`);
        newCounts.push(1);
        if (newHolCounts) newHolCounts.push(1);
        if (newMinPerLevel) newMinPerLevel.push((config.staffLevels || []).map(() => 0));
      }
    } else {
      newNames.splice(val);
      newCounts.splice(val);
      if (newHolCounts) newHolCounts.splice(val);
      if (newMinPerLevel) newMinPerLevel.splice(val);
    }
    setConfig({ ...config, shiftsPerDay: val, shiftNames: newNames, staffPerShift: newCounts, holidayStaffPerShift: newHolCounts, minStaffPerLevel: newMinPerLevel });
  };

  const addStaff = () => {
    const randomNames = ["Dr. Smith", "Nurse Jackie", "Dr. Strange", "Nurse Joy", "Dr. House", "Nurse Ratched", "Dr. Watson", "Nurse Nightingale", "Dr. Grey", "Nurse Somsri", "Dr. Somchai"];
    const existingNames = new Set(staff.map(s => s.name.toLowerCase()));
    const availableNames = randomNames.filter(name => !existingNames.has(name.toLowerCase()));
    
    let name = "";
    if (availableNames.length > 0) {
      name = availableNames[Math.floor(Math.random() * availableNames.length)];
    } else {
      name = `Staff Member ${staff.length + 1}`;
    }
    
    setStaff([...staff, { id: nanoid(), name, maxShifts: 20, blocked: [] }]);
  };

  const addBulkStaff = () => {
    const prefix = bulkPrefix.trim() || (lang === "th" ? "บุคลากร" : "Staff");
    const newStaff: StaffMember[] = [];
    for (let i = 0; i < bulkCount; i++) {
      const member: StaffMember = {
        id: nanoid(),
        name: `${prefix} ${bulkStartNum + i}`,
        maxShifts: bulkMaxShifts,
        blocked: [],
      };
      if (config.staffLevels && config.staffLevels.length > 0) {
        member.level = bulkLevel;
      }
      newStaff.push(member);
    }
    setStaff([...staff, ...newStaff]);
    setShowBulkAdd(false);
    setBulkStartNum(bulkStartNum + bulkCount);
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const buffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.worksheets[0];
      if (!ws) {
        toast({ title: t.uploadExcelError, variant: "destructive" });
        return;
      }
      const names: string[] = [];
      ws.eachRow((row) => {
        const val = row.getCell(1).value;
        const name = val?.toString().trim();
        if (name && name.length > 0) names.push(name);
      });
      if (names.length === 0) {
        toast({ title: t.uploadExcelEmpty, variant: "destructive" });
        return;
      }
      const newStaff: StaffMember[] = names.map(name => ({
        id: nanoid(),
        name,
        maxShifts: globalMaxShifts,
        blocked: [],
      }));
      setStaff([...staff, ...newStaff]);
      toast({ title: t.uploadExcelSuccess.replace("{count}", String(names.length)) });
    } catch {
      toast({ title: t.uploadExcelError, variant: "destructive" });
    }
  };

  const downloadExcelTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(lang === "th" ? "รายชื่อ" : "Staff");
    ws.getColumn(1).width = 30;
    const sampleNames = lang === "th"
      ? ["สมชาย ใจดี", "สมหญิง รักเรียน", "วิชัย สุขสันต์", "ประภาศรี แก้วใส", "นภัทร วงศ์สว่าง", "ธนกฤต พิทักษ์", "แพรวา จันทร์เพ็ญ", "ญาดา มณีรัตน์", "ปัทมพร ศรีสุข", "หฤษฏ์ เจริญผล"]
      : ["John Smith", "Jane Doe", "Mike Johnson", "Sarah Williams", "David Brown", "Emily Davis", "Robert Wilson", "Lisa Anderson", "James Taylor", "Maria Garcia"];
    sampleNames.forEach(name => ws.addRow([name]));
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "staff_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const applyGlobalMaxShifts = () => {
    setStaff(staff.map(s => ({ ...s, maxShifts: globalMaxShifts })));
  };

  const removeStaff = (id: string) => {
    setStaff(staff.filter(s => s.id !== id));
  };

  const updateStaff = (id: string, field: keyof StaffMember, value: any) => {
    setStaff(staff.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const toggleBlockedDate = (staffId: string, date: number, shiftIdx: number) => {
    const member = staff.find(s => s.id === staffId);
    if (!member) return;
    const existing = member.blocked.findIndex(b => b.date === date && b.shift === shiftIdx);
    let newBlocked;
    if (existing !== -1) {
      newBlocked = member.blocked.filter((_, i) => i !== existing);
    } else {
      newBlocked = [...member.blocked, { date, shift: shiftIdx }];
      const newRequested = (member.requested || []).filter(r => !(r.date === date && r.shift === shiftIdx));
      if (newRequested.length !== (member.requested || []).length) {
        updateStaff(staffId, "requested", newRequested);
      }
    }
    updateStaff(staffId, "blocked", newBlocked);
  };

  const isDateBlocked = (staffId: string, date: number, shiftIdx: number) => {
    const member = staff.find(s => s.id === staffId);
    if (!member) return false;
    return member.blocked.some(b => b.date === date && (b.shift === shiftIdx || b.shift === -1));
  };

  const isFullDayBlocked = (staffId: string, date: number) => {
    const member = staff.find(s => s.id === staffId);
    if (!member) return false;
    return member.blocked.some(b => b.date === date && b.shift === -1);
  };

  const toggleFullDayBlock = (staffId: string, date: number) => {
    const member = staff.find(s => s.id === staffId);
    if (!member) return;
    const hasFullDay = member.blocked.some(b => b.date === date && b.shift === -1);
    let newBlocked;
    if (hasFullDay) {
      newBlocked = member.blocked.filter(b => !(b.date === date));
    } else {
      newBlocked = [...member.blocked.filter(b => b.date !== date), { date, shift: -1 }];
      const newRequested = (member.requested || []).filter(r => r.date !== date);
      if (newRequested.length !== (member.requested || []).length) {
        updateStaff(staffId, "requested", newRequested);
      }
    }
    updateStaff(staffId, "blocked", newBlocked);
  };

  const toggleRequestedDate = (staffId: string, date: number, shiftIdx: number) => {
    const member = staff.find(s => s.id === staffId);
    if (!member) return;
    if (member.blocked.some(b => b.date === date && (b.shift === -1 || b.shift === shiftIdx))) return;
    const requested = member.requested || [];
    const existing = requested.findIndex(r => r.date === date && r.shift === shiftIdx);
    let newRequested;
    if (existing !== -1) {
      newRequested = requested.filter((_, i) => i !== existing);
    } else {
      newRequested = [...requested, { date, shift: shiftIdx }];
    }
    updateStaff(staffId, "requested", newRequested);
  };

  const isDateRequested = (staffId: string, date: number, shiftIdx: number) => {
    const member = staff.find(s => s.id === staffId);
    if (!member) return false;
    return (member.requested || []).some(r => r.date === date && r.shift === shiftIdx);
  };

  const hasAnyRequested = (staffId: string, date: number) => {
    const member = staff.find(s => s.id === staffId);
    if (!member) return false;
    return (member.requested || []).some(r => r.date === date);
  };

  const checkLevelFeasibility = (): string[] => {
    const levels = config.staffLevels;
    const minPerLevel = config.minStaffPerLevel;
    if (!levels || levels.length === 0 || !minPerLevel) return [];

    const S = config.shiftNames.length;
    let totalDays: number;
    if (useCustomRange && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    } else {
      totalDays = new Date(year, month, 0).getDate();
    }

    const warnings: string[] = [];
    for (let lvl = 0; lvl < levels.length; lvl++) {
      let totalNeeded = 0;
      for (let s = 0; s < S; s++) {
        const minReq = minPerLevel[s]?.[lvl] ?? 0;
        if (minReq > 0) totalNeeded += minReq * totalDays;
      }
      if (totalNeeded === 0) continue;

      const levelStaff = staff.filter(s => (s.level ?? 0) === lvl);
      const totalBlocked = levelStaff.reduce((sum, s) => sum + (s.blocked?.length ?? 0), 0);
      const totalCapacity = levelStaff.reduce((sum, s) => sum + s.maxShifts, 0) - totalBlocked;
      const avgMax = levelStaff.length > 0 ? Math.round(levelStaff.reduce((s, m) => s + m.maxShifts, 0) / levelStaff.length) : 0;

      if (totalCapacity < totalNeeded) {
        warnings.push(
          t.levelCapacityDetail
            .replace("{level}", levels[lvl])
            .replace("{needed}", String(totalNeeded))
            .replace("{capacity}", String(Math.max(0, totalCapacity)))
            .replace("{count}", String(levelStaff.length))
            .replace("{maxShifts}", String(avgMax))
            .replace("{blocked}", String(totalBlocked))
        );
      }
    }

    const holidayDays = new Set<number>();
    if (config.balanceHolidays || config.separateHolidayConfig) {
      for (let d = 1; d <= totalDays; d++) {
        const dt = getDateForIndex(d);
        const dow = dt.getDay();
        if (dow === 0 || dow === 6) holidayDays.add(d);
      }
      if (config.holidays) {
        for (const h of config.holidays) holidayDays.add(h);
      }
    }

    let dayWarningCount = 0;
    const maxDayWarnings = 5;
    for (let d = 1; d <= totalDays && dayWarningCount < maxDayWarnings; d++) {
      const isHol = holidayDays.has(d);
      const sps = (config.separateHolidayConfig && config.holidayStaffPerShift && isHol)
        ? config.holidayStaffPerShift : config.staffPerShift;
      for (let s = 0; s < S && dayWarningCount < maxDayWarnings; s++) {
        if ((sps[s] || 0) === 0) continue;
        for (let lvl = 0; lvl < levels.length && dayWarningCount < maxDayWarnings; lvl++) {
          const minReq = minPerLevel[s]?.[lvl] ?? 0;
          if (minReq <= 0) continue;
          const availableAtLevel = staff.filter(m => {
            if ((m.level ?? 0) !== lvl) return false;
            return !m.blocked.some(b => b.date === d && (b.shift === -1 || b.shift === s));
          }).length;
          if (availableAtLevel < minReq) {
            const dt = getDateForIndex(d);
            warnings.push(
              t.levelDayShortage
                .replace("{day}", String(d))
                .replace("{date}", format(dt, "d/M"))
                .replace("{shift}", config.shiftNames[s])
                .replace("{needed}", String(minReq))
                .replace("{level}", levels[lvl])
                .replace("{available}", String(availableAtLevel))
            );
            dayWarningCount++;
          }
        }
      }
    }

    return warnings;
  };

  const estimateShouldForceSoftLevels = (): boolean => {
    const levels = config.staffLevels;
    const minPerLevel = config.minStaffPerLevel;
    if (!levels || levels.length === 0 || !minPerLevel) return false;

    const S = config.shiftNames.length;
    let totalDays: number;
    if (useCustomRange && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    } else {
      totalDays = new Date(year, month, 0).getDate();
    }

    for (let lvl = 0; lvl < levels.length; lvl++) {
      let totalNeeded = 0;
      const levelShifts = new Set<number>();
      for (let s = 0; s < S; s++) {
        const minReq = minPerLevel[s]?.[lvl] ?? 0;
        if (minReq > 0) {
          totalNeeded += minReq * totalDays;
          levelShifts.add(s);
        }
      }
      if (totalNeeded === 0) continue;

      const levelStaff = staff.filter(s => (s.level ?? 0) === lvl);
      if (levelStaff.length === 0) return true;

      const totalBlocked = levelStaff.reduce((sum, s) => sum + (s.blocked?.length ?? 0), 0);
      let rawCapacity = levelStaff.reduce((sum, s) => sum + s.maxShifts, 0) - totalBlocked;

      let penaltyFactor = 1.0;
      for (const rule of (config.consecutiveRules || [])) {
        const ruleType = rule.type || 'nextDay';
        const fromRelevant = levelShifts.has(rule.from);
        const toRelevant = levelShifts.has(rule.to);
        if (fromRelevant || toRelevant) {
          if (ruleType === 'sameDay') {
            penaltyFactor -= 0.15;
          } else {
            penaltyFactor -= 0.12;
          }
        }
      }

      if (config.maxConsecutiveRules) {
        for (const rule of config.maxConsecutiveRules) {
          const hasRelevantShift = rule.shifts.some(s => levelShifts.has(s));
          if (hasRelevantShift) {
            penaltyFactor -= 0.08;
          }
        }
      }

      penaltyFactor = Math.max(0.3, penaltyFactor);

      const effectiveCapacity = rawCapacity * penaltyFactor;
      if (effectiveCapacity < totalNeeded * 1.1) {
        return true;
      }
    }

    return false;
  };

  const executeOptimizer = (softLevels: boolean) => {
    setIsOptimizing(true);
    setOptimizeProgress(0);
    setOptimizeTotal(1);
    const optimizeStartTime = performance.now();
    (async () => {
      try {
        let holStaff = config.holidayStaffPerShift;
        if (config.separateHolidayConfig && holStaff) {
          while (holStaff.length < config.shiftNames.length) holStaff = [...holStaff, config.staffPerShift[holStaff.length] ?? 1];
          if (holStaff.length > config.shiftNames.length) holStaff = holStaff.slice(0, config.shiftNames.length);
        }
        const optimizerConfig = {
          ...config,
          useCustomRange,
          customStartDate: useCustomRange ? customStartDate : undefined,
          customEndDate: useCustomRange ? customEndDate : undefined,
          holidayStaffPerShift: config.separateHolidayConfig ? holStaff : undefined,
        };

        setOptimizeProgress(1);
        await new Promise(r => setTimeout(r, 50));
        const res = await runOptimizerInWorker(optimizerConfig, staff, month, year, { softLevelConstraints: softLevels });

        setResults([res]);
        setSelectedVersion(0);
        setStep(4);
        savePreset();

        const totalDays = res?.schedule?.length ?? 0;
        const totalAssigned = res?.metrics?.perStaff?.reduce((sum, s) => sum + s.total, 0) ?? 0;
        const unfilledCount = res?.unfilledSlots?.reduce((sum, u) => sum + (u.required - u.assigned), 0) ?? 0;
        const totalRequired = totalAssigned + unfilledCount;
        const coveragePct = totalRequired > 0 ? Math.round((totalAssigned / totalRequired) * 100) : 0;
        try {
          fetch("/api/usage-log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventType: "schedule_generated",
              staffCount: staff.length,
              dayCount: totalDays,
              shiftCount: config.shiftNames.length,
              coveragePercent: Math.min(coveragePct, 100),
              isPartial: res?.isPartial ?? false,
              durationMs: Math.round(performance.now() - optimizeStartTime),
              metadata: {
                shiftNames: config.shiftNames,
                softLevels,
                versions: 1,
                hasLevels: !!config.staffLevels?.length,
              },
            }),
          }).catch(() => {});
          const anonymizedStaff = staff.map((s, i) => ({
            ...s,
            name: `Staff_${i + 1}`,
            id: `s${i + 1}`,
          }));
          fetch("/api/generated-schedules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              month,
              year,
              config: optimizerConfig,
              staff: anonymizedStaff,
              result: res,
            }),
          }).catch(() => {});
        } catch {}

        if (res.isPartial && res.unfilledSlots && res.unfilledSlots.length > 0) {
          toast({ 
            title: t.partialScheduleWarning, 
            description: t.partialScheduleDesc, 
            variant: "destructive" 
          });
        } else if (softLevels) {
          toast({ title: t.scheduleGenerated, description: t.softLevelNote, variant: "default" });
        } else {
          toast({ title: t.scheduleGenerated, description: t.optimizationComplete });
        }
      } catch (e: any) {
        const isTimeout = e.message === "OPTIMIZER_TIMEOUT";
        toast({ 
          title: t.optimizationFailed, 
          description: isTimeout ? t.optimizerTimeout : (e.message || "Could not satisfy all constraints. Try adding more staff or loosening rules."), 
          variant: "destructive" 
        });
      } finally {
        setIsOptimizing(false);
        setOptimizeProgress(0);
      }
    })();
  };

  const checkPreOptimization = (): { capacityWarnings: string[]; conflicts: string[] } => {
    const capacityWarnings: string[] = [];
    let totalDays: number;
    if (useCustomRange && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    } else {
      totalDays = new Date(year, month, 0).getDate();
    }

    const holidayDays = new Set<number>();
    if (config.balanceHolidays || config.separateHolidayConfig) {
      for (let d = 1; d <= totalDays; d++) {
        const dt = getDateForIndex(d);
        const dow = dt.getDay();
        if (dow === 0 || dow === 6) holidayDays.add(d);
      }
      if (config.holidays) {
        for (const h of config.holidays) holidayDays.add(h);
      }
    }

    let totalSlots = 0;
    for (let d = 1; d <= totalDays; d++) {
      const isHol = holidayDays.has(d);
      const sps = (config.separateHolidayConfig && config.holidayStaffPerShift && isHol)
        ? config.holidayStaffPerShift : config.staffPerShift;
      for (let s = 0; s < config.shiftNames.length; s++) {
        const needed = sps[s] || 0;
        if (needed === 0) continue;
        totalSlots += needed;
        let available = 0;
        for (const m of staff) {
          const blocked = m.blocked.some(b => b.date === d && (b.shift === -1 || b.shift === s));
          if (!blocked) available++;
        }
        if (available < needed) {
          const dt = getDateForIndex(d);
          capacityWarnings.push(
            t.capacityWarningDay
              .replace("{day}", String(d))
              .replace("{date}", format(dt, "d/M"))
              .replace("{shift}", config.shiftNames[s])
              .replace("{needed}", String(needed))
              .replace("{available}", String(available))
          );
        }
      }
    }

    let totalCapacity = staff.reduce((sum, m) => sum + m.maxShifts, 0);
    if (totalSlots > totalCapacity) {
      capacityWarnings.unshift(
        t.capacityWarning
          .replace("{totalSlots}", String(totalSlots))
          .replace("{totalCapacity}", String(totalCapacity))
      );
    }

    const conflicts: string[] = [];
    for (const m of staff) {
      const requested = m.requested || [];
      if (requested.length === 0) continue;
      if (requested.length > m.maxShifts) {
        conflicts.push(
          (lang === "th"
            ? `${m.name}: ขอเวร ${requested.length} เวร แต่จำนวนเวรสูงสุดคือ ${m.maxShifts} เวร กรุณาลดจำนวนเวรที่ขอหรือเพิ่มเวรสูงสุด`
            : `${m.name}: requested ${requested.length} shifts but max shifts is ${m.maxShifts}. Please reduce requests or increase max shifts.`)
        );
      }
      for (const rule of config.consecutiveRules) {
        const ruleType = rule.type || 'nextDay';
        if (ruleType === 'sameDay') {
          for (let d = 1; d <= totalDays; d++) {
            const hasFrom = requested.some(r => r.date === d && r.shift === rule.from);
            const hasTo = requested.some(r => r.date === d && r.shift === rule.to);
            if (hasFrom && hasTo) {
              conflicts.push(
                t.requestedConflictDetail
                  .replace("{name}", m.name)
                  .replace("{shiftA}", config.shiftNames[rule.from])
                  .replace("{shiftB}", config.shiftNames[rule.to])
                  .replace("{context}", t.requestedConflictSameDay.replace("{day}", String(d)))
                  .replace("{ruleType}", t.conflictRuleSameDay)
              );
            }
          }
        } else {
          for (let d = 1; d < totalDays; d++) {
            const hasFrom = requested.some(r => r.date === d && r.shift === rule.from);
            const hasTo = requested.some(r => r.date === d + 1 && r.shift === rule.to);
            if (hasFrom && hasTo) {
              conflicts.push(
                t.requestedConflictDetail
                  .replace("{name}", m.name)
                  .replace("{shiftA}", config.shiftNames[rule.from])
                  .replace("{shiftB}", config.shiftNames[rule.to])
                  .replace("{context}", t.requestedConflictNextDay.replace("{dayA}", String(d)).replace("{dayB}", String(d + 1)))
                  .replace("{ruleType}", t.conflictRuleNextDay)
              );
            }
          }
        }
      }
    }

    if (config.maxConsecutiveRules) {
      for (const m of staff) {
        const requested = m.requested || [];
        if (requested.length === 0) continue;
        for (const rule of config.maxConsecutiveRules) {
          const isCombined = rule.shifts.length > 1;

          let qualifyingDays: number[];
          if (isCombined) {
            const daySet = new Set<number>();
            for (const r of requested) {
              if (rule.shifts.includes(r.shift)) daySet.add(r.date);
            }
            qualifyingDays = Array.from(daySet).filter(day => {
              const shiftsOnDay = new Set<number>();
              for (const r of requested) {
                if (r.date === day && rule.shifts.includes(r.shift)) {
                  shiftsOnDay.add(r.shift);
                }
              }
              return shiftsOnDay.size >= 2;
            }).sort((a, b) => a - b);
          } else {
            const daySet = new Set<number>();
            for (const r of requested) {
              if (rule.shifts.includes(r.shift)) daySet.add(r.date);
            }
            qualifyingDays = Array.from(daySet).sort((a, b) => a - b);
          }

          if (qualifyingDays.length <= rule.maxDays) continue;
          let runStart = 0;
          for (let i = 1; i <= qualifyingDays.length; i++) {
            if (i === qualifyingDays.length || qualifyingDays[i] !== qualifyingDays[i - 1] + 1) {
              const runLen = i - runStart;
              if (runLen > rule.maxDays) {
                const runDays = qualifyingDays.slice(runStart, i);
                const shiftLabel = rule.shifts.map(si => config.shiftNames[si]).join('+');
                conflicts.push(
                  t.maxConsecutiveConflict
                    .replace("{name}", m.name)
                    .replace("{shifts}", shiftLabel)
                    .replace("{count}", String(runLen))
                    .replace("{days}", runDays.join(', '))
                    .replace("{max}", String(rule.maxDays))
                );
              }
              runStart = i;
            }
          }
        }
      }
    }

    for (let d = 1; d <= totalDays; d++) {
      const isHol = holidayDays.has(d);
      const sps = (config.separateHolidayConfig && config.holidayStaffPerShift && isHol)
        ? config.holidayStaffPerShift : config.staffPerShift;
      for (let s = 0; s < config.shiftNames.length; s++) {
        const capacity = sps[s] || 0;
        if (capacity <= 0) continue;
        const requestedNames: string[] = [];
        for (const m of staff) {
          const hasReq = (m.requested || []).some(r => r.date === d && r.shift === s);
          if (hasReq) requestedNames.push(m.name);
        }
        if (requestedNames.length > capacity) {
          const dt = getDateForIndex(d);
          conflicts.push(
            t.requestedExceedsSlots
              .replace("{day}", String(d))
              .replace("{date}", format(dt, "d/M"))
              .replace("{shift}", config.shiftNames[s])
              .replace("{requested}", String(requestedNames.length))
              .replace("{capacity}", String(capacity))
              .replace("{names}", requestedNames.join(', '))
          );
        }

        if (config.staffLevels && config.staffLevels.length > 0 && config.minStaffPerLevel) {
          const requestedByLevel: Record<number, string[]> = {};
          for (const m of staff) {
            const hasReq = (m.requested || []).some(r => r.date === d && r.shift === s);
            if (hasReq) {
              const lvl = m.level ?? 0;
              if (!requestedByLevel[lvl]) requestedByLevel[lvl] = [];
              requestedByLevel[lvl].push(m.name);
            }
          }
          const totalRequested = Object.values(requestedByLevel).reduce((sum, arr) => sum + arr.length, 0);
          if (totalRequested > 0) {
            const remainingSlots = capacity - totalRequested;
            for (let lvl = 0; lvl < config.staffLevels.length; lvl++) {
              const minReq = config.minStaffPerLevel[s]?.[lvl] || 0;
              if (minReq <= 0) continue;
              const requestedAtThisLevel = (requestedByLevel[lvl] || []).length;
              const stillNeeded = minReq - requestedAtThisLevel;
              if (stillNeeded > 0 && stillNeeded > remainingSlots) {
                const dt = getDateForIndex(d);
                const otherLevels = Object.entries(requestedByLevel)
                  .filter(([l]) => Number(l) !== lvl)
                  .map(([l, names]) => `${config.staffLevels![Number(l)]} ${names.length} คน`)
                  .join(', ');
                conflicts.push(
                  t.requestedBlocksLevel
                    .replace("{day}", String(d))
                    .replace("{date}", format(dt, "d/M"))
                    .replace("{shift}", config.shiftNames[s])
                    .replace("{requestedCount}", String(totalRequested - requestedAtThisLevel))
                    .replace("{requestedLevel}", otherLevels || "other levels")
                    .replace("{remaining}", String(Math.max(0, remainingSlots)))
                    .replace("{neededLevel}", config.staffLevels[lvl])
                    .replace("{minRequired}", String(minReq))
                );
              }
            }
          }
        }
      }
    }

    return { capacityWarnings, conflicts };
  };

  const decideLevelMode = (): { useSoft: boolean; showWarningDialog: boolean; warnings: string[] } => {
    const hasLevels = !!(config.staffLevels && config.staffLevels.length > 0 && config.minStaffPerLevel);
    if (!hasLevels) return { useSoft: false, showWarningDialog: false, warnings: [] };

    const warnings = checkLevelFeasibility();
    if (warnings.length > 0) {
      return { useSoft: true, showWarningDialog: true, warnings };
    }

    const shouldForceSoft = estimateShouldForceSoftLevels();
    if (shouldForceSoft) {
      return { useSoft: true, showWarningDialog: false, warnings: [] };
    }

    return { useSoft: false, showWarningDialog: false, warnings: [] };
  };

  const runOptimizer = () => {
    const { capacityWarnings, conflicts } = checkPreOptimization();
    if (conflicts.length > 0 || capacityWarnings.length > 0) {
      setPreCheckConflicts(conflicts);
      setPreCheckWarnings(capacityWarnings);
      setShowPreCheckWarning(true);
      return;
    }
    const levelDecision = decideLevelMode();
    if (levelDecision.showWarningDialog) {
      setLevelWarnings(levelDecision.warnings);
      setShowLevelWarning(true);
    } else {
      if (levelDecision.useSoft) {
        toast({ title: t.levelFeasibilityWarning, description: t.levelAutoSoftNotice });
      }
      executeOptimizer(levelDecision.useSoft);
    }
  };

  const proceedAfterPreCheck = () => {
    setShowPreCheckWarning(false);
    const levelDecision = decideLevelMode();
    if (levelDecision.showWarningDialog) {
      setLevelWarnings(levelDecision.warnings);
      setShowLevelWarning(true);
    } else {
      if (levelDecision.useSoft) {
        toast({ title: t.levelFeasibilityWarning, description: t.levelAutoSoftNotice });
      }
      executeOptimizer(levelDecision.useSoft);
    }
  };

  const saveSchedule = async (versionIdx?: number) => {
    const vIdx = versionIdx ?? selectedVersion;
    const r = results[vIdx];
    if (!r) return;
    try {
      const saveConfig = {
        ...config,
        useCustomRange,
        customStartDate: useCustomRange ? customStartDate : undefined,
        customEndDate: useCustomRange ? customEndDate : undefined,
      };
      await createMutation.mutateAsync({
        name: scheduleName,
        month,
        year,
        config: saveConfig,
        staff,
        result: r.schedule as any,
        isPartial: r.isPartial || false,
        unfilledSlots: r.unfilledSlots || [],
        isPublished: false
      });
      setShowSaveDialog(false);
      setLocation("/history");
    } catch (error) {
    }
  };

  const doExcelExport = async (versionIdx: number) => {
    const r = results[versionIdx];
    if (!r) return;
    const exConfig = {
      ...config,
      useCustomRange,
      customStartDate: useCustomRange ? customStartDate : undefined,
      customEndDate: useCustomRange ? customEndDate : undefined,
    };
    await exportToExcel(
      scheduleName, month, year, r.schedule, exConfig, staff,
      { date: t.date, day: t.day, staffName: t.staffName, total: t.total, summary: t.summary, schedule: t.scheduleView, staffSchedule: t.staffSchedule, level: t.level },
      lang
    );
    setShowSaveDialog(false);
    setHasExported(true);
  };

  const handleSaveClick = () => {
    if (results.length > 1) {
      setSaveVersion(selectedVersion);
      setShowSaveDialog(true);
    } else if (exportOnly) {
      doExcelExport(0);
    } else {
      saveSchedule(0);
    }
  };

  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [calendarMode, setCalendarMode] = useState<'block' | 'request'>('block');

  useEffect(() => {
    if (step === 2 && walkthrough.active && !selectedStaffId && staff.length > 0) {
      setSelectedStaffId(staff[0].id);
    }
  }, [step, walkthrough.active, selectedStaffId, staff]);
  const selectedStaffMember = staff.find(s => s.id === selectedStaffId) || null;
  const baseDate = useCustomRange && customStartDate
    ? parseISO(customStartDate)
    : new Date(year, month - 1, 1);
  const firstDayOfWeek = baseDate.getDay();

  const getDateForIndex = (dayIndex: number): Date => {
    if (useCustomRange && customStartDate) {
      return addDays(parseISO(customStartDate), dayIndex - 1);
    }
    return setDate(baseDate, dayIndex);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {walkthrough.active && step === 1 && (
        <WalkthroughOverlay
          steps={walkthroughStep1}
          wizardStep={step}
          onComplete={walkthrough.complete}
          onNeverShow={walkthrough.neverShow}
        />
      )}
      {walkthrough.active && step === 2 && (
        <WalkthroughOverlay
          steps={walkthroughStep2}
          wizardStep={step}
          onComplete={walkthrough.complete}
          onNeverShow={walkthrough.neverShow}
        />
      )}
      {walkthrough.active && step === 3 && (
        <WalkthroughOverlay
          steps={walkthroughStep3}
          wizardStep={step}
          onComplete={walkthrough.complete}
          onNeverShow={walkthrough.neverShow}
        />
      )}
      {walkthrough.active && step === 4 && (
        <WalkthroughOverlay
          steps={walkthroughStep4}
          wizardStep={step}
          onComplete={walkthrough.complete}
          onNeverShow={walkthrough.neverShow}
        />
      )}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full"
              data-testid="button-wizard-back"
              onClick={() => {
                if (step > 1) {
                  setStep(s => s - 1);
                } else {
                  setLocation("/");
                }
              }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl font-display text-primary">{t.schedulerWizard}</span>
              <Badge variant="outline" className="ml-2">{t.step} {step}/4</Badge>
              <LanguageToggle />
              {user && <UserMenu />}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {step === 4 && (
              <Button onClick={handleSaveClick} disabled={!exportOnly && createMutation.isPending} className="bg-green-600 hover:bg-green-700" data-testid="button-save-schedule" data-walkthrough="export-btn">
                {!exportOnly && createMutation.isPending
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/>
                  : exportOnly
                    ? <FileSpreadsheet className="w-4 h-4 mr-2" />
                    : <Save className="w-4 h-4 mr-2" />
                }
                {exportOnly ? t.exportExcel : t.saveSchedule}
              </Button>
            )}
          </div>
        </div>
        
        <div className="h-1 bg-slate-100 dark:bg-slate-800 w-full">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-out" 
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </header>

      <main className={cn("mx-auto px-4 py-8", step === 4 ? "max-w-[95vw]" : "max-w-5xl")}>
        
        {/* STEP 1: CONFIGURATION */}
        <WizardStep 
          isActive={step === 1} 
          title={t.basicConfig} 
          description={t.basicConfigDesc}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-md border-0 ring-1 ring-slate-200 dark:ring-slate-800">
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4" data-walkthrough="shifts-per-day">
                  <Label className="text-base font-semibold">{t.shiftsPerDay}</Label>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => setShiftsPerDay(config.shiftsPerDay - 1)}
                      disabled={config.shiftsPerDay <= 1}
                      data-testid="button-shifts-minus"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 text-center">
                      <span className="text-3xl font-bold text-primary" data-testid="text-shifts-count">{config.shiftsPerDay}</span>
                      <p className="text-xs text-muted-foreground mt-1">{config.shiftsPerDay !== 1 ? t.shiftsPerDayPlural : t.shiftPerDay}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => setShiftsPerDay(config.shiftsPerDay + 1)}
                      disabled={config.shiftsPerDay >= 5}
                      data-testid="button-shifts-plus"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4" data-walkthrough="timeline">
                  <Label className="text-base font-semibold">{t.timeline}</Label>
                  <Tabs value={useCustomRange ? "custom" : "month"} onValueChange={handleModeSwitch}>
                    <TabsList className="w-full">
                      <TabsTrigger value="month" className="flex-1" data-testid="tab-full-month">
                        <CalendarIcon className="w-4 h-4 mr-1.5" />
                        {t.fullMonth}
                      </TabsTrigger>
                      <TabsTrigger value="custom" className="flex-1" data-testid="tab-custom-range">
                        <CalendarDays className="w-4 h-4 mr-1.5" />
                        {t.customRange}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="month" className="mt-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t.monthLabel}</Label>
                          <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                            <SelectTrigger data-testid="select-month"><SelectValue /></SelectTrigger>
                            <SelectContent position="popper" sideOffset={4} className="bg-white dark:bg-slate-900">
                              {t.months.map((m, i) => (
                                <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{t.yearLabel}</Label>
                          <Input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} data-testid="input-year" />
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="custom" className="mt-3">
                      <p className="text-sm text-muted-foreground mb-3">{t.customRangeDesc}</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t.startDate}</Label>
                          <Input
                            type="date"
                            value={customStartDate}
                            onChange={e => setCustomStartDate(e.target.value)}
                            data-testid="input-start-date"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t.endDate}</Label>
                          <Input
                            type="date"
                            value={customEndDate}
                            min={customStartDate || undefined}
                            onChange={e => setCustomEndDate(e.target.value)}
                            data-testid="input-end-date"
                          />
                        </div>
                      </div>
                      {useCustomRange && customStartDate && customEndDate && daysInMonth > 0 && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            {format(parseISO(customStartDate), "d MMM yyyy")} — {format(parseISO(customEndDate), "d MMM yyyy")} ({daysInMonth} {t.day})
                          </p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md border-0 ring-1 ring-slate-200 dark:ring-slate-800" data-walkthrough="shift-details">
              <CardContent className="p-6 space-y-6">
                <div className="space-y-1">
                  <Label className="text-base font-semibold">{t.shiftDetails}</Label>
                  {config.separateHolidayConfig && (
                    <p className="text-xs text-muted-foreground">{t.weekdayStaffing}</p>
                  )}
                </div>
                <div className="space-y-4">
                  {config.shiftNames.map((name, i) => (
                    <div key={i} className="flex gap-4 items-end bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                      <div className="flex-1 space-y-2">
                        <Label>{t.nameLabel}</Label>
                        <Input value={name} onChange={e => updateShiftName(i, e.target.value)} data-testid={`input-shift-name-${i}`} />
                      </div>
                      <div className="w-24 space-y-2">
                        <Label>{t.staffReq}</Label>
                        <Input 
                          type="number" 
                          min={1} 
                          value={config.staffPerShift[i]} 
                          onChange={e => updateStaffCount(i, parseInt(e.target.value))} 
                          data-testid={`input-staff-per-shift-${i}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-4" data-walkthrough="holiday-toggle">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="separateHolidayConfig"
                      checked={config.separateHolidayConfig || false}
                      onCheckedChange={(checked) => toggleSeparateHolidayConfig(!!checked)}
                      data-testid="checkbox-separate-holiday-config"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="separateHolidayConfig" className="text-sm font-medium cursor-pointer">
                        {t.separateHolidayConfig}
                      </Label>
                      <p className="text-xs text-muted-foreground">{t.separateHolidayConfigDesc}</p>
                    </div>
                  </div>

                  {config.separateHolidayConfig && (
                    <div className="space-y-3 pl-1 border-l-2 border-purple-300 dark:border-purple-700 ml-1">
                      <Label className="text-sm font-semibold text-purple-700 dark:text-purple-300 pl-3">{t.holidayStaffing}</Label>
                      {config.shiftNames.map((name, i) => {
                        const holCount = config.holidayStaffPerShift?.[i] ?? config.staffPerShift[i];
                        return (
                          <div key={i} className="flex gap-4 items-center bg-purple-50/50 dark:bg-purple-900/10 p-3 rounded-lg ml-3">
                            <div className="flex-1">
                              <span className="text-sm font-medium">{name}</span>
                            </div>
                            <div className="w-24 space-y-1">
                              <Label className="text-xs">{t.staffReqHoliday}</Label>
                              <Input
                                type="number"
                                min={0}
                                value={holCount}
                                onChange={e => updateHolidayStaffCount(i, parseInt(e.target.value) || 0)}
                                data-testid={`input-holiday-staff-per-shift-${i}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-md border-0 ring-1 ring-slate-200 dark:ring-slate-800 mt-6" data-walkthrough="staff-levels">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    <Label className="text-base font-semibold">{t.staffLevels}</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.staffLevelsDesc}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addStaffLevel}
                  disabled={(config.staffLevels?.length || 0) >= 5}
                  data-testid="button-add-level"
                >
                  <Plus className="w-4 h-4 mr-1" /> {t.addLevel}
                </Button>
              </div>

              {config.staffLevels && config.staffLevels.length > 0 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {config.staffLevels.map((levelName, idx) => (
                      <div key={idx} className="flex gap-3 items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg" data-testid={`staff-level-row-${idx}`}>
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">{t.levelName}</Label>
                          <Input
                            value={levelName}
                            onChange={e => updateStaffLevelName(idx, e.target.value)}
                            data-testid={`input-level-name-${idx}`}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive shrink-0"
                          onClick={() => removeStaffLevel(idx)}
                          data-testid={`button-remove-level-${idx}`}
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> {t.removeLevel}
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">{t.minPerLevel}</Label>
                    <p className="text-xs text-muted-foreground">{t.minPerLevelDesc}</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="table-min-per-level">
                        <thead>
                          <tr>
                            <th className="text-left p-2 font-medium text-muted-foreground">{t.nameLabel}</th>
                            {config.staffLevels.map((lvl, li) => (
                              <th key={li} className="text-center p-2 font-medium text-muted-foreground">{lvl}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {config.shiftNames.map((shiftName, si) => (
                            <tr key={si} className="border-t border-slate-100 dark:border-slate-800">
                              <td className="p-2 font-medium">{shiftName}</td>
                              {config.staffLevels!.map((_, li) => (
                                <td key={li} className="p-2 text-center">
                                  <Input
                                    type="number"
                                    min={0}
                                    className="w-16 h-7 text-xs text-center mx-auto"
                                    value={config.minStaffPerLevel?.[si]?.[li] ?? 0}
                                    onChange={e => updateMinStaffPerLevel(si, li, parseInt(e.target.value) || 0)}
                                    data-testid={`input-min-level-${si}-${li}`}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic" data-testid="text-no-levels">{t.noLevelsConfigured}</p>
              )}
            </CardContent>
          </Card>
        </WizardStep>

        {/* STEP 2: STAFF + BLOCKED DATES */}
        <WizardStep 
          isActive={step === 2} 
          title={t.staffAvailability} 
          description={t.staffAvailabilityDesc}
        >
          <Dialog open={showBulkAdd} onOpenChange={setShowBulkAdd}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t.addMultipleTitle}</DialogTitle>
                <DialogDescription>{t.addMultipleDesc}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>{t.numberOfStaff}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={bulkCount}
                    onChange={e => setBulkCount(Math.min(200, Math.max(1, parseInt(e.target.value) || 1)))}
                    data-testid="input-bulk-count"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.namePrefix}</Label>
                  <Input
                    placeholder={t.namePrefixPlaceholder}
                    value={bulkPrefix}
                    onChange={e => setBulkPrefix(e.target.value)}
                    data-testid="input-bulk-prefix"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t.startNumbering}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={bulkStartNum}
                      onChange={e => setBulkStartNum(Math.max(1, parseInt(e.target.value) || 1))}
                      data-testid="input-bulk-start-num"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.defaultMaxShifts}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={bulkMaxShifts}
                      onChange={e => setBulkMaxShifts(Math.max(1, parseInt(e.target.value) || 1))}
                      data-testid="input-bulk-max-shifts"
                    />
                  </div>
                </div>
                {config.staffLevels && config.staffLevels.length > 0 && (
                  <div className="space-y-2">
                    <Label>{t.level}</Label>
                    <Select value={bulkLevel.toString()} onValueChange={(v) => setBulkLevel(parseInt(v))}>
                      <SelectTrigger data-testid="select-bulk-level"><SelectValue /></SelectTrigger>
                      <SelectContent position="popper" sideOffset={4} className="bg-white dark:bg-slate-900">
                        {config.staffLevels.map((lvl, i) => (
                          <SelectItem key={i} value={i.toString()}>{lvl}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 text-sm text-muted-foreground">
                  {bulkPrefix.trim() || (lang === "th" ? "บุคลากร" : "Staff")} {bulkStartNum} — {bulkPrefix.trim() || (lang === "th" ? "บุคลากร" : "Staff")} {bulkStartNum + bulkCount - 1}
                </div>
                <Button onClick={addBulkStaff} className="w-full" data-testid="button-bulk-add-confirm">
                  <Users className="w-4 h-4 mr-2" />
                  {t.addStaffBtn} ({bulkCount})
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card className="shadow-md border-0 ring-1 ring-slate-200 dark:ring-slate-800 lg:col-span-2">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label className="text-base font-semibold">{t.staff} ({staff.length})</Label>
                    <div className="flex items-center gap-1.5 flex-wrap" data-walkthrough="add-staff-buttons">
                      <Button onClick={addStaff} variant="outline" size="sm" className="border-dashed" data-testid="button-add-staff">
                        <Plus className="w-4 h-4 mr-1" /> {t.add}
                      </Button>
                      <Button onClick={() => setShowBulkAdd(true)} variant="outline" size="sm" data-testid="button-add-multiple">
                        <Users className="w-4 h-4 mr-1" /> {t.addMultiple}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => document.getElementById('excel-upload-input')?.click()} data-testid="button-upload-excel">
                        <Upload className="w-4 h-4 mr-1" /> {t.uploadExcel}
                      </Button>
                      <input
                        id="excel-upload-input"
                        type="file"
                        accept=".xlsx"
                        className="hidden"
                        onChange={handleExcelUpload}
                        data-testid="input-upload-excel"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-blue-50/60 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/50">
                    <FileSpreadsheet className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-xs text-muted-foreground flex-1">{t.uploadExcelHint}</span>
                    <Button variant="ghost" size="sm" className="text-xs h-auto p-0 text-blue-600 dark:text-blue-400 shrink-0" onClick={downloadExcelTemplate} data-testid="button-download-template">
                      <Download className="w-3 h-3 mr-1" />{t.downloadTemplate}
                    </Button>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg space-y-2" data-walkthrough="max-shifts-global">
                    <Label className="text-xs text-muted-foreground">{t.setAllMaxShifts}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        className="flex-1 h-7 text-sm text-right"
                        value={globalMaxShifts}
                        onChange={e => setGlobalMaxShifts(Math.max(1, parseInt(e.target.value) || 1))}
                        data-testid="input-global-max-shifts"
                      />
                      <Button variant="outline" size="sm" onClick={applyGlobalMaxShifts} className="shrink-0" data-testid="button-apply-all-max">
                        {t.applyToAll}
                      </Button>
                    </div>
                  </div>

                  {staff.length > 0 && (
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive text-xs"
                        onClick={() => { if (window.confirm(t.removeAllConfirm)) { setStaff([]); setSelectedStaffId(null); } }}
                        data-testid="button-remove-all-staff"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> {t.removeAll}
                      </Button>
                    </div>
                  )}
                  
                  <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1" data-walkthrough="staff-list">
                    {staff.map((s) => {
                      const blockedCount = s.blocked?.length || 0;
                      const requestedCount = s.requested?.length || 0;
                      const isSelected = selectedStaffId === s.id;
                      return (
                        <div 
                          key={s.id} 
                          className={`group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 dark:bg-primary/15 ring-1 ring-primary/30' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                          onClick={() => setSelectedStaffId(isSelected ? null : s.id)}
                          data-testid={`staff-card-${s.id}`}
                        >
                          <div className="min-w-[100px] flex-[2] truncate">
                            <Input 
                              value={s.name} 
                              onChange={e => { e.stopPropagation(); updateStaff(s.id, "name", e.target.value); }}
                              onClick={e => { e.stopPropagation(); setSelectedStaffId(s.id); }}
                              className="font-medium h-6 text-sm border-transparent hover:border-input focus:border-input px-1"
                              data-testid={`input-staff-name-${s.id}`}
                            />
                          </div>
                          {config.staffLevels && config.staffLevels.length > 0 && (
                            <Select
                              value={(s.level ?? 0).toString()}
                              onValueChange={(v) => { updateStaff(s.id, "level", parseInt(v)); }}
                            >
                              <SelectTrigger
                                className="w-20 h-6 text-[10px] shrink-0"
                                onClick={e => e.stopPropagation()}
                                data-testid={`select-staff-level-${s.id}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent position="popper" sideOffset={4} className="bg-white dark:bg-slate-900">
                                {config.staffLevels.map((lvl, li) => (
                                  <SelectItem key={li} value={li.toString()}>{lvl}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {blockedCount > 0 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">{blockedCount}</Badge>
                          )}
                          {requestedCount > 0 && (
                            <Badge className="text-[10px] px-1.5 py-0 shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-100">{requestedCount}</Badge>
                          )}
                          <Input 
                            type="number"
                            min={1}
                            className="w-16 h-6 text-xs text-center shrink-0"
                            value={s.maxShifts}
                            onClick={e => e.stopPropagation()}
                            onChange={e => { e.stopPropagation(); updateStaff(s.id, "maxShifts", parseInt(e.target.value) || 1); }}
                            data-testid={`input-max-shifts-${s.id}`}
                          />
                          <button
                            className="invisible group-hover:visible h-5 w-5 inline-flex items-center justify-center text-muted-foreground rounded-sm shrink-0"
                            onClick={(e) => { e.stopPropagation(); removeStaff(s.id); }}
                            data-testid={`button-remove-staff-${s.id}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md border-0 ring-1 ring-slate-200 dark:ring-slate-800 lg:col-span-3" data-walkthrough="calendar-panel">
              <CardContent className="p-6">
                {selectedStaffMember ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="font-semibold text-lg">{selectedStaffMember.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {calendarMode === 'block' ? t.clickDatesToBlock : t.requestedShiftsDesc}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {selectedStaffMember.blocked?.length || 0} {t.blocked}
                        </Badge>
                        <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-100">
                          {selectedStaffMember.requested?.length || 0} {t.requested}
                        </Badge>
                        {((selectedStaffMember.blocked?.length || 0) > 0 || (selectedStaffMember.requested?.length || 0) > 0) && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setStaff(staff.map(s => s.id === selectedStaffId ? { ...s, blocked: [], requested: [] } : s));
                            }}
                            data-testid="button-clear-blocks"
                          >
                            {t.clearAll}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2" data-walkthrough="block-request-mode">
                      <Button
                        variant={calendarMode === 'block' ? 'default' : 'outline'}
                        size="sm"
                        className={calendarMode === 'block' ? 'bg-red-500 hover:bg-red-600' : ''}
                        onClick={() => setCalendarMode('block')}
                        data-testid="button-mode-block"
                      >
                        {t.modeBlock}
                      </Button>
                      <Button
                        variant={calendarMode === 'request' ? 'default' : 'outline'}
                        size="sm"
                        className={calendarMode === 'request' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                        onClick={() => setCalendarMode('request')}
                        data-testid="button-mode-request"
                      >
                        {t.modeRequest}
                      </Button>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {dayNames.map(d => (
                          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                          <div key={`empty-${i}`} />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const date = i + 1;
                          const blocked = isFullDayBlocked(selectedStaffId!, date);
                          const partiallyBlocked = !blocked && selectedStaffMember.blocked?.some(b => b.date === date);
                          const hasRequested = hasAnyRequested(selectedStaffId!, date);
                          const currentDate = getDateForIndex(date);
                          const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
                          
                          return (
                            <button
                              key={date}
                              onClick={() => {
                                if (calendarMode === 'block') {
                                  toggleFullDayBlock(selectedStaffId!, date);
                                } else {
                                  const member = staff.find(s => s.id === selectedStaffId);
                                  if (!member) return;
                                  const requested = member.requested || [];
                                  const hasAny = requested.some(r => r.date === date);
                                  let newRequested;
                                  if (hasAny) {
                                    newRequested = requested.filter(r => r.date !== date);
                                  } else {
                                    const isBlocked = member.blocked.some(b => b.date === date && (b.shift === -1 || b.shift === 0));
                                    if (!isBlocked) {
                                      newRequested = [...requested, { date, shift: 0 }];
                                    } else {
                                      newRequested = requested;
                                    }
                                  }
                                  updateStaff(selectedStaffId!, "requested", newRequested);
                                }
                              }}
                              className={`
                                relative p-2 rounded-md text-sm font-medium transition-all text-center
                                ${blocked 
                                  ? 'bg-red-500 text-white hover:bg-red-600' 
                                  : partiallyBlocked
                                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50 ring-1 ring-orange-300 dark:ring-orange-700'
                                    : hasRequested
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 ring-1 ring-emerald-300 dark:ring-emerald-700'
                                      : isWeekend 
                                        ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700' 
                                        : 'bg-white dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }
                              `}
                              data-testid={`calendar-day-${date}`}
                            >
                              {useCustomRange ? format(currentDate, "d") : date}
                              {useCustomRange && date === 1 && (
                                <span className="block text-[9px] text-muted-foreground leading-none mt-0.5">{format(currentDate, "MMM")}</span>
                              )}
                              {useCustomRange && currentDate.getDate() === 1 && date !== 1 && (
                                <span className="block text-[9px] text-muted-foreground leading-none mt-0.5">{format(currentDate, "MMM")}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">{t.blockSpecificShifts}</Label>
                      <p className="text-xs text-muted-foreground">{t.blockSpecificShiftsDesc}</p>
                      <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1">
                        {selectedStaffMember.blocked?.filter(b => b.shift === -1).map((b) => {
                          const currentDate = getDateForIndex(b.date);
                          return (
                            <div key={`full-${b.date}`} className="flex items-center justify-between gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{format(currentDate, "MMM d")} ({format(currentDate, "EEE")})</span>
                                <Badge variant="destructive" className="text-[10px]">{t.allDay}</Badge>
                              </div>
                              <div className="flex items-center gap-1">
                                {config.shiftNames.map((shiftName, sIdx) => (
                                  <Badge 
                                    key={sIdx}
                                    variant="outline"
                                    className="text-[10px] cursor-pointer opacity-50 line-through"
                                    onClick={() => {
                                      const newBlocked = selectedStaffMember.blocked.filter(bl => !(bl.date === b.date && bl.shift === -1));
                                      config.shiftNames.forEach((_, si) => {
                                        if (si !== sIdx) newBlocked.push({ date: b.date, shift: si });
                                      });
                                      updateStaff(selectedStaffId!, "blocked", newBlocked);
                                    }}
                                    data-testid={`badge-shift-${b.date}-${sIdx}`}
                                  >
                                    {shiftName}
                                  </Badge>
                                ))}
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-5 w-5 text-muted-foreground hover:text-destructive ml-1"
                                  onClick={() => toggleFullDayBlock(selectedStaffId!, b.date)}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}

                        {selectedStaffMember.blocked?.filter(b => b.shift !== -1)
                          .reduce<{ date: number; shifts: number[] }[]>((acc, b) => {
                            const existing = acc.find(a => a.date === b.date);
                            if (existing) { existing.shifts.push(b.shift); }
                            else { acc.push({ date: b.date, shifts: [b.shift] }); }
                            return acc;
                          }, [])
                          .sort((a, b) => a.date - b.date)
                          .map((group) => {
                            const currentDate = getDateForIndex(group.date);
                            return (
                              <div key={`partial-${group.date}`} className="flex items-center justify-between gap-2 p-2 bg-orange-50 dark:bg-orange-900/10 rounded-md border border-orange-200 dark:border-orange-800">
                                <span className="text-sm font-medium">{format(currentDate, "MMM d")} ({format(currentDate, "EEE")})</span>
                                <div className="flex items-center gap-1">
                                  {config.shiftNames.map((shiftName, sIdx) => {
                                    const isBlocked = group.shifts.includes(sIdx);
                                    return (
                                      <Badge 
                                        key={sIdx}
                                        variant={isBlocked ? "destructive" : "outline"}
                                        className="text-[10px] cursor-pointer"
                                        onClick={() => toggleBlockedDate(selectedStaffId!, group.date, sIdx)}
                                        data-testid={`badge-shift-${group.date}-${sIdx}`}
                                      >
                                        {shiftName}
                                      </Badge>
                                    );
                                  })}
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-5 w-5 text-muted-foreground hover:text-destructive ml-1"
                                    onClick={() => {
                                      const newBlocked = selectedStaffMember.blocked.filter(b => b.date !== group.date);
                                      updateStaff(selectedStaffId!, "blocked", newBlocked);
                                    }}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        }

                        {(!selectedStaffMember.blocked || selectedStaffMember.blocked.length === 0) && (
                          <p className="text-sm text-center text-muted-foreground py-4 italic">{t.noBlockedDates}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{t.requestedShifts}</Label>
                      <p className="text-xs text-muted-foreground">{t.requestedShiftsDesc}</p>
                      <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1">
                        {(selectedStaffMember.requested || [])
                          .reduce<{ date: number; shifts: number[] }[]>((acc, r) => {
                            const existing = acc.find(a => a.date === r.date);
                            if (existing) { existing.shifts.push(r.shift); }
                            else { acc.push({ date: r.date, shifts: [r.shift] }); }
                            return acc;
                          }, [])
                          .sort((a, b) => a.date - b.date)
                          .map((group) => {
                            const currentDate = getDateForIndex(group.date);
                            return (
                              <div key={`req-${group.date}`} className="flex items-center justify-between gap-2 p-2 bg-emerald-50 dark:bg-emerald-900/10 rounded-md border border-emerald-200 dark:border-emerald-800">
                                <span className="text-sm font-medium">{format(currentDate, "MMM d")} ({format(currentDate, "EEE")})</span>
                                <div className="flex items-center gap-1">
                                  {config.shiftNames.map((shiftName, sIdx) => {
                                    const isReq = group.shifts.includes(sIdx);
                                    return (
                                      <Badge 
                                        key={sIdx}
                                        variant="outline"
                                        className={`text-[10px] cursor-pointer ${isReq ? 'bg-emerald-500 text-white border-emerald-500' : ''}`}
                                        onClick={() => toggleRequestedDate(selectedStaffId!, group.date, sIdx)}
                                        data-testid={`badge-req-${group.date}-${sIdx}`}
                                      >
                                        {shiftName}
                                      </Badge>
                                    );
                                  })}
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-5 w-5 text-muted-foreground hover:text-destructive ml-1"
                                    onClick={() => {
                                      const newRequested = (selectedStaffMember.requested || []).filter(r => r.date !== group.date);
                                      updateStaff(selectedStaffId!, "requested", newRequested);
                                    }}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        }

                        {(!selectedStaffMember.requested || selectedStaffMember.requested.length === 0) && (
                          <p className="text-sm text-center text-muted-foreground py-2 italic">{t.noRequestedDates}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[400px] text-center">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                      <CalendarIcon className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{t.selectStaffMember}</h3>
                    <p className="text-muted-foreground max-w-sm">
                      {t.selectStaffMemberDesc}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </WizardStep>

        {/* STEP 3: CONSTRAINTS */}
        <WizardStep 
          isActive={step === 3} 
          title={t.rulesConstraints} 
          description={t.rulesConstraintsDesc}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <Card className="shadow-md" data-walkthrough="consecutive-rules">
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                      <Settings2 className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h3 className="font-semibold text-lg">{t.consecutiveShiftRules}</h3>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-4">
                    {t.consecutiveDesc}
                  </p>

                  <div className="space-y-2">
                    {config.consecutiveRules.map((rule, idx) => {
                      const ruleType = rule.type || 'nextDay';
                      return (
                      <div key={idx} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border flex-wrap">
                        <span className="text-red-500 font-bold">{t.no}</span>
                        <Badge variant="outline">{config.shiftNames[rule.from]}</Badge>
                        <span className="text-muted-foreground text-sm">
                          {ruleType === 'sameDay' ? t.sameDayWith : t.followedBy}
                        </span>
                        <Badge variant="outline">{config.shiftNames[rule.to]}</Badge>
                        <Badge variant="secondary" className="text-xs">
                          {ruleType === 'sameDay' ? t.ruleTypeSameDay : t.ruleTypeNextDay}
                        </Badge>
                        <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0" onClick={() => {
                           const newRules = config.consecutiveRules.filter((_, i) => i !== idx);
                           setConfig({...config, consecutiveRules: newRules});
                        }} data-testid={`button-remove-rule-${idx}`}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      );
                    })}
                    
                    <div className="flex items-center gap-2 pt-2">
                       <Select key={`nextDay-${config.consecutiveRules.length}`} onValueChange={(val) => {
                         const [from, to] = val.split(',').map(Number);
                         setConfig({
                           ...config,
                           consecutiveRules: [...config.consecutiveRules, { from, to, type: 'nextDay' as const }]
                         });
                       }}>
                         <SelectTrigger className="w-full" data-testid="select-add-nextday-rule">
                           <SelectValue placeholder={t.addNextDayRule} />
                         </SelectTrigger>
                         <SelectContent position="popper" sideOffset={4} className="bg-white dark:bg-slate-900">
                           {config.shiftNames.flatMap((name1, i) =>
                             config.shiftNames.map((name2, j) => {
                               const exists = config.consecutiveRules.some(r => r.from === i && r.to === j && (r.type || 'nextDay') === 'nextDay');
                               if (exists) return null;
                               return (
                                 <SelectItem key={`${i}-${j}`} value={`${i},${j}`}>
                                   {t.no} {name1} {t.followedBy} {name2}
                                 </SelectItem>
                               );
                             })
                           ).filter(Boolean)}
                         </SelectContent>
                       </Select>
                    </div>
                    <div className="flex items-center gap-2">
                       <Select key={`sameDay-${config.consecutiveRules.length}`} onValueChange={(val) => {
                         const [from, to] = val.split(',').map(Number);
                         const blockedPair = [from, to].sort().join(',');
                         const filteredMaxRules = (config.maxConsecutiveRules || []).filter(r => {
                           if (r.shifts.length <= 1) return true;
                           for (let a = 0; a < r.shifts.length; a++) {
                             for (let b = a + 1; b < r.shifts.length; b++) {
                               if ([r.shifts[a], r.shifts[b]].sort().join(',') === blockedPair) return false;
                             }
                           }
                           return true;
                         });
                         setConfig({
                           ...config,
                           consecutiveRules: [...config.consecutiveRules, { from, to, type: 'sameDay' as const }],
                           maxConsecutiveRules: filteredMaxRules.length > 0 ? filteredMaxRules : undefined
                         });
                       }}>
                         <SelectTrigger className="w-full" data-testid="select-add-sameday-rule">
                           <SelectValue placeholder={t.addSameDayRule} />
                         </SelectTrigger>
                         <SelectContent position="popper" sideOffset={4} className="bg-white dark:bg-slate-900">
                           {config.shiftNames.flatMap((name1, i) =>
                             config.shiftNames.map((name2, j) => {
                               if (i === j) return null;
                               const exists = config.consecutiveRules.some(r =>
                                 r.type === 'sameDay' && ((r.from === i && r.to === j) || (r.from === j && r.to === i))
                               );
                               if (exists) return null;
                               return (
                                 <SelectItem key={`${i}-${j}`} value={`${i},${j}`}>
                                   {t.no} {name1} {t.sameDayWith} {name2}
                                 </SelectItem>
                               );
                             })
                           ).filter(Boolean)}
                         </SelectContent>
                       </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-md" data-walkthrough="max-consecutive-rules">
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                      <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <circle cx="4" cy="12" r="2.5" fill="currentColor" stroke="none" />
                        <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
                        <circle cx="20" cy="12" r="2.5" fill="currentColor" stroke="none" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-lg">{t.maxConsecutiveRules}</h3>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-4">
                    {t.maxConsecutiveDesc}
                  </p>

                  <div className="space-y-2">
                    {(config.maxConsecutiveRules || []).map((rule, idx) => {
                      const isCombined = rule.shifts.length > 1;
                      return (
                      <div key={idx} className="flex items-center gap-1.5 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border flex-nowrap overflow-x-auto">
                        <div className="flex items-center gap-1 flex-nowrap shrink-0">
                          {rule.shifts.map((si, j) => (
                            <span key={j} className="flex items-center gap-1 shrink-0">
                              {j > 0 && <span className="text-muted-foreground text-xs">{isCombined ? lang === "th" ? "และ" : "&" : "+"}</span>}
                              <Badge variant="outline" className="whitespace-nowrap text-xs">{config.shiftNames[si]}</Badge>
                            </span>
                          ))}
                          {isCombined && <span className="text-xs text-muted-foreground shrink-0">{t.maxConsecutiveSameDay}</span>}
                        </div>
                        <span className="text-muted-foreground text-xs shrink-0">≤</span>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          value={rule.maxDays}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(31, parseInt(e.target.value) || 1));
                            const newRules = [...(config.maxConsecutiveRules || [])];
                            newRules[idx] = { ...rule, maxDays: val };
                            setConfig({ ...config, maxConsecutiveRules: newRules });
                          }}
                          className="w-14 text-center shrink-0"
                          data-testid={`input-max-consecutive-${idx}`}
                        />
                        <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">{t.maxConsecutiveDays}</span>
                        <Button variant="ghost" size="icon" className="ml-auto shrink-0" onClick={() => {
                          const newRules = (config.maxConsecutiveRules || []).filter((_, i) => i !== idx);
                          setConfig({ ...config, maxConsecutiveRules: newRules });
                        }} data-testid={`button-remove-max-consecutive-${idx}`}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      );
                    })}

                    <div className="pt-2">
                      <Select
                        key={`maxConsec-${(config.maxConsecutiveRules || []).length}`}
                        onValueChange={(val) => {
                          const shiftIndices = val.split(',').map(Number);
                          const newRule = { shifts: shiftIndices, maxDays: 3 };
                          setConfig({
                            ...config,
                            maxConsecutiveRules: [...(config.maxConsecutiveRules || []), newRule]
                          });
                        }}
                      >
                        <SelectTrigger className="w-full" data-testid="select-add-max-consecutive">
                          <SelectValue placeholder={t.addMaxConsecutiveRule} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="bg-white dark:bg-slate-900">
                          {(() => {
                            const existingKeys = new Set((config.maxConsecutiveRules || []).map(r => [...r.shifts].sort().join(',')));
                            const sameDayBlocked = new Set<string>();
                            (config.consecutiveRules || []).forEach(r => {
                              if (r.type === 'sameDay') {
                                const pair = [r.from, r.to].sort().join(',');
                                sameDayBlocked.add(pair);
                              }
                            });
                            const isCombinedBlockedBySameDay = (indices: number[]) => {
                              for (let a = 0; a < indices.length; a++) {
                                for (let b = a + 1; b < indices.length; b++) {
                                  const pair = [indices[a], indices[b]].sort().join(',');
                                  if (sameDayBlocked.has(pair)) return true;
                                }
                              }
                              return false;
                            };
                            const options: { label: string; value: string }[] = [];
                            for (let i = 0; i < config.shiftNames.length; i++) {
                              const key = String(i);
                              if (!existingKeys.has(key)) {
                                options.push({ label: config.shiftNames[i], value: key });
                              }
                            }
                            for (let i = 0; i < config.shiftNames.length; i++) {
                              for (let j = i + 1; j < config.shiftNames.length; j++) {
                                const key = `${i},${j}`;
                                if (!existingKeys.has(key) && !isCombinedBlockedBySameDay([i, j])) {
                                  const connector = lang === "th" ? " และ " : " & ";
                                  options.push({ label: `${config.shiftNames[i]}${connector}${config.shiftNames[j]}`, value: key });
                                }
                              }
                            }
                            if (config.shiftNames.length >= 3) {
                              const allIndices = config.shiftNames.map((_, i) => i);
                              const allKey = allIndices.join(',');
                              if (!existingKeys.has(allKey) && !isCombinedBlockedBySameDay(allIndices)) {
                                const connector = lang === "th" ? " และ " : " & ";
                                options.push({ label: config.shiftNames.join(connector), value: allKey });
                              }
                            }
                            return options.map(opt => (
                              <SelectItem key={opt.value} value={opt.value} data-testid={`select-item-max-consecutive-${opt.value}`}>
                                {opt.label}
                              </SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-md" data-walkthrough="holiday-balancing">
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                      <CalendarDays className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="font-semibold text-lg">{t.holidayWeekendBalancing}</h3>
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox 
                      id="balance-holidays"
                      checked={config.balanceHolidays || false}
                      onCheckedChange={(checked) => setConfig({...config, balanceHolidays: checked === true})}
                      data-testid="checkbox-balance-holidays"
                    />
                    <div>
                      <label htmlFor="balance-holidays" className="text-sm font-medium cursor-pointer leading-none">
                        {t.balanceWeekendHoliday}
                      </label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t.balanceDesc}
                      </p>
                    </div>
                  </div>

                  {config.balanceHolidays && (
                    <div className="space-y-3 pt-2">
                      <Separator />
                      <Label className="text-sm font-semibold">{t.customHolidays}</Label>
                      <p className="text-xs text-muted-foreground">
                        {t.clickHolidays}
                      </p>
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                        <div className="grid grid-cols-7 gap-1 mb-2">
                          {dayNames.map(d => (
                            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                            <div key={`empty-hol-${i}`} />
                          ))}
                          {Array.from({ length: daysInMonth }).map((_, i) => {
                            const date = i + 1;
                            const currentDate = getDateForIndex(date);
                            const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
                            const isHoliday = (config.holidays || []).includes(date);
                            
                            return (
                              <button
                                key={date}
                                onClick={() => {
                                  if (isWeekend) return;
                                  const currentHolidays = config.holidays || [];
                                  const newHolidays = isHoliday 
                                    ? currentHolidays.filter(d => d !== date)
                                    : [...currentHolidays, date];
                                  setConfig({...config, holidays: newHolidays});
                                }}
                                className={`
                                  relative p-2 rounded-md text-sm font-medium transition-all text-center
                                  ${isWeekend
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 cursor-default ring-1 ring-purple-200 dark:ring-purple-800'
                                    : isHoliday
                                      ? 'bg-purple-500 text-white hover:bg-purple-600 ring-1 ring-purple-400'
                                      : 'bg-white dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700'
                                  }
                                `}
                                disabled={isWeekend}
                                data-testid={`holiday-day-${date}`}
                              >
                                {useCustomRange ? format(currentDate, "d") : date}
                                {useCustomRange && currentDate.getDate() === 1 && (
                                  <span className="block text-[9px] text-muted-foreground leading-none mt-0.5">{format(currentDate, "MMM")}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {(config.holidays || []).length > 0 && (
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">{t.customHolidaysLabel}</span>
                            {(config.holidays || []).sort((a, b) => a - b).map(d => (
                              <Badge key={d} variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                {format(getDateForIndex(d), "MMM d")}
                                <button
                                  className="ml-1 hover:text-destructive"
                                  onClick={() => setConfig({...config, holidays: (config.holidays || []).filter(h => h !== d)})}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfig({...config, holidays: []})}
                            data-testid="button-clear-holidays"
                          >
                            {t.clearAll}
                          </Button>
                        </div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                          {t.satSunAuto}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-purple-500 text-white border-purple-400">
                          {t.customHolidayLabel}
                        </Badge>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-center p-8" data-walkthrough="optimize-button">
              {isOptimizing ? (
                <div className="text-center space-y-6 max-w-sm mx-auto">
                  <div className="relative inline-flex items-center justify-center">
                    <div className="w-24 h-24 rounded-2xl p-2.5" style={{ background: "linear-gradient(135deg, #5FA8D3, #3B82C4)" }}>
                      <div className="relative w-full h-full grid grid-cols-3 gap-[6px]">
                        {[...Array(9)].map((_, i) => (
                          <div key={i} className="logo-grid-cell rounded-[3px] bg-white/40" />
                        ))}
                        <div className="logo-grid-highlight absolute top-0 left-0 w-[calc((100%-12px)/3)] h-[calc((100%-12px)/3)] rounded-[3px]" style={{ backgroundColor: "#FACC15" }} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold">{t.generatingVersions}</h3>
                    <p className="text-sm text-muted-foreground">
                      {lang === "th" ? "กรุณารอสักครู่..." : "Please wait..."}
                    </p>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${(optimizeProgress / optimizeTotal) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-5 max-w-sm mx-auto">
                  <div className="relative inline-flex items-center justify-center">
                    <div className="absolute w-24 h-24 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10" />
                    <div className="absolute w-20 h-20 rounded-full bg-gradient-to-br from-primary/15 to-primary/8 dark:from-primary/25 dark:to-primary/15" />
                    <div className="relative w-16 h-16 rounded-full bg-primary/20 dark:bg-primary/30 flex items-center justify-center">
                      <Activity className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">{t.readyToOptimize}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {t.optimizeDesc}
                    </p>
                  </div>
                  <Button size="lg" onClick={runOptimizer} className="w-full rounded-full shadow-lg shadow-primary/20" data-testid="button-generate">
                    <PlayCircle className="mr-2 h-5 w-5" /> {t.generateSchedule}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </WizardStep>

        {/* STEP 4: RESULTS */}
        {step === 4 && result && (
          <WizardStep 
            isActive={true} 
            title={t.generatedSchedule}
            className="!max-w-none w-full"
          >
            {isOptimizing && (
              <div className="flex items-center justify-center p-8">
                <div className="text-center space-y-6 max-w-sm mx-auto">
                  <div className="relative inline-flex items-center justify-center">
                    <div className="w-24 h-24 rounded-2xl p-2.5" style={{ background: "linear-gradient(135deg, #5FA8D3, #3B82C4)" }}>
                      <div className="relative w-full h-full grid grid-cols-3 gap-[6px]">
                        {[...Array(9)].map((_, i) => (
                          <div key={i} className="logo-grid-cell rounded-[3px] bg-white/40" />
                        ))}
                        <div className="logo-grid-highlight absolute top-0 left-0 w-[calc((100%-12px)/3)] h-[calc((100%-12px)/3)] rounded-[3px]" style={{ backgroundColor: "#FACC15" }} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold">{t.generatingVersions}</h3>
                    <p className="text-sm text-muted-foreground">
                      {lang === "th" ? "กรุณารอสักครู่..." : "Please wait..."}
                    </p>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${(optimizeProgress / optimizeTotal) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div className={`space-y-8 ${isOptimizing ? "hidden" : ""}`}>
              <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <Label>{t.scheduleName}</Label>
                  <Input 
                    value={scheduleName} 
                    onChange={e => setScheduleName(e.target.value)} 
                    className="text-lg font-bold border-none shadow-none focus-visible:ring-0 px-0"
                    data-testid="input-schedule-name"
                  />
                </div>
                <Button variant="outline" onClick={() => setStep(3)} data-testid="button-adjust-rules">
                  <Settings2 className="w-4 h-4 mr-2" /> {t.adjustRules}
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" onClick={runOptimizer} disabled={isOptimizing} data-testid="button-regenerate" data-walkthrough="regenerate-btn">
                        {isOptimizing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <History className="w-4 h-4 mr-2" />}
                        {t.regenerate}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-white dark:bg-gray-800 border shadow-lg">
                      <p>{t.regenerateTooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {results.length > 1 && (
                <div className="space-y-2" data-walkthrough="version-selector">
                  <p className="text-sm text-muted-foreground">{t.selectVersion}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {results.map((r, idx) => {
                      const totalAssigned = r.metrics.perStaff.reduce((sum, s) => sum + s.total, 0);
                      const unfilledCount = r.unfilledSlots?.reduce((sum, u) => sum + (u.required - u.assigned), 0) || 0;
                      const totalRequired = totalAssigned + unfilledCount;
                      const isSelected = idx === selectedVersion;
                      const maxShift = Math.max(...r.metrics.perStaff.map(s => s.total));
                      const minShift = Math.min(...r.metrics.perStaff.map(s => s.total));
                      return (
                        <Card
                          key={idx}
                          className={`cursor-pointer transition-all ${
                            isSelected 
                              ? "border-primary border-2 bg-primary/5 dark:bg-primary/10" 
                              : "hover-elevate"
                          }`}
                          onClick={() => setSelectedVersion(idx)}
                          data-testid={`button-version-${idx}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-lg">{t.version} {idx + 1}</span>
                              {isSelected && <Check className="w-5 h-5 text-primary" />}
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t.coverage}</span>
                                <span className="font-medium">{totalAssigned}/{totalRequired}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Min-Max</span>
                                <span className="font-medium">{minShift} - {maxShift}</span>
                              </div>
                              {r.unfilledSlots && r.unfilledSlots.length > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Unfilled</span>
                                  <span className="font-medium text-amber-600 dark:text-amber-400">{unfilledCount}</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              <Tabs defaultValue="calendar">
                <TabsList className="mb-4" data-walkthrough="view-tabs">
                  <TabsTrigger value="calendar" data-testid="tab-calendar"><CalendarIcon className="w-4 h-4 mr-2" />{t.calendarView}</TabsTrigger>
                  <TabsTrigger value="summary" data-testid="tab-summary"><Check className="w-4 h-4 mr-2" />{t.summary}</TabsTrigger>
                  <TabsTrigger value="stats" data-testid="tab-stats"><Activity className="w-4 h-4 mr-2" />{t.statistics}</TabsTrigger>
                </TabsList>
                
                <TabsContent value="calendar" className="mt-0">
                  <ScheduleEditor
                    schedule={result.schedule}
                    config={{
                      ...config,
                      useCustomRange,
                      customStartDate: useCustomRange ? customStartDate : undefined,
                      customEndDate: useCustomRange ? customEndDate : undefined,
                    }}
                    staff={staff}
                    month={month}
                    year={year}
                    onScheduleChange={handleScheduleEdit}
                  />
                </TabsContent>

                <TabsContent value="summary" className="mt-0">
                  <Card className="shadow-md">
                    <CardContent className="p-6 space-y-6">
                      <div className="overflow-x-auto">
                        <h3 className="font-semibold text-base mb-3">{t.overallSummary}</h3>
                        <table className="w-full text-sm border-collapse" data-testid="table-summary-overall">
                          <thead>
                            <tr className="border-b bg-slate-50 dark:bg-slate-900">
                              <th className="p-3 text-left font-semibold">{t.staffName}</th>
                              {config.shiftNames.map((name, i) => (
                                <th key={i} className="p-3 text-center font-semibold">{name}</th>
                              ))}
                              <th className="p-3 text-center font-semibold text-primary">{t.total}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.metrics.perStaff.map((s, i) => (
                              <tr key={i} className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                                <td className="p-3 font-medium">{s.name}</td>
                                {s.byShift.map((count, j) => (
                                  <td key={j} className="p-3 text-center">{count}</td>
                                ))}
                                <td className="p-3 text-center font-bold text-primary">{s.total}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {config.balanceHolidays && result.metrics.perStaff[0]?.holidayByShift && (
                        <>
                          <Separator />
                          <div className="overflow-x-auto">
                            <h3 className="font-semibold text-base mb-1">
                              <Badge variant="secondary" className="mr-2 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">{t.holidayWeekend}</Badge>
                              {t.shiftBreakdown}
                            </h3>
                            <p className="text-xs text-muted-foreground mb-3">{t.includesSatSun}</p>
                            <table className="w-full text-sm border-collapse" data-testid="table-summary-holiday">
                              <thead>
                                <tr className="border-b bg-purple-50 dark:bg-purple-900/10">
                                  <th className="p-3 text-left font-semibold">{t.staffName}</th>
                                  {config.shiftNames.map((name, i) => (
                                    <th key={i} className="p-3 text-center font-semibold">{name}</th>
                                  ))}
                                  <th className="p-3 text-center font-semibold text-purple-600 dark:text-purple-400">{t.total}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {result.metrics.perStaff.map((s, i) => (
                                  <tr key={i} className="border-b hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors">
                                    <td className="p-3 font-medium">{s.name}</td>
                                    {(s.holidayByShift || []).map((count, j) => (
                                      <td key={j} className="p-3 text-center">{count}</td>
                                    ))}
                                    <td className="p-3 text-center font-bold text-purple-600 dark:text-purple-400">{s.holidayTotal || 0}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <Separator />
                          <div className="overflow-x-auto">
                            <h3 className="font-semibold text-base mb-1">
                              <Badge variant="secondary" className="mr-2">{t.weekday}</Badge>
                              {t.shiftBreakdown}
                            </h3>
                            <p className="text-xs text-muted-foreground mb-3">{t.excludesHolidays}</p>
                            <table className="w-full text-sm border-collapse" data-testid="table-summary-weekday">
                              <thead>
                                <tr className="border-b bg-slate-50 dark:bg-slate-900">
                                  <th className="p-3 text-left font-semibold">{t.staffName}</th>
                                  {config.shiftNames.map((name, i) => (
                                    <th key={i} className="p-3 text-center font-semibold">{name}</th>
                                  ))}
                                  <th className="p-3 text-center font-semibold text-primary">{t.total}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {result.metrics.perStaff.map((s, i) => (
                                  <tr key={i} className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                                    <td className="p-3 font-medium">{s.name}</td>
                                    {(s.weekdayByShift || []).map((count, j) => (
                                      <td key={j} className="p-3 text-center">{count}</td>
                                    ))}
                                    <td className="p-3 text-center font-bold text-primary">{s.weekdayTotal || 0}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="stats" className="mt-0">
                  <StatsCard result={result} config={config} staff={staff} />
                </TabsContent>
              </Tabs>
            </div>
          </WizardStep>
        )}

        {step === 4 && <FeedbackWidget autoOpen={hasExported} />}

        {/* Navigation Footer */}
        {step < 4 && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-zinc-950 border-t z-40">
            <div className="max-w-5xl mx-auto flex justify-between items-center gap-2">
              <Button 
                variant="ghost" 
                onClick={() => setStep(s => Math.max(s - 1, 1))} 
                disabled={step === 1}
                className="text-muted-foreground"
                data-testid="button-back-footer"
              >
                Back
              </Button>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleSavePresetClick}
                  className="rounded-full"
                  data-testid="button-save-preset"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {lang === "th" ? "บันทึก" : "Save"}
                </Button>
                {step < 3 ? (
                  <Button
                    onClick={handleNext}
                    disabled={step === 1 && useCustomRange && (!customStartDate || !customEndDate || daysInMonth <= 0)}
                    className="px-8 rounded-full shadow-lg shadow-primary/25"
                    data-testid="button-next-step"
                  >
                    {t.nextStep} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <div className="opacity-0 pointer-events-none">
                    <Button variant="outline">Placeholder</Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{exportOnly ? t.exportVersionTitle : t.saveVersionTitle}</DialogTitle>
            <DialogDescription>{exportOnly ? t.exportVersionDesc : t.saveVersionDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {results.map((r, idx) => {
              const totalAssigned = r.metrics.perStaff.reduce((sum, s) => sum + s.total, 0);
              const unfilledCount = r.unfilledSlots?.reduce((sum, u) => sum + (u.required - u.assigned), 0) || 0;
              const totalRequired = totalAssigned + unfilledCount;
              const isSaveSelected = idx === saveVersion;
              const maxShift = Math.max(...r.metrics.perStaff.map(s => s.total));
              const minShift = Math.min(...r.metrics.perStaff.map(s => s.total));
              return (
                <Card
                  key={idx}
                  className={`cursor-pointer transition-all ${
                    isSaveSelected
                      ? "border-primary border-2 bg-primary/5 dark:bg-primary/10"
                      : "hover-elevate"
                  }`}
                  onClick={() => setSaveVersion(idx)}
                  data-testid={`save-version-${idx}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-lg">{t.version} {idx + 1}</span>
                      {isSaveSelected && <Check className="w-5 h-5 text-primary" />}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t.coverage}: </span>
                        <span className="font-medium">{totalAssigned}/{totalRequired}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Min-Max: </span>
                        <span className="font-medium">{minShift} - {maxShift}</span>
                      </div>
                      {r.unfilledSlots && r.unfilledSlots.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">Unfilled: </span>
                          <span className="font-medium text-amber-600 dark:text-amber-400">{unfilledCount}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Button
            onClick={() => exportOnly ? doExcelExport(saveVersion) : saveSchedule(saveVersion)}
            disabled={!exportOnly && createMutation.isPending}
            className="w-full bg-green-600 hover:bg-green-700"
            data-testid="button-confirm-save"
          >
            {!exportOnly && createMutation.isPending
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : exportOnly
                ? <FileSpreadsheet className="w-4 h-4 mr-2" />
                : <Save className="w-4 h-4 mr-2" />
            }
            {exportOnly
              ? `${t.exportThisVersion} (${t.version} ${saveVersion + 1})`
              : `${t.confirmSave} (${t.version} ${saveVersion + 1})`
            }
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreCheckWarning} onOpenChange={setShowPreCheckWarning}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {preCheckConflicts.length > 0
                ? <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0" />
                : <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" />
              }
              <DialogTitle>
                {preCheckConflicts.length > 0 ? t.preCheckConflictTitle : t.preCheckWarningTitle}
              </DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              {preCheckConflicts.length > 0 ? t.preCheckConflictDesc : t.preCheckWarningDesc}
            </DialogDescription>
          </DialogHeader>
          {preCheckConflicts.length > 0 && (
            <div className="space-y-2 text-sm">
              {preCheckConflicts.map((c, i) => (
                <div key={`c-${i}`} className="pl-3 border-l-2 border-red-400 dark:border-red-500 py-1 text-red-700 dark:text-red-300">
                  {c}
                </div>
              ))}
              <p className="text-sm text-red-600 dark:text-red-400 font-medium italic">{t.mustFixBeforeProceed}</p>
            </div>
          )}
          {preCheckWarnings.length > 0 && preCheckConflicts.length === 0 && (
            <div className="space-y-2 text-sm text-muted-foreground">
              {preCheckWarnings.map((w, i) => (
                <div key={`w-${i}`} className="pl-3 border-l-2 border-amber-400 dark:border-amber-500 py-1">
                  {w}
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setShowPreCheckWarning(false)}
              data-testid="button-cancel-precheck"
            >
              {t.cancelOptimization}
            </Button>
            {preCheckConflicts.length === 0 && (
              <Button
                onClick={proceedAfterPreCheck}
                data-testid="button-proceed-precheck"
              >
                {t.proceedAnyway}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLevelWarning} onOpenChange={setShowLevelWarning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500 dark:text-yellow-400 shrink-0" />
              <DialogTitle>{t.levelFeasibilityWarning}</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              {t.levelFeasibilityDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            {levelWarnings.map((w, i) => (
              <div key={i} className="pl-3 border-l-2 border-yellow-400 dark:border-yellow-500 py-1">
                {w}
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground italic">{t.softLevelNote}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setShowLevelWarning(false)}
              data-testid="button-cancel-optimization"
            >
              {t.cancelOptimization}
            </Button>
            <Button
              onClick={() => {
                setShowLevelWarning(false);
                executeOptimizer(true);
              }}
              data-testid="button-proceed-soft-levels"
            >
              {t.proceedWithSoftLevels}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent dark:from-primary/20 dark:via-primary/10 px-6 pt-6 pb-4 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-primary/15 dark:bg-primary/25 flex items-center justify-center mb-3">
              <Save className="w-7 h-7 text-primary" />
            </div>
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="text-lg">
                {lang === "th" ? "เข้าสู่ระบบเพื่อบันทึกข้อมูล" : "Sign in to save your data"}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                {lang === "th"
                  ? "เข้าสู่ระบบด้วย Google เพื่อบันทึกรายชื่อสตาฟและการตั้งค่า คุณจะไม่ต้องกรอกใหม่ทุกครั้ง"
                  : "Sign in with Google to save your staff list and settings. You won't need to re-enter them next time."}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex flex-col items-center gap-3 px-6 pb-6 pt-2">
            <GoogleSignInButton />
            <Separator className="my-1" />
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => {
                setShowLoginPrompt(false);
                if (loginPromptReason === "next") {
                  setStep(s => Math.min(s + 1, 4));
                }
              }}
              data-testid="button-skip-login"
            >
              {lang === "th" ? "ข้ามไปก่อน" : "Skip for now"} <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
