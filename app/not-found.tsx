import Link from "next/link";
import { Compass } from "lucide-react";

export default function RootNotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-canvas">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Compass className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted tabular-nums">
          404
        </p>
        <h1 className="mt-2 text-display-md text-ink">
          Página não encontrada
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          O endereço acessado não existe ou não está mais disponível.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  );
}
