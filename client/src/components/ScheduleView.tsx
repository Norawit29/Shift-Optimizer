import { type DaySchedule, type SchedulerConfig, type StaffMember } from "@shared/schema";
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

interface ScheduleViewProps {
  schedule: DaySchedule[];
  config: SchedulerConfig;
  staff: StaffMember[];
  month: number;
  year: number;
}

export function ScheduleView({ schedule, config, staff, month, year }: ScheduleViewProps) {
  // Helper to get staff name by ID
  const getStaffName = (id: string) => staff.find(s => s.id === id)?.name || "Unknown";

  const baseDate = new Date(year, month - 1, 1);

  return (
    <div className="space-y-6">
      <Card className="border shadow-lg overflow-hidden bg-white dark:bg-zinc-900">
        <ScrollArea className="h-[600px] w-full rounded-md">
          <div className="min-w-[800px]">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[100px] font-bold">Date</TableHead>
                  <TableHead className="w-[100px]">Day</TableHead>
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

                  return (
                    <TableRow key={idx} className={cn("hover:bg-muted/30 transition-colors", isWeekend && "bg-slate-50 dark:bg-slate-900/30")}>
                      <TableCell className="font-medium">{format(currentDate, "MMM d")}</TableCell>
                      <TableCell className="text-muted-foreground">{format(currentDate, "EEEE")}</TableCell>
                      {day.shifts.map((assignedStaffIds, shiftIdx) => (
                        <TableCell key={shiftIdx} className="text-center p-2">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {assignedStaffIds.length > 0 ? (
                              assignedStaffIds.map(id => (
                                <Badge 
                                  key={id} 
                                  variant="secondary"
                                  className="font-normal bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 border border-blue-100 dark:border-blue-800"
                                >
                                  {getStaffName(id)}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground italic">-</span>
                            )}
                          </div>
                        </TableCell>
                      ))}
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
