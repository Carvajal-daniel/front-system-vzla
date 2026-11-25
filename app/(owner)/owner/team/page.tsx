import { ModuleAiInsightBanner } from "@/components/ui/module-ai-insight-banner";
import { TeamPanel } from "../../_components/team-panel";

export default function OwnerTeamPage() {
  return (
    <div className="space-y-4">
      <ModuleAiInsightBanner module="TEAM" />
      <TeamPanel />
    </div>
  );
}
