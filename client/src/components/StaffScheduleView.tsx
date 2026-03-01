import { useMemo, useState, useCallback, Fragment } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import type { DaySchedule, SchedulerConfig, StaffMember } from "@shared/schema";
import { format, addDays, parseISO, setDate } from "date-fns";
import { AlertTriangle, Thermometer } from "lucide-react";

const SHIFT_BG_COLORS = [
  "bg-blue-200 dark:bg-blue-800/60",
  "bg-green-200 dark:bg-green-800/60",
  "bg-purple-200 dark:bg-purple-800/60",
  "bg-orange-200 dark:bg-orange-800/60",
  "bg-rose-200 dark:bg-rose-800/60",
];

const SHIFT_TEXT_COLORS = [
  "text-blue-900 dark:text-blue-100",
  "text-green-900 dark:text-green-100",
  "text-purple-900 dark:text-purple-100",
  "text-orange-900 dark:text-orange-100",
  "text-rose-900 dark:text-rose-100",
];

function getConsecutiveStreak(
  schedule: DaySchedule[],
  staffId: string,
  dayIndex: number
): number {
  let streak = 0;
  for (let d = dayIndex; d >= 0; d--) {
    const worksToday = schedule[d].shifts.some(shift => shift.includes(staffId));
    if (worksToday) streak++;
    else break;
  }
  return streak;
}

function getStreakColor(streak: number): string | null {
  if (streak >= 7) return "#fca5a5";
  if (streak >= 6) return "#fdba74";
  if (streak >= 5) return "#fde68a";
  return null;
}

function getStreakColorDark(streak: number): string | null {
  if (streak >= 7) return "#991b1b";
  if (streak >= 6) return "#9a3412";
  if (streak >= 5) return "#854d0e";
  return null;
}

function getStreakStartDay(
  schedule: DaySchedule[],
  staffId: string,
  dayIndex: number
): number {
  let start = dayIndex;
  for (let d = dayIndex; d >= 0; d--) {
    if (schedule[d].shifts.some(shift => shift.includes(staffId))) start = d;
    else break;
  }
  return start;
}

interface StaffScheduleViewProps {
  schedule: DaySchedule[];
  config: SchedulerConfig;
  staff: StaffMember[];
  month: number;
  year: number;
  onScheduleChange?: (updatedSchedule: DaySchedule[]) => void;
}

interface DragDataStaff {
  staffId: string;
  dayDate: number;
  shiftIndices: number[];
}

interface PendingMove {
  staffId: string;
  staffName: string;
  fromRowIdx: number;
  toRowIdx: number;
  toStaffId: string;
  toStaffName: string;
  dayDate: number;
  shiftIndices: number[];
  warnings: string[];
  warningMessages: string[];
}

