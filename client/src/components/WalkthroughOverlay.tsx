import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { X, ChevronLeft, ChevronRight, EyeOff } from "lucide-react";

const WALKTHROUGH_HIDDEN_KEY = "shift-scheduler-walkthrough-hidden";

function getHiddenSteps(): Record<number, boolean> {
  try {
    const raw = localStorage.getItem(WALKTHROUGH_HIDDEN_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function hideStepPermanently(wizardStep: number) {
  const hidden = getHiddenSteps();
  hidden[wizardStep] = true;
  localStorage.setItem(WALKTHROUGH_HIDDEN_KEY, JSON.stringify(hidden));
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
  onNeverShow: () => void;
}

const WALKTHROUGH_ENABLED_STEPS = new Set([1, 2, 3, 4]);

export function useWalkthrough(wizardStep: number) {
  const [active, setActive] = useState(false);
  const [hiddenSteps, setHiddenSteps] = useState<Record<number, boolean>>(getHiddenSteps);

  useEffect(() => {
    if (WALKTHROUGH_ENABLED_STEPS.has(wizardStep) && !hiddenSteps[wizardStep]) {
      const timer = setTimeout(() => setActive(true), 600);
      return () => clearTimeout(timer);
    } else {
      setActive(false);
    }
  }, [wizardStep, hiddenSteps]);

  const complete = useCallback(() => {
    setActive(false);
  }, []);

  const neverShow = useCallback(() => {
    setActive(false);
    hideStepPermanently(wizardStep);
    setHiddenSteps(prev => ({ ...prev, [wizardStep]: true }));
  }, [wizardStep]);

  const start = useCallback(() => {
    if (WALKTHROUGH_ENABLED_STEPS.has(wizardStep)) {
      setActive(true);
    }
  }, [wizardStep]);

  return { active, complete, neverShow, start, wizardStep };
}

interface SpotlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function getTooltipWidth() {
  const vw = window.innerWidth;
  if (vw < 400) return vw - 32;
  if (vw < 640) return Math.min(300, vw - 32);
  return 340;
}

export function WalkthroughOverlay({ steps, onComplete, onNeverShow }: WalkthroughOverlayProps) {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<React.CSSProperties>({ top: -9999, left: -9999 });
  const [arrowPos, setArrowPos] = useState<React.CSSProperties>({});
  const [arrowDir, setArrowDir] = useState<"top" | "bottom" | "left" | "right">("top");
  const [isReady, setIsReady] = useState(false);
  const [tooltipW, setTooltipW] = useState(getTooltipWidth);
  const rafRef = useRef<number>(0);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];
  const PAD = 8;
  const SAFE_MARGIN = 12;

  const computePositions = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.targetSelector) as HTMLElement | null;
    if (!el) {
      setSpotlight(null);
      return;
    }

    const tw = getTooltipWidth();
    setTooltipW(tw);

    const tooltipH = tooltipRef.current?.offsetHeight || 200;

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
    const gap = 12;
    const isMobile = vw < 640;

    let pos: "top" | "bottom" | "left" | "right" = step.position || "bottom";

    if (isMobile) {
      const spaceBelow = vh - r.bottom - gap;
      const spaceAbove = r.top - gap;
      pos = spaceBelow >= tooltipH ? "bottom" : spaceAbove >= tooltipH ? "top" : "bottom";
    } else {
      if (pos === "bottom" && r.bottom + gap + tooltipH > vh) pos = "top";
      if (pos === "top" && r.top - gap - tooltipH < 0) pos = "bottom";
      if (pos === "right" && r.right + gap + tw > vw) pos = "left";
      if (pos === "left" && r.left - gap - tw < 0) pos = "right";
    }

    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    let style: React.CSSProperties = {};
    let aStyle: React.CSSProperties = {};
    let aDir: typeof arrowDir = "top";

    const clampLeft = (left: number) => Math.max(SAFE_MARGIN, Math.min(left, vw - tw - SAFE_MARGIN));
    const clampTop = (top: number) => Math.max(SAFE_MARGIN, Math.min(top, vh - tooltipH - SAFE_MARGIN));

    if (pos === "bottom") {
      const tooltipLeft = clampLeft(centerX - tw / 2);
      const topVal = clampTop(r.bottom + gap);
      style = { top: topVal, left: tooltipLeft };
      aDir = "top";
      const arrowLeft = centerX - tooltipLeft - 8;
      aStyle = { top: -8, left: Math.min(Math.max(arrowLeft, 20), tw - 36) };
    } else if (pos === "top") {
      const tooltipLeft = clampLeft(centerX - tw / 2);
      const topVal = clampTop(r.top - gap - tooltipH);
      style = { top: topVal, left: tooltipLeft };
      aDir = "bottom";
      const arrowLeft = centerX - tooltipLeft - 8;
      aStyle = { bottom: -8, left: Math.min(Math.max(arrowLeft, 20), tw - 36) };
    } else if (pos === "right") {
      const leftVal = Math.min(r.right + gap, vw - tw - SAFE_MARGIN);
      const topVal = clampTop(r.top);
      style = { top: topVal, left: leftVal };
      aDir = "left";
      const arrowTop = centerY - topVal - 8;
      aStyle = { left: -8, top: Math.min(Math.max(arrowTop, 20), tooltipH - 36) };
    } else {
      const leftVal = Math.max(SAFE_MARGIN, r.left - gap - tw);
      const topVal = clampTop(r.top);
      style = { top: topVal, left: leftVal };
      aDir = "right";
      const arrowTop = centerY - topVal - 8;
      aStyle = { right: -8, top: Math.min(Math.max(arrowTop, 20), tooltipH - 36) };
    }

    setTooltipPos(style);
    setArrowPos(aStyle);
    setArrowDir(aDir);
  }, [step]);

  useEffect(() => {
    if (!step) return;
    const el = document.querySelector(step.targetSelector) as HTMLElement | null;
    if (!el) {
      if (currentStep < steps.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else {
        onComplete();
      }
      return;
    }

    setIsReady(false);
    el.scrollIntoView({ behavior: "smooth", block: "center" });

    const timer = setTimeout(() => {
      computePositions();
      requestAnimationFrame(() => {
        computePositions();
        setIsReady(true);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [currentStep, step, steps.length, computePositions, onComplete]);

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
    <div
      className="fixed inset-0 z-[9999]"
      data-testid="walkthrough-overlay"
      style={{
        opacity: isReady ? 1 : 0,
        transition: "opacity 0.25s ease",
      }}
    >
      <div className="absolute inset-0" style={{ pointerEvents: isReady ? "auto" : "none" }}>
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

      <div
        ref={tooltipRef}
        className="fixed bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 z-[10001] max-h-[80vh] overflow-y-auto"
        style={{
          width: tooltipW,
          ...tooltipPos,
          transition: isReady ? "top 0.4s cubic-bezier(0.4,0,0.2,1), left 0.4s cubic-bezier(0.4,0,0.2,1)" : "none",
        }}
        data-testid="walkthrough-tooltip"
      >
        <div
          className={`absolute w-0 h-0 ${arrowClasses[arrowDir]}`}
          style={{ ...arrowPos, transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)" }}
        />

        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <span className="text-[11px] sm:text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full">
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

        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-1.5 sm:mb-2">
          {titleText}
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3 sm:mb-5">
          {descText}
        </p>

        <div className="flex items-center justify-between gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-[11px] sm:text-xs text-slate-400 hover:text-slate-600 px-2 h-8"
            data-testid="button-walkthrough-skip"
          >
            {(t as any).walkthroughSkip || "Skip"}
          </Button>
          <div className="flex gap-1.5 sm:gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                className="h-8 px-2 sm:px-3 text-xs"
                data-testid="button-walkthrough-prev"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                <span className="hidden sm:inline">{(t as any).walkthroughBack || "Back"}</span>
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3 sm:px-4 text-xs sm:text-sm"
              data-testid="button-walkthrough-next"
            >
              {currentStep === steps.length - 1
                ? ((t as any).walkthroughDone || "Done")
                : ((t as any).walkthroughNext || "Next")}
              {currentStep < steps.length - 1 && <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-0.5 sm:ml-1" />}
            </Button>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={onNeverShow}
            className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors w-full justify-center"
            data-testid="button-walkthrough-never-show"
          >
            <EyeOff className="w-3 h-3" />
            {(t as any).walkthroughNeverShow || "Don't show this again"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WalkthroughOverlay;
