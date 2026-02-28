import { useMemo } from "react";
import { format, addDays, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
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
}

export function StaffScheduleView({ schedule, config, staff, month, year }: StaffScheduleViewProps) {
  const { t, lang } = useLanguage();
  const hasLevels = !!(config.staffLevels && config.staffLevels.length > 0);

  const isCustomRange = config.useCustomRange && config.customStartDate;
  const baseDate = isCustomRange
    ? parseISO(config.customStartDate!)
    : new Date(year, month - 1, 1);

  const getDateForIndex = (dayIndex: number): Date => {
    if (isCustomRange) return addDays(parseISO(config.customStartDate!), dayIndex - 1);
    return new Date(year, month - 1, dayIndex);
  };

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
  }, [schedule, lang, holidays]);

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

        const cellText = matchedShifts.map(si => config.shiftNames[si]).join("/");

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
          text: cellText,
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
    if (!hasLevels || !config.minStaffPerLevel) return null;

    return config.shiftNames.map((shiftName, shiftIdx) => {
      const shiftColor = SHIFT_COLORS[shiftIdx % SHIFT_COLORS.length];

      const levelRows = config.staffLevels!.map((lvlName, lvlIdx) => {
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
      });

      const totalRow = schedule.map(day => {
        return (day.shifts[shiftIdx] || []).filter(id => id && String(id).length > 0).length;
      });

      return { shiftName, shiftColor, levelRows, totalRow };
    });
  }, [schedule, config, staff, hasLevels]);

  const stickyColWidth = hasLevels ? "w-[180px]" : "w-[160px]";
  const levelColWidth = "w-[80px]";

  return (
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
                  <th className={cn("sticky z-30 bg-muted/95 text-left p-1.5 border-b border-r font-bold", levelColWidth)} style={{ left: hasLevels ? "180px" : undefined }}>
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
                  {s.dayCells.map((cell, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        "text-center p-0.5 border-b border-r min-w-[52px]",
                        dateColumns[ci]?.isHoliday && !cell.bgColor && "bg-purple-50/50 dark:bg-purple-900/10"
                      )}
                      style={cell.bgColor ? {
                        backgroundColor: cell.isBlocked ? "#FF4444" : `#${cell.bgColor}`,
                        color: cell.isBlocked ? "#FFFFFF" : undefined,
                      } : undefined}
                    >
                      <div className={cn(
                        "text-[10px] leading-tight",
                        cell.hasRequested && cell.text && "ring-2 ring-emerald-500 rounded px-0.5"
                      )}>
                        {cell.text}
                      </div>
                    </td>
                  ))}
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

          {shiftSummary && (
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
                      <td className={cn("sticky left-0 z-10 p-1 border-b border-r bg-white dark:bg-zinc-900", stickyColWidth)}></td>
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
  );
}