function validateMoveToStaff(
  staffId: string,
  dayDate: number,
  shiftIndices: number[],
  schedule: DaySchedule[],
  config: SchedulerConfig,
  staff: StaffMember[]
): string[] {
  const warnings: string[] = [];
  const member = staff.find((s) => s.id === staffId);
  if (!member) return warnings;

  for (const shiftIdx of shiftIndices) {
    const isBlocked = member.blocked.some(
      (b) => b.date === dayDate && (b.shift === -1 || b.shift === shiftIdx)
    );
    if (isBlocked && !warnings.includes("blocked")) {
      warnings.push("blocked");
    }
  }

  const daySchedule = schedule.find((d) => d.date === dayDate);
  if (daySchedule) {
    for (const shiftIdx of shiftIndices) {
      for (let si = 0; si < daySchedule.shifts.length; si++) {
        if (shiftIndices.includes(si)) continue;
        if (daySchedule.shifts[si].includes(staffId)) {
          const rules = config.consecutiveRules || [];
          const sameDayRule = rules.find(
            (r) => r.type === "sameDay" && ((r.from === si && r.to === shiftIdx) || (r.from === shiftIdx && r.to === si))
          );
          if (sameDayRule && !warnings.includes("consecutiveSameDay")) {
            warnings.push("consecutiveSameDay");
          }
        }
      }
    }
  }

  for (const shiftIdx of shiftIndices) {
    const prevDay = schedule.find((d) => d.date === dayDate - 1);
    if (prevDay) {
      for (let si = 0; si < prevDay.shifts.length; si++) {
        if (prevDay.shifts[si].includes(staffId)) {
          const rules = config.consecutiveRules || [];
          const rule = rules.find(
            (r) => (!r.type || r.type === "nextDay") && r.from === si && r.to === shiftIdx
          );
          if (rule && !warnings.includes("consecutiveNextDay")) {
            warnings.push("consecutiveNextDay");
          }
        }
      }
    }

    const nextDay = schedule.find((d) => d.date === dayDate + 1);
    if (nextDay) {
      for (let si = 0; si < nextDay.shifts.length; si++) {
        if (nextDay.shifts[si].includes(staffId)) {
          const rules = config.consecutiveRules || [];
          const rule = rules.find(
            (r) => (!r.type || r.type === "nextDay") && r.from === shiftIdx && r.to === si
          );
          if (rule && !warnings.includes("consecutiveNextDay")) {
            warnings.push("consecutiveNextDay");
          }
        }
      }
    }
  }

  let totalShifts = 0;
  for (const day of schedule) {
    for (const shift of day.shifts) {
      if (shift.includes(staffId)) totalShifts++;
    }
  }
  if (totalShifts + shiftIndices.length > member.maxShifts) {
    warnings.push("maxShifts");
  }

  return warnings;
}

