"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { useLocale } from "@/lib/i18n/locale-context";

export default function CollaboratorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    console.error("CollaboratorErrorBoundary:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="py-10">
      <ErrorState
        title={t.errors.unexpectedTitle}
        description={t.errors.unexpectedDescription}
        retryLabel={t.common.retry}
        onRetry={reset}
      />
    </div>
  );
}
