import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthGuard } from "@/components/ui/auth-guard";
import { CollaboratorShell } from "./_components/collaborator-shell";

export const instant = false;

export const metadata: Metadata = {
  title: "Portal do Colaborador",
  robots: { index: false, follow: false },
};

export default function CollaboratorLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthGuard requiredRole="COLLABORATOR">
      <CollaboratorShell>{children}</CollaboratorShell>
    </AuthGuard>
  );
}
