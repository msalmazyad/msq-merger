import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface Props { current: 1 | 2 | 3 | 4; }

export function StepIndicator({ current }: Props) {
  const { t } = useI18n();
  const steps = [
    { n: 1, label: t("step1Label") },
    { n: 2, label: t("step2Label") },
    { n: 3, label: t("step3Label") },
    { n: 4, label: t("step4Label") },
  ];

  return (
    <ol className="flex flex-wrap gap-2 mb-6">
      {steps.map((s) => {
        const done = s.n < current;
        const active = s.n === current;
        return (
          <li
            key={s.n}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border ps-1.5 pe-3 py-1 text-sm transition-colors",
              done && "bg-success/10 border-success/30 text-success",
              active && "bg-primary text-primary-foreground border-primary",
              !done && !active && "bg-background text-muted-foreground border-border",
            )}
          >
            <span
              className={cn(
                "inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold",
                done && "bg-success text-white",
                active && "bg-white/20",
                !done && !active && "bg-muted",
              )}
            >
              {done ? <Check className="w-3 h-3" /> : s.n}
            </span>
            <span className="font-medium">{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
