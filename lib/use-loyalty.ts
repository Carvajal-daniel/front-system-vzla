"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export interface LoyaltyProgram {
  id: string;
  companyId: string;
  name: string;
  pointsRequired: number; // Ex: 10 pontos para resgatar
  rewardDescription: string; // Ex: "Corte de Cabelo ou Hidratação Grátis"
  validityDays: number; // Ex: 180 dias
  autoPointOnCompletion: boolean; // Pontuar automaticamente ao concluir agendamento
  active: boolean;
}

export interface LoyaltyHistoryItem {
  id: string;
  date: string;
  action: "EARNED" | "REDEEMED" | "ADJUSTED";
  amount: number;
  reward?: string;
  note?: string;
}

export interface ClientLoyaltyRecord {
  clientId: string;
  points: number;
  totalEarned: number;
  totalRedeemed: number;
  history: LoyaltyHistoryItem[];
}

export interface RedemptionItem {
  id: string;
  clientId: string;
  date: string;
  reward: string;
  pointsDeducted: number;
}

function getProgramStorageKey(companyId: string): string {
  return `atelier_loyalty_program_${companyId}`;
}

function getClientsStorageKey(companyId: string): string {
  return `atelier_loyalty_clients_${companyId}`;
}

function getDefaultProgram(companyId: string): LoyaltyProgram {
  return {
    id: `loyalty_${companyId}`,
    companyId,
    name: "Cartela Fidelidade VIP",
    pointsRequired: 10,
    rewardDescription: "Corte de Cabelo ou Hidratação Grátis",
    validityDays: 180,
    autoPointOnCompletion: true,
    active: true,
  };
}

export function useLoyalty(companyId: string) {
  const [program, setProgram] = useState<LoyaltyProgram>(() => getDefaultProgram(companyId));
  const [records, setRecords] = useState<Record<string, ClientLoyaltyRecord>>({});

  // Carrega programa e registros salvos
  useEffect(() => {
    if (!companyId || typeof window === "undefined") return;

    try {
      const pRaw = localStorage.getItem(getProgramStorageKey(companyId));
      if (pRaw) {
        setProgram(JSON.parse(pRaw) as LoyaltyProgram);
      } else {
        setProgram(getDefaultProgram(companyId));
      }

      const cRaw = localStorage.getItem(getClientsStorageKey(companyId));
      if (cRaw) {
        setRecords(JSON.parse(cRaw) as Record<string, ClientLoyaltyRecord>);
      }
    } catch {
      // Ignora erro
    }
  }, [companyId]);

  // Atualiza as configurações do programa de fidelidade
  const updateProgram = useCallback(
    (patch: Partial<LoyaltyProgram>) => {
      setProgram((prev) => {
        const next = { ...prev, ...patch };
        if (typeof window !== "undefined" && companyId) {
          localStorage.setItem(getProgramStorageKey(companyId), JSON.stringify(next));
        }
        return next;
      });
    },
    [companyId],
  );

  // Obtém ou inicializa o registro do cliente
  const getClientLoyalty = useCallback(
    (clientId: string): ClientLoyaltyRecord => {
      return (
        records[clientId] || {
          clientId,
          points: 0,
          totalEarned: 0,
          totalRedeemed: 0,
          history: [],
        }
      );
    },
    [records],
  );

  // Adiciona ou subtrai pontos manualmente
  const addPoints = useCallback(
    (clientId: string, amount: number, note?: string) => {
      setRecords((prev) => {
        const current = prev[clientId] || {
          clientId,
          points: 0,
          totalEarned: 0,
          totalRedeemed: 0,
          history: [],
        };

        const newPoints = Math.max(0, current.points + amount);
        const historyItem: LoyaltyHistoryItem = {
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          date: new Date().toISOString(),
          action: amount >= 0 ? "EARNED" : "ADJUSTED",
          amount,
          note: note || (amount >= 0 ? "+1 Ponto de Atendimento" : "Ajuste manual de pontos"),
        };

        const nextRecord: ClientLoyaltyRecord = {
          ...current,
          points: newPoints,
          totalEarned: amount > 0 ? current.totalEarned + amount : current.totalEarned,
          history: [historyItem, ...current.history],
        };

        const next = { ...prev, [clientId]: nextRecord };
        if (typeof window !== "undefined" && companyId) {
          localStorage.setItem(getClientsStorageKey(companyId), JSON.stringify(next));
        }
        return next;
      });
    },
    [companyId],
  );

  // Resgate de prêmio / recompensa
  const redeemReward = useCallback(
    (clientId: string, customReward?: string) => {
      setRecords((prev) => {
        const current = prev[clientId];
        if (!current || current.points < program.pointsRequired) return prev;

        const rewardText = customReward || program.rewardDescription;
        const newPoints = current.points - program.pointsRequired;
        const historyItem: LoyaltyHistoryItem = {
          id: `redeem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          date: new Date().toISOString(),
          action: "REDEEMED",
          amount: -program.pointsRequired,
          reward: rewardText,
          note: `Resgate do prêmio: ${rewardText}`,
        };

        const nextRecord: ClientLoyaltyRecord = {
          ...current,
          points: newPoints,
          totalRedeemed: current.totalRedeemed + 1,
          history: [historyItem, ...current.history],
        };

        const next = { ...prev, [clientId]: nextRecord };
        if (typeof window !== "undefined" && companyId) {
          localStorage.setItem(getClientsStorageKey(companyId), JSON.stringify(next));
        }
        return next;
      });
    },
    [companyId, program.pointsRequired, program.rewardDescription],
  );

  // Lista unificada de todos os resgates realizados no histórico
  const redemptions = useMemo<RedemptionItem[]>(() => {
    const list: RedemptionItem[] = [];
    for (const [cId, rec] of Object.entries(records)) {
      for (const h of rec.history) {
        if (h.action === "REDEEMED") {
          list.push({
            id: h.id,
            clientId: cId,
            date: h.date,
            reward: h.reward || program.rewardDescription,
            pointsDeducted: Math.abs(h.amount),
          });
        }
      }
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, program.rewardDescription]);

  return {
    program,
    updateProgram,
    getClientLoyalty,
    addPoints,
    redeemReward,
    records,
    redemptions,
  };
}
