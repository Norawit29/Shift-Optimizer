import { useSchedule } from "@/hooks/use-schedules";
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, FileSpreadsheet } from "lucide-react";
import { ScheduleView } from "@/components/ScheduleView";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format, setDate, parseISO, addDays } from "date-fns";
import ExcelJS from "exceljs";
import type { DaySchedule, SchedulerConfig, StaffMember, UnfilledSlot } from "@shared/schema";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";

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
  labels: { date: string; day: string; staffName: string; total: string; totalHours: string; summary: string; schedule: string; staffSchedule: string; level: string }
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

  const ws1 = wb.addWorksheet(labels.schedule);
  const schedHeaders: string[] = [labels.date, labels.day];
  config.shiftNames.forEach((shiftName) => {
    schedHeaders.push(shiftName);
  });
  ws1.addRow(schedHeaders);
  result.forEach((day) => {
    const currentDate = getDateForIdx(day.date);
    const row: string[] = [format(currentDate, "MMM d"), format(currentDate, "EEEE")];
    config.shiftNames.forEach((_, shiftIdx) => {
      const names = day.shifts[shiftIdx]?.map(id => getStaffName(String(id))) || [];
      row.push(names.join(", "));
    });
    ws1.addRow(row);
  });
  ws1.getColumn(1).width = 8;
  ws1.getColumn(2).width = 12;
  for (let i = 3; i <= schedHeaders.length; i++) ws1.getColumn(i).width = 35;
  ws1.getRow(1).font = { bold: true };

  const ws2 = wb.addWorksheet(labels.summary);
  const hasLevels = config.staffLevels && config.staffLevels.length > 0;
  const shiftHours = config.shiftHours || config.shiftNames.map(() => 8);
  const summaryHeaders = hasLevels
    ? [labels.staffName, labels.level, ...config.shiftNames, labels.total, labels.totalHours]
    : [labels.staffName, ...config.shiftNames, labels.total, labels.totalHours];
  ws2.addRow(summaryHeaders);
  staff.forEach(s => {
    const row: (string | number)[] = [s.name];
    if (hasLevels) {
      row.push(config.staffLevels![(s.level ?? 0)] || config.staffLevels![0] || "");
    }
    let total = 0;
    const shiftCounts: number[] = [];
    config.shiftNames.forEach((_, shiftIdx) => {
      const count = result.reduce((acc, day) =>
        acc + (day.shifts[shiftIdx]?.map(String).includes(s.id) ? 1 : 0), 0);
      row.push(count);
      shiftCounts.push(count);
      total += count;
    });
    row.push(total);
    const totalHrs = shiftCounts.reduce((sum, c, si) => sum + c * (shiftHours[si] || 0), 0);
    row.push(totalHrs);
    ws2.addRow(row);
  });
  ws2.getColumn(1).width = 20;
  for (let i = 2; i <= config.shiftNames.length + 1; i++) ws2.getColumn(i).width = 12;
  ws2.getColumn(config.shiftNames.length + 2).width = 8;
  ws2.getColumn(config.shiftNames.length + 3).width = 10;
  ws2.getRow(1).font = { bold: true };

  const dateHeaders = result.map((day) => format(getDateForIdx(day.date), "d MMM"));
  const ws3 = wb.addWorksheet(labels.staffSchedule);
  const matrixHeaders = hasLevels
    ? [labels.staffName, labels.level, ...dateHeaders, ...config.shiftNames, labels.total, labels.totalHours]
    : [labels.staffName, ...dateHeaders, ...config.shiftNames, labels.total, labels.totalHours];
  const headerRow = ws3.addRow(matrixHeaders);
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
  });

  const shiftColorMap = config.shiftNames.map((_, i) => SHIFT_COLORS[i % SHIFT_COLORS.length]);
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

    shiftTotals.forEach(ct => rowValues.push(ct));
    rowValues.push(grandTotal);
    const totalHrs = shiftTotals.reduce((sum, c, si) => sum + c * (shiftHours[si] || 0), 0);
    rowValues.push(totalHrs);

    const excelRow = ws3.addRow(rowValues);

    dayCellInfo.forEach((info, ci) => {
      if (info.shiftIndices.length === 0) return;
      const cell = excelRow.getCell(ci + 2 + ws3ColOffset);
      let bgColor: string;
      if (info.shiftIndices.length === 1) {
        bgColor = shiftColorMap[info.shiftIndices[0]];
      } else {
        bgColor = info.shiftIndices.reduce((acc, si) => blendColors(acc, shiftColorMap[si]), shiftColorMap[info.shiftIndices[0]]);
      }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + bgColor } };
    });
  });

  ws3.getColumn(1).width = 20;
  if (hasLevels) ws3.getColumn(2).width = 14;
  for (let i = 2 + ws3ColOffset; i <= dateHeaders.length + 1 + ws3ColOffset; i++) ws3.getColumn(i).width = 10;
  for (let i = dateHeaders.length + 2 + ws3ColOffset; i <= dateHeaders.length + 1 + ws3ColOffset + config.shiftNames.length; i++) ws3.getColumn(i).width = 12;
  ws3.getColumn(matrixHeaders.length - 1).width = 8;
  ws3.getColumn(matrixHeaders.length).width = 10;

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
              onClick={() => exportToExcel(schedule.name, schedule.month, schedule.year, resultAsDaySchedule, schedule.config, schedule.staff, { date: t.date, day: t.day, staffName: t.staffName, total: t.total, totalHours: t.totalHours, summary: t.summary, schedule: t.scheduleView, staffSchedule: t.staffSchedule, level: t.level })}
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
