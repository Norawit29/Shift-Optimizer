import { useState, useEffect } from "react";
import { Link } from "wouter";
import { X } from "lucide-react";

const STORAGE_KEY = "cookie_consent_accepted";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(STORAGE_KEY);
    if (!accepted) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  const dismiss = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-800 text-white px-4 py-3 shadow-lg">
      <div className="max-w-5xl mx-auto flex items-center gap-4">
        <p className="text-sm text-slate-200 flex-1 leading-relaxed">
          เราใช้คุกกี้เพื่อให้เว็บไซต์ทำงานได้อย่างมีประสิทธิภาพ และเพื่อปรับปรุงประสบการณ์การใช้งานของคุณ
          {" "}ดูรายละเอียดเพิ่มเติมได้ที่{" "}
          <Link
            href="/privacy-policy"
            className="underline text-blue-300 hover:text-blue-200 transition-colors"
          >
            นโยบายความเป็นส่วนตัว
          </Link>
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={accept}
            data-testid="button-cookie-accept"
            className="bg-white text-slate-800 text-sm font-semibold px-4 py-1.5 rounded hover:bg-slate-100 transition-colors"
          >
            Allow
          </button>
          <button
            onClick={dismiss}
            data-testid="button-cookie-dismiss"
            aria-label="ปิด"
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
