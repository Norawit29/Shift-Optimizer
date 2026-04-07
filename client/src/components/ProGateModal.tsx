import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Check, X, Loader2, Zap } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { getTranslations } from "@/lib/i18n";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";

interface ProGateModalProps {
  open: boolean;
  onClose: () => void;
  featureKey?: string;
}

const featureDetails: Record<string, { en: string; th: string }> = {
  shifts: {
    en: "More than 3 shifts per day",
    th: "จำนวนเวรต่อวันมากกว่า 3 เวร",
  },
  levels: {
    en: "More than 3 staff levels",
    th: "ระดับขั้นบุคลากรมากกว่า 3 ระดับ",
  },
  staffCount: {
    en: "More than 15 staff members",
    th: "จำนวนบุคลากรมากกว่า 15 คน",
  },
  holidays: {
    en: "Weekend & holiday shift balancing",
    th: "การเกลี่ยเวรวันหยุด",
  },
  staffSchedule: {
    en: "Per-staff individual schedule view",
    th: "ตารางเวรรายบุคคล",
  },
  exportExcel: {
    en: "Export to Excel",
    th: "ส่งออกไฟล์ Excel",
  },
};

export function ProGateModal({ open, onClose, featureKey }: ProGateModalProps) {
  const { lang } = useLanguage();
  const t = getTranslations(lang);
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const feature = featureKey ? featureDetails[featureKey] : null;
  const featureName = feature ? feature[lang] : "";

  const { data: products } = useQuery<any>({
    queryKey: ["/api/stripe/products"],
    enabled: open,
  });

  const monthlyPrice = products?.data?.[0]?.prices?.find(
    (p: any) => p.recurring?.interval === "month"
  );

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await apiRequest("POST", "/api/stripe/checkout", { priceId });
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.url) window.open(data.url, "_blank");
    },
  });

  const handleUpgrade = () => {
    if (!user) {
      onClose();
      setLocation("/pricing");
      return;
    }
    if (monthlyPrice?.id) {
      checkoutMutation.mutate(monthlyPrice.id);
    } else {
      onClose();
      setLocation("/pricing");
    }
  };

  const freeFeatures = lang === "th"
    ? [
        { label: "บุคลากรสูงสุด 15 คน", included: true },
        { label: "เวรสูงสุด 3 เวรต่อวัน", included: true },
        { label: "ระดับขั้นบุคลากรสูงสุด 3 ระดับ", included: true },
        { label: "การเกลี่ยเวรวันหยุด", included: false },
        { label: "ตารางเวรรายบุคคล", included: false },
        { label: "ส่งออก Excel", included: false },
      ]
    : [
        { label: "Up to 15 staff members", included: true },
        { label: "Up to 3 shifts per day", included: true },
        { label: "Up to 3 staff levels", included: true },
        { label: "Holiday shift balancing", included: false },
        { label: "Per-staff schedule view", included: false },
        { label: "Export to Excel", included: false },
      ];

  const proFeatures = lang === "th"
    ? [
        "บุคลากรไม่จำกัด",
        "เวรสูงสุด 5 เวรต่อวัน",
        "ระดับขั้นบุคลากรสูงสุด 5 ระดับ",
        "การเกลี่ยเวรวันหยุด",
        "ตารางเวรรายบุคคล",
        "ส่งออก Excel",
      ]
    : [
        "Unlimited staff members",
        "Up to 5 shifts per day",
        "Up to 5 staff levels",
        "Holiday shift balancing",
        "Per-staff schedule view",
        "Export to Excel",
      ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30 shrink-0">
              <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t.proGateTitle}</h2>
              {featureName && (
                <p className="text-sm text-muted-foreground">
                  {lang === "th" ? `ต้องการ: "${featureName}"` : `Requires: "${featureName}"`}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 pb-5">
          <div className="grid grid-cols-2 gap-3">
            {/* Free card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">
                {lang === "th" ? "ฟรี" : "Free"}
              </p>
              <div className="space-y-2">
                {freeFeatures.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    {f.included ? (
                      <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400 dark:text-slate-500" />
                    ) : (
                      <X className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-300 dark:text-slate-600" />
                    )}
                    <span className={f.included
                      ? "text-slate-600 dark:text-slate-300"
                      : "text-slate-300 dark:text-slate-600 line-through"
                    }>
                      {f.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pro card */}
            <div className="rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/15 p-4 relative">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                  {lang === "th" ? "แนะนำ" : "Popular"}
                </span>
              </div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-3">
                Pro
              </p>
              <div className="space-y-2">
                {proFeatures.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500 dark:text-amber-400" />
                    <span className="text-amber-800 dark:text-amber-300">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 text-center text-xs text-muted-foreground">
            {lang === "th"
              ? "ทดลองใช้ฟรี 14 วัน · ฿299/เดือน"
              : "14-day free trial · ฿299/month"}
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold"
            onClick={handleUpgrade}
            disabled={checkoutMutation.isPending}
            data-testid="button-pro-gate-upgrade"
          >
            {checkoutMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Crown className="w-4 h-4 mr-1.5" />
            )}
            {t.proGateUpgrade}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
