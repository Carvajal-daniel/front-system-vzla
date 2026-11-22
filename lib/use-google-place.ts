"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import type { LinkedGooglePlace } from "@/lib/google-place";

const pending = new Map<string, Promise<LinkedGooglePlace>>();

export function useGooglePlace(companyId: string, placeId?: string | null, { summary = false, checkConfig = false } = {}) {
  const enabled = Boolean(placeId || checkConfig);
  const key = `${companyId}:${placeId ?? ""}:${summary}`;
  const [result, setResult] = useState<{ key: string; value: LinkedGooglePlace }>();

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let request = pending.get(key);
    if (!request) {
      request = apiRequest<LinkedGooglePlace>(`/companies/${encodeURIComponent(companyId)}/google-place`, {
        auth: false, query: { summary },
      }).catch(() => ({ status: "unavailable" }));
      pending.set(key, request);
      void request.then(() => { if (pending.get(key) === request) pending.delete(key); });
    }
    void request.then((value) => { if (active) setResult({ key, value }); });
    return () => { active = false; };
  }, [companyId, enabled, key, summary]);

  const value = enabled && result?.key === key ? result.value : undefined;
  return { result: value, place: value?.status === "ready" ? value.place : undefined, loading: enabled && !value };
}

