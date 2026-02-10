import { useSchedule } from "@/hooks/use-schedules";
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Printer } from "lucide-react";
import { ScheduleView } from "@/components/ScheduleView";
import { StatsCard } from "@/components/StatsCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function ScheduleDetailsPage() {
  const [, params] = useRoute("/schedule/:id");
  const id = parseInt(params?.id || "0");
  const { data: schedule, isLoading } = useSchedule(id);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!schedule) {
    return <div>Schedule not found</div>;
  }

  // Reconstruct result object for StatsCard
  // In a real app, backend might store metrics separately or we re-calculate
  const mockResult = {
    schedule: schedule.result,
    metrics: { 
      range: 0, 
      perStaff: schedule.staff.map(s => ({ name: s.name, total: 0, byShift: [] })) 
    } 
  };
  // (Note: In production, we'd want to store metrics in the DB or re-calculate them here)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/history">
              <Button variant="outline" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-display font-bold">{schedule.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>{schedule.month}/{schedule.year}</span>
                <Badge variant="secondary">Saved</Badge>
              </div>
            </div>
          </div>
          
          <Button onClick={() => window.print()} variant="outline">
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>

        <Tabs defaultValue="view" className="w-full">
          <TabsList>
            <TabsTrigger value="view">Schedule View</TabsTrigger>
            {/* Disabled stats for now as we need to re-calc metrics */}
            {/* <TabsTrigger value="stats">Stats</TabsTrigger> */}
          </TabsList>
          
          <TabsContent value="view" className="mt-6">
            <ScheduleView 
              schedule={schedule.result} 
              config={schedule.config} 
              staff={schedule.staff} 
              month={schedule.month} 
              year={schedule.year} 
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
