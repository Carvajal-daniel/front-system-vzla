"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";
import { deactivateCollaborator } from "@/lib/types/team";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

export type StructuredDeactivationReason =
  | "ILLNESS"
  | "PERSONAL"
  | "VACATION"
  | "TERMINATION";

interface DeactivationModalProps {
  open: boolean;
  collaboratorId: string;
  collaboratorName?: string;
  futureCount: number;
  title?: string;
  onClose: () => void;
  onDeactivated: () => Promise<void> | void;
}

export function DeactivationModal({
  open,
  collaboratorId,
  collaboratorName,
  futureCount,
  title,
  onClose,
  onDeactivated,
}: DeactivationModalProps) {
  const { t } = useLocale();
  const cp = t.owner.collaboratorProfile;

  const [selectedReason, setSelectedReason] =
    useState<StructuredDeactivationReason>("ILLNESS");
  const [notes, setNotes] = useState("");
  const [queueAiReschedule, setQueueAiReschedule] = useState(true);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedReason("ILLNESS");
    setNotes("");
    setQueueAiReschedule(true);
  }, [open, collaboratorId]);

  const reasonOptions: Array<{
    value: StructuredDeactivationReason;
    label: string;
  }> = [
    { value: "ILLNESS", label: cp.deactivationReasonIllness },
    { value: "PERSONAL", label: cp.deactivationReasonPersonal },
    { value: "VACATION", label: cp.deactivationReasonVacation },
    { value: "TERMINATION", label: cp.deactivationReasonTermination },
  ];

  const handleConfirm = async () => {
    setDeactivating(true);
    try {
      const selectedLabel =
        reasonOptions.find((opt) => opt.value === selectedReason)?.label ??
        cp.deactivationReasonTermination;
      const trimmedNotes = notes.trim();
      const formattedReason = trimmedNotes
        ? `${selectedLabel} — ${trimmedNotes}`
        : selectedLabel;

      const res = await deactivateCollaborator(collaboratorId, {
        reason: formattedReason,
        queueAiReschedule: futureCount > 0 ? queueAiReschedule : false,
      });

      onClose();
      if (res.queuedCount > 0) {
        toast.success(
          `${cp.deactivatedQueuedToastPrefix} ${res.queuedCount} ${cp.deactivatedQueuedToastSuffix}`,
        );
      } else {
        toast.success(cp.deactivatedSuccessToast);
      }
      await onDeactivated();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!deactivating) onClose();
      }}
      title={
        collaboratorName
          ? `${title ?? cp.deactivateModalTitle} — ${collaboratorName}`
          : (title ?? cp.deactivateModalTitle)
      }
    >
      <div className="space-y-4">
        {/* Garantia de preservação histórica */}
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5 text-xs text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{cp.deactivatePreserveNotice}</span>
        </div>

        {/* Alerta de agendamentos futuros + Switch Fila IA */}
        {futureCount > 0 ? (
          <div className="space-y-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-4">
            <div className="flex items-start gap-2.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {cp.deactivateFutureAlertPrefix} {futureCount}{" "}
                {cp.deactivateFutureAlertSuffix}
              </span>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={queueAiReschedule}
                onChange={(e) => setQueueAiReschedule(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-accent cursor-pointer"
              />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-ink inline-flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5 text-accent shrink-0" />
                  {cp.deactivateQueueAiLabel}
                </p>
                <p className="text-[11px] leading-relaxed text-ink-muted">
                  {cp.deactivateQueueAiDescription}
                </p>
              </div>
            </label>
          </div>
        ) : (
          <p className="text-xs text-ink-secondary">{cp.deactivateFutureZero}</p>
        )}

        {/* Seletor estruturado de motivo */}
        <div className="space-y-1.5">
          <Label htmlFor="deactivate-reason-select">
            {cp.deactivationReasonSelectLabel}
          </Label>
          <select
            id="deactivate-reason-select"
            value={selectedReason}
            onChange={(e) =>
              setSelectedReason(e.target.value as StructuredDeactivationReason)
            }
            className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            {reasonOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Observação adicional opcional */}
        <div className="space-y-1.5">
          <Label htmlFor="deactivate-notes">{cp.deactivationNotesLabel}</Label>
          <textarea
            id="deactivate-notes"
            rows={3}
            maxLength={350}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={cp.deactivationNotesPlaceholder}
            className="w-full rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={deactivating}
            onClick={onClose}
            className="cursor-pointer"
          >
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deactivating}
            onClick={() => void handleConfirm()}
            className="cursor-pointer"
          >
            {deactivating && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {cp.deactivateConfirmBtn}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
