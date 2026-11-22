"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import type { Collaborator } from "@/lib/types/team";

export type PlanType = "TRIAL" | "PRO" | "ENTERPRISE";

export interface PlanLimits {
  name: string;
  maxProfessionals: number;
  maxWhatsAppMessages: number;
  maxAiConversations: number;
  trialDaysRemaining?: number;
}

export const PLAN_CONFIGS: Record<PlanType, PlanLimits> = {
  TRIAL: {
    name: "Trial",
    maxProfessionals: 3,
    maxWhatsAppMessages: 300,
    maxAiConversations: 20,
    trialDaysRemaining: 7,
  },
  PRO: {
    name: "Pro",
    maxProfessionals: 15,
    maxWhatsAppMessages: 2000,
    maxAiConversations: 200,
  },
  ENTERPRISE: {
    name: "Enterprise",
    maxProfessionals: 999,
    maxWhatsAppMessages: 10000,
    maxAiConversations: 1000,
  },
};

/**
 * Hook centralizado para controle de regras e limites do plano do salão/barbearia.
 */
export function usePlanLimits() {
  const [currentPlan, setCurrentPlan] = useState<PlanType>("TRIAL");
  const [activeProfessionals, setActiveProfessionals] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    void apiRequest<{ collaborators?: Collaborator[] } | Collaborator[]>("/collaborators")
      .then((response) => {
        const list = Array.isArray(response) ? response : response.collaborators ?? [];
        if (active) {
          const activeList = list.filter((c) => (c.status ? c.status === "ACTIVE" : c.isActive));
          setActiveProfessionals(activeList.length);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const limits = PLAN_CONFIGS[currentPlan];
  const isOverProfessionalsLimit = activeProfessionals >= limits.maxProfessionals;
  const canAddProfessional = !isOverProfessionalsLimit;

  return {
    currentPlan,
    setCurrentPlan,
    limits,
    activeProfessionals,
    isOverProfessionalsLimit,
    canAddProfessional,
    loading,
  };
}
