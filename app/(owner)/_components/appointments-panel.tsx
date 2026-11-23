"use client";

import { useSession } from "@/components/ui/auth-guard";
import { AgendaWorkspace } from "@/components/ui/agenda-workspace";
import { ReceiptDialog } from "./receipt-dialog";

export function AppointmentsPanel() {
  const { session } = useSession();
  return (
    <div className="h-full min-h-0">
      <AgendaWorkspace session={session} renderReceipt={(props) => <ReceiptDialog {...props} />} />
    </div>
  );
}
