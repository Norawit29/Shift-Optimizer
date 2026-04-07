import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Zap } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { getTranslations } from "@/lib/i18n";

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
  const feature = featureKey ? featureDetails[featureKey] : null;
  const featureName = feature ? feature[lang] : "";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <Crown className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-xl">{t.proGateTitle}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed pt-1">
            {featureName && (
              <span className="block mb-2 font-medium text-foreground">
                {lang === "th" ? `"${featureName}"` : `"${featureName}"`}
              </span>
            )}
            {t.proGateDesc}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 p-4 space-y-2">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {lang === "th" ? "✦ ฟีเจอร์ Pro ทั้งหมด" : "✦ All Pro Features"}
            </p>
            {Object.values(featureDetails).map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span>{f[lang]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
            onClick={onClose}
          >
            <Crown className="w-4 h-4 mr-1.5" />
            {t.proGateUpgrade}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
