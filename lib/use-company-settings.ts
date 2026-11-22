"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { apiRequest } from "@/lib/api-client";
import { defaultCompanySettings, selectedClientFields, type CompanySettings } from "@/lib/company-settings";

const CHANGE_KEY = "cloudgo-company-settings-change";
const snapshots = new Map<string, CompanySettings>();
const listeners = new Map<string, Set<() => void>>();

function publish(companyId: string, settings: CompanySettings) {
  snapshots.set(companyId, settings);
  listeners.get(companyId)?.forEach((listener) => listener());
}

export async function saveCompanySettings(companyId: string, body: Partial<Omit<CompanySettings, "rating">>) {
  const settings = await apiRequest<CompanySettings>("/companies/me/settings", { method: "PATCH", body });
  publish(`${companyId}:private`, settings);
  const publicKeys = ["address", "agendaInterval", "bookingInterval", "leadTime", "birthdayRadar", "surveyEnabled", "rating",
    "googleMapsUrl", "googleRating", "googleReviewsCount", "googlePlaceId", "clientFieldSlots"] as const;
  const publicSettings = { ...defaultCompanySettings };
  Object.assign(publicSettings, Object.fromEntries(publicKeys.map((key) => [key, settings[key]])));
  const active = selectedClientFields(settings);
  const activeIds = new Set(active.map(({ id }) => id));
  publicSettings.clientFields = { ...defaultCompanySettings.clientFields,
    ...Object.fromEntries(active.map(({ id, required }) => [id, required ? "required" : "optional"])) };
  publicSettings.customClientFields = settings.customClientFields.filter(({ id }) => activeIds.has(id));
  publish(companyId, publicSettings);
  try {
    window.localStorage.setItem(CHANGE_KEY, JSON.stringify({ companyId, at: Date.now() }));
  } catch {
    // Mounted modules have already received the saved settings.
  }
  return settings;
}

export function useCompanySettings(companyId: string, initial = defaultCompanySettings, load = true, privateSettings = false) {
  const key = privateSettings ? `${companyId}:private` : companyId;
  const subscribe = useCallback((listener: () => void) => {
    const group = listeners.get(key) ?? new Set();
    listeners.set(key, group);
    group.add(listener);
    return () => {
      group.delete(listener);
      if (group.size === 0) listeners.delete(key);
    };
  }, [key]);
  const read = useCallback(() => snapshots.get(key) ?? initial, [key, initial]);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const before = snapshots.get(key);
    const path = privateSettings ? "/companies/me/settings" : `/public/companies/${encodeURIComponent(companyId)}/settings`;
    const settings = await apiRequest<Partial<CompanySettings>>(path, { auth: privateSettings, signal });
    if (!signal?.aborted && snapshots.get(key) === before) publish(key, { ...defaultCompanySettings, ...settings });
  }, [companyId, key, privateSettings]);

  useEffect(() => {
    if (!load) return;
    const request = new AbortController();
    const reload = () => void refresh(request.signal).catch(() => undefined);
    const sync = (event: StorageEvent) => {
      if (event.key === CHANGE_KEY) reload();
    };
    reload();
    window.addEventListener("focus", reload);
    window.addEventListener("storage", sync);
    return () => {
      request.abort();
      window.removeEventListener("focus", reload);
      window.removeEventListener("storage", sync);
    };
  }, [load, refresh]);

  return { settings: useSyncExternalStore(subscribe, read, () => initial), refresh };
}
