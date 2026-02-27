import { useState, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useSchedule, useUpdateSchedule } from "@/hooks/use-schedules";
import { useLanguage } from "@/context/LanguageContext";
import { ScheduleEditor } from "@/components/ScheduleEditor";
import { StatsCard } from "@/components/StatsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Save, Calendar as CalendarIcon, Check, Activity, Loader2 } from "lucide-react";
import { type DaySchedule, type SchedulerConfig, type StaffMember, type OptimizerResult } from "@shared/schema";

export default function ScheduleDetailPage() {
  const [, params] = useRoute("/schedule/:id");
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const { data: schedule, isLoading } = useSchedule(id);
  const updateMutation = useUpdateSchedule();
  const [editedSchedule, setEditedSchedule] = useState<DaySchedule[] | null>(null);
  const [editedName, setEditedName] = useState<string | null>(null);

  const config = (schedule?.config || {}) as SchedulerConfig;
  const staff = (schedule?.staff || []) as StaffMember[];
  const rawResult = (schedule?.result || []) as any[];

  const currentSchedule = editedSchedule || rawResult.map((d: any) => ({
    date: d.date,
    shifts: (d.shifts || []).map((s: any) => Array.isArray(s) ? s.map(String) : []),
  }));

  const currentName = editedName ?? schedule?.name ?? "";

  const computeResult = useCallback((sched: DaySchedule[]): OptimizerResult => {
    const isCustom = config.useCustomRange && config.customStartDate;
    const base = isCustom
      ? new Date(config.customStartDate!)
      : new Date(schedule?.year || 2026, (schedule?.month || 1) - 1, 1);
    const hols = new Set(config.holidays || []);

    const getDate = (idx: number) => {
      if (isCustom) {
        const d = new Date(config.customStartDate!);
        d.setDate(d.getDate() + idx - 1);
        return d;
      }
      const d = new Date(base);
      d.setDate(idx);
      return d;
    };

    const perStaff = staff.map((s) => {
      const byShift = new Array(config.shiftsPerDay || 0).fill(0);
      const weekdayByShift = new Array(config.shiftsPerDay || 0).fill(0);
      const holidayByShift = new Array(config.shiftsPerDay || 0).fill(0);
      let total = 0, weekdayTotal = 0, holidayTotal = 0;
      for (const day of sched) {
        const dt = getDate(day.date);
        const isHol = dt.getDay() === 0 || dt.getDay() === 6 || hols.has(day.date);
        for (let si = 0; si < day.shifts.length; si++) {
          if (day.shifts[si].includes(s.id)) {
            byShift[si]++;
            total++;
            if (isHol) { holidayByShift[si]++; holidayTotal++; }
            else { weekdayByShift[si]++; weekdayTotal++; }
          }
        }
      }
      return { name: s.name, total, byShift, weekdayTotal, weekdayByShift, holidayTotal, holidayByShift };
    });

    const totals = perStaff.map(s => s.total);
    const range = totals.length > 0 ? Math.max(...totals) - Math.min(...totals) : 0;

    return {
      schedule: sched,
      metrics: { range, perStaff },
      isPartial: schedule?.isPartial || false,
      unfilledSlots: (schedule?.unfilledSlots as any) || [],
    };
  }, [config, staff, schedule]);

  const result = computeResult(currentSchedule);
  const hasChanges = editedSchedule !== null || editedName !== null;

  const handleSave = () => {
    if (!schedule) return;
    const data: any = {};
    if (editedSchedule) data.result = editedSchedule;
    if (editedName !== null) data.name = editedName;
    updateMutation.mutate({ id: schedule.id, data }, {
      onSuccess: () => {
        setEditedSchedule(null);
        setEditedName(null);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-muted-foreground">{t.scheduleNotFound}</p>
            <Button onClick={() => setLocation("/history")} data-testid="button-back-history">
              <ArrowLeft className="w-4 h-4 mr-2" /> {t.savedSchedules}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-[95vw] mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/history")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs text-muted-foreground">{t.scheduleName}</Label>
            <Input
              value={currentName}
              onChange={e => setEditedName(e.target.value)}
              className="text-lg font-bold border-none shadow-none focus-visible:ring-0 px-0"
              data-testid="input-schedule-name"
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
            data-testid="button-save"
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {t.saveSchedule}
          </Button>
        </div>

        <Tabs defaultValue="calendar">
          <TabsList className="mb-4">
            <TabsTrigger value="calendar" data-testid="tab-calendar"><CalendarIcon className="w-4 h-4 mr-2" />{t.calendarView}</TabsTrigger>
            <TabsTrigger value="stats" data-testid="tab-stats"><Activity className="w-4 h-4 mr-2" />{t.statistics}</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-0">
            <ScheduleEditor
              schedule={currentSchedule}
              config={config}
              staff={staff}
              month={schedule.month}
              year={schedule.year}
              onScheduleChange={setEditedSchedule}
            />
          </TabsContent>

          <TabsContent value="stats" className="mt-0">
            <StatsCard
              result={result}
              config={config}
              staff={staff}
              month={schedule.month}
              year={schedule.year}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
