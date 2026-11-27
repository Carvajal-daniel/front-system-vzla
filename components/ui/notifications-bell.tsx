"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Bot,
  Check,
  CheckCheck,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  Volume2,
  VolumeX,
} from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { formatDateTimeInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import {
  INSIGHTS_UPDATED_EVENT,
  intelligenceApi,
  type ProactiveInsightItem,
} from "@/lib/intelligence-api";
import {
  OWNER_ALERTS_UPDATED_EVENT,
  operationsApi,
  type OwnerAlertRecord,
  type OwnerAlertType,
} from "@/lib/operations-api";
import type { Appointment } from "@/lib/types/appointment";
import { useSession } from "@/components/ui/auth-guard";

const OWNER_ALERT_META: Record<
  OwnerAlertType,
  { label: string; badgeClass: string; Icon: typeof ShieldAlert }
> = {
  LOW_SURVEY_SCORE: {
    label: "Nota Retida (1–3★)",
    badgeClass: "border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300",
    Icon: ShieldAlert,
  },
  COLLABORATOR_EMERGENCY: {
    label: "Modo Imprevisto",
    badgeClass: "border-amber-500/35 bg-amber-500/12 text-amber-800 dark:text-amber-300",
    Icon: AlertTriangle,
  },
  CHURN_OPPORTUNITY: {
    label: "Radar de Churn",
    badgeClass: "border-accent/35 bg-accent-soft text-accent",
    Icon: TrendingDown,
  },
  AI_HANDOFF: {
    label: "Atendimento IA",
    badgeClass: "border-sky-500/35 bg-sky-500/12 text-sky-700 dark:text-sky-300",
    Icon: Bot,
  },
};

const POLL_INTERVAL_MS = 30_000;
const SOUND_STORAGE_KEY = "atelier_agenda_notification_sound";
const SOUND_CHANGE_EVENT = "atelier:notification-sound-change";

function readSoundPreference() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SOUND_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function subscribeSoundPreference(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", callback);
  window.addEventListener(SOUND_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SOUND_CHANGE_EVENT, callback);
  };
}

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
    const trimmed = Array.from(ids).slice(-200);
    window.localStorage.setItem(storageKey, JSON.stringify(trimmed));
  } catch {
    // Ignora falhas de storage
  }
}

