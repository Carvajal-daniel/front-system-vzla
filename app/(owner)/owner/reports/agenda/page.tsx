import { Suspense } from "react";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";
import { AgendaReportPanel } from "../../../_components/agenda-report-panel";

export const instant = false;

// Página de relatórios dedicados da Agenda (volume, status, profissionais, serviços e agendamentos futuros)
export default function AgendaReportsPage() {
  return (
    <Suspense fallback={<CardListSkeleton count={4} />}>
      <AgendaReportPanel />
    </Suspense>
  );
}
