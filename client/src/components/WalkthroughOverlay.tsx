import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const WALKTHROUGH_SEEN_KEY = "shift-scheduler-walkthrough-seen";

function getSeenSteps(): Record<number, boolean> {
  try {
    const raw = localStorage.getItem(WALKTHROUGH_SEEN_KEY);
    if (!raw) return {};
    if (raw === "true") return { 1: true };
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function markStepSeen(wizardStep: number) {
  const seen = getSeenSteps();
  seen[wizardStep] = true;
  localStorage.setItem(WALKTHROUGH_SEEN_KEY, JSON.stringify(seen));
}

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

const WALKTHROUGH_ENABLED_STEPS = new Set([1, 2, 3]);

export function useWalkthrough(wizardStep: number) {
  const [active, setActive] = useState(false);
  const [seenSteps, setSeenSteps] = useState<Record<number, boolean>>(getSeenSteps);

  useEffect(() => {
    if (WALKTHROUGH_ENABLED_STEPS.has(wizardStep) && !seenSteps[wizardStep]) {
      const timer = setTimeout(() => setActive(true), 600);
      return () => clearTimeout(timer);
    } else {
      setActive(false);
    }
  }, [wizardStep, seenSteps]);

  const complete = useCallback(() => {
    setActive(false);
    markStepSeen(wizardStep);
    setSeenSteps(prev => ({ ...prev, [wizardStep]: true }));
  }, [wizardStep]);

  const start = useCallback(() => {
    if (WALKTHROUGH_ENABLED_STEPS.has(wizardStep)) {
      setActive(true);
    }
  }, [wizardStep]);

  return { active, complete, start, wizardStep };
}

interface SpotlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function WalkthroughOverlay({ steps, onComplete }: WalkthroughOverlayProps) {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<React.CSSProperties>({});
  const [arrowPos, setArrowPos] = useState<React.CSSProperties>({});
  const [arrowDir, setArrowDir] = useState<"top" | "bottom" | "left" | "right">("top");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const rafRef = useRef<number>(0);

  const step = steps[currentStep];
  const PAD = 10;
  const TOOLTIP_W = 340;

  const computePositions = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.targetSelector) as HTMLElement | null;
    if (!el) {
      setSpotlight(null);
      return;
    }

    const r = el.getBoundingClientRect();
    const spot: SpotlightRect = {
      left: r.left - PAD,
      top: r.top - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
    };
    setSpotlight(spot);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 16;

    const preferred = step.position || "bottom";
    let pos = preferred;

    if (pos === "bottom" && r.bottom + gap + 200 > vh) pos = "top";
    if (pos === "top" && r.top - gap - 200 < 0) pos = "bottom";
    if (pos === "right" && r.right + gap + TOOLTIP_W > vw) pos = "left";
    if (pos === "left" && r.left - gap - TOOLTIP_W < 0) pos = "right";

    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    let style: React.CSSProperties = {};
    let aStyle: React.CSSProperties = {};
    let aDir: typeof arrowDir = "top";

    if (pos === "bottom") {
      const tooltipLeft = Math.max(16, Math.min(centerX - TOOLTIP_W / 2, vw - TOOLTIP_W - 16));
      style = { top: r.bottom + gap, left: tooltipLeft };
      aDir = "top";
      aStyle = { top: -8, left: Math.min(Math.max(centerX - tooltipLeft - 8, 20), TOOLTIP_W - 40) };
    } else if (pos === "top") {
      const tooltipLeft = Math.max(16, Math.min(centerX - TOOLTIP_W / 2, vw - TOOLTIP_W - 16));
      style = { top: r.top - gap, left: tooltipLeft, transform: "translateY(-100%)" };
      aDir = "bottom";
      aStyle = { bottom: -8, left: Math.min(Math.max(centerX - tooltipLeft - 8, 20), TOOLTIP_W - 40) };
    } else if (pos === "right") {
      style = { top: Math.max(16, Math.min(centerY - 100, vh - 220)), left: r.right + gap };
      aDir = "left";
      aStyle = { left: -8, top: Math.min(Math.max(centerY - (style.top as number) - 8, 20), 180) };
    } else {
      style = { top: Math.max(16, Math.min(centerY - 100, vh - 220)), left: r.left - gap - TOOLTIP_W };
      aDir = "right";
      aStyle = { right: -8, top: Math.min(Math.max(centerY - (style.top as number) - 8, 20), 180) };
    }

    setTooltipPos(style);
    setArrowPos(aStyle);
    setArrowDir(aDir);
  }, [step]);

  useEffect(() => {
    if (!step) return;
    const el = document.querySelector(step.targetSelector) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    setIsTransitioning(true);
    const timer = setTimeout(() => {
      computePositions();
      setIsTransitioning(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [currentStep, step, computePositions]);

  useEffect(() => {
    const update = () => {
      rafRef.current = requestAnimationFrame(() => computePositions());
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [computePositions]);

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

  const arrowClasses: Record<string, string> = {
    top: "border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white dark:border-b-slate-800",
    bottom: "border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white dark:border-t-slate-800",
    left: "border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-white dark:border-r-slate-800",
    right: "border-t-8 border-b-8 border-l-8 border-t-transparent border-b-transparent border-l-white dark:border-l-slate-800",
  };

  const titleText = (t as any)[step.titleKey] || step.titleKey;
  const descText = (t as any)[step.descKey] || step.descKey;

  return (
    <div className="fixed inset-0 z-[9999]" data-testid="walkthrough-overlay">
      {/* Dark overlay - blocks all clicks outside spotlight */}
      <div className="absolute inset-0" style={{ pointerEvents: "auto" }}>
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <mask id="wk-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {spotlight && (
                <rect
                  x={spotlight.left}
                  y={spotlight.top}
                  width={spotlight.width}
                  height={spotlight.height}
                  rx="12"
                  fill="black"
                  style={{ transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)" }}
                />
              )}
            </mask>
          </defs>
          <rect
            x="0" y="0" width="100%" height="100%"
            fill="rgba(0,0,0,0.45)"
            mask="url(#wk-mask)"
          />
        </svg>
      </div>

      {/* Spotlight border glow - allows pointer events through to the element */}
      {spotlight && (
        <div
          className="absolute rounded-xl pointer-events-none"
          style={{
            left: spotlight.left,
            top: spotlight.top,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.5), 0 0 20px 4px rgba(59, 130, 246, 0.15)",
            transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      )}

      {/* Clickable area over spotlight so user can interact with highlighted element */}
      {spotlight && (
        <div
          className="absolute"
          style={{
            left: spotlight.left,
            top: spotlight.top,
            width: spotlight.width,
            height: spotlight.height,
            pointerEvents: "auto",
            zIndex: 1,
            transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="fixed bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 z-[10001]"
        style={{
          width: TOOLTIP_W,
          opacity: isTransitioning ? 0 : 1,
          ...tooltipPos,
          transition: "opacity 0.3s ease, top 0.4s cubic-bezier(0.4,0,0.2,1), left 0.4s cubic-bezier(0.4,0,0.2,1), transform 0.4s cubic-bezier(0.4,0,0.2,1)",
        }}
        data-testid="walkthrough-tooltip"
      >
        <div
          className={`absolute w-0 h-0 ${arrowClasses[arrowDir]}`}
          style={{ ...arrowPos, transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)" }}
        />

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-full">
            {currentStep + 1} / {steps.length}
          </span>
          <button
            onClick={handleSkip}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
            data-testid="button-walkthrough-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
          {titleText}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5">
          {descText}
        </p>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-xs text-slate-400 hover:text-slate-600"
            data-testid="button-walkthrough-skip"
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
