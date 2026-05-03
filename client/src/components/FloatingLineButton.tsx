import { useState } from "react";
import { SiLine } from "react-icons/si";
import { MessageCircle, X } from "lucide-react";
import { m, AnimatePresence, LazyMotion, domAnimation } from "framer-motion";

export function FloatingLineButton() {
  const [open, setOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);

  return (
    <LazyMotion features={domAnimation}>
      <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-3">
        {/* Expanded: LINE option */}
        <AnimatePresence>
          {open && (
            <m.div
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.9 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-3"
            >
              <span className="bg-slate-900 dark:bg-slate-800 text-white text-sm font-medium px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap">
                ติดต่อผ่าน LINE
              </span>
              <button
                onClick={() => { setShowQR(true); setOpen(false); }}
                className="w-14 h-14 rounded-full bg-[#06C755] hover:bg-[#05b34c] shadow-lg shadow-green-500/30 flex items-center justify-center transition-all active:scale-95"
                data-testid="button-float-line"
                aria-label="ติดต่อผ่าน LINE"
              >
                <SiLine className="w-8 h-8 text-white" />
              </button>
            </m.div>
          )}
        </AnimatePresence>

        {/* Main toggle button */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-14 h-14 rounded-full bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 shadow-xl flex items-center justify-center transition-all active:scale-95"
          data-testid="button-float-main"
          aria-label="ติดต่อเรา"
        >
          <AnimatePresence mode="wait" initial={false}>
            {open ? (
              <m.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <X className="w-6 h-6 text-white" />
              </m.span>
            ) : (
              <m.span key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <MessageCircle className="w-6 h-6 text-white" />
              </m.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* LINE QR popup */}
      {showQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowQR(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl max-w-xs w-full mx-4 flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <SiLine className="w-6 h-6 text-green-500" />
                <span className="font-bold text-slate-900 dark:text-white text-lg">LINE Official</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">@shift-optimizer</p>
            </div>
            <img
              src="/line-qr.png"
              alt="LINE QR Code @shift-optimizer"
              className="w-52 h-52 rounded-lg"
            />
            <p className="text-xs text-slate-400 text-center">สแกน QR Code เพื่อเพิ่มเพื่อนใน LINE<br />แล้วส่งข้อความหาเราได้เลย</p>
            <button
              onClick={() => setShowQR(false)}
              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </LazyMotion>
  );
}
