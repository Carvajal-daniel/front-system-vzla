import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthGuard } from "@/components/ui/auth-guard";
import { OwnerShell } from "./_components/owner-shell";

export const instant = false;

export const metadata: Metadata = {
  title: "Painel do Proprietário",
  robots: { index: false, follow: false },
};

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard requiredRole="OWNER">
      <OwnerShell>{children}</OwnerShell>
    </AuthGuard>
  );
}
