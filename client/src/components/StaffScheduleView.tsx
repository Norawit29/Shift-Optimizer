import { useMemo, Fragment } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import type { DaySchedule, SchedulerConfig, StaffMember } from "@shared/schema";
import { format, addDays, parseISO, setDate } from "date-fns";

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

interface StaffScheduleViewProps {
  schedule: DaySchedule[];
  config: SchedulerConfig;
  staff: StaffMember[];
  month: number;
  year: number;
}

export function StaffScheduleView({ schedule, config, staff, month, year }: StaffScheduleViewProps) {
  const { t } = useLanguage();

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
      return { name: s.name, levelLabel, dayCells, shiftTotals, grandTotal };
    });
  }, [staff, schedule, config, S, hasLevels]);

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

  return (
    <Card className="border shadow-lg overflow-hidden bg-white dark:bg-zinc-900" data-testid="staff-schedule-view">
      <div className="flex items-center gap-4 px-4 py-2 border-b bg-slate-50 dark:bg-slate-800/50 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded bg-red-400 dark:bg-red-700" />
          <span className="text-muted-foreground">{t.blockedDateLegend}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded ring-2 ring-emerald-500 bg-blue-200 dark:bg-blue-800/60" />
          <span className="text-muted-foreground">{t.requestedDateLegend}</span>
        </div>
      </div>
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
                <th className="p-1.5 text-center font-bold border-b min-w-[44px] bg-slate-200 dark:bg-slate-700">
                  {t.total}
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
                    const d = getDateForIdx(schedule[ci].date);
                    const dow = d.getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    const isHol = holidays.has(schedule[ci].date);

                    if (cell.isBlocked && cell.matchedShifts.length === 0) {
                      return (
                        <td key={ci} className="p-0.5 text-center border-r bg-red-400 dark:bg-red-700" />
                      );
                    }

                    if (cell.matchedShifts.length === 0) {
                      return (
                        <td key={ci} className={cn("p-0.5 text-center border-r", (isWeekend || isHol) && "bg-purple-50/50 dark:bg-purple-900/10")} />
                      );
                    }

                    const shiftLabel = cell.matchedShifts.map(si => config.shiftNames[si]).join("/");
                    const primaryShift = cell.matchedShifts[0];
                    const bgClass = SHIFT_BG_COLORS[primaryShift % SHIFT_BG_COLORS.length];
                    const textClass = SHIFT_TEXT_COLORS[primaryShift % SHIFT_TEXT_COLORS.length];

                    return (
                      <td
                        key={ci}
                        className={cn(
                          "p-0.5 text-center border-r font-medium",
                          bgClass,
                          textClass,
                          cell.isRequested && "ring-2 ring-inset ring-emerald-500"
                        )}
                      >
                        {shiftLabel}
                      </td>
                    );
                  })}
                  {row.shiftTotals.map((total, si) => (
                    <td key={`st-${si}`} className="p-1 text-center border-r font-medium">{total}</td>
                  ))}
                  <td className="p-1 text-center font-bold bg-slate-50 dark:bg-slate-900/50">{row.grandTotal}</td>
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
  );
}