"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  Download,
  Loader2,
  Pencil,
  Percent,
  Plus,
  Power,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiRequest } from "@/lib/api-client";
import {
  formatDuration,
  formatPercentage,
  formatPriceFromCents,
} from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import type {
  CreateServicePayload,
  Service,
  ServiceCollaboratorItem,
  ServiceCollaboratorsResponse,
} from "@/lib/types/service";
import type {
  Collaborator,
  CollaboratorsListResponse,
  DayOfWeek,
  WorkScheduleSlot,
} from "@/lib/types/team";
import { Button } from "@/components/ui/button";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { useSession } from "@/components/ui/auth-guard";

const DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

function extractArray<T>(raw: unknown, key: string): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object" && key in raw) {
    const val = (raw as Record<string, unknown>)[key];
    if (Array.isArray(val)) return val as T[];
  }
  return [];
}

interface DayRowState {
  dayOfWeek: DayOfWeek;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

function buildDefaultScheduleRows(): DayRowState[] {
  return DAYS.map((day) => ({
    dayOfWeek: day,
    enabled: day >= 1 && day <= 6,
    startTime: "09:00",
    endTime: "18:00",
  }));
}

export function ServicesPanel() {
  const { locale, t } = useLocale();
  const { session } = useSession();

  const [services, setServices] = useState<Service[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Drawer de Serviço (criar / editar)
  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [svcName, setSvcName] = useState("");
  const [svcDesc, setSvcDesc] = useState("");
  const [svcDuration, setSvcDuration] = useState("30");
  const [svcPriceReais, setSvcPriceReais] = useState("50.00");
  const [svcImageUrl, setSvcImageUrl] = useState<string | null>(null);
  const [svcError, setSvcError] = useState<string | null>(null);
  const [svcSaving, setSvcSaving] = useState(false);

  // Drawer de Comissões por serviço
  const [commService, setCommService] = useState<Service | null>(null);
  const [linkedCollabs, setLinkedCollabs] = useState<ServiceCollaboratorItem[]>(
    [],
  );
  const [commLoading, setCommLoading] = useState(false);
  const [commError, setCommError] = useState<string | null>(null);
  const [linkCollabId, setLinkCollabId] = useState("");
  const [linkPercentage, setLinkPercentage] = useState("50");
  const [commSaving, setCommSaving] = useState(false);

  // Drawer de Grade Semanal (work_schedules)
  const [scheduleDrawerOpen, setScheduleDrawerOpen] = useState(false);
  const [scheduleCollabId, setScheduleCollabId] = useState("");
  const [scheduleRows, setScheduleRows] = useState<DayRowState[]>(
    buildDefaultScheduleRows,
  );
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSaved, setScheduleSaved] = useState(false);

  // Modal de Confirmação de Exclusão de Serviço
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deletingService, setDeletingService] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Filtros e busca
  const [searchQuery, setSearchQuery] = useState("");

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return services.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) && !(s.description || "").toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [services, searchQuery]);

  const handleExportCsv = () => {
    if (filteredServices.length === 0) {
      toast.warning("Não há serviços para exportar.");
      return;
    }
    const headers = ["Nome", "Duração (min)", "Preço (R$)", "Status", "Descrição"];
    const rows = filteredServices.map((s) => [
      `"${s.name.replace(/"/g, '""')}"`,
      s.durationMinutes,
      (s.priceInCents / 100).toFixed(2),
      s.active ? "Ativo" : "Inativo",
      `"${(s.description || "").replace(/"/g, '""')}"`,
    ].join(","));
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `servicos_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Catálogo de serviços exportado com sucesso!");
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [servicesRaw, collabsRes] = await Promise.all([
        apiRequest<unknown>("/services", { auth: true }),
        apiRequest<CollaboratorsListResponse>("/collaborators", { auth: true }),
      ]);
      setServices(extractArray<Service>(servicesRaw, "services"));
      setCollaborators(collabsRes.collaborators ?? []);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t.errors.networkDescription,
      );
    } finally {
      setLoading(false);
    }
  }, [t.errors.networkDescription]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [servicesRaw, collabsRes] = await Promise.all([
          apiRequest<unknown>("/services", { auth: true }),
          apiRequest<CollaboratorsListResponse>("/collaborators", {
            auth: true,
          }),
        ]);
        if (!active) return;
        setServices(extractArray<Service>(servicesRaw, "services"));
        setCollaborators(collabsRes.collaborators ?? []);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof ApiError ? err.message : t.errors.networkDescription,
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [t.errors.networkDescription]);

  const kpis = useMemo(() => {
    const total = services.length;
    const activeCount = services.filter((s) => s.active).length;
    return { total, activeCount, teamCount: collaborators.length };
  }, [services, collaborators.length]);

  const openCreateService = () => {
    setEditingService(null);
    setSvcName("");
    setSvcDesc("");
    setSvcDuration("30");
    setSvcPriceReais("50.00");
    setSvcImageUrl(null);
    setSvcError(null);
    setServiceDrawerOpen(true);
  };

  const openEditService = (service: Service) => {
    setEditingService(service);
    setSvcName(service.name);
    setSvcDesc(service.description ?? "");
    setSvcDuration(String(service.durationMinutes));
    setSvcPriceReais((service.priceInCents / 100).toFixed(2));
    setSvcImageUrl(service.imageUrl ?? null);
    setSvcError(null);
    setServiceDrawerOpen(true);
  };

  const handleSaveService = async (event: React.FormEvent) => {
    event.preventDefault();
    setSvcError(null);
    setSvcSaving(true);

    const priceInCents = Math.round(
      (Number(svcPriceReais.replace(",", ".")) || 0) * 100,
    );
    const payload: CreateServicePayload = {
      name: svcName.trim(),
      description: svcDesc.trim() || null,
      durationMinutes: Number(svcDuration) || 30,
      priceInCents,
      imageUrl: svcImageUrl,
    };

    try {
      if (editingService) {
        await apiRequest<Service>(
          `/services/${encodeURIComponent(editingService.id)}`,
          { method: "PATCH", auth: true, body: payload },
        );
      } else {
        await apiRequest<Service>("/services", {
          method: "POST",
          auth: true,
          body: payload,
        });
      }
      setServiceDrawerOpen(false);
      void loadAll();
    } catch (err) {
      setSvcError(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setSvcSaving(false);
    }
  };

  const handleToggleService = async (service: Service) => {
    setTogglingId(service.id);
    try {
      await apiRequest<Service>(
        `/services/${encodeURIComponent(service.id)}/status`,
        {
          method: "PATCH",
          auth: true,
          body: { active: !service.active },
        },
      );
      setServices((prev) =>
        prev.map((item) =>
          item.id === service.id
            ? { ...item, active: !item.active }
            : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setTogglingId(null);
    }
  };

  const openCommissionsDrawer = async (service: Service) => {
    setCommService(service);
    setCommLoading(true);
    setCommError(null);
    setLinkCollabId("");
    setLinkPercentage("50");
    try {
      const res = await apiRequest<ServiceCollaboratorsResponse>(
        `/services/${encodeURIComponent(service.id)}/collaborators`,
        { auth: true },
      );
      setLinkedCollabs(res.collaborators ?? []);
    } catch (err) {
      setCommError(
        err instanceof ApiError ? err.message : t.errors.networkDescription,
      );
    } finally {
      setCommLoading(false);
    }
  };

  const handleLinkCollaborator = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!commService || !linkCollabId) return;
    setCommSaving(true);
    setCommError(null);
    try {
      await apiRequest(
        `/services/${encodeURIComponent(commService.id)}/collaborators`,
        {
          method: "POST",
          auth: true,
          body: {
            collaboratorId: linkCollabId,
            commissionPercentage: Number(linkPercentage) || 0,
          },
        },
      );
      const res = await apiRequest<ServiceCollaboratorsResponse>(
        `/services/${encodeURIComponent(commService.id)}/collaborators`,
        { auth: true },
      );
      setLinkedCollabs(res.collaborators ?? []);
      setLinkCollabId("");
    } catch (err) {
      setCommError(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setCommSaving(false);
    }
  };

  const handleUpdateCommission = async (
    collaboratorId: string,
    percentage: number,
  ) => {
    if (!commService) return;
    try {
      await apiRequest(
        `/services/${encodeURIComponent(commService.id)}/collaborators/${encodeURIComponent(collaboratorId)}`,
        {
          method: "PATCH",
          auth: true,
          body: { commissionPercentage: percentage },
        },
      );
      setLinkedCollabs((prev) =>
        prev.map((item) =>
          item.collaboratorId === collaboratorId
            ? { ...item, commissionPercentage: percentage }
            : item,
        ),
      );
    } catch (err) {
      setCommError(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    }
  };

  const handleUnlinkCollaborator = async (collaboratorId: string) => {
    if (!commService) return;
    try {
      await apiRequest(
        `/services/${encodeURIComponent(commService.id)}/collaborators/${encodeURIComponent(collaboratorId)}`,
        { method: "DELETE", auth: true },
      );
      setLinkedCollabs((prev) =>
        prev.filter((item) => item.collaboratorId !== collaboratorId),
      );
    } catch (err) {
      setCommError(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    }
  };

  const loadCollaboratorSchedule = async (collabId: string) => {
    setScheduleCollabId(collabId);
    setScheduleSaved(false);
    setScheduleError(null);
    if (!collabId) return;

    setScheduleLoading(true);
    try {
      const raw = await apiRequest<unknown>(
        `/collaborators/${encodeURIComponent(collabId)}/work-schedules`,
        { auth: true },
      );
      const slots = extractArray<WorkScheduleSlot>(raw, "schedules");
      const slotMap = new Map<DayOfWeek, WorkScheduleSlot>();
      for (const s of slots) {
        slotMap.set(s.dayOfWeek, s);
      }
      setScheduleRows(
        DAYS.map((day) => {
          const existing = slotMap.get(day);
          return existing
            ? {
                dayOfWeek: day,
                enabled: existing.isWorkingDay,
                startTime: (existing.startTime ?? "09:00").slice(0, 5),
                endTime: (existing.endTime ?? "18:00").slice(0, 5),
              }
            : {
                dayOfWeek: day,
                enabled: false,
                startTime: "09:00",
                endTime: "18:00",
              };
        }),
      );
    } catch (err) {
      setScheduleError(
        err instanceof ApiError ? err.message : t.errors.networkDescription,
      );
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleSaveSchedule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!scheduleCollabId) return;

    const enabledRows = scheduleRows.filter((r) => r.enabled);
    for (const row of enabledRows) {
      if (row.startTime >= row.endTime) {
        setScheduleError(t.errors.invalidTimeRange);
        return;
      }
    }

    setScheduleSaving(true);
    setScheduleError(null);
    setScheduleSaved(false);

    const schedules: WorkScheduleSlot[] = scheduleRows.map((r) => ({
      dayOfWeek: r.dayOfWeek,
      isWorkingDay: r.enabled,
      startTime: r.enabled ? r.startTime : null,
      endTime: r.enabled ? r.endTime : null,
    }));

    try {
      await apiRequest(
        `/collaborators/${encodeURIComponent(scheduleCollabId)}/work-schedules`,
        {
          method: "PUT",
          auth: true,
          body: { schedules },
        },
      );
      setScheduleSaved(true);
    } catch (err) {
      setScheduleError(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleConfirmDeleteService = async () => {
    if (!deleteTarget) return;
    setDeletingService(true);
    setDeleteError(null);
    try {
      await apiRequest<void>(
        `/services/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE", auth: true },
      );
      setServices((prev) =>
        prev.filter((item) => item.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDeleteError(t.common.deleteHasAppointments);
      } else {
        setDeleteError(
          err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
        );
      }
    } finally {
      setDeletingService(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card-interactive rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted">
              {t.nav.ownerServices}
            </span>
            <Wrench className="h-4 w-4 text-accent" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-ink tabular-nums">
            {kpis.total}
          </p>
        </div>

        <div className="card-interactive rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted">
              {t.common.active}
            </span>
            <Power
              className="h-4 w-4 text-[var(--status-success-ink)]"
              aria-hidden="true"
            />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-ink tabular-nums">
            {kpis.activeCount}
          </p>
        </div>

        <div className="card-interactive rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted">
              {t.owner.workSchedules}
            </span>
            <Clock className="h-4 w-4 text-accent" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-ink tabular-nums">
            {kpis.teamCount}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title-sm font-bold text-ink">
          {t.owner.servicesTitle}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCsv}
            className="min-h-11 rounded-full px-4 cursor-pointer"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Salvar em CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setScheduleDrawerOpen(true);
              setScheduleSaved(false);
              if (collaborators[0] && !scheduleCollabId) {
                void loadCollaboratorSchedule(collaborators[0].id);
              }
            }}
            className="min-h-11 rounded-full px-4 cursor-pointer"
          >
            <Clock className="h-4 w-4" aria-hidden="true" />
            {t.owner.workSchedules}
          </Button>
          <Button
            type="button"
            onClick={openCreateService}
            className="min-h-11 rounded-full bg-accent px-5 text-accent-ink hover:bg-accent-hover cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t.owner.newService}
          </Button>
        </div>
      </div>

      {/* Barra de Busca de Serviços */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-3">
        <div className="relative w-64 sm:w-80">
          <Search className="absolute left-3 top-2.5 size-4 text-ink-muted" />
          <input
            type="text"
            placeholder="Buscar serviço por nome ou descrição..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border-subtle bg-canvas/40 pl-9 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
          />
        </div>
        <span className="text-xs text-ink-muted">{filteredServices.length} serviço(s)</span>
      </div>

      <div
        role="note"
        className="rounded-xl border border-border-subtle bg-subtle/70 px-4 py-3 text-xs text-ink-secondary"
      >
        {t.owner.commissionsBookingHint}
      </div>

      {loading ? (
        <CardListSkeleton count={3} />
      ) : error ? (
        <ErrorState
          title={t.errors.networkTitle}
          description={error}
          retryLabel={t.common.retry}
          onRetry={() => void loadAll()}
        />
      ) : services.length === 0 ? (
        <EmptyState
          title={t.common.noData}
          description={t.owner.servicesTitle}
          icon={<Wrench className="h-6 w-6" aria-hidden="true" />}
          action={
            <Button
              type="button"
              onClick={openCreateService}
              className="min-h-11 rounded-full bg-accent px-5 text-accent-ink hover:bg-accent-hover cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t.owner.newService}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredServices.map((service) => (
            <article
              key={service.id}
              className="card-interactive flex flex-col justify-between gap-4 rounded-2xl border border-border-subtle bg-surface p-5"
            >
              <div className="space-y-2 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {service.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={service.imageUrl}
                        alt={service.name}
                        className="h-12 w-12 shrink-0 rounded-xl object-cover border border-border-subtle shadow-xs"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                        <Wrench className="h-5 w-5" aria-hidden="true" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-ink truncate">
                        {service.name}
                      </h3>
                      <p className="font-mono text-sm font-bold text-accent tabular-nums">
                        {formatPriceFromCents(service.priceInCents, locale, session.company.currency)}{" "}
                        <span className="font-sans text-xs font-normal text-ink-muted">
                          · {formatDuration(service.durationMinutes, locale)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <StatusBadge
                    tone={service.active ? "success" : "neutral"}
                    label={service.active ? t.common.active : t.common.inactive}
                  />
                </div>
                {service.description && (
                  <p className="text-xs text-ink-secondary line-clamp-2">
                    {service.description}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openEditService(service)}
                  className="min-h-11 flex-1 rounded-xl text-xs cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.common.edit}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void openCommissionsDrawer(service)}
                  className="min-h-11 flex-1 rounded-xl text-xs cursor-pointer"
                >
                  <Percent className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.owner.commissions}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={togglingId === service.id}
                  onClick={() => void handleToggleService(service)}
                  aria-label={
                    service.active ? t.common.inactive : t.common.active
                  }
                  className="min-h-11 rounded-xl px-3 cursor-pointer"
                >
                  {togglingId === service.id ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Power className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={t.common.delete}
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteTarget(service);
                  }}
                  className="min-h-11 rounded-xl border-[var(--status-danger-border)] px-3 text-[var(--status-danger-ink)] hover:bg-[var(--status-danger-bg)] cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal: Criar / Editar Serviço */}
      <Modal
        open={serviceDrawerOpen}
        title={editingService ? t.common.edit : t.owner.newService}
        maxWidth="max-w-lg"
        onClose={() => setServiceDrawerOpen(false)}
      >
        <form onSubmit={handleSaveService} className="space-y-4">
          <AvatarPicker
            id="service-image"
            value={svcImageUrl}
            onChange={(next) => setSvcImageUrl(next)}
          />

          <div className="space-y-1.5">
            <Label htmlFor="svc-name">{t.booking.stepService}</Label>
            <Input
              id="svc-name"
              required
              value={svcName}
              onChange={(e) => setSvcName(e.target.value)}
              className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="svc-desc">{t.common.descriptionOptional}</Label>
            <Input
              id="svc-desc"
              value={svcDesc}
              onChange={(e) => setSvcDesc(e.target.value)}
              className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="svc-duration">{t.common.durationMinutes}</Label>
              <Input
                id="svc-duration"
                type="number"
                min={5}
                max={480}
                required
                value={svcDuration}
                onChange={(e) => setSvcDuration(e.target.value)}
                className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5 tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="svc-price">{t.common.price}</Label>
              <Input
                id="svc-price"
                type="number"
                min={0}
                step="0.01"
                required
                value={svcPriceReais}
                onChange={(e) => setSvcPriceReais(e.target.value)}
                className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5 tabular-nums"
              />
            </div>
          </div>

          {svcError && (
            <p
              role="alert"
              className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-danger-ink)]"
            >
              {svcError}
            </p>
          )}

          <Button
            type="submit"
            disabled={svcSaving}
            className="min-h-11 w-full rounded-full bg-accent text-accent-ink hover:bg-accent-hover cursor-pointer"
          >
            {svcSaving && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {t.common.save}
          </Button>
        </form>
      </Modal>

      {/* Modal: Comissões por Serviço */}
      <Modal
        open={Boolean(commService)}
        title={t.owner.commissions}
        maxWidth="max-w-xl"
        onClose={() => setCommService(null)}
      >
        <div className="space-y-5">
          <p className="text-sm font-semibold text-ink">
            {commService?.name}
          </p>
          <form onSubmit={handleLinkCollaborator} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="link-collab">{t.booking.stepProfessional}</Label>
              <select
                id="link-collab"
                required
                value={linkCollabId}
                onChange={(e) => setLinkCollabId(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink"
              >
                <option value="">—</option>
                {collaborators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={linkPercentage}
                onChange={(e) => setLinkPercentage(e.target.value)}
                aria-label="Comissão %"
                className="min-h-11 flex-1 rounded-xl border-border-strong bg-surface px-3 tabular-nums"
              />
              <Button
                type="submit"
                disabled={commSaving}
                className="min-h-11 rounded-xl bg-accent px-4 text-accent-ink hover:bg-accent-hover cursor-pointer"
              >
                {commSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden="true" />
                )}
                {t.common.create}
              </Button>
            </div>
          </form>

          {commError && (
            <p
              role="alert"
              className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-danger-ink)]"
            >
              {commError}
            </p>
          )}

          {commLoading ? (
            <CardListSkeleton count={2} />
          ) : linkedCollabs.length === 0 ? (
            <p className="text-sm text-ink-muted">{t.common.noData}</p>
          ) : (
            <ul className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {linkedCollabs.map((item) => (
                <li
                  key={item.collaboratorId}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border-subtle bg-subtle/60 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">
                      {item.name}
                    </p>
                    <p className="font-mono text-xs text-ink-secondary tabular-nums">
                      {formatPercentage(item.commissionPercentage, locale)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      defaultValue={item.commissionPercentage}
                      aria-label={`Comissão de ${item.name}`}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (
                          !Number.isNaN(val) &&
                          val !== item.commissionPercentage
                        ) {
                          void handleUpdateCommission(item.collaboratorId, val);
                        }
                      }}
                      className="min-h-11 w-20 rounded-xl border border-border-strong bg-surface px-2.5 text-xs font-mono text-ink tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void handleUnlinkCollaborator(item.collaboratorId)
                      }
                      aria-label={t.common.delete}
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--status-danger-ink)] hover:bg-[var(--status-danger-bg)] cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      {/* Modal: Grade Semanal (work_schedules) */}
      <Modal
        open={scheduleDrawerOpen}
        title={t.owner.workSchedules}
        maxWidth="max-w-2xl"
        onClose={() => setScheduleDrawerOpen(false)}
      >
        <form onSubmit={handleSaveSchedule} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sched-collab">{t.booking.stepProfessional}</Label>
            <select
              id="sched-collab"
              value={scheduleCollabId}
              onChange={(e) => void loadCollaboratorSchedule(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink"
            >
              <option value="">—</option>
              {collaborators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {collaborators.find((c) => c.id === scheduleCollabId) && (
              <div className="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-subtle/40 p-2">
                {collaborators.find((c) => c.id === scheduleCollabId)?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={collaborators.find((c) => c.id === scheduleCollabId)!.avatarUrl!}
                    alt={collaborators.find((c) => c.id === scheduleCollabId)!.name}
                    className="h-8 w-8 shrink-0 rounded-full object-cover border border-border-subtle"
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent text-xs font-semibold">
                    {collaborators.find((c) => c.id === scheduleCollabId)!.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink truncate">
                    {collaborators.find((c) => c.id === scheduleCollabId)!.name}
                  </p>
                  {collaborators.find((c) => c.id === scheduleCollabId)!.specialty && (
                    <p className="text-[11px] text-ink-secondary truncate">
                      {collaborators.find((c) => c.id === scheduleCollabId)!.specialty}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {scheduleLoading ? (
            <CardListSkeleton count={3} />
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {scheduleRows.map((row) => (
                <div
                  key={row.dayOfWeek}
                  className="rounded-xl border border-border-subtle bg-subtle/40 p-3 space-y-2"
                >
                  <label className="flex items-center gap-2 text-sm font-semibold text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) =>
                        setScheduleRows((prev) =>
                          prev.map((item) =>
                            item.dayOfWeek === row.dayOfWeek
                              ? { ...item, enabled: e.target.checked }
                              : item,
                          ),
                        )
                      }
                      className="h-4 w-4 accent-accent"
                    />
                    {t.days[row.dayOfWeek]}
                  </label>
                  {row.enabled && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-ink-muted">
                          {t.common.startTime}
                        </span>
                        <Input
                          type="time"
                          value={row.startTime}
                          onChange={(e) =>
                            setScheduleRows((prev) =>
                              prev.map((item) =>
                                item.dayOfWeek === row.dayOfWeek
                                  ? { ...item, startTime: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          className="min-h-11 rounded-xl border-border-strong bg-surface px-2.5 font-mono text-xs tabular-nums"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-ink-muted">
                          {t.common.endTime}
                        </span>
                        <Input
                          type="time"
                          value={row.endTime}
                          onChange={(e) =>
                            setScheduleRows((prev) =>
                              prev.map((item) =>
                                item.dayOfWeek === row.dayOfWeek
                                  ? { ...item, endTime: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          className="min-h-11 rounded-xl border-border-strong bg-surface px-2.5 font-mono text-xs tabular-nums"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {scheduleError && (
            <p
              role="alert"
              className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-danger-ink)]"
            >
              {scheduleError}
            </p>
          )}

          {scheduleSaved && (
            <p
              role="status"
              className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-success-ink)]"
            >
              {t.owner.scheduleSaved}
            </p>
          )}

          <Button
            type="submit"
            disabled={!scheduleCollabId || scheduleSaving}
            className="min-h-11 w-full rounded-full bg-accent text-accent-ink hover:bg-accent-hover cursor-pointer"
          >
            {scheduleSaving && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {t.common.save}
          </Button>
        </form>
      </Modal>
      {/* Modal: Confirmar Exclusão de Serviço */}
      <Modal
        open={Boolean(deleteTarget)}
        title={t.common.confirmDeleteTitle}
        onClose={() => setDeleteTarget(null)}
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-ink-secondary">
              {t.common.confirmDeleteService}
            </p>
            <p className="rounded-xl bg-subtle px-3.5 py-2.5 text-sm font-semibold text-ink">
              {deleteTarget.name}
            </p>
            {deleteError && (
              <p
                role="alert"
                className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-danger-ink)]"
              >
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                className="min-h-11 rounded-full px-5 cursor-pointer"
              >
                {t.common.cancel}
              </Button>
              <Button
                type="button"
                disabled={deletingService}
                onClick={() => void handleConfirmDeleteService()}
                className="min-h-11 rounded-full bg-[var(--status-danger-ink)] px-5 text-white hover:opacity-90 cursor-pointer"
              >
                {deletingService && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                {t.common.delete}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
