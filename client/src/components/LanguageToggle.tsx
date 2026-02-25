import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setLang(lang === "en" ? "th" : "en")}
      className="gap-1.5"
      aria-label={lang === "en" ? "Switch to Thai" : "เปลี่ยนเป็นภาษาอังกฤษ"}
      data-testid="button-language-toggle"
    >
      <Languages className="w-4 h-4" aria-hidden="true" />
      {lang === "en" ? "TH" : "EN"}
    </Button>
  );
}
