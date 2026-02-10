import { type OptimizerResult, type SchedulerConfig } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Users, AlertTriangle, CheckCircle2 } from "lucide-react";

interface StatsCardProps {
  result: OptimizerResult;
  config: SchedulerConfig;
}

export function StatsCard({ result, config }: StatsCardProps) {
  const { metrics } = result;

  // Prepare data for chart
  const data = metrics.perStaff.map(s => ({
    name: s.name,
    shifts: s.total,
    ...s.byShift.reduce((acc, count, i) => ({ ...acc, [config.shiftNames[i]]: count }), {})
  })).sort((a, b) => b.shifts - a.shifts); // Sort by busiest

  // Calculate fairness rating
  const fairnessScore = Math.max(0, 100 - (metrics.range * 10)); // Simple heuristic
  let statusColor = "text-green-500";
  if (fairnessScore < 70) statusColor = "text-yellow-500";
  if (fairnessScore < 50) statusColor = "text-red-500";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-2 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Workload Distribution</CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Fairness Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className={`text-4xl font-bold font-display ${statusColor}`}>{fairnessScore}%</span>
              <span className="text-sm text-muted-foreground mb-1">
                (Range: {metrics.range})
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Lower range means fairer distribution.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-full dark:bg-green-900/30">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold">Optimized</p>
                <p className="text-xs text-muted-foreground">Rules respected</p>
              </div>
            </div>
            
            {metrics.range > 3 && (
              <div className="flex items-center gap-3">
                <div className="bg-yellow-100 p-2 rounded-full dark:bg-yellow-900/30">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="font-semibold">Imbalanced</p>
                  <p className="text-xs text-muted-foreground">Some staff have significantly more shifts</p>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-full dark:bg-blue-900/30">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold">{metrics.perStaff.length} Staff</p>
                <p className="text-xs text-muted-foreground">Active members</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
