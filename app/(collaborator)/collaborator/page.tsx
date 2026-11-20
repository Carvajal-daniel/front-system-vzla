import { Suspense } from "react";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";
import { MyAppointmentsPanel } from "../_components/my-appointments-panel";

export const instant = false;

export default function CollaboratorAgendaPage() {
  return (
    <Suspense fallback={<CardListSkeleton count={4} />}>
      <MyAppointmentsPanel />
    </Suspense>
  );
}
