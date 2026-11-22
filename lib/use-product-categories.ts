"use client";

import { useCallback, useEffect, useState } from "react";

export interface ProductCategory {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  active: boolean;
}

const defaultProductCategories: Omit<ProductCategory, "id" | "companyId">[] = [
  { name: "Revenda / Home Care", description: "Produtos para venda direta aos clientes", active: true },
  { name: "Uso Interno / Lavatório", description: "Shampoos, condicionadores e máscaras de bancada", active: true },
  { name: "Descartáveis e Higiene", description: "Luvas, lâminas, toalhas, golas e capas", active: true },
  { name: "Química Profissional", description: "Colorações, pós descolorantes e oxidantes", active: true },
  { name: "Equipamentos e Acessórios", description: "Máquinas, pentes, tesouras e secadores", active: true },
];

function getCategoriesStorageKey(companyId: string): string {
  return `atelier_product_categories_${companyId}`;
}

export function useProductCategories(companyId: string) {
  const [categories, setCategories] = useState<ProductCategory[]>([]);

  useEffect(() => {
    if (!companyId || typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(getCategoriesStorageKey(companyId));
      if (raw) {
        setCategories(JSON.parse(raw) as ProductCategory[]);
      } else {
        const seeded: ProductCategory[] = defaultProductCategories.map((c, i) => ({
          id: `pcat_${i + 1}_${Date.now()}`,
          companyId,
          ...c,
        }));
        setCategories(seeded);
        localStorage.setItem(getCategoriesStorageKey(companyId), JSON.stringify(seeded));
      }
    } catch {
      // Ignora erro
    }
  }, [companyId]);

  const saveCategories = useCallback(
    (next: ProductCategory[]) => {
      setCategories(next);
      if (typeof window !== "undefined" && companyId) {
        localStorage.setItem(getCategoriesStorageKey(companyId), JSON.stringify(next));
      }
    },
    [companyId],
  );

  const addCategory = useCallback(
    (data: Omit<ProductCategory, "id" | "companyId">) => {
      const newCat: ProductCategory = {
        id: `pcat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        companyId,
        ...data,
      };
      saveCategories([...categories, newCat]);
    },
    [categories, companyId, saveCategories],
  );

  const updateCategory = useCallback(
    (id: string, patch: Partial<ProductCategory>) => {
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

  return {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
  };
}
