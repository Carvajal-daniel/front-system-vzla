"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Edit2,
  FolderTree,
  Plus,
  Power,
  Tag,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/ui/auth-guard";
import { useServiceCatalogMeta, type ServiceCategory } from "@/lib/use-service-catalog-meta";

export default function ServiceCategoriesPage() {
  const { session } = useSession();
  const companyId = session.company.id;
  const { categories, addCategory, updateCategory, deleteCategory } =
    useServiceCatalogMeta(companyId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setName("");
    setDescription("");
    setModalOpen(true);
  };

  const handleOpenEdit = (cat: ServiceCategory) => {
    setEditingCategory(cat);
    setName(cat.name);
    setDescription(cat.description || "");
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Informe o nome da categoria.");
      return;
    }

    if (editingCategory) {
      updateCategory(editingCategory.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast.success("Categoria atualizada com sucesso!");
    } else {
      addCategory({
        name: name.trim(),
        description: description.trim() || undefined,
        active: true,
      });
      toast.success("Nova categoria criada com sucesso!");
    }

    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Botão Voltar */}
      <div className="flex items-center justify-between">
        <Link
          href="/owner/services"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink transition-colors"
        >
          <ArrowLeft size={14} />
          Voltar para Serviços
        </Link>
      </div>

      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <FolderTree className="size-6 text-accent" />
            Categorias de Serviços / Especialidades
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Agrupe os procedimentos do catálogo em especialidades para organizar o agendamento dos
            clientes.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs cursor-pointer"
        >
          <Plus size={14} />
          Nova Categoria
        </button>
      </div>

      {/* Tabela de Categorias */}
      <div className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
        {categories.length === 0 ? (
          <div className="py-16 text-center text-xs text-ink-muted">
            Nenhuma categoria de serviço cadastrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                <tr>
                  <th className="py-3 px-4">Categoria / Especialidade</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-canvas/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="grid size-7 place-items-center rounded-lg bg-accent/15 text-accent">
                          <Tag size={13} />
                        </span>
                        <span className="font-semibold text-ink text-sm">{cat.name}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-ink-muted">
                      {cat.description || "Sem descrição"}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          updateCategory(cat.id, { active: !cat.active });
                          toast.info(cat.active ? "Categoria desativada." : "Categoria ativada.");
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                          cat.active
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                        }`}
                      >
                        <Power size={11} />
                        {cat.active ? "Ativa" : "Inativa"}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(cat)}
                        className="rounded-lg border border-border-subtle bg-surface p-1.5 text-ink-secondary hover:text-ink hover:border-accent transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Excluir a categoria "${cat.name}"?`)) {
                            deleteCategory(cat.id);
                            toast.success("Categoria excluída!");
                          }
                        }}
                        className="rounded-lg border border-border-subtle bg-surface p-1.5 text-rose-500 hover:bg-rose-500/10 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Criação / Edição */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <Tag size={16} className="text-accent" />
                {editingCategory ? "Editar Categoria" : "Nova Categoria de Serviços"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-ink-muted hover:text-ink transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-ink-secondary mb-1">
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Cabelo, Barba, Química, Estética"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink-secondary mb-1">
                  Descrição (Opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Breve resumo dos tipos de serviço desta especialidade..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-border-subtle px-4 py-2 text-xs font-semibold text-ink hover:bg-canvas transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors"
                >
                  Salvar Categoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
