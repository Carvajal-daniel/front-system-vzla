"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { formatDateTimeInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import type { Appointment } from "@/lib/types/appointment";
import { useSession } from "@/components/ui/auth-guard";

const POLL_INTERVAL_MS = 30_000;

function readSeenIds(storageKey: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((v): v is string => typeof v === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

function writeSeenIds(storageKey: string, ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    // Mantém apenas os 200 IDs mais recentes para não inflar o localStorage
    const trimmed = Array.from(ids).slice(-200);
    window.localStorage.setItem(storageKey, JSON.stringify(trimmed));
  } catch {
    // Ignora falhas de storage
  }
}

/**
 * Sininho de notificações para Owner e Colaborador: consulta periodicamente
 * os agendamentos recentes, destaca não lidos com badge e exibe aviso discreto
 * quando uma nova reserva chega durante a sessão.
 */
export function NotificationsBell() {
  const router = useRouter();
  const { session } = useSession();
  const { locale, t } = useLocale();
  const storageKey = `atelier_seen_appts_${session.id}`;
  const endpoint =
    session.role === "OWNER" ? "/appointments" : "/me/appointments";

  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<Appointment[]>([]);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(() => new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());

  const pollAppointments = useCallback(async () => {
    try {
      const list = await apiRequest<Appointment[]>(endpoint, { auth: true });
      if (!Array.isArray(list)) return;

      const sorted = [...list].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const topRecent = sorted.slice(0, 12);
      setRecent(topRecent);

      const seen = readSeenIds(storageKey);

      if (!initializedRef.current) {
        initializedRef.current = true;
        knownIdsRef.current = new Set(sorted.map((a) => a.id));
        // Na primeira carga, se ainda não havia histórico salvo, marca os existentes como vistos
        if (seen.size === 0 && sorted.length > 0) {
          const allIds = new Set(sorted.map((a) => a.id));
          writeSeenIds(storageKey, allIds);
          setUnreadIds(new Set());
          return;
        }
      } else {
        const newlyArrived = sorted.filter(
          (a) => !knownIdsRef.current.has(a.id),
        );
        if (newlyArrived.length > 0) {
          for (const item of newlyArrived) {
            knownIdsRef.current.add(item.id);
          }
          setToastMessage(
            `${t.notifications.newBookingToast} ${newlyArrived[0].clientName}`,
          );
          window.setTimeout(() => setToastMessage(null), 5000);
        }
      }

      const nextUnread = new Set<string>();
      for (const item of topRecent) {
        if (!seen.has(item.id)) {
          nextUnread.add(item.id);
        }
      }
      setUnreadIds(nextUnread);
    } catch {
      // Falha silenciosa no polling para não interromper o uso do painel
    }
  }, [endpoint, storageKey, t.notifications.newBookingToast]);

  useEffect(() => {
    let active = true;
    const run = () => {
      if (active) void pollAppointments();
    };
    const initialTimer = window.setTimeout(run, 400);
    const interval = window.setInterval(run, POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [pollAppointments]);

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  const handleMarkAllRead = () => {
    const seen = readSeenIds(storageKey);
    for (const item of recent) {
      seen.add(item.id);
    }
    writeSeenIds(storageKey, seen);
    setUnreadIds(new Set());
  };

  // Marca notificação como lida, fecha o popover e navega diretamente para o card na agenda
  const handleSelectNotification = (appointmentId: string) => {
    const seen = readSeenIds(storageKey);
    seen.add(appointmentId);
    writeSeenIds(storageKey, seen);
    setUnreadIds((prev) => {
      const next = new Set(prev);
      next.delete(appointmentId);
      return next;
    });
    setOpen(false);
    const basePath = session.role === "OWNER" ? "/owner" : "/collaborator";
    router.push(`${basePath}?appointmentId=${encodeURIComponent(appointmentId)}`);
  };

  const unreadCount = unreadIds.size;

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t.notifications.title}
        title={t.notifications.title}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-border-subtle bg-surface text-ink-secondary transition-colors hover:border-border-strong hover:text-ink cursor-pointer"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-bold text-accent-ink tabular-nums">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-20 right-4 z-50 rounded-2xl border border-accent/30 bg-surface px-4 py-3 text-xs font-semibold text-ink shadow-xl lg:bottom-6"
        >
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" />
            {toastMessage}
          </span>
        </div>
      )}

      {open && (
        <div
          role="menu"
          aria-label={t.notifications.title}
          className="absolute right-0 top-13 z-50 w-80 max-w-[90vw] rounded-2xl border border-border-subtle bg-surface p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <p className="text-xs font-bold text-ink">
              {t.notifications.title}
            </p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {t.notifications.markAllRead}
              </button>
            )}
          </div>

          {recent.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-ink-muted">
              {t.notifications.empty}
            </p>
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto">
              {recent.map((appt) => {
                const isUnread = unreadIds.has(appt.id);
                return (
                  <li key={appt.id}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelectNotification(appt.id)}
                      className={[
                        "w-full text-left rounded-xl border px-3 py-2 text-xs transition-colors cursor-pointer",
                        isUnread
                          ? "border-accent/30 bg-accent-soft/40 hover:bg-accent-soft/70"
                          : "border-border-subtle bg-subtle/40 hover:bg-subtle",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-ink truncate">
                          {appt.clientName}
                        </p>
                        {isUnread && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                        )}
                      </div>
                      <p className="text-ink-secondary truncate">
                        {appt.serviceNameSnapshot}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-muted tabular-nums">
                        {formatDateTimeInTimezone(
                          appt.startsAt,
                          session.company.timezone,
                          locale,
                        )}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
