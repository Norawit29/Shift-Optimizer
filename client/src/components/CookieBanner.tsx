import { useState, useEffect } from "react";
import { Link } from "wouter";
import { X, ChevronDown, ChevronRight } from "lucide-react";

const STORAGE_KEY = "cookie_consent_v2";

type ConsentState = {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  performance: boolean;
  advertisement: boolean;
};

const DEFAULT_CONSENT: ConsentState = {
  necessary: true,
  functional: false,
  analytics: false,
  performance: false,
  advertisement: false,
};

const ALL_ACCEPTED: ConsentState = {
  necessary: true,
  functional: true,
  analytics: true,
  performance: true,
  advertisement: true,
};

type Category = {
  key: keyof ConsentState;
  label: string;
  desc: string;
  alwaysOn?: boolean;
};

const CATEGORIES: Category[] = [
  {
    key: "necessary",
    label: "จำเป็น",
    desc: "คุกกี้ที่จำเป็นช่วยให้เว็บไซต์ทำงานได้ เช่น การเข้าสู่ระบบและการจัดการการตั้งค่าความยินยอม คุกกี้เหล่านี้ไม่เก็บข้อมูลส่วนบุคคลใดๆ",
    alwaysOn: true,
  },
  {
    key: "functional",
    label: "การทำงาน",
    desc: "คุกกี้เพื่อการทำงานช่วยให้เว็บไซต์สามารถแสดงฟังก์ชันเพิ่มเติม เช่น การแชร์เนื้อหาบนโซเชียลมีเดีย และฟีเจอร์จากบุคคลที่สาม",
  },
  {
    key: "analytics",
    label: "การวิเคราะห์",
    desc: "คุกกี้เชิงวิเคราะห์ใช้เพื่อทำความเข้าใจว่าผู้เยี่ยมชมโต้ตอบกับเว็บไซต์อย่างไร ข้อมูลเหล่านี้รวบรวมแบบไม่ระบุตัวตน เช่น จำนวนผู้เยี่ยมชม แหล่งที่มาของการเข้าชม",
  },
  {
    key: "performance",
    label: "ประสิทธิภาพ",
    desc: "คุกกี้ด้านประสิทธิภาพใช้เพื่อวิเคราะห์ตัวชี้วัดด้านประสิทธิภาพหลักของเว็บไซต์ ซึ่งช่วยในการมอบประสบการณ์ที่ดีขึ้นแก่ผู้เยี่ยมชม",
  },
  {
    key: "advertisement",
    label: "โฆษณา",
    desc: "คุกกี้โฆษณาใช้เพื่อนำเสนอโฆษณาที่ตรงกับความสนใจของผู้เยี่ยมชมตามหน้าที่เคยเข้าชม และวิเคราะห์ประสิทธิผลของแคมเปญโฆษณา",
  },
];

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [consent, setConsent] = useState<ConsentState>(DEFAULT_CONSENT);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) setVisible(true);
  }, []);

  const save = (state: ConsentState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setVisible(false);
    setShowSettings(false);
  };

  const acceptAll = () => save(ALL_ACCEPTED);
  const rejectAll = () => save(DEFAULT_CONSENT);
  const savePreferences = () => save(consent);

  const toggle = (key: keyof ConsentState) => {
    if (key === "necessary") return;
    setConsent((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!visible) return null;

  return (
    <>
      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          />
          <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                ปรับแต่งการตั้งค่าความยินยอม
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                aria-label="ปิด"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-5 space-y-1">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                เราใช้คุกกี้เพื่อให้เว็บไซต์ทำงานได้อย่างมีประสิทธิภาพ และเพื่อปรับปรุงประสบการณ์การใช้งานของคุณ คุณสามารถเลือกยอมรับหรือปฏิเสธคุกกี้แต่ละประเภทได้ตามต้องการ ดูรายละเอียดเพิ่มเติมได้ที่{" "}
                <Link href="/privacy-policy" className="text-primary underline hover:opacity-80" onClick={() => setShowSettings(false)}>
                  นโยบายความเป็นส่วนตัว
                </Link>
              </p>

              {CATEGORIES.map((cat) => (
                <div key={cat.key} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                    onClick={() => setExpanded(expanded === cat.key ? null : cat.key)}
                  >
                    <div className="flex items-center gap-2">
                      {expanded === cat.key
                        ? <ChevronDown className="w-4 h-4 text-slate-400" />
                        : <ChevronRight className="w-4 h-4 text-slate-400" />
                      }
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                        {cat.label}
                      </span>
                    </div>
                    {cat.alwaysOn ? (
                      <span className="text-xs font-semibold text-green-600 dark:text-green-400">เปิดตลอดเวลา</span>
                    ) : (
                      <div
                        role="switch"
                        aria-checked={consent[cat.key] as boolean}
                        onClick={(e) => { e.stopPropagation(); toggle(cat.key); }}
                        className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                          consent[cat.key] ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          consent[cat.key] ? "translate-x-5" : "translate-x-0"
                        }`} />
                      </div>
                    )}
                  </button>
                  {expanded === cat.key && (
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700">
                      {cat.desc}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer buttons */}
            <div className="flex gap-2 p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
              <button
                onClick={rejectAll}
                className="flex-1 border border-primary text-primary text-sm font-semibold py-2.5 rounded-lg hover:bg-primary/5 transition-colors"
              >
                ปฏิเสธทั้งหมด
              </button>
              <button
                onClick={savePreferences}
                className="flex-1 border border-primary text-primary text-sm font-semibold py-2.5 rounded-lg hover:bg-primary/5 transition-colors"
              >
                บันทึกการตั้งค่า
              </button>
              <button
                onClick={acceptAll}
                className="flex-1 bg-primary text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
              >
                ยอมรับทั้งหมด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main banner */}
      {!showSettings && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
            เราให้ความสำคัญกับความเป็นส่วนตัวของคุณ
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
            เราใช้คุกกี้เพื่อปรับปรุงประสบการณ์การใช้งาน นำเสนอเนื้อหาที่เหมาะสม และวิเคราะห์การใช้งานเว็บไซต์ การกด "ยอมรับทั้งหมด" ถือว่าคุณยินยอมให้ใช้คุกกี้ทั้งหมด{" "}
            <Link href="/privacy-policy" className="text-primary underline hover:opacity-80">
              นโยบายความเป็นส่วนตัว
            </Link>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(true)}
              data-testid="button-cookie-customise"
              className="flex-1 border border-primary text-primary text-sm font-semibold py-2 rounded-lg hover:bg-primary/5 transition-colors"
            >
              ปรับแต่ง
            </button>
            <button
              onClick={rejectAll}
              data-testid="button-cookie-reject"
              className="flex-1 border border-primary text-primary text-sm font-semibold py-2 rounded-lg hover:bg-primary/5 transition-colors"
            >
              ปฏิเสธทั้งหมด
            </button>
            <button
              onClick={acceptAll}
              data-testid="button-cookie-accept"
              className="flex-1 bg-primary text-white text-sm font-semibold py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              ยอมรับทั้งหมด
            </button>
          </div>
        </div>
      )}
    </>
  );
}
