import { ModuleAiInsightBanner } from "@/components/ui/module-ai-insight-banner";
import { ServicesPanel } from "../../_components/services-panel";

export default function OwnerServicesPage() {
  return (
    <div className="space-y-4">
      <ModuleAiInsightBanner module="SERVICES" />
      <ServicesPanel />
    </div>
  );
}
