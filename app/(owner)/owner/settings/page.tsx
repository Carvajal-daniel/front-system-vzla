import { Suspense } from "react";
import { SettingsPanel } from "../../_components/settings-panel";

export default function OwnerSettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPanel />
    </Suspense>
  );
}
