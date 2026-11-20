import Link from "next/link";
import { Scissors } from "lucide-react";

export default function BookingNotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-8 text-center shadow-xs">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Scissors className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted tabular-nums">
          404
        </p>
        <h1 className="mt-2 text-display-md text-ink">
          Estabelecimento não encontrado
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          O link de reserva informado não existe ou não está ativo no momento.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            Ir para a página inicial
          </Link>
        </div>
      </div>
    </main>
  );
}
