"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Edit2,
  ExternalLink,
  MessageCircle,
  Plus,
  Power,
  Search,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/ui/auth-guard";
import { useSuppliers, type Supplier } from "@/lib/use-suppliers";

export default function SuppliersPage() {
  const { session } = useSession();
  const companyId = session.company.id;
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useSuppliers(companyId);

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [formName, setFormName] = useState("");
  const [formDocument, setFormDocument] = useState("");
  const [formDdi, setFormDdi] = useState<"+55" | "+58">("+55");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCategory, setFormCategory] = useState("Cosméticos e Insumos");
  const [formNotes, setFormNotes] = useState("");

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.document.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q),
    );
  }, [suppliers, search]);

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setFormName("");
    setFormDocument("");
    setFormDdi("+55");
    setFormPhone("");
    setFormEmail("");
    setFormCategory("Cosméticos e Insumos");
    setFormNotes("");
    setModalOpen(true);
  };

  const handleOpenEdit = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormName(sup.name);
    setFormDocument(sup.document);
    setFormDdi(sup.ddi || "+55");
    setFormPhone(sup.phone);
    setFormEmail(sup.email || "");
    setFormCategory(sup.category);
    setFormNotes(sup.notes || "");
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Informe a Razão Social ou Nome Fantasia.");
      return;
    }
    if (!formDocument.trim()) {
      toast.error("Informe o CNPJ ou RIF do fornecedor.");
      return;
    }
    if (!formPhone.trim()) {
      toast.error("Informe o telefone ou WhatsApp do fornecedor.");
      return;
    }

    if (editingSupplier) {
      updateSupplier(editingSupplier.id, {
        name: formName.trim(),
        document: formDocument.trim(),
        ddi: formDdi,
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
        category: formCategory.trim(),
        notes: formNotes.trim() || undefined,
      });
      toast.success("Fornecedor atualizado com sucesso!");
    } else {
      addSupplier({
        name: formName.trim(),
        document: formDocument.trim(),
        ddi: formDdi,
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
        category: formCategory.trim(),
        notes: formNotes.trim() || undefined,
        active: true,
      });
      toast.success("Fornecedor cadastrado com sucesso!");
    }

    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Botão Voltar */}
      <div className="flex items-center justify-between">
        <Link
          href="/owner/inventory"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink transition-colors"
        >
          <ArrowLeft size={14} />
          Voltar para Estoque
        </Link>
      </div>

      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Truck className="size-6 text-accent" />
            Fornecedores e Fabricantes
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Gestão de fornecedores com suporte para documentos e DDI do Brasil (CNPJ +55) e
            Venezuela (RIF +58).
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs cursor-pointer"
        >
          <Plus size={14} />
          Novo Fornecedor
        </button>
      </div>

      {/* Barra de Busca */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
        <div className="relative w-72 sm:w-80">
          <Search className="absolute left-3 top-2.5 size-4 text-ink-muted" />
          <input
            type="text"
            placeholder="Buscar por nome, CNPJ/RIF ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border-subtle bg-canvas/40 pl-9 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
          />
        </div>

        <span className="text-xs text-ink-muted">{filteredSuppliers.length} fornecedor(es)</span>
      </div>

      {/* Tabela de Fornecedores */}
      <div className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
        {filteredSuppliers.length === 0 ? (
          <div className="py-16 text-center text-xs text-ink-muted">
            Nenhum fornecedor encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                <tr>
                  <th className="py-3 px-4">Fornecedor</th>
                  <th className="py-3 px-4">CNPJ / RIF</th>
                  <th className="py-3 px-4">Contato / WhatsApp</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {filteredSuppliers.map((sup) => {
                  const rawDigits = sup.phone.replace(/\D/g, "");
                  const ddiCode = sup.ddi === "+58" ? "58" : "55";
                  const waLink = rawDigits ? `https://wa.me/${ddiCode}${rawDigits}` : null;

                  return (
                    <tr key={sup.id} className="hover:bg-canvas/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="grid size-8 place-items-center rounded-xl bg-accent/15 text-accent font-bold">
                            <Building2 size={14} />
                          </span>
                          <div>
                            <p className="font-semibold text-ink text-sm">{sup.name}</p>
                            {sup.email && (
                              <p className="text-[11px] text-ink-muted">{sup.email}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-mono font-medium text-ink">
                        {sup.document}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-ink-muted font-mono">
                            {sup.ddi} {sup.phone}
                          </span>
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-grid size-6 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                              title="Chamar no WhatsApp"
                            >
                              <MessageCircle size={12} />
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-ink-secondary">{sup.category}</td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            updateSupplier(sup.id, { active: !sup.active });
                            toast.info(sup.active ? "Fornecedor inativo." : "Fornecedor ativo.");
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                            sup.active
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                          }`}
                        >
                          <Power size={11} />
                          {sup.active ? "Ativo" : "Inativo"}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(sup)}
                          className="rounded-lg border border-border-subtle bg-surface p-1.5 text-ink-secondary hover:text-ink hover:border-accent transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Excluir o fornecedor "${sup.name}"?`)) {
                              deleteSupplier(sup.id);
                              toast.success("Fornecedor excluído!");
                            }
                          }}
                          className="rounded-lg border border-border-subtle bg-surface p-1.5 text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Criar / Editar Fornecedor */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <Truck size={18} className="text-accent" />
                {editingSupplier ? "Editar Fornecedor" : "Cadastrar Fornecedor"}
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
                  Razão Social / Nome Fantasia *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Distribuidora Beleza Pro"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink-secondary mb-1">
                  CNPJ (Brasil) ou RIF (Venezuela) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 00.000.000/0001-00 ou J-12345678-9 / V-..."
                  value={formDocument}
                  onChange={(e) => setFormDocument(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink-secondary mb-1">
                  Telefone / WhatsApp *
                </label>
                <div className="flex gap-2">
                  <select
                    value={formDdi}
                    onChange={(e) => setFormDdi(e.target.value as "+55" | "+58")}
                    className="w-28 rounded-xl border border-border-subtle bg-canvas/40 px-2 py-2 text-xs text-ink shrink-0"
                  >
                    <option value="+55">🇧🇷 +55</option>
                    <option value="+58">🇻🇪 +58</option>
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="(11) 98765-4321 ou 412 1234567"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink-secondary mb-1">E-mail</label>
                  <input
                    type="email"
                    placeholder="contato@fornecedor.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink-secondary mb-1">
                    Categoria Principal
                  </label>
                  <input
                    type="text"
                    placeholder="Cosméticos, Descartáveis..."
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink-secondary mb-1">Observações</label>
                <textarea
                  rows={2}
                  placeholder="Prazos de entrega, condições de frete ou pagamento..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
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
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs"
                >
                  Salvar Fornecedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
