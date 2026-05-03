import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";

const VIDEO_ID = "NKHwHSUMK_s";

export function YouTubeDemoWidget() {
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="fixed bottom-6 right-4 z-50 w-72 shadow-2xl rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors"
          data-testid="button-yt-widget-toggle"
        >
          <span>🎥</span>
          <span>วิดีโอสาธิตการใช้งาน</span>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          aria-label="ปิด"
          data-testid="button-yt-widget-close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Embed */}
      {open && (
        <div className="aspect-video w-full">
          <iframe
            src={`https://www.youtube.com/embed/${VIDEO_ID}?rel=0`}
            title="วิดีโอสาธิตการใช้งาน Shift Optimizer"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      )}
    </div>
  );
}
