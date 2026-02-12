import { useSchedule } from "@/hooks/use-schedules";
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, FileSpreadsheet } from "lucide-react";
import { ScheduleView } from "@/components/ScheduleView";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format, setDate, parseISO, addDays } from "date-fns";
import * as XLSX from "xlsx";
import type { DaySchedule, SchedulerConfig, StaffMember, UnfilledSlot } from "@shared/schema";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";

function exportToExcel(
  name: string,
  month: number,
  year: number,
  result: DaySchedule[],
  config: SchedulerConfig,
  staff: StaffMember[],
  labels: { date: string; day: string; staffName: string; total: string; summary: string; schedule: string; staffSchedule: string }
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

  const rows = result.map((day) => {
    const currentDate = getDateForIdx(day.date);
    const row: Record<string, string> = {
      [labels.date]: format(currentDate, "MMM d"),
      [labels.day]: format(currentDate, "EEEE"),
    };
    config.shiftNames.forEach((shiftName, shiftIdx) => {
      const names = day.shifts[shiftIdx]?.map(id => getStaffName(String(id))) || [];
      row[shiftName] = names.join(", ");
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 8 },
    { wch: 12 },
    ...config.shiftNames.map(() => ({ wch: 35 })),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, labels.schedule);

  const summaryRows = staff.map(s => {
    const row: Record<string, string | number> = { [labels.staffName]: s.name };
    let total = 0;
    config.shiftNames.forEach((shiftName, shiftIdx) => {
      const count = result.reduce((acc, day) =>
        acc + (day.shifts[shiftIdx]?.map(String).includes(s.id) ? 1 : 0), 0);
      row[shiftName] = count;
      total += count;
    });
    row[labels.total] = total;
    return row;
  });

  const ws2 = XLSX.utils.json_to_sheet(summaryRows);
  ws2["!cols"] = [
    { wch: 20 },
    ...config.shiftNames.map(() => ({ wch: 12 })),
    { wch: 8 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, labels.summary);

  const shiftAbbrevs = config.shiftNames.map(n => {
    const trimmed = n.trim();
    if (!trimmed) return "?";
    return trimmed.charAt(0).toUpperCase();
  });

  const dateHeaders = result.map((day) => {
    const d = getDateForIdx(day.date);
    return format(d, "d MMM");
  });

  const staffMatrixHeaders = [labels.staffName, ...dateHeaders, ...config.shiftNames, labels.total];

  const staffMatrixRows = staff.map(s => {
    const row: string[] = [s.name];
    let grandTotal = 0;
    const shiftTotals = config.shiftNames.map(() => 0);

    result.forEach((day) => {
      const dayShifts: string[] = [];
      config.shiftNames.forEach((_, shiftIdx) => {
        const assigned = day.shifts[shiftIdx]?.map(String) || [];
        if (assigned.includes(s.id)) {
          dayShifts.push(shiftAbbrevs[shiftIdx]);
          shiftTotals[shiftIdx]++;
          grandTotal++;
        }
      });
      row.push(dayShifts.join("/"));
    });

    shiftTotals.forEach(ct => row.push(String(ct)));
    row.push(String(grandTotal));
    return row;
  });

  const ws3 = XLSX.utils.aoa_to_sheet([staffMatrixHeaders, ...staffMatrixRows]);
  ws3["!cols"] = [
    { wch: 20 },
    ...dateHeaders.map(() => ({ wch: 8 })),
    ...config.shiftNames.map(() => ({ wch: 10 })),
    { wch: 8 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, labels.staffSchedule);

  const rangeLabel = isCustomRange
    ? `${config.customStartDate}_to_${config.customEndDate}`
    : `${month}_${year}`;
  const filename = `${name.replace(/[^a-zA-Z0-9]/g, "_")}_${rangeLabel}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export default function ScheduleDetailsPage() {
  const [, params] = useRoute("/schedule/:id");
  const id = parseInt(params?.id || "0");
  const { data: schedule, isLoading } = useSchedule(id);
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!schedule || !schedule.result) {
    return <div>{t.scheduleNotFound}</div>;
  }

  const resultAsDaySchedule: DaySchedule[] = schedule.result.map(day => ({
    date: day.date,
    shifts: day.shifts.map(shift => shift.map(String))
  }));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <Link href="/history">
              <Button variant="outline" size="icon" className="rounded-full" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-display font-bold" data-testid="text-schedule-name">{schedule.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>
                  {schedule.config.useCustomRange && schedule.config.customStartDate && schedule.config.customEndDate
                    ? `${format(parseISO(schedule.config.customStartDate), "d MMM yyyy")} — ${format(parseISO(schedule.config.customEndDate), "d MMM yyyy")}`
                    : `${schedule.month}/${schedule.year}`}
                </span>
                <Badge variant="secondary">{t.saved}</Badge>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button
              onClick={() => exportToExcel(schedule.name, schedule.month, schedule.year, resultAsDaySchedule, schedule.config, schedule.staff, { date: t.date, day: t.day, staffName: t.staffName, total: t.total, summary: t.summary, schedule: t.scheduleView, staffSchedule: t.staffSchedule })}
              variant="default"
              data-testid="button-export-excel"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" /> {t.exportExcel}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="view" className="w-full">
          <TabsList>
            <TabsTrigger value="view" data-testid="tab-schedule-view">{t.scheduleView}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="view" className="mt-6">
            <ScheduleView 
              schedule={resultAsDaySchedule}
              config={schedule.config} 
              staff={schedule.staff} 
              month={schedule.month} 
              year={schedule.year}
              unfilledSlots={(schedule as any).unfilledSlots as UnfilledSlot[] | undefined}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
