"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function PortalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-8 text-center shadow-xs">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--status-danger-bg)] text-[var(--status-danger-ink)]">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold text-ink">
          Não foi possível carregar o portal
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Ocorreu uma instabilidade momentânea ao carregar as informações do
          estabelecimento. Tente novamente em instantes.
        </p>
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={reset}
            className="cursor-pointer inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Tentar novamente
          </button>
        </div>
      </div>
    </main>
  );
}
