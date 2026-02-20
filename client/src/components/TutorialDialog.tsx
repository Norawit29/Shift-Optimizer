import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { Settings, Users, CalendarOff, Cpu, FileSpreadsheet, Sparkles } from "lucide-react";

const TUTORIAL_SEEN_KEY = "shift-scheduler-tutorial-seen";

interface TutorialStep {
  titleKey: "tutorialWelcomeTitle" | "tutorialStep1Title" | "tutorialStep2Title" | "tutorialStep3Title" | "tutorialStep4Title" | "tutorialStep5Title";
  descKey: "tutorialWelcomeDesc" | "tutorialStep1Desc" | "tutorialStep2Desc" | "tutorialStep3Desc" | "tutorialStep4Desc" | "tutorialStep5Desc";
  icon: typeof Sparkles;
  gradient: string;
}

const steps: TutorialStep[] = [
  { titleKey: "tutorialWelcomeTitle", descKey: "tutorialWelcomeDesc", icon: Sparkles, gradient: "from-amber-500 to-orange-500" },
  { titleKey: "tutorialStep1Title", descKey: "tutorialStep1Desc", icon: Settings, gradient: "from-sky-500 to-blue-600" },
  { titleKey: "tutorialStep2Title", descKey: "tutorialStep2Desc", icon: Users, gradient: "from-emerald-500 to-green-600" },
  { titleKey: "tutorialStep3Title", descKey: "tutorialStep3Desc", icon: CalendarOff, gradient: "from-rose-500 to-red-600" },
  { titleKey: "tutorialStep4Title", descKey: "tutorialStep4Desc", icon: Cpu, gradient: "from-violet-500 to-purple-600" },
  { titleKey: "tutorialStep5Title", descKey: "tutorialStep5Desc", icon: FileSpreadsheet, gradient: "from-teal-500 to-cyan-600" },
];

export default function TutorialDialog() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem(TUTORIAL_SEEN_KEY);
    if (!seen) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(TUTORIAL_SEEN_KEY, "true");
    setOpen(false);
    setCurrentStep(0);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = steps[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose(); }}>
      <DialogContent className="max-w-md p-0 overflow-visible [&>button]:text-white [&>button]:top-3 [&>button]:right-3" data-testid="tutorial-dialog">
        <div className={`bg-gradient-to-br ${step.gradient} p-8 flex flex-col items-center text-white rounded-t-lg`}>
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4">
            <Icon className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-xl font-bold text-center text-white">
            {t[step.titleKey]}
          </DialogTitle>
        </div>

        <div className="p-6">
          <p className="text-sm text-muted-foreground leading-relaxed text-center">
            {t[step.descKey]}
          </p>

          <div className="flex items-center justify-center gap-1.5 mt-5">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStep ? "w-6 bg-sky-500" : "w-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          <p className="text-xs text-muted-foreground text-center mt-2" data-testid="text-tutorial-step-counter">
            {currentStep + 1} {t.tutorialStepOf} {steps.length}
          </p>

          <div className="flex items-center justify-between gap-2 mt-5">
            {isFirst ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                data-testid="button-tutorial-skip"
              >
                {t.tutorialSkip}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                data-testid="button-tutorial-back"
              >
                {t.tutorialBack}
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleNext}
              data-testid="button-tutorial-next"
            >
              {isLast ? t.tutorialDone : t.tutorialNext}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
