"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";

export function useOwnerInventory<T>(path: string | null, revision = 0) {
  const key = path ? path + "#" + revision : null;
  const [result, setResult] = useState<{ key: string; data: T | null }>();
  useEffect(() => {
    if (!path || !key) return;
    const controller = new AbortController();
    void apiRequest<T>(path, { signal: controller.signal }).then(
      (data) => { if (!controller.signal.aborted) setResult({ key, data }); },
      () => { if (!controller.signal.aborted) setResult({ key, data: null }); },
    );
    return () => controller.abort();
  }, [path, key]);
  return result?.key === key ? result.data : undefined;
}
