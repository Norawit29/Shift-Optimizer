import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const WALKTHROUGH_SEEN_KEY = "shift-scheduler-walkthrough-seen";

export interface WalkthroughStep {
  targetSelector: string;
  titleKey: string;
  descKey: string;
  position?: "top" | "bottom" | "left" | "right";
}

interface WalkthroughOverlayProps {
  steps: WalkthroughStep[];
  wizardStep: number;
  onComplete: () => void;
}

export function useWalkthrough(wizardStep: number) {
  const [active, setActive] = useState(false);
  const [hasSeenWalkthrough, setHasSeenWalkthrough] = useState(() => {
    return !!localStorage.getItem(WALKTHROUGH_SEEN_KEY);
  });

  useEffect(() => {
    if (!hasSeenWalkthrough && wizardStep === 1) {
      const timer = setTimeout(() => setActive(true), 600);
      return () => clearTimeout(timer);
    }
  }, [hasSeenWalkthrough, wizardStep]);

  const complete = useCallback(() => {
    setActive(false);
    setHasSeenWalkthrough(true);
    localStorage.setItem(WALKTHROUGH_SEEN_KEY, "true");
  }, []);

  const start = useCallback(() => {
    setActive(true);
  }, []);

  return { active, complete, start };
}

export function WalkthroughOverlay({ steps, wizardStep, onComplete }: WalkthroughOverlayProps) {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const [arrowDir, setArrowDir] = useState<"top" | "bottom" | "left" | "right">("top");
  const overlayRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];

  const positionTooltip = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.targetSelector);
    if (!el) {
      setRect(null);
      return;
    }

    const r = el.getBoundingClientRect();
    setRect(r);

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    setTimeout(() => {
      const updatedR = el.getBoundingClientRect();
      setRect(updatedR);

      const pad = 12;
      const tooltipW = 340;
      const tooltipH = 180;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const preferred = step.position || "bottom";
      let pos = preferred;

      if (pos === "bottom" && updatedR.bottom + pad + tooltipH > vh) pos = "top";
      if (pos === "top" && updatedR.top - pad - tooltipH < 0) pos = "bottom";
      if (pos === "right" && updatedR.right + pad + tooltipW > vw) pos = "left";
      if (pos === "left" && updatedR.left - pad - tooltipW < 0) pos = "right";

      let style: React.CSSProperties = {};
      let aStyle: React.CSSProperties = {};
      let aDir: "top" | "bottom" | "left" | "right" = "top";

      const centerX = updatedR.left + updatedR.width / 2;
      const centerY = updatedR.top + updatedR.height / 2;

      if (pos === "bottom") {
        style = {
          top: updatedR.bottom + pad + 8,
          left: Math.max(16, Math.min(centerX - tooltipW / 2, vw - tooltipW - 16)),
        };
        aDir = "top";
        aStyle = {
          top: -8,
          left: Math.min(Math.max(centerX - (style.left as number) - 8, 16), tooltipW - 32),
        };
      } else if (pos === "top") {
        style = {
          bottom: vh - updatedR.top + pad + 8,
          left: Math.max(16, Math.min(centerX - tooltipW / 2, vw - tooltipW - 16)),
        };
        aDir = "bottom";
        aStyle = {
          bottom: -8,
          left: Math.min(Math.max(centerX - (style.left as number) - 8, 16), tooltipW - 32),
        };
      } else if (pos === "right") {
        style = {
          top: Math.max(16, Math.min(centerY - tooltipH / 2, vh - tooltipH - 16)),
          left: updatedR.right + pad + 8,
        };
        aDir = "left";
        aStyle = {
          left: -8,
          top: Math.min(Math.max(centerY - (style.top as number) - 8, 16), tooltipH - 32),
        };
      } else {
        style = {
          top: Math.max(16, Math.min(centerY - tooltipH / 2, vh - tooltipH - 16)),
          right: vw - updatedR.left + pad + 8,
        };
        aDir = "right";
        aStyle = {
          right: -8,
          top: Math.min(Math.max(centerY - (style.top as number) - 8, 16), tooltipH - 32),
        };
      }

      setTooltipStyle(style);
      setArrowStyle(aStyle);
      setArrowDir(aDir);
    }, 350);
  }, [step]);

  useEffect(() => {
    positionTooltip();
    const handleResize = () => positionTooltip();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [currentStep, positionTooltip]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  if (!step) return null;

  const arrowBorder = {
    top: "border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white dark:border-b-slate-800",
    bottom: "border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white dark:border-t-slate-800",
    left: "border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-white dark:border-r-slate-800",
    right: "border-t-8 border-b-8 border-l-8 border-t-transparent border-b-transparent border-l-white dark:border-l-slate-800",
  };

  const titleText = (t as any)[step.titleKey] || step.titleKey;
  const descText = (t as any)[step.descKey] || step.descKey;

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[9999]" data-testid="walkthrough-overlay">
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="walkthrough-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - 8}
                y={rect.top - 8}
                width={rect.width + 16}
                height={rect.height + 16}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.5)"
          mask="url(#walkthrough-mask)"
          style={{ pointerEvents: "auto" }}
          onClick={handleSkip}
        />
      </svg>

      {rect && (
        <div
          className="absolute rounded-lg ring-2 ring-blue-400 ring-offset-2 pointer-events-none"
          style={{
            left: rect.left - 8,
            top: rect.top - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.3)",
            transition: "all 0.3s ease",
          }}
        />
      )}

      <div
        className="fixed bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 z-[10000]"
        style={{
          width: 340,
          ...tooltipStyle,
          transition: "all 0.3s ease",
        }}
        data-testid="walkthrough-tooltip"
      >
        <div className={`absolute w-0 h-0 ${arrowBorder[arrowDir]}`} style={arrowStyle} />

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-1 rounded-full">
            {currentStep + 1} / {steps.length}
          </span>
          <button
            onClick={handleSkip}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            data-testid="button-walkthrough-skip"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
          {titleText}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
          {descText}
        </p>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-xs text-slate-500 hover:text-slate-700"
            data-testid="button-walkthrough-skip-text"
          >
            {(t as any).walkthroughSkip || "Skip"}
          </Button>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                data-testid="button-walkthrough-prev"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {(t as any).walkthroughBack || "Back"}
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-walkthrough-next"
            >
              {currentStep === steps.length - 1
                ? ((t as any).walkthroughDone || "Done")
                : ((t as any).walkthroughNext || "Next")}
              {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WalkthroughOverlay;