export function NotificationsBell() {
  const router = useRouter();
  const { session } = useSession();
  const { locale, t } = useLocale();
  const storageKey = `atelier_seen_appts_${session.id}`;
  const isOwner = session.role === "OWNER";
  const endpoint = isOwner ? "/appointments" : "/me/appointments";

  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<Appointment[]>([]);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(() => new Set());
  const [aiInsights, setAiInsights] = useState<ProactiveInsightItem[]>([]);
  const [aiPendingCount, setAiPendingCount] = useState(0);
  const [ownerAlerts, setOwnerAlerts] = useState<OwnerAlertRecord[]>([]);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [markingAlertId, setMarkingAlertId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const soundEnabled = useSyncExternalStore(
    subscribeSoundPreference,
    readSoundPreference,
    () => true,
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());

  const playAlert = useCallback(
    (force = false) => {
      if ((!soundEnabled && !force) || typeof window === "undefined") return;
      try {
        const AudioContextConstructor = window.AudioContext;
        if (!AudioContextConstructor) return;
        const context = new AudioContextConstructor();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, context.currentTime);
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.23);
        oscillator.onended = () => {
          void context.close();
        };
      } catch {
        // Áudio opcional
      }
    },
    [soundEnabled],
  );

  const pollOwnerAlerts = useCallback(async () => {
    if (!isOwner) return;
    try {
      const data = await operationsApi.listOwnerAlerts({ limit: 20 });
      if (Array.isArray(data.alerts)) {
        setOwnerAlerts(data.alerts);
      }
    } catch {
      // Falha silenciosa no polling
    }
  }, [isOwner]);

  const pollAiInsights = useCallback(async () => {
    if (!isOwner) return;
    try {
      const data = await intelligenceApi.listInsights({
        status: "PENDING",
        limit: 5,
      });
      setAiInsights(data.insights);
      setAiPendingCount(data.pendingCount);
    } catch {
      // Falha silenciosa no polling
    }
  }, [isOwner]);

  const pollAppointments = useCallback(async () => {
    try {
      const list = await apiRequest<Appointment[]>(endpoint, { auth: true });
      if (!Array.isArray(list)) return;

      const sorted = [...list].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const topRecent = sorted.slice(0, 8);
      setRecent(topRecent);

      const seen = readSeenIds(storageKey);

      if (!initializedRef.current) {
        initializedRef.current = true;
        knownIdsRef.current = new Set(sorted.map((a) => a.id));
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
          playAlert();
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
      // Falha silenciosa no polling
    }
  }, [endpoint, playAlert, storageKey, t.notifications.newBookingToast]);

  const toggleSound = () => {
    const next = !soundEnabled;
    try {
      window.localStorage.setItem(SOUND_STORAGE_KEY, String(next));
    } catch {
      // Storage indisponível
    }
    window.dispatchEvent(new CustomEvent(SOUND_CHANGE_EVENT));
    if (next) playAlert(true);
  };

  useEffect(() => {
    let active = true;
    const run = () => {
      if (!active) return;
      void pollAppointments();
      void pollAiInsights();
      void pollOwnerAlerts();
    };
    const initialTimer = window.setTimeout(run, 400);
    const interval = window.setInterval(run, POLL_INTERVAL_MS);
    const onInsightsUpdated = () => {
      if (active) void pollAiInsights();
    };
    const onOwnerAlertsUpdated = () => {
      if (active) void pollOwnerAlerts();
    };
    window.addEventListener(INSIGHTS_UPDATED_EVENT, onInsightsUpdated);
    window.addEventListener(OWNER_ALERTS_UPDATED_EVENT, onOwnerAlertsUpdated);
    return () => {
      active = false;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      window.removeEventListener(INSIGHTS_UPDATED_EVENT, onInsightsUpdated);
      window.removeEventListener(OWNER_ALERTS_UPDATED_EVENT, onOwnerAlertsUpdated);
    };
  }, [pollAppointments, pollAiInsights, pollOwnerAlerts]);

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
    const basePath = isOwner ? "/owner" : "/collaborator";
    router.push(`${basePath}?appointmentId=${encodeURIComponent(appointmentId)}`);
  };

  const handleMarkOwnerAlertRead = async (alertId: string) => {
    setMarkingAlertId(alertId);
    try {
      await operationsApi.markOwnerAlertRead(alertId);
      setOwnerAlerts((prev) =>
        prev.map((item) =>
          item.id === alertId ? { ...item, isRead: true } : item,
        ),
      );
    } catch {
      // Mantém estado atual em caso de falha de rede
    } finally {
      setMarkingAlertId(null);
    }
  };

  const unreadOwnerAlertsCount = isOwner
    ? ownerAlerts.filter((item) => !item.isRead).length
    : 0;
  const totalBadgeCount =
    unreadIds.size + (isOwner ? aiPendingCount + unreadOwnerAlertsCount : 0);

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t.notifications.title}
        title={t.notifications.title}
        className="relative grid min-h-11 min-w-11 md:min-h-9 md:min-w-9 md:h-9 md:w-9 place-items-center rounded-lg border border-border-subtle bg-surface text-ink-secondary transition-colors hover:border-border-strong hover:text-ink cursor-pointer"
      >
        <Bell className="size-4" aria-hidden="true" />
        {totalBadgeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1 font-mono text-xs leading-none font-semibold text-accent-ink tabular-nums">
            {unreadOwnerAlertsCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-rose-500 opacity-75 motion-safe:animate-ping"
              />
            )}
            <span
              className={`relative z-10 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 ${
                unreadOwnerAlertsCount > 0 ? "bg-rose-600 text-white" : ""
              }`}
            >
              {totalBadgeCount > 9 ? "9+" : totalBadgeCount}
            </span>
          </span>
        )}
      </button>

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-20 right-4 z-50 rounded-xl border border-accent/30 bg-surface px-3.5 py-2.5 text-xs font-semibold text-ink shadow-lg lg:bottom-6"
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
          className="absolute right-0 top-12 z-50 w-88 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-3.5 py-2.5">
            <p className="text-xs font-semibold text-ink">
              {t.notifications.title}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleSound}
                aria-label={
                  soundEnabled ? t.product.soundOn : t.product.soundOff
                }
                title={soundEnabled ? t.product.soundOn : t.product.soundOff}
                className="grid size-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-subtle hover:text-ink cursor-pointer"
              >
                {soundEnabled ? (
                  <Volume2 className="size-3.5" aria-hidden="true" />
                ) : (
                  <VolumeX className="size-3.5" aria-hidden="true" />
                )}
              </button>
              {unreadIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft cursor-pointer"
                >
                  <CheckCheck className="size-3.5" aria-hidden="true" />
                  {t.notifications.markAllRead}
                </button>
              )}
            </div>
          </div>

          {/* Central de Alertas do Dono (Reputação, Modo Imprevisto, Churn e IA) */}
          {isOwner && (
            <div className="border-b border-border-subtle bg-rose-500/[0.03]">
              <div className="flex items-center justify-between px-3.5 py-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="size-3.5" aria-hidden="true" />
                  Alertas do Dono ({unreadOwnerAlertsCount})
                </span>
              </div>
              {ownerAlerts.length === 0 ? (
                <p className="px-3.5 pb-2.5 text-xs text-ink-muted">
                  Nenhum alerta operacional ou de reputação no momento.
                </p>
              ) : (
                <ul className="max-h-56 divide-y divide-border-subtle/60 overflow-y-auto">
                  {ownerAlerts.slice(0, 8).map((alert) => {
                    const meta = OWNER_ALERT_META[alert.type];
                    const AlertIcon = meta.Icon;
                    const expanded = expandedAlertId === alert.id;
                    const score =
                      typeof alert.metadata?.score === "number"
                        ? alert.metadata.score
                        : null;
                    return (
                      <li
                        key={alert.id}
                        className={alert.isRead ? "bg-surface/60" : "bg-rose-500/[0.06]"}
                      >
                        <div className="px-3.5 py-2.5 text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedAlertId((prev) =>
                                prev === alert.id ? null : alert.id,
                              )
                            }
                            className="w-full cursor-pointer text-left"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${meta.badgeClass}`}
                              >
                                <AlertIcon className="size-3" aria-hidden="true" />
                                {meta.label}
                              </span>
                              {!alert.isRead && (
                                <span className="size-2 shrink-0 rounded-full bg-rose-500 motion-safe:animate-pulse" />
                              )}
                            </div>
                            <p className="mt-1 font-semibold text-ink">
                              {alert.title}
                            </p>
                            <p
                              className={`mt-0.5 text-ink-secondary ${
                                expanded ? "whitespace-pre-wrap" : "line-clamp-2"
                              }`}
                            >
                              {alert.description}
                            </p>
                          </button>

                          {expanded && (
                            <div className="mt-2 space-y-2 border-t border-border-subtle/60 pt-2">
                              {score !== null && (
                                <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                                  Avaliação retida: ★ {score}/5
                                </p>
                              )}
                              <p className="font-mono text-[10px] text-ink-muted tabular-nums">
                                {formatDateTimeInTimezone(
                                  alert.createdAt,
                                  session.company.timezone,
                                  locale,
                                )}
                              </p>
                              {!alert.isRead && (
                                <button
                                  type="button"
                                  disabled={markingAlertId === alert.id}
                                  onClick={() => void handleMarkOwnerAlertRead(alert.id)}
                                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-subtle bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Check className="size-3" aria-hidden="true" />
                                  Marcar como lido
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Seção de Oportunidades e Alertas Proativos da IA */}
          {isOwner && (
            <div className="border-b border-border-subtle bg-accent-soft/25">
              <div className="flex items-center justify-between px-3.5 py-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  Oportunidades IA ({aiPendingCount})
                </span>
                <Link
                  href="/owner/intelligence"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                >
                  <span>Abrir Central</span>
                  <ArrowRight className="size-3" aria-hidden="true" />
                </Link>
              </div>
              {aiInsights.length === 0 ? (
                <p className="px-3.5 pb-2.5 text-xs text-ink-muted">
                  Nenhuma oportunidade pendente no radar agora.
                </p>
              ) : (
                <ul className="divide-y divide-border-subtle/50">
                  {aiInsights.slice(0, 3).map((insight) => (
                    <li key={insight.id}>
                      <Link
                        href="/owner/intelligence"
                        onClick={() => setOpen(false)}
                        className="block px-3.5 py-2 text-xs transition-colors hover:bg-accent-soft/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-ink truncate">
                            {insight.title}
                          </span>
                          <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono font-semibold text-accent">
                            {insight.module}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-ink-secondary">
                          {insight.description}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-ink-muted">
              {t.notifications.empty}
            </p>
          ) : (
            <ul className="max-h-60 divide-y divide-border-subtle/70 overflow-y-auto">
              {recent.map((appt) => {
                const isUnread = unreadIds.has(appt.id);
                return (
                  <li key={appt.id}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelectNotification(appt.id)}
                      className={[
                        "w-full text-left px-3.5 py-2.5 text-xs transition-colors cursor-pointer",
                        isUnread
                          ? "bg-accent-soft/45 hover:bg-accent-soft/75"
                          : "bg-surface hover:bg-subtle/70",
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
                      <p className="mt-0.5 text-ink-secondary truncate">
                        {appt.serviceNameSnapshot}
                      </p>
                      <p className="mt-1 font-mono text-xs text-ink-muted tabular-nums">
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
