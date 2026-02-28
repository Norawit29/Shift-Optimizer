import { useState, useCallback, useMemo, useRef } from "react";
import { type DaySchedule, type SchedulerConfig, type StaffMember, type StaffMetrics } from "@shared/schema";
import { format, setDate, parseISO, addDays } from "date-fns";
import { Card } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { X, PanelRightClose, PanelRightOpen, GripVertical, AlertTriangle } from "lucide-react";

interface ScheduleEditorProps {
  schedule: DaySchedule[];
  config: SchedulerConfig;
  staff: StaffMember[];
  month: number;
  year: number;
  onScheduleChange: (updatedSchedule: DaySchedule[]) => void;
}

interface DragData {
  staffId: string;
  sourceDayIndex?: number;
  sourceShiftIndex?: number;
}

interface PendingAssignment {
  staffId: string;
  targetDayDate: number;
  targetShiftIdx: number;
  sourceDayIndex?: number;
  sourceShiftIndex?: number;
  warnings: string[];
  warningMessages: string[];
}

function computeStaffMetrics(
  schedule: DaySchedule[],
  staff: StaffMember[],
  config: SchedulerConfig,
  month: number,
  year: number
): StaffMetrics[] {
  const isCustomRange = config.useCustomRange && config.customStartDate;
  const baseDate = isCustomRange
    ? parseISO(config.customStartDate!)
    : new Date(year, month - 1, 1);
  const holidays = new Set(config.holidays || []);

  const getDateForIndex = (dayIndex: number): Date => {
    if (isCustomRange) {
      return addDays(parseISO(config.customStartDate!), dayIndex - 1);
    }
    return setDate(baseDate, dayIndex);
  };

  return staff.map((s) => {
    const byShift = new Array(config.shiftsPerDay).fill(0);
    const weekdayByShift = new Array(config.shiftsPerDay).fill(0);
    const holidayByShift = new Array(config.shiftsPerDay).fill(0);
    let total = 0;
    let weekdayTotal = 0;
    let holidayTotal = 0;

    for (const day of schedule) {
      const currentDate = getDateForIndex(day.date);
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      const isHoliday = holidays.has(day.date);
      const isDayHoliday = isWeekend || isHoliday;

      for (let si = 0; si < day.shifts.length; si++) {
        if (day.shifts[si].includes(s.id)) {
          byShift[si]++;
          total++;
          if (isDayHoliday) {
            holidayByShift[si]++;
            holidayTotal++;
          } else {
            weekdayByShift[si]++;
            weekdayTotal++;
          }
        }
      }
    }

    return {
      id: s.id,
      name: s.name,
      total,
      weekdayTotal,
      holidayTotal,
      byShift,
      weekdayByShift,
      holidayByShift,
    };
  });
}

