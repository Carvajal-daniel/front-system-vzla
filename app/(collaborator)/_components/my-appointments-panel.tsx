"use client";

import { useSession } from "@/components/ui/auth-guard";
import { AgendaWorkspace } from "@/components/ui/agenda-workspace";

export function MyAppointmentsPanel() {
  const { session } = useSession();
  return <AgendaWorkspace session={session} />;
}
