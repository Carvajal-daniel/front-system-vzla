"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, ApiError } from "@/lib/api-client";
import {
  clearStoredToken,
  getStoredToken,
  subscribeUnauthorized,
} from "@/lib/auth";
import { useLocale } from "@/lib/i18n/locale-context";
import type { MeResponse, UserRole } from "@/lib/types/auth";
import { CardListSkeleton } from "./card-list-skeleton";

interface SessionContextValue {
  session: MeResponse;
  refreshSession: () => Promise<void>;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within AuthGuard");
  }
  return ctx;
}

export interface AuthGuardProps {
  requiredRole: UserRole;
  children: ReactNode;
}

/**
 * Guarda de sessão determinística: renderiza o mesmo skeleton no servidor e na
 * primeira pintura do cliente (zero erros de hidratação) e valida o JWT exclusivamente
 * via GET /me na API Fastify após a montagem.
 */
export function AuthGuard({ requiredRole, children }: AuthGuardProps) {
  const router = useRouter();
  const { t } = useLocale();
  const [session, setSession] = useState<MeResponse | null>(null);
  const [checking, setChecking] = useState(true);

  const logout = useCallback(() => {
    clearStoredToken();
    setSession(null);
    router.replace("/login");
  }, [router]);

  const fetchMe = useCallback(async (): Promise<MeResponse | null> => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return null;
    }

    try {
      const me = await apiRequest<MeResponse>("/me", { auth: true });
      if (me.role !== requiredRole) {
        const target = me.role === "OWNER" ? "/owner" : "/collaborator";
        router.replace(target);
        return null;
      }
      return me;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace("/login?reason=expired");
        return null;
      }
      clearStoredToken();
      router.replace("/login");
      return null;
    }
  }, [requiredRole, router]);

  const refreshSession = useCallback(async () => {
    const me = await fetchMe();
    if (me) {
      setSession(me);
    }
  }, [fetchMe]);

  useEffect(() => {
    let active = true;
    void fetchMe().then((me) => {
      if (!active) return;
      if (me) {
        setSession(me);
        setChecking(false);
      }
    });
    return () => {
      active = false;
    };
  }, [fetchMe]);

  useEffect(() => {
    return subscribeUnauthorized(() => {
      setSession(null);
      router.replace("/login?reason=expired");
    });
  }, [router]);

  const contextValue = useMemo<SessionContextValue | null>(() => {
    if (!session) return null;
    return {
      session,
      refreshSession,
      logout,
    };
  }, [session, refreshSession, logout]);

  if (checking || !contextValue) {
    return (
      <div className="min-h-dvh bg-canvas p-4 sm:p-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <p className="text-sm font-medium text-ink-muted">
            {t.auth.checkingSession}
          </p>
          <CardListSkeleton count={3} />
        </div>
      </div>
    );
  }

  return <SessionContext value={contextValue}>{children}</SessionContext>;
}
