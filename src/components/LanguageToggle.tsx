import { Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setLang(lang === "en" ? "ar" : "en")}
      aria-label="Change language"
    >
      <Languages className="w-4 h-4" />
      <span>{lang === "en" ? "العربية" : "English"}</span>
    </Button>
  );
}
