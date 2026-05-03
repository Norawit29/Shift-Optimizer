import { useState } from "react";
import { useSchedules, useDeleteSchedule } from "@/hooks/use-schedules";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Trash2, Calendar, ArrowLeft, Loader2, Eye } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { YouTubeDemoWidget } from "@/components/YouTubeDemoWidget";

export default function HistoryPage() {
  const { data: schedules, isLoading } = useSchedules();
  const deleteMutation = useDeleteSchedule();
  const { t } = useLanguage();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-back-home">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-display font-bold">{t.savedSchedules}</h1>
            <p className="text-muted-foreground">{t.managePastRosters}</p>
          </div>
          <LanguageToggle />
        </div>

        {!schedules?.length ? (
          <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">{t.noSchedulesFound}</h3>
            <p className="text-muted-foreground mb-6">{t.createFirstRoster}</p>
            <Link href="/create">
              <Button data-testid="button-create-new">{t.createSchedule}</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {schedules.map((schedule) => (
              <Card key={schedule.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-primary group" data-testid={`card-schedule-${schedule.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl truncate pr-4">{schedule.name}</CardTitle>
                    <div className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs font-mono">
                      {format(new Date(schedule.year, schedule.month - 1), "MMM yyyy")}
                    </div>
                  </div>
                  <CardDescription>
                    {t.created} {format(new Date(schedule.createdAt!), "MMM d, yyyy")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mt-4">
                    <Link href={`/create?load=${schedule.id}`} className="flex-1">
                      <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors" data-testid={`button-open-${schedule.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        {t.view}
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteId(schedule.id)}
                      data-testid={`button-delete-${schedule.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.areYouSure}</DialogTitle>
              <DialogDescription>{t.deleteConfirm}</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setDeleteId(null)}>{t.cancel}</Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (deleteId !== null) {
                    deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
                  }
                }}
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t.delete}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <YouTubeDemoWidget />
    </div>
  );
}
