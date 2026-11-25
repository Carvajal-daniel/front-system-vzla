import { ModuleAiInsightBanner } from "@/components/ui/module-ai-insight-banner";
import { FinancePanel } from "../../_components/finance-panel";

export const instant = false;

export default function OwnerFinancePage() {
  return (
    <div className="space-y-4">
      <ModuleAiInsightBanner module="FINANCE" />
      <FinancePanel />
    </div>
  );
}
