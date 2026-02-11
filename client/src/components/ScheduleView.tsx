import { type DaySchedule, type SchedulerConfig, type StaffMember, type UnfilledSlot } from "@shared/schema";
import { format, setDate } from "date-fns";
import { Card } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
import { AlertTriangle } from "lucide-react";

interface ScheduleViewProps {
  schedule: DaySchedule[];
  config: SchedulerConfig;
  staff: StaffMember[];
  month: number;
  year: number;
  unfilledSlots?: UnfilledSlot[];
}

export function ScheduleView({ schedule, config, staff, month, year, unfilledSlots }: ScheduleViewProps) {
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name || "Unknown";
  const { t } = useLanguage();

  const baseDate = new Date(year, month - 1, 1);
  const holidays = new Set(config.holidays || []);

  const unfilledSet = new Set<string>();
  if (unfilledSlots) {
    for (const u of unfilledSlots) {
      unfilledSet.add(`${u.date}-${u.shiftIdx}`);
    }
  }

  return (
    <div className="space-y-6">
      {unfilledSlots && unfilledSlots.length > 0 && (
        <Card className="border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p className="font-semibold text-red-800 dark:text-red-300" data-testid="text-partial-warning">{t.partialScheduleWarning}</p>
              <p className="text-sm text-red-700 dark:text-red-400">{t.partialScheduleDesc}</p>
              <div className="text-sm text-red-600 dark:text-red-400 space-y-1 mt-2">
                <p className="font-medium">{t.unfilledSlots} ({unfilledSlots.length}):</p>
                <div className="flex flex-wrap gap-1.5">
                  {unfilledSlots.map((slot, idx) => {
                    const slotDate = setDate(baseDate, slot.date);
                    return (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-700"
                        data-testid={`badge-unfilled-${slot.date}-${slot.shiftIdx}`}
                      >
                        {format(slotDate, "MMM d")} - {slot.shiftName} ({slot.assigned}/{slot.required})
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="border shadow-lg overflow-hidden bg-white dark:bg-zinc-900">
        <ScrollArea className="h-[600px] w-full rounded-md">
          <div className="min-w-[800px]">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[100px] font-bold">{t.date}</TableHead>
                  <TableHead className="w-[100px]">{t.day}</TableHead>
                  {config.shiftNames.map((shift, idx) => (
                    <TableHead key={idx} className="text-center font-bold text-primary">
                      {shift}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.map((day, idx) => {
                  const currentDate = setDate(baseDate, day.date);
                  const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
                  const isHoliday = holidays.has(day.date);

                  return (
                    <TableRow key={idx} className={cn(
                      "hover:bg-muted/30 transition-colors", 
                      (isWeekend || isHoliday) && "bg-purple-50/50 dark:bg-purple-900/10",
                      isWeekend && !isHoliday && "bg-slate-50 dark:bg-slate-900/30"
                    )}>
                      <TableCell className="font-medium">
                        {format(currentDate, "MMM d")}
                        {isHoliday && (
                          <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">H</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{format(currentDate, "EEEE")}</TableCell>
                      {day.shifts.map((assignedStaffIds, shiftIdx) => {
                        const isUnfilled = unfilledSet.has(`${day.date}-${shiftIdx}`);
                        const filledIds = assignedStaffIds.map(String).filter(id => id !== "");

                        return (
                          <TableCell key={shiftIdx} className={cn(
                            "text-center p-2",
                            isUnfilled && "bg-red-50 dark:bg-red-950/30"
                          )}>
                            <div className="flex flex-wrap gap-1 justify-center">
                              {filledIds.length > 0 && filledIds.map(id => (
                                <Badge 
                                  key={id} 
                                  variant="secondary"
                                  className="font-normal bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 border border-blue-100 dark:border-blue-800"
                                >
                                  {getStaffName(id)}
                                </Badge>
                              ))}
                              {isUnfilled && (
                                <Badge
                                  variant="secondary"
                                  className="font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-700 animate-pulse"
                                  data-testid={`badge-vacancy-${day.date}-${shiftIdx}`}
                                >
                                  {t.vacancy}
                                </Badge>
                              )}
                              {!isUnfilled && filledIds.length === 0 && (
                                <span className="text-xs text-muted-foreground italic">-</span>
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
  );
}
