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
      data-testid="button-language-toggle"
    >
      <Languages className="w-4 h-4" />
      {lang === "en" ? "TH" : "EN"}
    </Button>
  );
}
