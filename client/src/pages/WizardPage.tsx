import { useState, useMemo, useEffect, useCallback } from "react";
import { useCreateSchedule } from "@/hooks/use-schedules";
import { type StaffMember, type SchedulerConfig, type OptimizerResult, type DaySchedule } from "@shared/schema";
import { useAuth } from "@/context/AuthContext";
import { GoogleSignInButton, UserMenu } from "@/components/GoogleSignIn";
import { ShiftOptimizer } from "@/lib/optimizer";
import { WizardStep } from "@/components/WizardStep";
import { ScheduleView } from "@/components/ScheduleView";
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
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { nanoid } from "nanoid";
import { Link, useLocation } from "wouter";
import { getDaysInMonth, format, setDate, parseISO, differenceInCalendarDays, addDays } from "date-fns";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import ExcelJS from "exceljs";
import { FeedbackWidget } from "@/components/FeedbackWidget";

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

const INITIAL_CONFIG: SchedulerConfig = {
  shiftsPerDay: 3,
  shiftNames: ["Morning", "Evening", "Night"],
  staffPerShift: [2, 2, 1],
  consecutiveRules: [{ from: 2, to: 0 }],
};

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
  labels: { date: string; day: string; staffName: string; total: string; summary: string; schedule: string; staffSchedule: string; level: string }
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
  ws1.addRow(schedHeaders);
  result.forEach((day) => {
    const currentDate = getDateForIdx(day.date);
    const row: string[] = [format(currentDate, "MMM d"), format(currentDate, "EEEE")];
    config.shiftNames.forEach((_, shiftIdx) => {
      const names = day.shifts[shiftIdx]?.map(id => getStaffName(String(id))) || [];
      for (let p = 0; p < maxPerShift[shiftIdx]; p++) {
        row.push(names[p] || "");
      }
    });
    ws1.addRow(row);
  });
  ws1.getColumn(1).width = 8;
  ws1.getColumn(2).width = 12;
  for (let i = 3; i <= schedHeaders.length; i++) ws1.getColumn(i).width = 18;
  ws1.getRow(1).font = { bold: true };

  const ws2 = wb.addWorksheet(labels.summary);
  const hasLevels = config.staffLevels && config.staffLevels.length > 0;
  const summaryHeaders = hasLevels
    ? [labels.staffName, labels.level, ...config.shiftNames, labels.total]
    : [labels.staffName, ...config.shiftNames, labels.total];
  ws2.addRow(summaryHeaders);
  staff.forEach(s => {
    const row: (string | number)[] = [s.name];
    if (hasLevels) {
      row.push(config.staffLevels![(s.level ?? 0)] || config.staffLevels![0] || "");
    }
    let total = 0;
    config.shiftNames.forEach((_, shiftIdx) => {
      const count = result.reduce((acc, day) =>
        acc + (day.shifts[shiftIdx]?.map(String).includes(s.id) ? 1 : 0), 0);
      row.push(count);
      total += count;
    });
    row.push(total);
    ws2.addRow(row);
  });
  ws2.getColumn(1).width = 20;
  const colOffset = hasLevels ? 1 : 0;
  if (hasLevels) ws2.getColumn(2).width = 16;
  for (let i = 2 + colOffset; i <= config.shiftNames.length + 1 + colOffset; i++) ws2.getColumn(i).width = 12;
  ws2.getColumn(config.shiftNames.length + 2 + colOffset).width = 8;
  ws2.getRow(1).font = { bold: true };

  const dateHeaders = result.map((day) => format(getDateForIdx(day.date), "d MMM"));
  const ws3 = wb.addWorksheet(labels.staffSchedule);
  const matrixHeaders = [labels.staffName, ...dateHeaders, ...config.shiftNames, labels.total];
  const headerRow = ws3.addRow(matrixHeaders);
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
  });

  const shiftColors = config.shiftNames.map((_, i) => SHIFT_COLORS[i % SHIFT_COLORS.length]);

  staff.forEach(s => {
    const rowValues: (string | number)[] = [s.name];
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

    shiftTotals.forEach(ct => rowValues.push(ct));
    rowValues.push(grandTotal);

    const excelRow = ws3.addRow(rowValues);

    dayCellInfo.forEach((info, colOffset) => {
      if (info.shiftIndices.length === 0) return;
      const cell = excelRow.getCell(colOffset + 2);
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
  for (let i = 2; i <= dateHeaders.length + 1; i++) ws3.getColumn(i).width = 10;
  for (let i = dateHeaders.length + 2; i <= dateHeaders.length + 1 + config.shiftNames.length; i++) ws3.getColumn(i).width = 12;
  ws3.getColumn(matrixHeaders.length).width = 8;

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
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [config, setConfig] = useState<SchedulerConfig>(INITIAL_CONFIG);
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
  const result = results.length > 0 ? results[selectedVersion] : null;
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [presetLoaded, setPresetLoaded] = useState(false);
  const [showLevelWarning, setShowLevelWarning] = useState(false);
  const [levelWarnings, setLevelWarnings] = useState<string[]>([]);
  const { user } = useAuth();

  const handleModeSwitch = (mode: string) => {
    const newMode = mode === "custom";
    if (newMode !== useCustomRange) {
      setUseCustomRange(newMode);
      setStaff(prev => prev.map(s => ({ ...s, blocked: [] })));
      setConfig(prev => ({ ...prev, holidays: [] }));
    }
  };
  
  const createMutation = useCreateSchedule();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { t, dayNames, lang } = useLanguage();

  useEffect(() => {
    if (user && showLoginPrompt) {
      setShowLoginPrompt(false);
      setStep(s => Math.min(s + 1, 4));
    }
  }, [user, showLoginPrompt]);

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
            setStaff(p.staff.map((s: StaffMember) => ({ ...s, blocked: [] })));
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
      await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: scheduleName, config, staff }),
      });
    } catch {}
  }, [user, config, staff, scheduleName]);

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

  const handleNext = () => {
    if (step === 2 && !user) {
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
    if (levels.length >= 3) return;
    const defaultNames = lang === "th" 
      ? ["พยาบาล", "ผู้ช่วยพยาบาล", "คนงาน"]
      : ["Nurse", "Assistant", "Worker"];
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
    }
    updateStaff(staffId, "blocked", newBlocked);
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
    return warnings;
  };

  const executeOptimizer = (softLevels: boolean) => {
    setIsOptimizing(true);
    setOptimizeProgress(0);
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
        const allResults: OptimizerResult[] = [];
        for (let v = 0; v < 3; v++) {
          setOptimizeProgress(v + 1);
          await new Promise(r => setTimeout(r, 50));
          const optimizer = new ShiftOptimizer(optimizerConfig, staff, month, year, { softLevelConstraints: softLevels });
          const res = await optimizer.optimize();
          allResults.push(res);
        }
        setResults(allResults);
        setSelectedVersion(0);
        setStep(4);
        savePreset();
        const anyPartial = allResults.some(r => r.isPartial && r.unfilledSlots && r.unfilledSlots.length > 0);
        if (anyPartial) {
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
        toast({ 
          title: t.optimizationFailed, 
          description: e.message || "Could not satisfy all constraints. Try adding more staff or loosening rules.", 
          variant: "destructive" 
        });
      } finally {
        setIsOptimizing(false);
        setOptimizeProgress(0);
      }
    })();
  };

  const runOptimizer = () => {
    const warnings = checkLevelFeasibility();
    if (warnings.length > 0) {
      setLevelWarnings(warnings);
      setShowLevelWarning(true);
    } else {
      executeOptimizer(false);
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
      { date: t.date, day: t.day, staffName: t.staffName, total: t.total, summary: t.summary, schedule: t.scheduleView, staffSchedule: t.staffSchedule, level: t.level }
    );
    setShowSaveDialog(false);
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
              <Button onClick={handleSaveClick} disabled={!exportOnly && createMutation.isPending} className="bg-green-600 hover:bg-green-700" data-testid="button-save-schedule">
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

      <main className="max-w-5xl mx-auto px-4 py-8">
        
        {/* STEP 1: CONFIGURATION */}
        <WizardStep 
          isActive={step === 1} 
          title={t.basicConfig} 
          description={t.basicConfigDesc}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-md border-0 ring-1 ring-slate-200 dark:ring-slate-800">
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
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

                <div className="space-y-4">
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
                            {format(parseISO(customStartDate), "d MMM yyyy")} — {format(parseISO(customEndDate), "d MMM yyyy")} ({daysInMonth} {daysInMonth === 1 ? t.shiftPerDay.split(" ")[0] : t.day.toLowerCase() + "s"})
                          </p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md border-0 ring-1 ring-slate-200 dark:ring-slate-800">
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

                <div className="space-y-4">
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

          <Card className="shadow-md border-0 ring-1 ring-slate-200 dark:ring-slate-800 mt-6">
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
                  disabled={(config.staffLevels?.length || 0) >= 3}
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
                    <div className="flex items-center gap-1.5">
                      <Button onClick={addStaff} variant="outline" size="sm" className="border-dashed" data-testid="button-add-staff">
                        <Plus className="w-4 h-4 mr-1" /> {t.add}
                      </Button>
                      <Button onClick={() => setShowBulkAdd(true)} variant="outline" size="sm" data-testid="button-add-multiple">
                        <Users className="w-4 h-4 mr-1" /> {t.addMultiple}
                      </Button>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg space-y-2">
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
                  
                  <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
                    {staff.map((s) => {
                      const blockedCount = s.blocked?.length || 0;
                      const isSelected = selectedStaffId === s.id;
                      return (
                        <div 
                          key={s.id} 
                          className={`group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 dark:bg-primary/15 ring-1 ring-primary/30' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                          onClick={() => setSelectedStaffId(isSelected ? null : s.id)}
                          data-testid={`staff-card-${s.id}`}
                        >
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                            {s.name.charAt(0)}
                          </div>
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

            <Card className="shadow-md border-0 ring-1 ring-slate-200 dark:ring-slate-800 lg:col-span-3">
              <CardContent className="p-6">
                {selectedStaffMember ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="font-semibold text-lg">{selectedStaffMember.name} - {t.availability}</h3>
                        <p className="text-sm text-muted-foreground">
                          {t.clickDatesToBlock}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {selectedStaffMember.blocked?.length || 0} {t.blocked}
                        </Badge>
                        {(selectedStaffMember.blocked?.length || 0) > 0 && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => updateStaff(selectedStaffId!, "blocked", [])}
                            data-testid="button-clear-blocks"
                          >
                            {t.clearAll}
                          </Button>
                        )}
                      </div>
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
                          const currentDate = getDateForIndex(date);
                          const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
                          
                          return (
                            <button
                              key={date}
                              onClick={() => toggleFullDayBlock(selectedStaffId!, date)}
                              className={`
                                relative p-2 rounded-md text-sm font-medium transition-all text-center
                                ${blocked 
                                  ? 'bg-red-500 text-white hover:bg-red-600' 
                                  : partiallyBlocked
                                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50 ring-1 ring-orange-300 dark:ring-orange-700'
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
              <Card className="shadow-md">
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
                    {config.consecutiveRules.map((rule, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border flex-wrap">
                        <span className="text-red-500 font-bold">{t.no}</span>
                        <Badge variant="outline">{config.shiftNames[rule.from]}</Badge>
                        <span className="text-muted-foreground text-sm">{t.followedBy}</span>
                        <Badge variant="outline">{config.shiftNames[rule.to]}</Badge>
                        <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0" onClick={() => {
                           const newRules = config.consecutiveRules.filter((_, i) => i !== idx);
                           setConfig({...config, consecutiveRules: newRules});
                        }} data-testid={`button-remove-rule-${idx}`}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    
                    <div className="flex items-center gap-2 pt-2">
                       <Select key={config.consecutiveRules.length} onValueChange={(val) => {
                         const [from, to] = val.split(',').map(Number);
                         setConfig({
                           ...config,
                           consecutiveRules: [...config.consecutiveRules, { from, to }]
                         });
                       }}>
                         <SelectTrigger className="w-full" data-testid="select-add-rule">
                           <SelectValue placeholder={t.addNewRule} />
                         </SelectTrigger>
                         <SelectContent position="popper" sideOffset={4} className="bg-white dark:bg-slate-900">
                           {config.shiftNames.flatMap((name1, i) =>
                             config.shiftNames.map((name2, j) => {
                               const exists = config.consecutiveRules.some(r => r.from === i && r.to === j);
                               if (exists) return null;
                               return (
                                 <SelectItem key={`${i}-${j}`} value={`${i},${j}`}>
                                   {t.blockRule} {name1} {t.followedBy} {name2}
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

              <Card className="shadow-md">
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

            <div className="flex items-center justify-center p-8">
              {isOptimizing ? (
                <div className="text-center space-y-6 max-w-sm mx-auto">
                  <div className="relative inline-flex items-center justify-center">
                    <div className="absolute w-28 h-28 rounded-full border-4 border-primary/15 dark:border-primary/25" />
                    <svg className="w-28 h-28 animate-spin" style={{ animationDuration: "2.5s" }} viewBox="0 0 112 112">
                      <circle cx="56" cy="56" r="52" fill="none" stroke="hsl(var(--primary) / 0.3)" strokeWidth="4" strokeDasharray="220 110" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-primary">{optimizeProgress}/3</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold">{t.generatingVersions}...</h3>
                    <p className="text-sm text-muted-foreground">
                      {lang === "th" ? "กำลังคำนวณเวอร์ชัน" : "Computing version"} {optimizeProgress} {lang === "th" ? "จาก" : "of"} 3
                    </p>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${(optimizeProgress / 3) * 100}%` }}
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
            className="max-w-6xl"
          >
            <div className="space-y-8">
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
                <Button variant="outline" onClick={runOptimizer} disabled={isOptimizing} data-testid="button-regenerate">
                  {isOptimizing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <History className="w-4 h-4 mr-2" />}
                  {t.regenerate}
                </Button>
              </div>

              {results.length > 1 && (
                <div className="space-y-2">
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
                <TabsList className="mb-4">
                  <TabsTrigger value="calendar" data-testid="tab-calendar"><CalendarIcon className="w-4 h-4 mr-2" />{t.calendarView}</TabsTrigger>
                  <TabsTrigger value="summary" data-testid="tab-summary"><Check className="w-4 h-4 mr-2" />{t.summary}</TabsTrigger>
                  <TabsTrigger value="stats" data-testid="tab-stats"><Activity className="w-4 h-4 mr-2" />{t.statistics}</TabsTrigger>
                </TabsList>
                
                <TabsContent value="calendar" className="mt-0">
                  <ScheduleView 
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
                    unfilledSlots={result.unfilledSlots}
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
                  <StatsCard result={result} config={config} />
                </TabsContent>
              </Tabs>
            </div>
          </WizardStep>
        )}

        {step === 4 && <FeedbackWidget />}

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
                setStep(s => Math.min(s + 1, 4));
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
