import { Suspense } from "react";
import type { Metadata } from "next";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";
import { LoginForm } from "../_components/login-form";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse o painel de proprietário ou portal do colaborador.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<CardListSkeleton count={1} />}>
      <LoginForm />
    </Suspense>
  );
}