export function StaffScheduleView({ schedule, config, staff, month, year, onScheduleChange }: StaffScheduleViewProps) {
  const { t } = useLanguage();
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [draggingFrom, setDraggingFrom] = useState<string | null>(null);
  const [draggingShiftKey, setDraggingShiftKey] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const editable = !!onScheduleChange;

  const isCustomRange = config.useCustomRange && config.customStartDate;
  const baseDate = isCustomRange
    ? parseISO(config.customStartDate!)
    : new Date(year, month - 1, 1);

  const getDateForIdx = (dayIndex: number): Date => {
    if (isCustomRange) return addDays(parseISO(config.customStartDate!), dayIndex - 1);
    return setDate(baseDate, dayIndex);
  };

  const holidays = useMemo(() => new Set(config.holidays || []), [config.holidays]);
  const hasLevels = !!(config.staffLevels && config.staffLevels.length > 0);
  const S = config.shiftNames.length;

  const staffRows = useMemo(() => {
    return staff.map(s => {
      const shiftTotals = new Array(S).fill(0);
      let grandTotal = 0;
      const dayCells = schedule.map(day => {
        const matchedShifts: number[] = [];
        config.shiftNames.forEach((_, shiftIdx) => {
          const assigned = day.shifts[shiftIdx]?.map(String) || [];
          if (assigned.includes(s.id)) {
            matchedShifts.push(shiftIdx);
            shiftTotals[shiftIdx]++;
            grandTotal++;
          }
        });
        const isBlocked = s.blocked.some(b => b.date === day.date && b.shift === -1) ||
          config.shiftNames.every((_, si) => s.blocked.some(b => b.date === day.date && b.shift === si));
        const isRequested = (s.requested || []).some(r => r.date === day.date && matchedShifts.includes(r.shift));
        return { matchedShifts, isBlocked, isRequested };
      });
      const levelLabel = hasLevels ? (config.staffLevels![(s.level ?? 0)] || "") : "";
      const shiftHours = config.shiftHours || config.shiftNames.map(() => 8);
      const totalHours = shiftTotals.reduce((sum, count, si) => sum + count * (shiftHours[si] || 0), 0);
      return { id: s.id, name: s.name, levelLabel, dayCells, shiftTotals, grandTotal, totalHours };
    });
  }, [staff, schedule, config, S, hasLevels]);

  const streakMap = useMemo(() => {
    if (!showHeatmap) return null;
    const map = new Map<string, { streak: number; startDay: number }>();
    staff.forEach(s => {
      schedule.forEach((_, ci) => {
        const streak = getConsecutiveStreak(schedule, s.id, ci);
        if (streak >= 5) {
          const startDay = getStreakStartDay(schedule, s.id, ci);
          map.set(`${s.id}-${ci}`, { streak, startDay });
        }
      });
    });
    return map;
  }, [showHeatmap, staff, schedule]);

  const shiftTotalPerDay = useMemo(() => {
    return config.shiftNames.map((_, shiftIdx) => {
      const perDay = schedule.map(day => {
        return (day.shifts[shiftIdx] || []).length;
      });
      return { shiftIdx, perDay };
    });
  }, [config.shiftNames, schedule]);

  const levelCounts = useMemo(() => {
    if (!hasLevels || !config.minStaffPerLevel) return null;
    const levelNames = config.staffLevels!;
    return config.shiftNames.map((_, shiftIdx) => {
      return levelNames.map((levelName, lvl) => {
        const minReq = config.minStaffPerLevel![shiftIdx]?.[lvl] || 0;
        if (minReq <= 0) return null;
        const perDay = schedule.map(day => {
          let count = 0;
          const assigned = day.shifts[shiftIdx]?.map(String) || [];
          for (const sid of assigned) {
            const member = staff.find(m => m.id === sid);
            if (member && (member.level ?? 0) === lvl) count++;
          }
          return { count, met: count >= minReq };
        });
        return { levelName, minReq, perDay, shiftIdx };
      }).filter(Boolean);
    }).flat().filter(r => r !== null);
  }, [hasLevels, config, schedule, staff]);

  const handleDragStart = useCallback(
    (e: React.DragEvent, staffId: string, dayDate: number, shiftIndices: number[], rowIdx: number) => {
      if (!editable) return;
      const dragData: DragDataStaff = { staffId, dayDate, shiftIndices };
      e.dataTransfer.setData("application/json", JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = "move";
      setDraggingFrom(`${rowIdx}-${dayDate}`);
      setDraggingShiftKey(`${rowIdx}-${dayDate}-${shiftIndices.join(",")}`);
    },
    [editable]
  );

  const handleDragEnd = useCallback(() => {
    setDragOverTarget(null);
    setDraggingFrom(null);
    setDraggingShiftKey(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, rowIdx: number, dayDate: number) => {
      if (!editable) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverTarget(`${rowIdx}-${dayDate}`);
    },
    [editable]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverTarget(null);
  }, []);

  const applyMove = useCallback(
    (sourceStaffId: string, targetStaffId: string, dayDate: number, shiftIndices: number[]) => {
      if (!onScheduleChange) return;
      const newSchedule = schedule.map((day) => ({
        ...day,
        shifts: day.shifts.map((shift) => [...shift]),
      }));

      const dayEntry = newSchedule.find((d) => d.date === dayDate);
      if (!dayEntry) return;

      for (const si of shiftIndices) {
        dayEntry.shifts[si] = dayEntry.shifts[si].filter((id) => id !== sourceStaffId);
        if (!dayEntry.shifts[si].includes(targetStaffId)) {
          dayEntry.shifts[si].push(targetStaffId);
        }
      }

      onScheduleChange(newSchedule);
    },
    [schedule, onScheduleChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetRowIdx: number, targetDayDate: number) => {
      e.preventDefault();
      setDragOverTarget(null);
      setDraggingFrom(null);

      if (!editable) return;

      let dragData: DragDataStaff;
      try {
        dragData = JSON.parse(e.dataTransfer.getData("application/json"));
      } catch {
        return;
      }

      const { staffId: sourceStaffId, dayDate: sourceDayDate, shiftIndices } = dragData;

      if (sourceDayDate !== targetDayDate) return;
      if (!shiftIndices || shiftIndices.length === 0) return;

      const targetStaff = staff[targetRowIdx];
      if (!targetStaff) return;
      if (targetStaff.id === sourceStaffId) return;

      const scheduleAfterRemove = schedule.map((day) => {
        if (day.date !== sourceDayDate) return day;
        return {
          ...day,
          shifts: day.shifts.map((shift, si) =>
            shiftIndices.includes(si) ? shift.filter((id) => id !== sourceStaffId) : shift
          ),
        };
      });

      const warnings = validateMoveToStaff(
        targetStaff.id,
        targetDayDate,
        shiftIndices,
        scheduleAfterRemove,
        config,
        staff
      );

      if (warnings.length > 0) {
        const warningMessages = warnings.map((w) => {
          switch (w) {
            case "blocked": return t.editorBlockedDate;
            case "consecutiveSameDay":
            case "consecutiveNextDay": return t.editorConsecutiveViolation;
            case "maxShifts": return t.editorMaxShiftsReached;
            case "alreadyAssigned": return t.editorAlreadyAssigned;
            default: return w;
          }
        });

        const sourceMember = staff.find(s => s.id === sourceStaffId);
        setPendingMove({
          staffId: sourceStaffId,
          staffName: sourceMember?.name || sourceStaffId,
          fromRowIdx: staff.findIndex(s => s.id === sourceStaffId),
          toRowIdx: targetRowIdx,
          toStaffId: targetStaff.id,
          toStaffName: targetStaff.name,
          dayDate: targetDayDate,
          shiftIndices,
          warnings,
          warningMessages,
        });
        return;
      }

      applyMove(sourceStaffId, targetStaff.id, targetDayDate, shiftIndices);
    },
    [editable, schedule, config, staff, t, applyMove]
  );

  const handleConfirmPending = useCallback(() => {
    if (!pendingMove) return;
    applyMove(pendingMove.staffId, pendingMove.toStaffId, pendingMove.dayDate, pendingMove.shiftIndices);
    setPendingMove(null);
  }, [pendingMove, applyMove]);

  const handleCancelPending = useCallback(() => {
    setPendingMove(null);
  }, []);

  return (
    <>
      <Card className="border shadow-lg overflow-hidden bg-white dark:bg-zinc-900" data-testid="staff-schedule-view">
        <div className="flex items-center gap-4 px-4 py-2 border-b bg-slate-50 dark:bg-slate-800/50 text-xs flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded bg-red-400 dark:bg-red-700" />
            <span className="text-muted-foreground">{t.blockedDateLegend}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded ring-2 ring-emerald-500 bg-white dark:bg-zinc-900" />
            <span className="text-muted-foreground">{t.requestedDateLegend}</span>
          </div>
          <div className="ml-auto">
            <Button
              variant={showHeatmap ? "default" : "outline"}
              size="sm"
              className="h-6 text-[11px] gap-1 px-2"
              onClick={() => setShowHeatmap(v => !v)}
              data-testid="button-toggle-heatmap"
            >
              <Thermometer className="w-3 h-3" />
              {t.streakHeatmap}
            </Button>
          </div>
        </div>
        {showHeatmap && (
          <div className="flex items-center gap-4 px-4 py-1.5 border-b bg-slate-50/50 dark:bg-slate-800/30 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded" style={{ background: "rgba(250, 204, 21, 0.35)" }} />
              <span className="text-muted-foreground">{t.streakLegend5}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded" style={{ background: "rgba(251, 146, 60, 0.4)" }} />
              <span className="text-muted-foreground">{t.streakLegend6}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded" style={{ background: "rgba(239, 68, 68, 0.4)" }} />
              <span className="text-muted-foreground">{t.streakLegend7}</span>
            </div>
          </div>
        )}
        <ScrollArea className="h-[calc(100vh-260px)] w-full">
          <div className="min-w-max">
            <table className="text-xs border-collapse w-full">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th className="sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 p-1.5 text-left font-bold border-b border-r min-w-[140px]">
                    {t.staffName}
                  </th>
                  {hasLevels && (
                    <th className="sticky z-20 bg-slate-100 dark:bg-slate-800 p-1.5 text-center font-bold border-b border-r min-w-[50px]" style={{ left: "140px" }}>
                      {t.level}
                    </th>
                  )}
                  {schedule.map(day => {
                    const d = getDateForIdx(day.date);
                    const dow = d.getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    const isHol = holidays.has(day.date);
                    return (
                      <th
                        key={day.date}
                        className={cn(
                          "p-1 text-center font-medium border-b border-r min-w-[52px]",
                          (isWeekend || isHol) && "bg-purple-100 dark:bg-purple-900/30"
                        )}
                      >
                        <div className="text-[10px] leading-tight">{format(d, "d")}</div>
                        <div className="text-[9px] text-muted-foreground leading-tight">{format(d, "EEE")}</div>
                      </th>
                    );
                  })}
                  {config.shiftNames.map((name, i) => (
                    <th key={`shift-${i}`} className={cn("p-1.5 text-center font-bold border-b border-r min-w-[44px]", SHIFT_BG_COLORS[i % SHIFT_BG_COLORS.length])}>
                      {name}
                    </th>
                  ))}
                  <th className="p-1.5 text-center font-bold border-b border-r min-w-[44px] bg-slate-200 dark:bg-slate-700">
                    {t.total}
                  </th>
                  <th className="p-1.5 text-center font-bold border-b min-w-[52px] bg-amber-100 dark:bg-amber-900/40">
                    {t.totalHours}
                  </th>
                </tr>
              </thead>
              <tbody>
                {staffRows.map((row, ri) => (
                  <tr key={ri} className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="sticky left-0 z-10 bg-white dark:bg-zinc-900 p-1.5 font-medium border-r whitespace-nowrap">
                      {row.name}
                    </td>
                    {hasLevels && (
                      <td className="sticky z-10 bg-white dark:bg-zinc-900 p-1 text-center border-r" style={{ left: "140px" }}>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">{row.levelLabel}</Badge>
                      </td>
                    )}
                    {row.dayCells.map((cell, ci) => {
                      const dayDate = schedule[ci].date;
                      const d = getDateForIdx(dayDate);
                      const dow = d.getDay();
                      const isWeekend = dow === 0 || dow === 6;
                      const isHol = holidays.has(dayDate);
                      const isDragOver = dragOverTarget === `${ri}-${dayDate}`;
                      const isDragging = draggingFrom === `${ri}-${dayDate}`;

                      const streakInfo = showHeatmap && streakMap ? streakMap.get(`${row.id}-${ci}`) : undefined;
                      const heatmapActive = showHeatmap && cell.matchedShifts.length > 0;
                      const streakBg = streakInfo ? getStreakColor(streakInfo.streak) : null;
                      const streakBgDark = streakInfo ? getStreakColorDark(streakInfo.streak) : null;
                      const heatmapNoBg = heatmapActive && !streakBg;
                      const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
                      const streakStyle = streakBg ? { backgroundColor: isDark ? (streakBgDark || undefined) : streakBg } : (heatmapActive ? { backgroundColor: isDark ? "#27272a" : "#f8fafc" } : undefined);

                      const streakLabel = streakInfo && streakInfo.streak >= 5 ? `${streakInfo.streak}d` : null;

                      if (cell.isBlocked && cell.matchedShifts.length === 0) {
                        return (
                          <td
                            key={ci}
                            className="p-0.5 text-center border-r bg-red-400 dark:bg-red-700"
                            onDragOver={editable ? (e) => handleDragOver(e, ri, dayDate) : undefined}
                            onDragLeave={editable ? handleDragLeave : undefined}
                            onDrop={editable ? (e) => handleDrop(e, ri, dayDate) : undefined}
                          />
                        );
                      }

                      if (cell.matchedShifts.length === 0) {
                        return (
                          <td
                            key={ci}
                            className={cn(
                              "p-0.5 text-center border-r",
                              (isWeekend || isHol) && "bg-purple-50/50 dark:bg-purple-900/10",
                              isDragOver && "ring-2 ring-inset ring-blue-400 bg-blue-50 dark:bg-blue-900/20"
                            )}
                            onDragOver={editable ? (e) => handleDragOver(e, ri, dayDate) : undefined}
                            onDragLeave={editable ? handleDragLeave : undefined}
                            onDrop={editable ? (e) => handleDrop(e, ri, dayDate) : undefined}
                          />
                        );
                      }

                      if (cell.matchedShifts.length === 1) {
                        const si = cell.matchedShifts[0];
                        const bgClass = SHIFT_BG_COLORS[si % SHIFT_BG_COLORS.length];
                        const textClass = SHIFT_TEXT_COLORS[si % SHIFT_TEXT_COLORS.length];
                        const shiftKey = `${ri}-${dayDate}-${si}`;
                        const isDraggingThis = draggingShiftKey === shiftKey;

                        return (
                          <td
                            key={ci}
                            draggable={editable}
                            onDragStart={editable ? (e) => handleDragStart(e, row.id, dayDate, [si], ri) : undefined}
                            onDragEnd={editable ? handleDragEnd : undefined}
                            onDragOver={editable ? (e) => handleDragOver(e, ri, dayDate) : undefined}
                            onDragLeave={editable ? handleDragLeave : undefined}
                            onDrop={editable ? (e) => handleDrop(e, ri, dayDate) : undefined}
                            className={cn(
                              "p-0.5 text-center border-r font-medium relative",
                              editable && "cursor-grab active:cursor-grabbing",
                              !heatmapActive && bgClass,
                              heatmapActive ? "text-zinc-800 dark:text-zinc-200" : textClass,
                              cell.isRequested && !heatmapActive && "ring-2 ring-inset ring-emerald-500",
                              isDragOver && !isDragging && "ring-2 ring-inset ring-blue-400 brightness-110",
                              isDraggingThis && "opacity-50"
                            )}
                            style={streakStyle}
                            data-testid={`staff-cell-${ri}-${dayDate}`}
                          >
                            {config.shiftNames[si]}
                            {streakLabel && (
                              <span className="absolute top-0 right-0 text-[7px] leading-none font-bold text-red-600 dark:text-red-400 opacity-70">
                                {streakLabel}
                              </span>
                            )}
                          </td>
                        );
                      }

                      return (
                        <td
                          key={ci}
                          className={cn(
                            "p-0 text-center border-r relative",
                            isDragOver && !isDragging && "ring-2 ring-inset ring-blue-400 bg-blue-50 dark:bg-blue-900/20"
                          )}
                          style={streakStyle}
                          onDragOver={editable ? (e) => handleDragOver(e, ri, dayDate) : undefined}
                          onDragLeave={editable ? handleDragLeave : undefined}
                          onDrop={editable ? (e) => handleDrop(e, ri, dayDate) : undefined}
                          data-testid={`staff-cell-${ri}-${dayDate}`}
                        >
                          <div className="flex flex-col gap-px">
                            {cell.matchedShifts.map((si) => {
                              const bgClass = SHIFT_BG_COLORS[si % SHIFT_BG_COLORS.length];
                              const textClass = SHIFT_TEXT_COLORS[si % SHIFT_TEXT_COLORS.length];
                              const shiftKey = `${ri}-${dayDate}-${si}`;
                              const isDraggingThis = draggingShiftKey === shiftKey;
                              return (
                                <span
                                  key={si}
                                  draggable={editable}
                                  onDragStart={editable ? (e) => { e.stopPropagation(); handleDragStart(e, row.id, dayDate, [si], ri); } : undefined}
                                  onDragEnd={editable ? handleDragEnd : undefined}
                                  className={cn(
                                    "block px-0.5 py-px text-[10px] font-medium leading-tight rounded-sm",
                                    editable && "cursor-grab active:cursor-grabbing",
                                    !heatmapActive && bgClass,
                                    heatmapActive ? "text-zinc-800 dark:text-zinc-200" : textClass,
                                    cell.isRequested && !heatmapActive && "ring-1 ring-emerald-500",
                                    isDraggingThis && "opacity-50"
                                  )}
                                >
                                  {config.shiftNames[si]}
                                </span>
                              );
                            })}
                          </div>
                          {streakLabel && (
                            <span className="absolute top-0 right-0 text-[7px] leading-none font-bold text-red-600 dark:text-red-400 opacity-70">
                              {streakLabel}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {row.shiftTotals.map((total, si) => (
                      <td key={`st-${si}`} className="p-1 text-center border-r font-medium">{total}</td>
                    ))}
                    <td className="p-1 text-center font-bold border-r bg-slate-50 dark:bg-slate-900/50">{row.grandTotal}</td>
                    <td className="p-1 text-center font-bold bg-amber-50 dark:bg-amber-900/20">{row.totalHours}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={999} className="p-1" /></tr>
                {config.shiftNames.map((shiftName, shiftIdx) => {
                  const shiftBg = SHIFT_BG_COLORS[shiftIdx % SHIFT_BG_COLORS.length];
                  const shiftText = SHIFT_TEXT_COLORS[shiftIdx % SHIFT_TEXT_COLORS.length];
                  const st = shiftTotalPerDay[shiftIdx];
                  const minReq = config.staffPerShift[shiftIdx] || 0;
                  const levelRowsForShift = levelCounts?.filter(lc => lc && lc.shiftIdx === shiftIdx) || [];

                  return (
                    <Fragment key={`group-${shiftIdx}`}>
                      {levelRowsForShift.map((lc, lci) => {
                        if (!lc) return null;
                        return (
                          <tr key={`lc-${shiftIdx}-${lci}`} className="border-t">
                            <td className="sticky left-0 z-10 bg-white dark:bg-zinc-900 p-1 font-medium border-r whitespace-nowrap">
                              <span className={cn("inline-block px-1 rounded text-[10px]", shiftBg)}>
                                {shiftName}
                              </span>
                              {" "}
                              <span className="text-muted-foreground">{lc.levelName} ≥{lc.minReq}</span>
                            </td>
                            {hasLevels && <td className="sticky z-10 bg-white dark:bg-zinc-900 border-r" style={{ left: "140px" }} />}
                            {lc.perDay.map((pd, di) => (
                              <td
                                key={di}
                                className={cn(
                                  "p-0.5 text-center border-r font-medium text-[10px]",
                                  pd.met ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                                )}
                              >
                                {pd.count}
                              </td>
                            ))}
                            <td colSpan={S + 1} className="border-r" />
                          </tr>
                        );
                      })}
                      <tr className="border-t">
                        <td className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/50 p-1 font-bold border-r whitespace-nowrap">
                          <span className={cn("inline-block px-1.5 py-0.5 rounded text-[10px]", shiftBg, shiftText)}>
                            {shiftName}
                          </span>
                          {" "}
                          <span className="text-muted-foreground">{t.shiftTotalLabel}</span>
                        </td>
                        {hasLevels && <td className="sticky z-10 bg-slate-50 dark:bg-slate-800/50 border-r" style={{ left: "140px" }} />}
                        {st.perDay.map((count, di) => {
                          const met = minReq > 0 ? count >= minReq : true;
                          return (
                            <td
                              key={di}
                              className={cn(
                                "p-0.5 text-center border-r font-bold text-[10px]",
                                met ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                              )}
                            >
                              {count}
                            </td>
                          );
                        })}
                        <td colSpan={S} className="border-r" />
                        <td className="p-0.5 text-center font-bold text-[10px] bg-slate-100 dark:bg-slate-700">{st.perDay.reduce((a, b) => a + b, 0)}</td>
                      </tr>
                      {shiftIdx < config.shiftNames.length - 1 && (
                        <tr><td colSpan={999} className="p-0.5" /></tr>
                      )}
                    </Fragment>
                  );
                })}
              </tfoot>
            </table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>

      <Dialog open={!!pendingMove} onOpenChange={(open) => !open && handleCancelPending()}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-confirm-move">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {t.editorConfirmViolation}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2">
                {pendingMove && (
                  <p className="text-sm">
                    {pendingMove.staffName} → {pendingMove.toStaffName}
                    {" · "}
                    {pendingMove.shiftIndices.map(si => config.shiftNames[si]).join("/")}
                  </p>
                )}
                <ul className="space-y-1">
                  {pendingMove?.warningMessages.map((msg, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      {msg}
                    </li>
                  ))}
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleCancelPending} data-testid="button-cancel-move">
              {t.editorCancelAssign}
            </Button>
            <Button variant="destructive" onClick={handleConfirmPending} data-testid="button-confirm-move">
              {t.editorConfirmAssign}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
