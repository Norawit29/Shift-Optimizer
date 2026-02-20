import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { Settings, Users, CalendarOff, Cpu, FileSpreadsheet, Sparkles, X, Lightbulb } from "lucide-react";
import type { Translations } from "@/lib/i18n";

const TUTORIAL_SEEN_KEY = "shift-scheduler-tutorial-seen";
const TUTORIAL_DISMISSED_KEY = "shift-scheduler-tutorial-dismissed";

interface StepTip {
  titleKey: keyof Translations;
  descKey: keyof Translations;
  icon: typeof Sparkles;
  gradient: string;
}

const stepTips: Record<number, StepTip> = {
  1: { titleKey: "tutorialStep1Title", descKey: "tutorialStep1Desc", icon: Settings, gradient: "from-sky-500 to-blue-600" },
  2: { titleKey: "tutorialStep2Title", descKey: "tutorialStep2Desc", icon: Users, gradient: "from-emerald-500 to-green-600" },
  3: { titleKey: "tutorialStep3Title", descKey: "tutorialStep3Desc", icon: CalendarOff, gradient: "from-rose-500 to-red-600" },
  4: { titleKey: "tutorialStep4Title", descKey: "tutorialStep4Desc", icon: FileSpreadsheet, gradient: "from-teal-500 to-cyan-600" },
};

export function TutorialWelcome() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(TUTORIAL_SEEN_KEY);
    if (!seen) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(TUTORIAL_SEEN_KEY, "true");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose(); }}>
      <DialogContent className="max-w-md p-0 overflow-visible [&>button]:text-white [&>button]:top-3 [&>button]:right-3" data-testid="tutorial-welcome-dialog">
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-8 flex flex-col items-center text-white rounded-t-lg">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-xl font-bold text-center text-white">
            {t.tutorialWelcomeTitle}
          </DialogTitle>
        </div>
        <div className="p-6">
          <p className="text-base text-muted-foreground leading-relaxed text-center">
            {t.tutorialWelcomeDesc.split("\n").map((line, i) => (
              <span key={i}>{line}{i < t.tutorialWelcomeDesc.split("\n").length - 1 && <br />}</span>
            ))}
          </p>
          <div className="flex justify-center mt-6">
            <Button onClick={handleClose} data-testid="button-tutorial-start">
              {t.tutorialDone}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TutorialBanner({ wizardStep }: { wizardStep: number }) {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState<Record<number, boolean>>({});
  const [tutorialSeen, setTutorialSeen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TUTORIAL_DISMISSED_KEY);
      if (stored) setDismissed(JSON.parse(stored));
    } catch {}
    if (localStorage.getItem(TUTORIAL_SEEN_KEY)) {
      setTutorialSeen(true);
    }
  }, []);

  useEffect(() => {
    if (tutorialSeen) return;
    const interval = setInterval(() => {
      if (localStorage.getItem(TUTORIAL_SEEN_KEY)) {
        setTutorialSeen(true);
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [tutorialSeen]);

  const tip = stepTips[wizardStep];
  if (!tip || dismissed[wizardStep]) return null;

  if (!tutorialSeen) return null;

  const handleDismiss = () => {
    const next = { ...dismissed, [wizardStep]: true };
    setDismissed(next);
    localStorage.setItem(TUTORIAL_DISMISSED_KEY, JSON.stringify(next));
  };

  const Icon = tip.icon;
  const lines = (t[tip.descKey] as string).split("\n");

  return (
    <div className="mb-4 rounded-lg border bg-sky-50/80 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800 p-4" data-testid={`tutorial-banner-step-${wizardStep}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Lightbulb className="w-5 h-5 text-sky-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h4 className="text-sm font-semibold text-sky-700 dark:text-sky-300">
              {t[tip.titleKey] as string}
            </h4>
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 h-6 w-6 text-sky-400 dark:text-sky-500"
              onClick={handleDismiss}
              data-testid={`button-dismiss-tutorial-${wizardStep}`}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          {lines.length <= 1 ? (
            <p className="text-sm text-sky-600/80 dark:text-sky-400/80">{lines[0]}</p>
          ) : (
            <ul className="text-sm text-sky-600/80 dark:text-sky-400/80 space-y-1 list-disc list-inside">
              {lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default TutorialWelcome;
