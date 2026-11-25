import { Suspense } from "react";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";
import { ModuleAiInsightBanner } from "@/components/ui/module-ai-insight-banner";
import { AppointmentsPanel } from "../../_components/appointments-panel";

export const instant = false;

export default function OwnerAppointmentsPage() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <ModuleAiInsightBanner module="AGENDA" className="shrink-0" />
      <div className="min-h-0 flex-1">
        <Suspense fallback={<CardListSkeleton count={4} />}>
          <AppointmentsPanel />
        </Suspense>
      </div>
    </div>
  );
}
