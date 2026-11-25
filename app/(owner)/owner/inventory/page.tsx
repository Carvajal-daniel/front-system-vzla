import { ModuleAiInsightBanner } from "@/components/ui/module-ai-insight-banner";
import { InventoryPanel } from "../../_components/inventory-panel";

export const instant = false;

export default function OwnerInventoryPage() {
  return (
    <div className="space-y-4">
      <ModuleAiInsightBanner module="INVENTORY" />
      <InventoryPanel />
    </div>
  );
}
