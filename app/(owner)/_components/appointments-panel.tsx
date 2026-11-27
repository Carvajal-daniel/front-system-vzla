"use client";

import { useSearchParams } from "next/navigation";
import { useSession } from "@/components/ui/auth-guard";
import { AgendaWorkspace } from "@/components/ui/agenda-workspace";
import { parseAgendaDate } from "@/lib/agenda";
import { ReceiptDialog } from "./receipt-dialog";

export function AppointmentsPanel() {
  const { session } = useSession();
  const initialDate = parseAgendaDate(useSearchParams().get("date"));
  return (
    <div className="h-full min-h-0">
      <AgendaWorkspace
        key={initialDate}
        session={session}
        initialDate={initialDate}
        renderReceipt={(props) => <ReceiptDialog {...props} allowOnlinePix />}
      />
    </div>
  );
}
