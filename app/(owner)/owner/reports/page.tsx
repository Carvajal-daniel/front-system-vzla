import { Suspense } from "react";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";
import { OwnerDashboard } from "../../_components/owner-dashboard";

export const instant = false;

// Painel principal consolidado de relatórios (KPIs, comparação de faturamento e metas)
export default function OwnerReportsMainPage() {
  return (
    <Suspense fallback={<CardListSkeleton count={6} />}>
      <OwnerDashboard />
    </Suspense>
  );
}