function validateAssignment(
  staffId: string,
  dayDate: number,
  shiftIdx: number,
  schedule: DaySchedule[],
  config: SchedulerConfig,
  staff: StaffMember[],
  _month: number,
  _year: number
): string[] {
  const warnings: string[] = [];
  const member = staff.find((s) => s.id === staffId);
  if (!member) return warnings;

  const isBlocked = member.blocked.some(
    (b) => b.date === dayDate && (b.shift === -1 || b.shift === shiftIdx)
  );
  if (isBlocked) {
    warnings.push("blocked");
  }

  const daySchedule = schedule.find((d) => d.date === dayDate);
  if (daySchedule) {
    for (let si = 0; si < daySchedule.shifts.length; si++) {
      if (si !== shiftIdx && daySchedule.shifts[si].includes(staffId)) {
        const rules = config.consecutiveRules || [];
        const sameDayRule = rules.find(
          (r) => r.type === "sameDay" && ((r.from === si && r.to === shiftIdx) || (r.from === shiftIdx && r.to === si))
        );
        if (sameDayRule) {
          warnings.push("consecutiveSameDay");
        } else {
          warnings.push("alreadyAssigned");
        }
      }
    }
  }

  const prevDay = schedule.find((d) => d.date === dayDate - 1);
  if (prevDay) {
    for (let si = 0; si < prevDay.shifts.length; si++) {
      if (prevDay.shifts[si].includes(staffId)) {
        const nextDayRules = config.consecutiveRules || [];
        const rule = nextDayRules.find(
          (r) => (!r.type || r.type === "nextDay") && r.from === si && r.to === shiftIdx
        );
        if (rule) {
          warnings.push("consecutiveNextDay");
        }
      }
    }
  }

  const nextDay = schedule.find((d) => d.date === dayDate + 1);
  if (nextDay) {
    for (let si = 0; si < nextDay.shifts.length; si++) {
      if (nextDay.shifts[si].includes(staffId)) {
        const fwdRules = config.consecutiveRules || [];
        const rule = fwdRules.find(
          (r) => (!r.type || r.type === "nextDay") && r.from === shiftIdx && r.to === si
        );
        if (rule) {
          warnings.push("consecutiveNextDay");
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
  if (totalShifts >= member.maxShifts) {
    warnings.push("maxShifts");
  }

  const sortedDays = [...schedule].sort((a, b) => a.date - b.date);
  const dayIdx = sortedDays.findIndex(d => d.date === dayDate);
  if (dayIdx >= 0) {
    let consecWork = 1;
    for (let i = dayIdx - 1; i >= 0; i--) {
      if (sortedDays[i].shifts.some(sh => sh.includes(staffId))) consecWork++;
      else break;
    }
    for (let i = dayIdx + 1; i < sortedDays.length; i++) {
      if (sortedDays[i].shifts.some(sh => sh.includes(staffId))) consecWork++;
      else break;
    }
    if (consecWork > 7) {
      warnings.push("maxConsecWorkDays");
    }
  }

  return warnings;
}

export function ScheduleEditor({
  schedule,
  config,
  staff,
  month,
  year,
  onScheduleChange,
}: ScheduleEditorProps) {
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [draggingStaffId, setDraggingStaffId] = useState<string | null>(null);
  const [pendingAssignment, setPendingAssignment] = useState<PendingAssignment | null>(null);

  const getStaffName = useCallback(
    (id: string) => staff.find((s) => s.id === id)?.name || "Unknown",
    [staff]
  );

  const getStaffLevel = useCallback(
    (id: string): string | null => {
      if (!config.staffLevels || config.staffLevels.length === 0) return null;
      const member = staff.find((s) => s.id === id);
      if (!member) return null;
      return config.staffLevels[member.level ?? 0] || config.staffLevels[0] || null;
    },
    [staff, config.staffLevels]
  );

  const isCustomRange = config.useCustomRange && config.customStartDate;
  const baseDate = isCustomRange
    ? parseISO(config.customStartDate!)
    : new Date(year, month - 1, 1);
  const holidays = new Set(config.holidays || []);

  const getDateForIndex = useCallback(
    (dayIndex: number): Date => {
      if (isCustomRange) {
        return addDays(parseISO(config.customStartDate!), dayIndex - 1);
      }
      return setDate(baseDate, dayIndex);
    },
    [isCustomRange, config.customStartDate, baseDate]
  );

  const staffMetrics = useMemo(
    () => computeStaffMetrics(schedule, staff, config, month, year),
    [schedule, staff, config, month, year]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, staffId: string, dayIndex?: number, shiftIndex?: number) => {
      const dragData: DragData = { staffId, sourceDayIndex: dayIndex, sourceShiftIndex: shiftIndex };
      e.dataTransfer.setData("application/json", JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = "move";
      setDraggingStaffId(staffId);
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDragOverTarget(null);
    setDraggingStaffId(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, dayDate: number, shiftIdx: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverTarget(`${dayDate}-${shiftIdx}`);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDragOverTarget(null);
  }, []);

  const applyAssignment = useCallback(
    (
      staffId: string,
      targetDayDate: number,
      targetShiftIdx: number,
      sourceDayIndex?: number,
      sourceShiftIndex?: number
    ) => {
      const newSchedule = schedule.map((day) => ({
        ...day,
        shifts: day.shifts.map((shift) => [...shift]),
      }));

      if (sourceDayIndex !== undefined && sourceShiftIndex !== undefined) {
        const sourceDay = newSchedule.find((d) => d.date === sourceDayIndex);
        if (sourceDay) {
          sourceDay.shifts[sourceShiftIndex] = sourceDay.shifts[sourceShiftIndex].filter(
            (id) => id !== staffId
          );
        }
      }

      const dropDay = newSchedule.find((d) => d.date === targetDayDate);
      if (dropDay) {
        dropDay.shifts[targetShiftIdx] = [...dropDay.shifts[targetShiftIdx], staffId];
      }

      onScheduleChange(newSchedule);
    },
    [schedule, onScheduleChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetDayDate: number, targetShiftIdx: number) => {
      e.preventDefault();
      setDragOverTarget(null);
      setDraggingStaffId(null);

      let dragData: DragData;
      try {
        dragData = JSON.parse(e.dataTransfer.getData("application/json"));
      } catch {
        return;
      }

      const { staffId, sourceDayIndex, sourceShiftIndex } = dragData;

      if (sourceDayIndex === targetDayDate && sourceShiftIndex === targetShiftIdx) {
        return;
      }

      const targetDay = schedule.find((d) => d.date === targetDayDate);
      if (targetDay && targetDay.shifts[targetShiftIdx]?.includes(staffId)) {
        return;
      }

      let scheduleForValidation = schedule;
      if (sourceDayIndex !== undefined && sourceShiftIndex !== undefined) {
        scheduleForValidation = schedule.map((day) => {
          if (day.date !== sourceDayIndex) return day;
          return {
            ...day,
            shifts: day.shifts.map((shift, si) =>
              si === sourceShiftIndex ? shift.filter((id) => id !== staffId) : shift
            ),
          };
        });
      }

      const warnings = validateAssignment(
        staffId,
        targetDayDate,
        targetShiftIdx,
        scheduleForValidation,
        config,
        staff,
        month,
        year
      );

      if (warnings.length > 0) {
        const warningMessages = warnings.map((w) => {
          switch (w) {
            case "blocked": return t.editorBlockedDate;
            case "consecutiveSameDay":
            case "consecutiveNextDay": return t.editorConsecutiveViolation;
            case "maxShifts": return t.editorMaxShiftsReached;
            case "alreadyAssigned": return t.editorAlreadyAssigned;
            case "maxConsecWorkDays": return (t as any).editorMaxConsecWorkDays || "Exceeds 7 consecutive working days";
            default: return w;
          }
        });

        setPendingAssignment({
          staffId,
          targetDayDate,
          targetShiftIdx,
          sourceDayIndex,
          sourceShiftIndex,
          warnings,
          warningMessages,
        });
        return;
      }

      applyAssignment(staffId, targetDayDate, targetShiftIdx, sourceDayIndex, sourceShiftIndex);
    },
    [schedule, config, staff, month, year, t, applyAssignment]
  );

  const handleConfirmPending = useCallback(() => {
    if (!pendingAssignment) return;
    const { staffId, targetDayDate, targetShiftIdx, sourceDayIndex, sourceShiftIndex } = pendingAssignment;
    applyAssignment(staffId, targetDayDate, targetShiftIdx, sourceDayIndex, sourceShiftIndex);
    setPendingAssignment(null);
  }, [pendingAssignment, applyAssignment]);

  const handleCancelPending = useCallback(() => {
    setPendingAssignment(null);
  }, []);

  const handleRemoveStaff = useCallback(
    (dayDate: number, shiftIdx: number, staffId: string) => {
      const newSchedule = schedule.map((day) => ({
        ...day,
        shifts: day.shifts.map((shift) => [...shift]),
      }));

      const day = newSchedule.find((d) => d.date === dayDate);
      if (day) {
        day.shifts[shiftIdx] = day.shifts[shiftIdx].filter((id) => id !== staffId);
      }

      onScheduleChange(newSchedule);
    },
    [schedule, onScheduleChange]
  );

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-3 w-full lg:h-[calc(100vh-140px)]" data-testid="schedule-editor">
        <div className="flex-1 min-w-0 min-h-0">
          <Card className="border shadow-lg overflow-hidden bg-white dark:bg-zinc-900 h-full">
            <ScrollArea className="h-[60vh] lg:h-full w-full rounded-md">
              <div className="min-w-[800px]">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-[100px] font-bold">{t.date}</TableHead>
                      <TableHead className="w-[100px]">{t.day}</TableHead>
                      {config.shiftNames.map((shift, idx) => (
                        <TableHead key={idx} className="text-center font-bold text-primary min-w-[160px]">
                          {shift}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedule.map((day) => {
                      const currentDate = getDateForIndex(day.date);
                      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
                      const isHoliday = holidays.has(day.date);
                      const isDayHoliday = isWeekend || isHoliday;
                      const dayStaffPerShift =
                        config.separateHolidayConfig && config.holidayStaffPerShift && isDayHoliday
                          ? config.holidayStaffPerShift
                          : config.staffPerShift;

                      return (
                        <TableRow
                          key={day.date}
                          className={cn(
                            "hover:bg-muted/30 transition-colors",
                            (isWeekend || isHoliday) && "bg-purple-50/50 dark:bg-purple-900/10",
                            isWeekend && !isHoliday && "bg-slate-50 dark:bg-slate-900/30"
                          )}
                        >
                          <TableCell className="font-medium">
                            {format(currentDate, "MMM d")}
                            {isHoliday && (
                              <Badge
                                variant="secondary"
                                className="ml-1 text-[9px] px-1 py-0 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                              >
                                H
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(currentDate, "EEEE")}
                          </TableCell>
                          {day.shifts.map((assignedStaffIds, shiftIdx) => {
                            const requiredForDay = dayStaffPerShift[shiftIdx] ?? 0;
                            const isShiftDisabled = requiredForDay === 0;
                            const filledIds = assignedStaffIds.filter((id) => id !== "");
                            const cellKey = `${day.date}-${shiftIdx}`;
                            const isDragOver = dragOverTarget === cellKey;

                            return (
                              <TableCell
                                key={shiftIdx}
                                className={cn(
                                  "text-center p-2 transition-colors",
                                  isShiftDisabled && "bg-slate-100/50 dark:bg-slate-800/30",
                                  isDragOver && !isShiftDisabled && "bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400 ring-inset",
                                  filledIds.length < requiredForDay && !isShiftDisabled && "bg-amber-50/50 dark:bg-amber-950/20"
                                )}
                                onDragOver={
                                  isShiftDisabled
                                    ? undefined
                                    : (e) => handleDragOver(e, day.date, shiftIdx)
                                }
                                onDragLeave={isShiftDisabled ? undefined : handleDragLeave}
                                onDrop={
                                  isShiftDisabled
                                    ? undefined
                                    : (e) => handleDrop(e, day.date, shiftIdx)
                                }
                                data-testid={`cell-${day.date}-${shiftIdx}`}
                              >
                                <div className="flex flex-wrap gap-1 justify-center min-h-[28px]">
                                  {isShiftDisabled ? (
                                    <span className="text-xs text-muted-foreground italic">-</span>
                                  ) : (
                                    <>
                                      {filledIds.map((id) => {
                                        const levelLabel = getStaffLevel(id);
                                        return (
                                          <div
                                            key={id}
                                            draggable
                                            onDragStart={(e) =>
                                              handleDragStart(e, id, day.date, shiftIdx)
                                            }
                                            onDragEnd={handleDragEnd}
                                            className={cn(
                                              "group relative cursor-grab active:cursor-grabbing",
                                              draggingStaffId === id && "opacity-50"
                                            )}
                                            data-testid={`badge-staff-${day.date}-${shiftIdx}-${id}`}
                                          >
                                            <Badge
                                              variant="secondary"
                                              className="font-normal bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-100 dark:border-blue-800 pr-5"
                                            >
                                              <GripVertical className="w-3 h-3 mr-0.5 opacity-40" />
                                              {getStaffName(id)}
                                              {levelLabel && (
                                                <span className="ml-1 text-[9px] opacity-60">
                                                  ({levelLabel})
                                                </span>
                                              )}
                                            </Badge>
                                            <button
                                              onClick={() =>
                                                handleRemoveStaff(day.date, shiftIdx, id)
                                              }
                                              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center invisible group-hover:visible transition-opacity"
                                              data-testid={`btn-remove-${day.date}-${shiftIdx}-${id}`}
                                            >
                                              <X className="w-2.5 h-2.5" />
                                            </button>
                                          </div>
                                        );
                                      })}
                                      {filledIds.length < requiredForDay && (
                                        <span
                                          className="text-xs text-amber-600 dark:text-amber-400 italic self-center"
                                          data-testid={`text-needed-${day.date}-${shiftIdx}`}
                                        >
                                          +{requiredForDay - filledIds.length}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </Card>
        </div>

        <div className="shrink-0 flex flex-col lg:h-full">
          {!sidebarOpen && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setSidebarOpen(true)}
              data-testid="button-toggle-staff-panel"
            >
              <PanelRightOpen className="w-4 h-4" />
            </Button>
          )}

          {sidebarOpen && (
            <Card className="w-full lg:min-w-[320px] lg:w-auto lg:max-w-[480px] border shadow-lg bg-white dark:bg-zinc-900 flex flex-col h-[40vh] lg:h-full overflow-hidden" data-testid="staff-panel">
              <div className="p-3 border-b shrink-0 flex items-center justify-between">
                <h3 className="font-semibold text-sm">{t.editorStaffPanel}</h3>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSidebarOpen(false)} data-testid="button-toggle-staff-panel">
                  <PanelRightClose className="w-4 h-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {staff.map((s, idx) => {
                    const metrics = staffMetrics[idx];
                    const ratio = metrics.total / s.maxShifts;
                    const isAtLimit = ratio >= 1;
                    const isNearLimit = ratio >= 0.85 && !isAtLimit;

                    return (
                      <div
                        key={s.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, s.id)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-md cursor-grab active:cursor-grabbing",
                          isAtLimit && "bg-red-50 dark:bg-red-950/30",
                          isNearLimit && "bg-amber-50 dark:bg-amber-950/30"
                        )}
                        data-testid={`staff-panel-item-${s.id}`}
                      >
                        <GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{s.name}</div>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span
                              className={cn(
                                "text-xs",
                                isAtLimit
                                  ? "text-red-600 dark:text-red-400 font-semibold"
                                  : isNearLimit
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-muted-foreground"
                              )}
                            >
                              {metrics.total}/{s.maxShifts}
                            </span>
                            {isAtLimit && (
                              <Badge variant="destructive" className="text-[9px] px-1 py-0">
                                {metrics.total > s.maxShifts ? t.editorOverLimit : t.editorAtLimit}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {config.shiftNames.map((shiftName, si) => (
                            <div
                              key={si}
                              className="text-center px-1"
                              title={shiftName}
                            >
                              <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {shiftName}
                              </div>
                              <div className="text-xs font-medium">{metrics.byShift[si]}</div>
                            </div>
                          ))}
                          <div className="text-center px-1 border-l border-muted">
                            <div className="text-[10px] text-muted-foreground whitespace-nowrap">{t.totalLabel || "รวม"}</div>
                            <div className="text-xs font-bold">{metrics.total}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={pendingAssignment !== null} onOpenChange={(open) => { if (!open) handleCancelPending(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {t.editorConstraintWarning}
            </DialogTitle>
            <DialogDescription>
              {t.editorConfirmViolation}
            </DialogDescription>
          </DialogHeader>
          {pendingAssignment && (
            <div className="space-y-4">
              <div className="text-sm font-medium">
                {getStaffName(pendingAssignment.staffId)}
              </div>
              <ul className="space-y-1">
                {pendingAssignment.warningMessages.map((msg, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-destructive">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                    {msg}
                  </li>
                ))}
              </ul>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={handleCancelPending} data-testid="button-cancel-violation">
                  {t.editorCancelAssign}
                </Button>
                <Button variant="destructive" onClick={handleConfirmPending} data-testid="button-confirm-violation">
                  {t.editorConfirmAssign}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
