import { Suspense } from "react";
import { BlocksPanel } from "../../_components/blocks-panel";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";

export default function OwnerBlocksPage() {
  return (
    <Suspense fallback={<CardListSkeleton count={3} />}>
      <BlocksPanel />
    </Suspense>
  );
}
