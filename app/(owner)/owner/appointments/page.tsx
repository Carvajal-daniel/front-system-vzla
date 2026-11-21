import { Suspense } from "react";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";
import { AppointmentsPanel } from "../../_components/appointments-panel";

export const instant = false;

export default function OwnerAppointmentsPage() {
  return <Suspense fallback={<CardListSkeleton count={4} />}><AppointmentsPanel /></Suspense>;
}
