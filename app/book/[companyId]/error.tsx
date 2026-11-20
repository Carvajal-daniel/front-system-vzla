"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { useLocale } from "@/lib/i18n/locale-context";

export default function BookingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    console.error("BookingErrorBoundary:", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="min-h-dvh flex items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <ErrorState
          title={t.errors.networkTitle}
          description={t.errors.networkDescription}
          retryLabel={t.common.retry}
          onRetry={reset}
        />
      </div>
    </main>
  );
}
