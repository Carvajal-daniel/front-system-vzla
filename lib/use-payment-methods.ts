"use client";

import { useCallback, useEffect, useState } from "react";
import type { PaymentMethod } from "@/lib/types/finance";

export interface CustomPaymentMethodConfig {
  method: PaymentMethod;
  name: string;
  enabled: boolean;
  feePercentage: number;
  settlementDays: number;
}

const DEFAULT_METHODS: CustomPaymentMethodConfig[] = [
  { method: "PIX", name: "PIX", enabled: true, feePercentage: 0, settlementDays: 0 },
  { method: "CASH", name: "Dinheiro", enabled: true, feePercentage: 0, settlementDays: 0 },
  { method: "CREDIT_CARD", name: "Cartão de Crédito", enabled: true, feePercentage: 3.5, settlementDays: 30 },
  { method: "DEBIT_CARD", name: "Cartão de Débito", enabled: true, feePercentage: 1.8, settlementDays: 1 },
  { method: "TRANSFER", name: "Transferência Bancária", enabled: true, feePercentage: 0, settlementDays: 0 },
  { method: "OTHER", name: "Outro / Cheque", enabled: false, feePercentage: 0, settlementDays: 0 },
];

const STORAGE_PREFIX = "salao_payment_methods_";

/**
 * Hook para gerenciar os métodos de pagamento aceitos no balcão e suas taxas
 * com persistência isolada no localStorage por companyId.
 */
export function usePaymentMethods(companyId: string) {
  const [methods, setMethods] = useState<CustomPaymentMethodConfig[]>(DEFAULT_METHODS);

  const loadMethods = useCallback(() => {
    if (typeof window === "undefined" || !companyId) return;
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${companyId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMethods(parsed);
          return;
        }
      }
      setMethods(DEFAULT_METHODS);
    } catch {
      setMethods(DEFAULT_METHODS);
    }
  }, [companyId]);

  useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  const updateMethod = useCallback(
    (method: PaymentMethod, updates: Partial<Omit<CustomPaymentMethodConfig, "method">>) => {
      setMethods((prev) => {
        const next = prev.map((item) => (item.method === method ? { ...item, ...updates } : item));
        try {
          localStorage.setItem(`${STORAGE_PREFIX}${companyId}`, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [companyId],
  );

  const resetDefaults = useCallback(() => {
    setMethods(DEFAULT_METHODS);
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${companyId}`, JSON.stringify(DEFAULT_METHODS));
    } catch {
      // ignore
    }
  }, [companyId]);

  return { methods, updateMethod, resetDefaults };
}
