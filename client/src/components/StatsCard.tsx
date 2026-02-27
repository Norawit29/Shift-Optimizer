import { type OptimizerResult, type SchedulerConfig } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Users, AlertTriangle, CheckCircle2, LayoutGrid } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface StatsCardProps {
  result: OptimizerResult;
  config: SchedulerConfig;
}

export function StatsCard({ result, config }: StatsCardProps) {
  const { metrics } = result;
  const { t } = useLanguage();

  const data = metrics.perStaff.map(s => ({
    name: s.name,
    shifts: s.total,
    ...s.byShift.reduce((acc, count, i) => ({ ...acc, [config.shiftNames[i]]: count }), {})
  })).sort((a, b) => b.shifts - a.shifts);

  const maxShift = Math.max(...metrics.perStaff.map(s => s.total));
  const minShift = Math.min(...metrics.perStaff.map(s => s.total));
  const range = maxShift - minShift;
  const avgShifts = metrics.perStaff.length > 0
    ? metrics.perStaff.reduce((sum, s) => sum + s.total, 0) / metrics.perStaff.length
    : 1;
  const relativeDeviation = avgShifts > 0 ? range / avgShifts : 0;
  const fairnessScore = Math.max(0, Math.min(100, Math.round(100 * (1 - relativeDeviation))));

  let statusColor = "text-green-500";
  if (fairnessScore < 70) statusColor = "text-yellow-500";
  if (fairnessScore < 50) statusColor = "text-red-500";

  const totalAssigned = metrics.perStaff.reduce((sum, s) => sum + s.total, 0);
  const unfilledCount = result.unfilledSlots?.reduce((sum, u) => sum + (u.required - u.assigned), 0) || 0;
  const totalRequired = totalAssigned + unfilledCount;
  const coveragePct = totalRequired > 0 ? Math.round((totalAssigned / totalRequired) * 100) : 100;
  let coverageColor = "text-green-500";
  if (coveragePct < 100) coverageColor = "text-yellow-500";
  if (coveragePct < 80) coverageColor = "text-red-500";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-2 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">{t.workloadDistribution}</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
              <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} angle={-35} textAnchor="end" interval={0} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="shifts" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${0.5 + (index % 3) * 0.2})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t.fairnessScore}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className={`text-4xl font-bold font-display ${statusColor}`} data-testid="text-fairness-score">{fairnessScore}%</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-muted-foreground">{t.minMaxLabel}:</span>
              <span className="text-sm font-semibold">{minShift} – {maxShift}</span>
              <span className="text-xs text-muted-foreground">({t.range}: {range})</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t.lowerRangeFairer}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t.coverageLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className={`text-4xl font-bold font-display ${coverageColor}`} data-testid="text-coverage-score">{coveragePct}%</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <LayoutGrid className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold" data-testid="text-coverage-detail">{totalAssigned}/{totalRequired}</span>
              <span className="text-xs text-muted-foreground">{t.slotsFilled}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t.status}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {result.isPartial ? (
                <>
                  <div className="bg-yellow-100 p-2 rounded-full dark:bg-yellow-900/30">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="font-semibold">{t.imbalanced}</p>
                    <p className="text-xs text-muted-foreground">{t.someStaffMore}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-green-100 p-2 rounded-full dark:bg-green-900/30">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold">{t.optimized}</p>
                    <p className="text-xs text-muted-foreground">{t.rulesRespected}</p>
                  </div>
                </>
              )}
            </div>
            
            {metrics.range > 3 && !result.isPartial && (
              <div className="flex items-center gap-3">
                <div className="bg-yellow-100 p-2 rounded-full dark:bg-yellow-900/30">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="font-semibold">{t.imbalanced}</p>
                  <p className="text-xs text-muted-foreground">{t.someStaffMore}</p>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-full dark:bg-blue-900/30">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold">{metrics.perStaff.length} {t.staff}</p>
                <p className="text-xs text-muted-foreground">{t.activeMembers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
