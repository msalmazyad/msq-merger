import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { I18nProvider, useI18n } from "./lib/i18n";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AlertCircle } from "lucide-react";
import { Button } from "./components/ui/button";

function FatalFallback({ error, reset }: { error: Error; reset: () => void }) {
  // Inside the i18n provider, so we can localise the message.
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full rounded-xl border bg-card p-6 shadow-sm text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
        <h1 className="text-lg font-semibold">{t("fatalTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("fatalSubtitle")}</p>
        <pre className="text-xs text-muted-foreground bg-muted/50 rounded p-2 overflow-auto max-h-32 text-start">
          {error.message}
        </pre>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => { reset(); window.location.reload(); }}>
            {t("reload")}
          </Button>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <ErrorBoundary fallback={(error, reset) => (
        <FatalFallback error={error} reset={reset} />
      )}>
        <App />
      </ErrorBoundary>
    </I18nProvider>
  </StrictMode>,
);
