import { useSchedules, useDeleteSchedule } from "@/hooks/use-schedules";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Plus, Trash2, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import type { Schedule } from "@shared/schema";
import { useState } from "react";

interface ScheduleSidebarProps {
  activeScheduleId: number | null;
  onLoadSchedule: (schedule: Schedule) => void;
  onNewSchedule: () => void;
}

export function ScheduleSidebar({ activeScheduleId, onLoadSchedule, onNewSchedule }: ScheduleSidebarProps) {
  const { t, lang } = useLanguage();
  const { data: schedules, isLoading } = useSchedules();
  const deleteMutation = useDeleteSchedule();
  const [collapsed, setCollapsed] = useState(false);

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm(t.deleteScheduleConfirm)) {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          if (id === activeScheduleId) {
            onNewSchedule();
          }
        }
      });
    }
  };

  if (collapsed) {
    return (
      <div className="w-10 shrink-0 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-zinc-900 flex flex-col items-center py-3 gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-8 h-8 p-0"
          onClick={() => setCollapsed(false)}
          data-testid="button-expand-sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-8 h-8 p-0"
          onClick={onNewSchedule}
          data-testid="button-new-schedule-collapsed"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-zinc-900 flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-sm truncate">{t.mySchedules}</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onNewSchedule}
            data-testid="button-new-schedule"
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setCollapsed(true)}
            data-testid="button-collapse-sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse" />
            ))
          ) : !schedules || schedules.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>{t.noSavedSchedules}</p>
            </div>
          ) : (
            schedules.map((schedule: Schedule) => {
              const isActive = activeScheduleId === schedule.id;
              const dateLabel = schedule.config?.useCustomRange && schedule.config?.customStartDate
                ? `${schedule.config.customStartDate} — ${schedule.config.customEndDate || ""}`
                : format(new Date(schedule.year, schedule.month - 1, 1), "MMMM yyyy", { locale: lang === "th" ? th : enUS });
              const savedDate = schedule.updatedAt
                ? format(new Date(schedule.updatedAt), "d MMM HH:mm", { locale: lang === "th" ? th : enUS })
                : "";
              return (
                <div
                  key={schedule.id}
                  className={cn(
                    "group rounded-md px-2.5 py-2 cursor-pointer transition-colors text-left w-full",
                    isActive
                      ? "bg-primary/10 dark:bg-primary/15 ring-1 ring-primary/30"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  )}
                  onClick={() => onLoadSchedule(schedule)}
                  data-testid={`sidebar-schedule-${schedule.id}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{schedule.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{dateLabel}</p>
                      {savedDate && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {t.savedAt} {savedDate}
                        </p>
                      )}
                    </div>
                    <button
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 h-6 w-6 inline-flex items-center justify-center text-muted-foreground hover:text-red-500 rounded-sm shrink-0 transition-opacity mt-0.5"
                      onClick={(e) => handleDelete(e, schedule.id)}
                      data-testid={`button-delete-schedule-${schedule.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
