"use client";

import type { ReactNode } from "react";
import { usePrivacy } from "@/lib/privacy-context";

export function SensitiveValue({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { hideSensitiveValues } = usePrivacy();
  return <span className={className} aria-label={hideSensitiveValues ? "Valor oculto" : undefined}>{hideSensitiveValues ? "••••" : children}</span>;
}

export function maskCurrency(value: string, hideSensitiveValues: boolean): string {
  return hideSensitiveValues ? "••••" : value;
}
