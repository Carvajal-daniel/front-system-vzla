"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Eye, EyeOff, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiRequest } from "@/lib/api-client";
import {
  formatPhoneToE164,
  isValidInternationalPhone,
  stripNonDigits,
} from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import type { PhoneCountryCode } from "@/lib/types/public-booking";
import type { Service } from "@/lib/types/service";
import {
  uploadCollaboratorAvatar,
  type Collaborator,
  type CreateCollaboratorPayload,
} from "@/lib/types/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { PhoneInput } from "@/components/ui/phone-input";

export interface GeneratedInvite {
  name: string;
  email: string;
  phoneE164: string;
  tempPassword: string;
  loginUrl: string;
}

interface NewCollaboratorModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (invite: GeneratedInvite) => void;
}

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/**
 * Gera senha temporária forte compatível com a política do backend (6 a 30 caracteres).
 */
function generateStrongTemporaryPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;

  const bytes = new Uint8Array(12);
  window.crypto.getRandomValues(bytes);

  const chars = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    special[bytes[3] % special.length],
  ];

  for (let i = 4; i < 12; i++) {
    chars.push(all[bytes[i] % all.length]);
  }

  return chars.join("");
}

export function NewCollaboratorModal({
  open,
  onClose,
  onCreated,
}: NewCollaboratorModalProps) {
  const { t } = useLocale();
  const td = t.owner.teamDirectory;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [countryCode, setCountryCode] = useState<PhoneCountryCode>("+55");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [commissionPercentage, setCommissionPercentage] = useState("40");
  const [monthlyGoal, setMonthlyGoal] = useState("");
  const [bio, setBio] = useState("");

  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(
    () => new Set(),
  );

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Carrega serviços ativos e gera senha inicial ao abrir o modal
  useEffect(() => {
    if (!open) return;

    setPassword(generateStrongTemporaryPassword());
    setFormError(null);

    let active = true;
    void (async () => {
      try {
        const res = await apiRequest<Service[] | { services?: Service[] }>(
          "/services",
          { auth: true },
        );
        if (!active) return;
        const list = Array.isArray(res) ? res : (res.services ?? []);
        setServices(list.filter((s) => s.active));
      } catch {
        if (active) setServices([]);
      }
    })();

    return () => {
      active = false;
    };
  }, [open]);

  // Libera ObjectURL para evitar vazamento de memória
  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  const resetForm = () => {
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setName("");
    setSpecialty("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setPhoneDigits("");
    setWhatsapp("");
    setCommissionPercentage("40");
    setMonthlyGoal("");
    setBio("");
    setSelectedServiceIds(new Set());
    setFormError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setFormError(td.avatarInvalidType);
      e.target.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setFormError(td.avatarTooLarge);
      e.target.value = "";
      return;
    }

    setFormError(null);
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }
    setAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  };

  const removeSelectedAvatar = () => {
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || name.trim().length < 2) {
      setFormError(t.errors.requiredField);
      return;
    }
    if (!specialty.trim()) {
      setFormError(t.errors.requiredField);
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setFormError(t.errors.requiredField);
      return;
    }
    if (!password || password.length < 6 || password.length > 30) {
      setFormError(td.initialPasswordHint);
      return;
    }
    if (!isValidInternationalPhone(countryCode, phoneDigits)) {
      setFormError(t.errors.invalidPhone);
      return;
    }

    const commissionNum = Number(commissionPercentage.replace(",", "."));
    if (Number.isNaN(commissionNum) || commissionNum < 0 || commissionNum > 100) {
      setFormError(t.errors.requiredField);
      return;
    }

    let monthlyGoalInCents: number | null = null;
    if (monthlyGoal.trim()) {
      const parsedGoal = Number(monthlyGoal.replace(",", "."));
      if (!Number.isNaN(parsedGoal) && parsedGoal >= 0) {
        monthlyGoalInCents = Math.round(parsedGoal * 100);
      }
    }

    const phoneE164 = formatPhoneToE164(countryCode, phoneDigits);
    const cleanedWhatsapp = whatsapp.trim() ? stripNonDigits(whatsapp) : null;

    setSubmitting(true);
    try {
      const payload: CreateCollaboratorPayload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phoneE164,
        whatsapp: cleanedWhatsapp,
        specialty: specialty.trim(),
        bio: bio.trim() ? bio.trim() : null,
        commissionPercentage: commissionNum,
        defaultCommissionRate: commissionNum,
        monthlyRevenueGoal: monthlyGoalInCents,
      };

      const created = await apiRequest<Collaborator>("/collaborators", {
        method: "POST",
        auth: true,
        body: payload,
      });

      // Envia foto de avatar imediatamente após a criação do registro
      if (avatarFile && created.id) {
        try {
          await uploadCollaboratorAvatar(created.id, avatarFile);
        } catch {
          toast.warning(td.avatarUploadFailed);
        }
      }

      // Vincula serviços selecionados usando o endpoint de sincronização do Stage 1
      if (selectedServiceIds.size > 0 && created.id) {
        try {
          await apiRequest(`/collaborators/${encodeURIComponent(created.id)}/services`, {
            method: "PUT",
            auth: true,
            body: {
              services: Array.from(selectedServiceIds).map((serviceId) => ({
                serviceId,
                customCommissionRate: null,
              })),
            },
          });
        } catch {
          // Não bloqueia o fluxo principal se a vinculação opcional falhar
        }
      }

      toast.success(td.createdSuccess);

      const loginUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/login`
          : "/login";

      const invite: GeneratedInvite = {
        name: payload.name,
        email: payload.email,
        phoneE164,
        tempPassword: password,
        loginUrl,
      };

      resetForm();
      onCreated(invite);
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t.owner.newCollaborator}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-600 dark:text-red-400">
            {formError}
          </div>
        )}

        {/* Bloco de Upload de Foto (Opcional) */}
        <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-border-subtle bg-surface-subtle/60 p-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border-subtle bg-surface flex items-center justify-center">
            {avatarPreviewUrl ? (
              <>
                <img
                  src={avatarPreviewUrl}
                  alt={name || "Avatar preview"}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={removeSelectedAvatar}
                  aria-label={t.common.close}
                  className="cursor-pointer absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/75 text-white hover:bg-slate-950 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <Camera className="h-7 w-7 text-ink-muted" />
            )}
          </div>

          <div className="flex-1 text-center sm:text-left space-y-1.5">
            <Label className="text-sm font-medium text-ink">{td.avatarLabel}</Label>
            <p className="text-xs text-ink-muted">{td.avatarHint}</p>
            <div className="pt-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-3.5 w-3.5 mr-1.5" />
                {avatarPreviewUrl ? td.avatarChangeBtn : td.avatarSelectBtn}
              </Button>
            </div>
          </div>
        </div>

        {/* Dados Básicos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-collab-name">{t.auth.nameLabel} *</Label>
            <Input
              id="new-collab-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Rafael Monteiro"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-collab-specialty">{t.common.specialty} *</Label>
            <Input
              id="new-collab-specialty"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Ex.: Barbeiro Visagista"
              required
            />
          </div>
        </div>

        {/* Acesso: E-mail & Senha Inicial */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-collab-email">{t.auth.emailLabel} *</Label>
            <Input
              id="new-collab-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="profissional@salao.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="new-collab-password">{td.initialPasswordLabel} *</Label>
              <button
                type="button"
                onClick={() => setPassword(generateStrongTemporaryPassword())}
                className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-medium text-accent-primary hover:underline"
              >
                <RefreshCw className="h-3 w-3" />
                {td.generatePassword}
              </button>
            </div>
            <div className="relative">
              <Input
                id="new-collab-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                maxLength={30}
                required
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="cursor-pointer absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Contatos: Telefone & WhatsApp */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <PhoneInput
              id="new-collab-phone"
              label={`${t.auth.phoneLabel} *`}
              countryCode={countryCode}
              value={phoneDigits}
              onCountryCodeChange={setCountryCode}
              onChange={setPhoneDigits}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-collab-whatsapp">{td.whatsappOptionalLabel}</Label>
            <Input
              id="new-collab-whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder={td.whatsappPlaceholder}
            />
          </div>
        </div>

        {/* Regras Financeiras: Comissão & Meta Mensal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-collab-commission">
              {t.owner.commissions} (%) *
            </Label>
            <Input
              id="new-collab-commission"
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={commissionPercentage}
              onChange={(e) => setCommissionPercentage(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-collab-goal">{td.monthlyGoalLabel}</Label>
            <Input
              id="new-collab-goal"
              type="number"
              min={0}
              step="50"
              value={monthlyGoal}
              onChange={(e) => setMonthlyGoal(e.target.value)}
              placeholder={td.monthlyGoalPlaceholder}
            />
          </div>
        </div>

        {/* Bio curta */}
        <div className="space-y-1.5">
          <Label htmlFor="new-collab-bio">{td.bioLabel}</Label>
          <textarea
            id="new-collab-bio"
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={td.bioPlaceholder}
            maxLength={500}
            className="w-full rounded-xl border border-input bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* Serviços iniciais (opcional) */}
        {services.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-ink-muted">
              {t.nav.ownerServices}
            </Label>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto rounded-xl border border-border-subtle bg-surface-subtle/50 p-2.5">
              {services.map((service) => {
                const selected = selectedServiceIds.has(service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => toggleService(service.id)}
                    className={[
                      "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                      selected
                        ? "border-accent-primary bg-accent-primary text-accent-ink"
                        : "border-border-subtle bg-surface text-ink-secondary hover:border-border-strong",
                    ].join(" ")}
                  >
                    {service.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Ações do Modal */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-subtle">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={submitting}
            className="cursor-pointer"
          >
            {t.common.cancel}
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitting ? t.common.saving : t.common.create}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
