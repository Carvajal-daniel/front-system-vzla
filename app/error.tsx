"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { Button } from "@/components/ui/button";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    // Registra erro no cliente sem expor detalhes internos ao usuário final
    console.error("RootErrorBoundary:", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-canvas">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--status-danger-bg)] text-[var(--status-danger-ink)]">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-display-md text-ink">{t.errors.unexpectedTitle}</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          {t.errors.unexpectedDescription}
        </p>
        <div className="mt-6 flex justify-center">
          <Button type="button" onClick={reset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t.common.retry}
          </Button>
        </div>
      </div>
    </main>
  );
}
