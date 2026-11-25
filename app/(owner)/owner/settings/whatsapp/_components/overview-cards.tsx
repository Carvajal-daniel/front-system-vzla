"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  Loader2,
  Power,
  QrCode,
  UserRoundCheck,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EvolutionConnectionStatus } from "@/lib/whatsapp-connection";

export interface WhatsAppOverviewCardsProps {
  es: boolean;
  status: EvolutionConnectionStatus;
  phoneNumber: string | null;
  remindersEnabled: boolean;
  remindersSent30d: number;
  humanQueueCount: number;
  disconnecting: boolean;
  onOpenWizard: () => void;
  onDisconnect: () => void;
}

export function WhatsAppOverviewCards({
  es,
  status,
  phoneNumber,
  remindersEnabled,
  remindersSent30d,
  humanQueueCount,
  disconnecting,
  onOpenWizard,
  onDisconnect,
}: WhatsAppOverviewCardsProps) {
  const isConnected = status === "CONNECTED";
  const isPending = status === "QRCODE_PENDING";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Card 1: Status do WhatsApp */}
      <article className="flex flex-col justify-between rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              {es ? "Estado de WhatsApp" : "Status do WhatsApp"}
            </p>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  isConnected
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                    : isPending
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-500"
                }`}
              >
                {isConnected ? (
                  <CheckCircle2 size={12} />
                ) : (
                  <WifiOff size={12} />
                )}
                {isConnected
                  ? es
                    ? "Conectado"
                    : "Conectado"
                  : isPending
                    ? es
                      ? "Esperando QR"
                      : "Aguardando QR"
                    : es
                      ? "Desconectado"
                      : "Desconectado"}
              </span>
            </div>
            <p className="pt-1 font-mono text-xs text-ink-secondary">
              {phoneNumber
                ? phoneNumber
                : es
                  ? "Ningún número vinculado"
                  : "Nenhum número vinculado"}
            </p>
          </div>

          <span
            className={`grid size-10 shrink-0 place-items-center rounded-xl ${
              isConnected
                ? "bg-emerald-500/15 text-emerald-500"
                : "bg-subtle text-ink-muted"
            }`}
          >
            <QrCode size={18} />
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-border-subtle/70 pt-3">
          {isConnected ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenWizard}
                className="flex-1 rounded-xl border-border-subtle text-xs font-semibold"
              >
                {es ? "Configurar" : "Configurar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDisconnect}
                disabled={disconnecting}
                className="rounded-xl border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-semibold"
              >
                {disconnecting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Power size={13} />
                )}
                {es ? "Desconectar" : "Desconectar"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={onOpenWizard}
              className="w-full rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 text-xs font-semibold"
            >
              <QrCode size={14} />
              {es ? "Conectar WhatsApp" : "Conectar WhatsApp"}
            </Button>
          )}
        </div>
      </article>

      {/* Card 2: Lembretes Automáticos */}
      <article className="flex flex-col justify-between rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              {es ? "Recordatorios Automáticos" : "Lembretes Automáticos"}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-ink">
                {remindersSent30d}
              </span>
              <span className="text-xs text-ink-muted">
                {es ? "envíos (30 días)" : "envios (30 dias)"}
              </span>
            </div>
            <p className="text-xs text-ink-secondary">
              {remindersEnabled
                ? es
                  ? "Confirmaciones 24h/2h activas"
                  : "Confirmações 24h/2h ativas"
                : es
                  ? "Activa en Configuración de Agenda"
                  : "Ative nas Configurações da Agenda"}
            </p>
          </div>

          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500">
            <BellRing size={18} />
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border-subtle/70 pt-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-500">
            {es ? "0 consumo de cuota IA" : "Sem consumo de cota IA"}
          </span>
          <Link
            href="/owner/settings"
            className="text-xs font-semibold text-ink-secondary hover:text-emerald-500 transition-colors"
          >
            {es ? "Ajustar" : "Ajustar"}
          </Link>
        </div>
      </article>

      {/* Card 3: Fila Humana */}
      <article className="flex flex-col justify-between rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              {es ? "Cola Humana" : "Fila Humana"}
            </p>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold tabular-nums ${
                  humanQueueCount > 0 ? "text-amber-500" : "text-ink"
                }`}
              >
                {humanQueueCount}
              </span>
              <span className="text-xs text-ink-muted">
                {humanQueueCount === 1
                  ? es
                    ? "conversación pausada"
                    : "conversa pausada"
                  : es
                    ? "conversaciones pausadas"
                    : "conversas pausadas"}
              </span>
            </div>
            <p className="text-xs text-ink-secondary">
              {humanQueueCount > 0
                ? es
                  ? "Esperando atención de tu equipo"
                  : "Aguardando um atendente humano"
                : es
                  ? "Ningún cliente esperando en cola"
                  : "Nenhum cliente aguardando na fila"}
            </p>
          </div>

          <span
            className={`grid size-10 shrink-0 place-items-center rounded-xl ${
              humanQueueCount > 0
                ? "bg-amber-500/15 text-amber-500"
                : "bg-subtle text-ink-muted"
            }`}
          >
            <UserRoundCheck size={18} />
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border-subtle/70 pt-3">
          <span className="text-[11px] text-ink-muted">
            {es ? "Transbordo directo al Inbox" : "Transbordo direto para o Inbox"}
          </span>
          <Link
            href="/owner/whatsapp"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            {es ? "Abrir Inbox" : "Abrir Inbox"}
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </article>
    </div>
  );
}
