import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "./button";

export interface ErrorStateProps {
  title: string;
  description: string;
  retryLabel: string;
  onRetry?: () => void;
}

export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-6 py-8 text-center"
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-[var(--status-danger-ink)]">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="text-title-sm font-semibold text-[var(--status-danger-ink)]">
        {title}
      </h3>
      <p className="mt-1.5 max-w-md text-sm text-ink-secondary">{description}</p>
      {onRetry && (
        <div className="mt-5">
          <Button type="button" variant="secondary" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
