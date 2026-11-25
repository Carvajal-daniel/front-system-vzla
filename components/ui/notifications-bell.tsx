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
  ArrowRight,
  Bell,
  CheckCheck,
  Sparkles,
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
import type { Appointment } from "@/lib/types/appointment";
import { useSession } from "@/components/ui/auth-guard";

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
    };
    const initialTimer = window.setTimeout(run, 400);
    const interval = window.setInterval(run, POLL_INTERVAL_MS);
    const onInsightsUpdated = () => {
      if (active) void pollAiInsights();
    };
    window.addEventListener(INSIGHTS_UPDATED_EVENT, onInsightsUpdated);
    return () => {
      active = false;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      window.removeEventListener(INSIGHTS_UPDATED_EVENT, onInsightsUpdated);
    };
  }, [pollAppointments, pollAiInsights]);

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

  const totalBadgeCount = unreadIds.size + (isOwner ? aiPendingCount : 0);

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
            {totalBadgeCount > 9 ? "9+" : totalBadgeCount}
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
