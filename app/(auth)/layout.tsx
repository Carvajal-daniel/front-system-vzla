import type { ReactNode } from "react";
import Link from "next/link";
import { Scissors } from "lucide-react";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-canvas text-ink">
      <header className="border-b border-border-subtle bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2.5 text-base font-bold text-ink"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-ink shadow-xs">
              <Scissors className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="font-display text-lg tracking-tight">
              Atelier Agenda
            </span>
          </Link>
          <LocaleSwitcher />
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-8 sm:px-6 sm:py-12">
        <div className="relative z-10 w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
