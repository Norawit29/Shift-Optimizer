import { type OptimizerResult, type SchedulerConfig, type StaffMember } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CheckCircle2, XCircle, LayoutGrid } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useMemo } from "react";

interface StatsCardProps {
  result: OptimizerResult;
  config: SchedulerConfig;
  staff: StaffMember[];
}

interface ConstraintCheck {
  label: string;
  detail: string;
  passed: boolean;
  violations: number;
}

function verifyConstraints(
  result: OptimizerResult,
  config: SchedulerConfig,
  staff: StaffMember[],
  t: any
): ConstraintCheck[] {
  const { schedule } = result;
  const checks: ConstraintCheck[] = [];
  const S = config.shiftNames.length;

  const staffAssignments: Map<string, { day: number; shift: number }[]> = new Map();
  for (const member of staff) {
    staffAssignments.set(member.name, []);
  }
  for (const daySchedule of schedule) {
    for (let s = 0; s < daySchedule.shifts.length; s++) {
      for (const name of daySchedule.shifts[s]) {
        const arr = staffAssignments.get(name);
        if (arr) arr.push({ day: daySchedule.date, shift: s });
      }
    }
  }

  if (config.consecutiveRules.length > 0) {
    let violations = 0;
    const ruleDescs: string[] = [];
    const nextDayRules = config.consecutiveRules.filter(r => !r.type || r.type === 'nextDay');
    const sameDayRules = config.consecutiveRules.filter(r => r.type === 'sameDay');
    for (const r of nextDayRules) ruleDescs.push(`${config.shiftNames[r.from]}→${config.shiftNames[r.to]}`);
    for (const r of sameDayRules) ruleDescs.push(`${config.shiftNames[r.from]}+${config.shiftNames[r.to]}`);
    for (const [, assignments] of staffAssignments) {
      for (const rule of nextDayRules) {
        for (const a of assignments) {
          if (a.shift === rule.from) {
            if (assignments.some(b => b.day === a.day + 1 && b.shift === rule.to)) violations++;
          }
        }
      }
      for (const rule of sameDayRules) {
        for (const a of assignments) {
          if (a.shift === rule.from) {
            if (assignments.some(b => b.day === a.day && b.shift === rule.to)) violations++;
          }
        }
      }
    }
    checks.push({
      label: t.constraintConsecutive,
      detail: ruleDescs.join(", "),
      passed: violations === 0,
      violations,
    });
  }

  if (config.maxConsecutiveRules && config.maxConsecutiveRules.length > 0) {
    let violations = 0;
    const ruleDescs: string[] = [];
    for (const rule of config.maxConsecutiveRules) {
      const shiftNames = rule.shifts.map(i => config.shiftNames[i]).join("+");
      ruleDescs.push(`${shiftNames} ≤${rule.maxDays}`);
      for (const [, assignments] of staffAssignments) {
        const days = new Set(assignments.filter(a => rule.shifts.includes(a.shift)).map(a => a.day));
        if (days.size === 0) continue;
        const sortedDays = Array.from(days).sort((a, b) => a - b);
        let consecutive = 1;
        for (let i = 1; i < sortedDays.length; i++) {
          if (sortedDays[i] === sortedDays[i - 1] + 1) {
            consecutive++;
            if (consecutive > rule.maxDays) violations++;
          } else {
            consecutive = 1;
          }
        }
      }
    }
    checks.push({
      label: t.constraintMaxConsecutive,
      detail: ruleDescs.join(", "),
      passed: violations === 0,
      violations,
    });
  }

  {
    let violations = 0;
    for (const member of staff) {
      const assignments = staffAssignments.get(member.name) || [];
      if (assignments.length > member.maxShifts) violations++;
    }
    checks.push({
      label: t.constraintMaxShifts,
      detail: `${staff.length} ${t.staff}`,
      passed: violations === 0,
      violations,
    });
  }

  {
    let violations = 0;
    for (const member of staff) {
      const assignments = staffAssignments.get(member.name) || [];
      for (const blocked of member.blocked) {
        const isAssigned = assignments.some(a => a.day === blocked.date && (blocked.shift === -1 || a.shift === blocked.shift));
        if (isAssigned) violations++;
      }
    }
    checks.push({
      label: t.constraintBlocked,
      detail: `${staff.reduce((s, m) => s + m.blocked.length, 0)} ${t.constraintBlocked.toLowerCase()}`,
      passed: violations === 0,
      violations,
    });
  }

  if (config.staffLevels && config.staffLevels.length > 0 && config.minStaffPerLevel) {
    let violations = 0;
    const levelDescs: string[] = [];
    for (let s = 0; s < S; s++) {
      const mins = config.minStaffPerLevel[s];
      if (!mins) continue;
      for (let lvl = 0; lvl < config.staffLevels.length; lvl++) {
        const minReq = mins[lvl] || 0;
        if (minReq <= 0) continue;
        levelDescs.push(`${config.shiftNames[s]}: ${config.staffLevels[lvl]} ≥${minReq}`);
        for (const daySchedule of schedule) {
          const assignedNames = daySchedule.shifts[s] || [];
          const levelCount = assignedNames.filter(name => {
            const member = staff.find(m => m.name === name);
            return member && member.level === lvl;
          }).length;
          if (levelCount < minReq && assignedNames.length > 0) violations++;
        }
      }
    }
    if (levelDescs.length > 0) {
      checks.push({
        label: t.constraintLevelMin,
        detail: levelDescs.join(", "),
        passed: violations === 0,
        violations,
      });
    }
  }

  return checks;
}

export function StatsCard({ result, config, staff }: StatsCardProps) {
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

  const constraintChecks = useMemo(
    () => verifyConstraints(result, config, staff, t),
    [result, config, staff, t]
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-2 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">{t.workloadDistribution}</CardTitle>
        </CardHeader>
        <CardContent className="h-[220px] flex items-center justify-center">
          <ResponsiveContainer width="90%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="name" hide />
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
          <CardContent className="space-y-2">
            {constraintChecks.map((check, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                  check.passed
                    ? "bg-green-50 dark:bg-green-900/10"
                    : "bg-red-50 dark:bg-red-900/10"
                }`}
                data-testid={`constraint-check-${i}`}
              >
                {check.passed ? (
                  <CheckCircle2 className="w-4.5 h-4.5 text-green-500 dark:text-green-400 shrink-0" />
                ) : (
                  <XCircle className="w-4.5 h-4.5 text-red-500 dark:text-red-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{check.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{check.detail}</p>
                </div>
                {!check.passed && (
                  <span className="text-xs font-medium text-red-600 dark:text-red-400 shrink-0">
                    {check.violations}
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
