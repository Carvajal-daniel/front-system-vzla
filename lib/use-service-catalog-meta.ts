"use client";

import { useCallback, useEffect, useState } from "react";

export interface ServiceCategory {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  active: boolean;
}

export interface ServicePackage {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  serviceIds: string[];
  serviceNames?: string[];
  totalSessions: number;
  priceInCents: number;
  validityDays: number;
  active: boolean;
}

export interface SoldPackageRecord {
  id: string;
  companyId: string;
  packageId: string;
  packageName: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  purchasedAt: string;
  expiresAt: string;
  totalSessions: number;
  usedSessions: number;
  priceInCents: number;
}

const defaultCategories: Omit<ServiceCategory, "id" | "companyId">[] = [
  { name: "Cabelo & Barbearia", description: "Cortes, finalizações e barboterapia", active: true },
  { name: "Química & Coloração", description: "Tinturas, luzes, alisamentos e descoloração", active: true },
  { name: "Tratamentos & Estética", description: "Hidratação profunda, cronograma e cuidados", active: true },
  { name: "Combos Promocionais", description: "Serviços combinados de alta procura", active: true },
];

function getCategoriesStorageKey(companyId: string): string {
  return `atelier_service_categories_${companyId}`;
}

function getPackagesStorageKey(companyId: string): string {
  return `atelier_service_packages_${companyId}`;
}

function getSoldPackagesStorageKey(companyId: string): string {
  return `atelier_sold_packages_${companyId}`;
}

export function useServiceCatalogMeta(companyId: string) {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [soldPackages, setSoldPackages] = useState<SoldPackageRecord[]>([]);

  // Carrega dados do localStorage
  useEffect(() => {
    if (!companyId || typeof window === "undefined") return;

    try {
      const catRaw = localStorage.getItem(getCategoriesStorageKey(companyId));
      if (catRaw) {
        setCategories(JSON.parse(catRaw) as ServiceCategory[]);
      } else {
        const seeded = defaultCategories.map((c, i) => ({
          id: `scat_${i + 1}_${Date.now()}`,
          companyId,
          ...c,
        }));
        setCategories(seeded);
        localStorage.setItem(getCategoriesStorageKey(companyId), JSON.stringify(seeded));
      }

      const pkgRaw = localStorage.getItem(getPackagesStorageKey(companyId));
      if (pkgRaw) {
        setPackages(JSON.parse(pkgRaw) as ServicePackage[]);
      }

      const soldRaw = localStorage.getItem(getSoldPackagesStorageKey(companyId));
      if (soldRaw) {
        setSoldPackages(JSON.parse(soldRaw) as SoldPackageRecord[]);
      }
    } catch {
      // Ignora erro
    }
  }, [companyId]);

  // Gestão de Categorias
  const saveCategories = useCallback(
    (next: ServiceCategory[]) => {
      setCategories(next);
      if (typeof window !== "undefined" && companyId) {
        localStorage.setItem(getCategoriesStorageKey(companyId), JSON.stringify(next));
      }
    },
    [companyId],
  );

  const addCategory = useCallback(
    (data: Omit<ServiceCategory, "id" | "companyId">) => {
      const newCat: ServiceCategory = {
        id: `scat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        companyId,
        ...data,
      };
      saveCategories([...categories, newCat]);
    },
    [categories, companyId, saveCategories],
  );

  const updateCategory = useCallback(
    (id: string, patch: Partial<ServiceCategory>) => {
      saveCategories(categories.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    },
    [categories, saveCategories],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      saveCategories(categories.filter((c) => c.id !== id));
    },
    [categories, saveCategories],
  );

  // Gestão de Pacotes
  const savePackages = useCallback(
    (next: ServicePackage[]) => {
      setPackages(next);
      if (typeof window !== "undefined" && companyId) {
        localStorage.setItem(getPackagesStorageKey(companyId), JSON.stringify(next));
      }
    },
    [companyId],
  );

  const addPackage = useCallback(
    (data: Omit<ServicePackage, "id" | "companyId">) => {
      const newPkg: ServicePackage = {
        id: `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        companyId,
        ...data,
      };
      savePackages([...packages, newPkg]);
    },
    [packages, companyId, savePackages],
  );

  const updatePackage = useCallback(
    (id: string, patch: Partial<ServicePackage>) => {
      savePackages(packages.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    },
    [packages, savePackages],
  );

  const deletePackage = useCallback(
    (id: string) => {
      savePackages(packages.filter((p) => p.id !== id));
    },
    [packages, savePackages],
  );

  // Gestão de Vendas de Pacotes e Abatimento de Sessões
  const saveSoldPackages = useCallback(
    (next: SoldPackageRecord[]) => {
      setSoldPackages(next);
      if (typeof window !== "undefined" && companyId) {
        localStorage.setItem(getSoldPackagesStorageKey(companyId), JSON.stringify(next));
      }
    },
    [companyId],
  );

  const sellPackage = useCallback(
    (pkg: ServicePackage, client: { id: string; name: string; phone: string }) => {
      const now = new Date();
      const expires = new Date(now.getTime() + pkg.validityDays * 86_400_000);

      const soldRecord: SoldPackageRecord = {
        id: `sold_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        companyId,
        packageId: pkg.id,
        packageName: pkg.name,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        purchasedAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        totalSessions: pkg.totalSessions,
        usedSessions: 0,
        priceInCents: pkg.priceInCents,
      };

      saveSoldPackages([soldRecord, ...soldPackages]);
    },
    [companyId, saveSoldPackages, soldPackages],
  );

  const deductSession = useCallback(
    (soldId: string) => {
      saveSoldPackages(
        soldPackages.map((s) => {
          if (s.id === soldId && s.usedSessions < s.totalSessions) {
            return { ...s, usedSessions: s.usedSessions + 1 };
          }
          return s;
        }),
      );
    },
    [saveSoldPackages, soldPackages],
  );

  return {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    packages,
    addPackage,
    updatePackage,
    deletePackage,
    soldPackages,
    sellPackage,
    deductSession,
  };
}
