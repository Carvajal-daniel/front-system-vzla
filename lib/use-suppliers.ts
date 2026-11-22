"use client";

import { useCallback, useEffect, useState } from "react";

export interface Supplier {
  id: string;
  companyId: string;
  name: string;
  document: string; // CNPJ (Brasil) ou RIF (Venezuela)
  ddi: "+55" | "+58";
  phone: string;
  email?: string;
  category: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const defaultSuppliersSeed: Omit<Supplier, "id" | "companyId" | "createdAt" | "updatedAt">[] = [
  {
    name: "Distribuidora Beleza Pro",
    document: "12.345.678/0001-90",
    ddi: "+55",
    phone: "(11) 98765-4321",
    email: "contato@belezapro.com.br",
    category: "Cosméticos e Tinturas",
    notes: "Fornecedor principal de colorações e oxidantes",
    active: true,
  },
  {
    name: "Insumos & Descartáveis Express",
    document: "J-31245678-0",
    ddi: "+58",
    phone: "412 1234567",
    email: "ventas@insumosexpress.ve",
    category: "Descartáveis e Higiene",
    notes: "Luvas, lâminas, capas e toalhas descartáveis",
    active: true,
  },
];

function getSuppliersStorageKey(companyId: string): string {
  return `atelier_suppliers_${companyId}`;
}

export function useSuppliers(companyId: string) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    if (!companyId || typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(getSuppliersStorageKey(companyId));
      if (raw) {
        setSuppliers(JSON.parse(raw) as Supplier[]);
      } else {
        const seeded: Supplier[] = defaultSuppliersSeed.map((s, idx) => ({
          id: `sup_${idx + 1}_${Date.now()}`,
          companyId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...s,
        }));
        setSuppliers(seeded);
        localStorage.setItem(getSuppliersStorageKey(companyId), JSON.stringify(seeded));
      }
    } catch {
      // Ignora erro
    }
  }, [companyId]);

  const saveSuppliers = useCallback(
    (next: Supplier[]) => {
      setSuppliers(next);
      if (typeof window !== "undefined" && companyId) {
        localStorage.setItem(getSuppliersStorageKey(companyId), JSON.stringify(next));
      }
    },
    [companyId],
  );

  const addSupplier = useCallback(
    (data: Omit<Supplier, "id" | "companyId" | "createdAt" | "updatedAt">) => {
      const newSup: Supplier = {
        id: `sup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        companyId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data,
      };
      saveSuppliers([...suppliers, newSup]);
      return newSup;
    },
    [companyId, saveSuppliers, suppliers],
  );

  const updateSupplier = useCallback(
    (id: string, patch: Partial<Supplier>) => {
      saveSuppliers(
        suppliers.map((s) =>
          s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s,
        ),
      );
    },
    [saveSuppliers, suppliers],
  );

  const deleteSupplier = useCallback(
    (id: string) => {
      saveSuppliers(suppliers.filter((s) => s.id !== id));
    },
    [saveSuppliers, suppliers],
  );

  const getSupplier = useCallback(
    (id: string) => {
      return suppliers.find((s) => s.id === id);
    },
    [suppliers],
  );

  return {
    suppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    getSupplier,
  };
}
