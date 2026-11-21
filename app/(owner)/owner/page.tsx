import { Suspense } from "react";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";
import { OwnerDashboard } from "../_components/owner-dashboard";

export const instant = false;

export default function OwnerDashboardPage() {
  return (
    <Suspense fallback={<CardListSkeleton count={6} />}>
      <OwnerDashboard />
    </Suspense>
  );
}
