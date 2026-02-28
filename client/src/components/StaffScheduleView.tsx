import { useState, useMemo, useCallback } from "react";
import { format, addDays, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import type { DaySchedule, SchedulerConfig, StaffMember } from "@shared/schema";

const SHIFT_COLORS = [
  "B3D9FF", "B3FFB3", "D9B3FF", "FFE0B3", "FFB3B3",
];

function blendHex(c1: string, c2: string): string {
  const r = Math.round((parseInt(c1.slice(0, 2), 16) + parseInt(c2.slice(0, 2), 16)) / 2);
  const g = Math.round((parseInt(c1.slice(2, 4), 16) + parseInt(c2.slice(2, 4), 16)) / 2);
  const b = Math.round((parseInt(c1.slice(4, 6), 16) + parseInt(c2.slice(4, 6), 16)) / 2);
  return r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");
}

interface StaffScheduleViewProps {
  schedule: DaySchedule[];
  config: SchedulerConfig;
  staff: StaffMember[];
  month: number;
  year: number;
  onScheduleChange?: (updatedSchedule: DaySchedule[]) => void;
}

interface DragData {
  staffId: string;
  dayDate: number;
  shiftIdx: number;
}

interface PendingAssignment {
  staffId: string;
  targetStaffId: string;
  dayDate: number;
  shiftIdx: number;
  warnings: string[];
  warningMessages: string[];
}

function validateAssignment(
  staffId: string,
  dayDate: number,
  shiftIdx: number,
  schedule: DaySchedule[],
  config: SchedulerConfig,
  staff: StaffMember[],
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

  return warnings;
}

export function StaffScheduleView({ schedule, config, staff, month, year, onScheduleChange }: StaffScheduleViewProps) {
  const { t, lang } = useLanguage();
  const hasLevels = !!(config.staffLevels && config.staffLevels.length > 0);
  const canEdit = !!onScheduleChange;

  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [draggingFrom, setDraggingFrom] = useState<string | null>(null);
  const [pendingAssignment, setPendingAssignment] = useState<PendingAssignment | null>(null);

  const isCustomRange = config.useCustomRange && config.customStartDate;

  const getDateForIndex = useCallback((dayIndex: number): Date => {
    if (isCustomRange) return addDays(parseISO(config.customStartDate!), dayIndex - 1);
    return new Date(year, month - 1, dayIndex);
  }, [isCustomRange, config.customStartDate, year, month]);

  const holidays = useMemo(() => new Set(config.holidays || []), [config.holidays]);

  const dateColumns = useMemo(() => {
    return schedule.map(day => {
      const date = getDateForIndex(day.date);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = holidays.has(day.date);
      return {
        date: day.date,
        label: format(date, "d MMM", { locale: lang === "th" ? th : undefined }),
        dayLabel: format(date, "EEE", { locale: lang === "th" ? th : undefined }),
        isHoliday: isWeekend || isHoliday,
      };
    });
  }, [schedule, lang, holidays, getDateForIndex]);

  const staffData = useMemo(() => {
    return staff.map(s => {
      const levelLabel = hasLevels ? (config.staffLevels![(s.level ?? 0)] || "") : "";
      let grandTotal = 0;
      const shiftTotals = config.shiftNames.map(() => 0);

      const dayCells = schedule.map(day => {
        const matchedShifts: number[] = [];
        config.shiftNames.forEach((_, shiftIdx) => {
          const assigned = (day.shifts[shiftIdx] || []).map(String);
          if (assigned.includes(s.id)) {
            matchedShifts.push(shiftIdx);
            shiftTotals[shiftIdx]++;
            grandTotal++;
          }
        });

        const hasFullDayBlock = s.blocked.some(b => b.date === day.date && b.shift === -1);
        const allShiftsBlocked = hasFullDayBlock || config.shiftNames.every((_, shiftIdx) =>
          s.blocked.some(b => b.date === day.date && b.shift === shiftIdx)
        );
        const hasRequested = (s.requested || []).some(r => r.date === day.date && matchedShifts.includes(r.shift));

        let bgColor: string | null = null;
        if (allShiftsBlocked) {
          bgColor = "FF4444";
        } else if (matchedShifts.length === 1) {
          bgColor = SHIFT_COLORS[matchedShifts[0] % SHIFT_COLORS.length];
        } else if (matchedShifts.length > 1) {
          bgColor = matchedShifts.reduce((acc, si) => blendHex(acc, SHIFT_COLORS[si % SHIFT_COLORS.length]), SHIFT_COLORS[matchedShifts[0] % SHIFT_COLORS.length]);
        }

        return {
          dayDate: day.date,
          text: matchedShifts.map(si => config.shiftNames[si]).join("/"),
          bgColor,
          isBlocked: allShiftsBlocked,
          hasRequested,
          shiftIndices: matchedShifts,
        };
      });

      return {
        id: s.id,
        name: s.name,
        level: levelLabel,
        dayCells,
        shiftTotals,
        grandTotal,
      };
    });
  }, [staff, schedule, config, hasLevels]);

  const shiftSummary = useMemo(() => {
    return config.shiftNames.map((shiftName, shiftIdx) => {
      const shiftColor = SHIFT_COLORS[shiftIdx % SHIFT_COLORS.length];

      const levelRows = hasLevels && config.staffLevels && config.minStaffPerLevel
        ? config.staffLevels.map((lvlName, lvlIdx) => {
            const minReq = config.minStaffPerLevel?.[shiftIdx]?.[lvlIdx] ?? 0;
            const displayName = minReq > 0 ? `${lvlName} >=${minReq}` : lvlName;

            const dayCounts = schedule.map(day => {
              const assignedIds = (day.shifts[shiftIdx] || []).map(String);
              return assignedIds.filter(id => {
                const member = staff.find(s => s.id === id);
                return member && (member.level ?? 0) === lvlIdx;
              }).length;
            });

            return { displayName, minReq, dayCounts };
          })
        : [];

      const totalRow = schedule.map(day => {
        return (day.shifts[shiftIdx] || []).filter(id => id && String(id).length > 0).length;
      });

      return { shiftName, shiftColor, levelRows, totalRow };
    });
  }, [schedule, config, staff, hasLevels]);

  const getStaffName = useCallback(
    (id: string) => staff.find(s => s.id === id)?.name || "Unknown",
    [staff]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, staffId: string, dayDate: number, shiftIdx: number) => {
      const dragData: DragData = { staffId, dayDate, shiftIdx };
      e.dataTransfer.setData("application/json", JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = "move";
      setDraggingFrom(`${staffId}-${dayDate}-${shiftIdx}`);
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDragOverTarget(null);
    setDraggingFrom(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetStaffId: string, dayDate: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverTarget(`${targetStaffId}-${dayDate}`);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDragOverTarget(null);
  }, []);

  const applyMove = useCallback(
    (sourceStaffId: string, targetStaffId: string, dayDate: number, shiftIdx: number) => {
      if (!onScheduleChange) return;

      const newSchedule = schedule.map(day => ({
        ...day,
        shifts: day.shifts.map(shift => [...shift]),
      }));

      const dayEntry = newSchedule.find(d => d.date === dayDate);
      if (!dayEntry) return;

      dayEntry.shifts[shiftIdx] = dayEntry.shifts[shiftIdx].filter(id => id !== sourceStaffId);
      dayEntry.shifts[shiftIdx] = [...dayEntry.shifts[shiftIdx], targetStaffId];

      onScheduleChange(newSchedule);
    },
    [schedule, onScheduleChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetStaffId: string, dayDate: number) => {
      e.preventDefault();
      setDragOverTarget(null);
      setDraggingFrom(null);

      if (!onScheduleChange) return;

      let dragData: DragData;
      try {
        dragData = JSON.parse(e.dataTransfer.getData("application/json"));
      } catch {
        return;
      }

      if (dragData.dayDate !== dayDate) return;
      if (dragData.staffId === targetStaffId) return;

      const targetDay = schedule.find(d => d.date === dayDate);
      if (targetDay && targetDay.shifts[dragData.shiftIdx]?.includes(targetStaffId)) {
        return;
      }

      const scheduleAfterRemove = schedule.map(day => {
        if (day.date !== dayDate) return day;
        return {
          ...day,
          shifts: day.shifts.map((shift, si) =>
            si === dragData.shiftIdx ? shift.filter(id => id !== dragData.staffId) : shift
          ),
        };
      });

      const warnings = validateAssignment(
        targetStaffId,
        dayDate,
        dragData.shiftIdx,
        scheduleAfterRemove,
        config,
        staff,
      );

      if (warnings.length > 0) {
        const warningMessages = warnings.map(w => {
          switch (w) {
            case "blocked": return t.editorBlockedDate;
            case "consecutiveSameDay":
            case "consecutiveNextDay": return t.editorConsecutiveViolation;
            case "maxShifts": return t.editorMaxShiftsReached;
            case "alreadyAssigned": return t.editorAlreadyAssigned;
            default: return w;
          }
        });

        setPendingAssignment({
          staffId: dragData.staffId,
          targetStaffId,
          dayDate,
          shiftIdx: dragData.shiftIdx,
          warnings,
          warningMessages,
        });
        return;
      }

      applyMove(dragData.staffId, targetStaffId, dayDate, dragData.shiftIdx);
    },
    [schedule, config, staff, t, applyMove, onScheduleChange]
  );

  const handleConfirmPending = useCallback(() => {
    if (!pendingAssignment) return;
    applyMove(
      pendingAssignment.staffId,
      pendingAssignment.targetStaffId,
      pendingAssignment.dayDate,
      pendingAssignment.shiftIdx
    );
    setPendingAssignment(null);
  }, [pendingAssignment, applyMove]);

  const handleCancelPending = useCallback(() => {
    setPendingAssignment(null);
  }, []);

  const stickyColWidth = hasLevels ? "w-[180px]" : "w-[160px]";
  const levelColWidth = "w-[80px]";

  return (
    <>
      <Card className="border shadow-lg overflow-hidden bg-white dark:bg-zinc-900" data-testid="staff-schedule-view">
        <ScrollArea className="h-[calc(100vh-200px)] w-full">
          <div className="min-w-max">
            <table className="text-xs border-collapse w-full">
              <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur">
                <tr>
                  <th className={cn("sticky left-0 z-30 bg-muted/95 text-left p-1.5 border-b border-r font-bold", stickyColWidth)}>
                    {t.staffName}
                  </th>
                  {hasLevels && (
                    <th className={cn("sticky z-30 bg-muted/95 text-left p-1.5 border-b border-r font-bold", levelColWidth)} style={{ left: "180px" }}>
                      {t.level}
                    </th>
                  )}
                  {dateColumns.map((col, i) => (
                    <th
                      key={i}
                      className={cn(
                        "text-center p-1 border-b border-r min-w-[52px] font-medium",
                        col.isHoliday && "bg-purple-100/80 dark:bg-purple-900/30"
                      )}
                    >
                      <div>{col.label}</div>
                      <div className="text-[9px] text-muted-foreground font-normal">{col.dayLabel}</div>
                    </th>
                  ))}
                  {config.shiftNames.map((name, i) => (
                    <th
                      key={`shift-${i}`}
                      className="text-center p-1.5 border-b border-r min-w-[44px] font-bold"
                      style={{ backgroundColor: `#${SHIFT_COLORS[i % SHIFT_COLORS.length]}` }}
                    >
                      {name}
                    </th>
                  ))}
                  <th className="text-center p-1.5 border-b font-bold min-w-[40px] bg-gray-200 dark:bg-gray-700">
                    {t.totalLabel}
                  </th>
                </tr>
              </thead>
              <tbody>
                {staffData.map((s, rowIdx) => (
                  <tr
                    key={s.id}
                    className={cn(
                      "hover:bg-muted/30 transition-colors",
                      rowIdx % 2 === 1 && "bg-muted/10"
                    )}
                    data-testid={`staff-view-row-${s.id}`}
                  >
                    <td className={cn("sticky left-0 z-10 p-1.5 border-b border-r font-medium whitespace-nowrap", stickyColWidth, rowIdx % 2 === 1 ? "bg-gray-50 dark:bg-zinc-800/50" : "bg-white dark:bg-zinc-900")}>
                      {s.name}
                    </td>
                    {hasLevels && (
                      <td className={cn("sticky z-10 p-1.5 border-b border-r text-muted-foreground whitespace-nowrap", levelColWidth, rowIdx % 2 === 1 ? "bg-gray-50 dark:bg-zinc-800/50" : "bg-white dark:bg-zinc-900")} style={{ left: "180px" }}>
                        {s.level}
                      </td>
                    )}
                    {s.dayCells.map((cell, ci) => {
                      const cellDropKey = `${s.id}-${cell.dayDate}`;
                      const isDragOver = dragOverTarget === cellDropKey;
                      const isSourceCell = cell.shiftIndices.some(
                        si => draggingFrom === `${s.id}-${cell.dayDate}-${si}`
                      );

                      return (
                        <td
                          key={ci}
                          className={cn(
                            "text-center p-0.5 border-b border-r min-w-[52px] transition-colors",
                            dateColumns[ci]?.isHoliday && !cell.bgColor && "bg-purple-50/50 dark:bg-purple-900/10",
                            isDragOver && canEdit && "ring-2 ring-blue-400 ring-inset bg-blue-50 dark:bg-blue-900/30",
                          )}
                          style={cell.bgColor && !isDragOver ? {
                            backgroundColor: cell.isBlocked ? "#FF4444" : `#${cell.bgColor}`,
                            color: cell.isBlocked ? "#FFFFFF" : undefined,
                          } : undefined}
                          onDragOver={canEdit && !cell.isBlocked ? (e) => handleDragOver(e, s.id, cell.dayDate) : undefined}
                          onDragLeave={canEdit ? handleDragLeave : undefined}
                          onDrop={canEdit && !cell.isBlocked ? (e) => handleDrop(e, s.id, cell.dayDate) : undefined}
                          data-testid={`staff-cell-${s.id}-${cell.dayDate}`}
                        >
                          <div className={cn(
                            "text-[10px] leading-tight flex flex-wrap justify-center gap-0.5",
                            cell.hasRequested && cell.text && "ring-2 ring-emerald-500 rounded px-0.5"
                          )}>
                            {cell.shiftIndices.length > 0 ? (
                              cell.shiftIndices.map(si => (
                                <span
                                  key={si}
                                  draggable={canEdit}
                                  onDragStart={canEdit ? (e) => {
                                    e.stopPropagation();
                                    handleDragStart(e, s.id, cell.dayDate, si);
                                  } : undefined}
                                  onDragEnd={canEdit ? handleDragEnd : undefined}
                                  className={cn(
                                    canEdit && "cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/50 rounded px-0.5",
                                    isSourceCell && draggingFrom === `${s.id}-${cell.dayDate}-${si}` && "opacity-40"
                                  )}
                                  style={{
                                    backgroundColor: `#${SHIFT_COLORS[si % SHIFT_COLORS.length]}`,
                                    borderRadius: "2px",
                                    padding: "0 3px",
                                  }}
                                  data-testid={`drag-shift-${s.id}-${cell.dayDate}-${si}`}
                                >
                                  {config.shiftNames[si]}
                                </span>
                              ))
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                    {s.shiftTotals.map((count, si) => (
                      <td key={`st-${si}`} className="text-center p-1 border-b border-r font-medium">
                        {count}
                      </td>
                    ))}
                    <td className="text-center p-1 border-b font-bold bg-gray-50 dark:bg-zinc-800/50">
                      {s.grandTotal}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {shiftSummary.length > 0 && (
              <div className="mt-2">
                {shiftSummary.map((shift, shiftIdx) => (
                  <table key={shiftIdx} className="text-xs border-collapse w-full mb-1">
                    <tbody>
                      <tr style={{ backgroundColor: `#${shift.shiftColor}` }}>
                        <td className={cn("sticky left-0 z-10 p-1.5 font-bold text-sm", stickyColWidth)} style={{ backgroundColor: `#${shift.shiftColor}` }}>
                          {shift.shiftName}
                        </td>
                        {hasLevels && (
                          <td className={cn(levelColWidth)} style={{ left: "180px", backgroundColor: `#${shift.shiftColor}` }}></td>
                        )}
                        {dateColumns.map((_, di) => (
                          <td key={di} className="min-w-[52px]" style={{ backgroundColor: `#${shift.shiftColor}` }}></td>
                        ))}
                        {config.shiftNames.map((_, si) => (
                          <td key={si} className="min-w-[44px]" style={{ backgroundColor: `#${shift.shiftColor}` }}></td>
                        ))}
                        <td className="min-w-[40px]" style={{ backgroundColor: `#${shift.shiftColor}` }}></td>
                      </tr>

                      {shift.levelRows.map((lvl, lvlIdx) => (
                        <tr key={lvlIdx}>
                          <td className={cn("sticky left-0 z-10 p-1 border-b border-r bg-white dark:bg-zinc-900", stickyColWidth)}></td>
                          {hasLevels && (
                            <td className={cn("sticky z-10 p-1 border-b border-r font-semibold text-[10px] whitespace-nowrap bg-white dark:bg-zinc-900", levelColWidth)} style={{ left: "180px" }}>
                              {lvl.displayName}
                            </td>
                          )}
                          {lvl.dayCounts.map((count, di) => (
                            <td
                              key={di}
                              className={cn(
                                "text-center p-0.5 border-b border-r min-w-[52px] font-semibold",
                                dateColumns[di]?.isHoliday && "bg-purple-50/50 dark:bg-purple-900/10"
                              )}
                              style={
                                lvl.minReq > 0 && count < lvl.minReq
                                  ? { color: "#FF0000", fontWeight: "bold" }
                                  : count > 0
                                    ? { backgroundColor: "#E8F5E9", fontWeight: "bold" }
                                    : undefined
                              }
                            >
                              {count}
                            </td>
                          ))}
                          {config.shiftNames.map((_, si) => (
                            <td key={si} className="min-w-[44px] border-b border-r"></td>
                          ))}
                          <td className="min-w-[40px] border-b"></td>
                        </tr>
                      ))}

                      <tr>
                        <td className={cn("sticky left-0 z-10 p-1 border-b border-r font-bold text-[10px] bg-white dark:bg-zinc-900 text-right", stickyColWidth)}>
                          {!hasLevels && t.totalLabel}
                        </td>
                        {hasLevels && (
                          <td className={cn("sticky z-10 p-1 border-b border-r font-bold text-[10px] bg-white dark:bg-zinc-900", levelColWidth)} style={{ left: "180px" }}>
                            {t.totalLabel}
                          </td>
                        )}
                        {shift.totalRow.map((count, di) => (
                          <td
                            key={di}
                            className="text-center p-0.5 border-b border-r min-w-[52px] font-bold"
                            style={{ backgroundColor: `#${shift.shiftColor}` }}
                          >
                            {count}
                          </td>
                        ))}
                        {config.shiftNames.map((_, si) => (
                          <td key={si} className="min-w-[44px] border-b border-r" style={{ backgroundColor: `#${shift.shiftColor}` }}></td>
                        ))}
                        <td className="min-w-[40px] border-b" style={{ backgroundColor: `#${shift.shiftColor}` }}></td>
                      </tr>
                    </tbody>
                  </table>
                ))}
              </div>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>

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
              <div className="text-sm">
                <span className="font-medium">{config.shiftNames[pendingAssignment.shiftIdx]}</span>
                <span className="text-muted-foreground mx-1">→</span>
                <span className="font-medium">{getStaffName(pendingAssignment.targetStaffId)}</span>
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
                <Button variant="outline" onClick={handleCancelPending} data-testid="button-cancel-staff-violation">
                  {t.editorCancelAssign}
                </Button>
                <Button variant="destructive" onClick={handleConfirmPending} data-testid="button-confirm-staff-violation">
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
