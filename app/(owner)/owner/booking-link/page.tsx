"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Globe,
  MapPin,
  Palette,
  Printer,
  QrCode,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import { displayCompanyRating, formatCompanyAddress } from "@/lib/company-settings";
import { useLocale } from "@/lib/i18n/locale-context";
import { saveCompanySettings, useCompanySettings } from "@/lib/use-company-settings";
import { CompanyRating } from "@/components/ui/company-rating";
import { useSession } from "@/components/ui/auth-guard";
import { CompanyAvatar } from "@/components/ui/company-avatar";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";

export default function BookingLinkPage() {
  const { t } = useLocale();
  const { session } = useSession();
  const company = session.company;
  const companyId = company.id;
  const { settings } = useCompanySettings(companyId, undefined, true, true);
  const address = formatCompanyAddress(settings.address);
  const [qr, setQr] = useState<{ png: string; svg: string }>();
  const [slugDraft, setSlugDraft] = useState<string | null>(null);
  const [savingSlug, setSavingSlug] = useState(false);

  const [copied, setCopied] = useState(false);
  const [deviceType, setDeviceType] = useState<"iphone" | "android">("iphone");
  const [primaryColor, setPrimaryColor] = useState("#10b981");
  const [instagram, setInstagram] = useState("@salao_vip");
  const [customTitle, setCustomTitle] = useState(company.companyName);

  // URL pública amigável do Portal Público (fallback para /book/[companyId] apenas se o slug vier vazio)
  const activeSlug = settings.slug?.trim();
  const bookingPath = activeSlug
    ? `/${encodeURIComponent(activeSlug)}`
    : `/book/${encodeURIComponent(companyId)}`;
  const bookingUrl = typeof window !== "undefined"
    ? `${window.location.origin}${bookingPath}`
    : `https://seusalao.com.br${bookingPath}`;
  const originPrefix = typeof window !== "undefined"
    ? `${window.location.origin}/`
    : "https://seusalao.com.br/";
  const currentSlugInput = slugDraft ?? settings.slug ?? "";

  async function handleSaveSlug() {
    const trimmed = currentSlugInput.trim();
    if (trimmed.length < 2) {
      toast.error("Informe um endereço com pelo menos 2 caracteres.");
      return;
    }
    setSavingSlug(true);
    try {
      const updated = await saveCompanySettings(companyId, { slug: trimmed });
      setSlugDraft(null);
      toast.success(`Link atualizado para /${updated.slug ?? trimmed}`);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Não foi possível salvar o slug.";
      toast.error(message);
    } finally {
      setSavingSlug(false);
    }
  }

  useEffect(() => {
    let active = true;
    void import("qrcode").then(async ({ toDataURL, toString }) => {
      const options = { width: 640, margin: 4, errorCorrectionLevel: "M" } as const;
      const [png, svg] = await Promise.all([toDataURL(bookingUrl, options), toString(bookingUrl, { ...options, type: "svg" })]);
      if (active) setQr({ png, svg });
    }).catch(() => {
      if (active) toast.error("Não foi possível gerar o QR Code.");
    });
    return () => { active = false; };
  }, [bookingUrl]);

  function handleCopy() {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      toast.success("Link de agendamento copiado para a área de transferência!");
      setTimeout(() => setCopied(false), 2500);
    }
  }

  function handleWhatsAppShare() {
    const text = encodeURIComponent(
      `Olá! Agora você pode agendar seu horário com rapidez e comodidade diretamente pelo nosso link online:\n\n${bookingUrl}\n\nEsperamos você!`,
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  }

  function handlePrintQrCode() {
    if (!qr) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Não foi possível abrir a janela de impressão.");
      return;
    }
    printWindow.opener = null;
    const doc = printWindow.document;
    doc.title = "QR Code de agendamento";
    doc.body.style.cssText = "min-height:90vh;display:grid;place-content:center;justify-items:center;text-align:center;font:16px system-ui;padding:24px";
    const title = doc.createElement("h1");
    title.textContent = customTitle;
    const description = doc.createElement("p");
    description.textContent = "Aponte a câmera do celular para agendar seu horário.";
    const image = doc.createElement("img");
    image.alt = "QR Code de agendamento";
    image.width = 280;
    image.height = 280;
    const url = doc.createElement("p");
    url.textContent = bookingUrl;
    doc.body.append(title, description, image, url);
    image.onload = () => { printWindow.focus(); printWindow.print(); };
    image.src = qr.png;
  }

  function handleDownloadSvg() {
    if (!qr) return;
    const url = URL.createObjectURL(new Blob([qr.svg], { type: "image/svg+xml;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `qrcode-agendamento-${activeSlug ?? companyId}.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="space-y-6">
      {/* Topo informativo */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Smartphone className="size-6 text-accent" />
            Central do Link de Agendamento Online
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Divulgue seu link público nas redes sociais, imprima o QR Code no balcão e receba agendamentos 24 horas por dia.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs cursor-pointer"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? "Link Copiado!" : "Copiar Link"}</span>
          </button>

          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] text-white px-3.5 py-2.5 text-xs font-bold hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
          >
            <WhatsAppIcon className="size-4" />
            <span>Compartilhar WhatsApp</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ======================================================== */}
        {/* COLUNA ESQUERDA: CONFIGURAÇÕES E COMPARTILHAMENTO (7 cols) */}
        {/* ======================================================== */}
        <div className="space-y-6 lg:col-span-7">
          {/* Card 1: URL Pública e Ações Rápidas */}
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
                <Globe size={14} className="text-accent" />
                Seu Link Exclusivo
              </span>
              <a
                href={bookingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1"
              >
                <span>Testar página pública</span>
                <ExternalLink size={12} />
              </a>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-canvas/40 p-2 sm:p-2.5">
              <input
                readOnly
                type="text"
                value={bookingUrl}
                className="flex-1 bg-transparent text-xs sm:text-sm font-mono text-ink outline-none select-all truncate"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:text-accent hover:border-accent border border-border-subtle transition-colors cursor-pointer shrink-0"
              >
                {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                <span>{copied ? "Copiado!" : "Copiar"}</span>
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center overflow-hidden rounded-xl border border-border-subtle bg-canvas/40 focus-within:border-accent">
                <span className="shrink-0 bg-subtle/60 px-2.5 py-2 text-xs font-mono text-ink-muted select-none">
                  {originPrefix}
                </span>
                <input
                  type="text"
                  value={currentSlugInput}
                  onChange={(e) => setSlugDraft(e.target.value)}
                  placeholder="minha-barbearia"
                  minLength={2}
                  maxLength={100}
                  className="flex-1 bg-transparent px-2.5 py-2 text-xs sm:text-sm font-mono text-ink outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleSaveSlug()}
                disabled={savingSlug || slugDraft === null || slugDraft.trim() === (settings.slug ?? "").trim()}
                className="inline-flex items-center justify-center rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-50 transition-colors cursor-pointer shrink-0"
              >
                {savingSlug ? "Salvando..." : "Salvar endereço"}
              </button>
            </div>

            <p className="text-xs text-ink-muted leading-relaxed">
              Cole este link na bio do seu <strong>Instagram</strong>, no botão de ação do <strong>WhatsApp Business</strong> e no seu perfil do <strong>Google Meu Negócio</strong>. Seus clientes poderão agendar a qualquer momento sem precisar baixar nenhum aplicativo.
            </p>
          </div>

          {/* Card 2: QR Code Visual Interativo e Impressão */}
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
                <QrCode size={14} className="text-accent" />
                QR Code para Balcão e Espelhos
              </span>
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                Pronto para Imprimir
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-md">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img width={140} height={140} alt="QR Code de agendamento" src={qr.png} />
                ) : <div className="size-[140px]" aria-hidden="true" />}
              </div>

              <div className="flex-1 space-y-3 text-center sm:text-left">
                <div>
                  <h4 className="text-sm font-semibold text-ink">Placa de Atendimento Presencial</h4>
                  <p className="mt-1 text-xs text-ink-muted">
                    Imprima e posicione na recepção ou em cada bancada para que clientes façam o próximo agendamento antes de sair.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handlePrintQrCode}
                    disabled={!qr}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:text-accent hover:border-accent transition-colors cursor-pointer"
                  >
                    <Printer size={13} />
                    <span>Imprimir Flyer</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadSvg}
                    disabled={!qr}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:text-accent hover:border-accent transition-colors cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Baixar SVG</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Personalização Visual do Link */}
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
              <Palette size={14} className="text-accent" />
              Personalização Visual do Link
            </span>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-semibold text-ink-secondary">
                Nome de Exibição
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink outline-none focus-visible:border-accent"
                />
              </label>

              <label className="space-y-1.5 text-xs font-semibold text-ink-secondary">
                Instagram Oficial
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@seuperfil"
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink outline-none focus-visible:border-accent"
                />
              </label>

              <div className="sm:col-span-2 space-y-1.5">
                <span className="text-xs font-semibold text-ink-secondary block">
                  Cor de Destaque da Marca
                </span>
                <div className="flex items-center gap-2.5">
                  {["#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#06b6d4"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPrimaryColor(c)}
                      style={{ backgroundColor: c }}
                      className={`size-7 rounded-full transition-transform cursor-pointer ${
                        primaryColor === c ? "ring-2 ring-offset-2 ring-accent scale-110" : "opacity-80 hover:opacity-100"
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="size-7 rounded-lg border-0 bg-transparent cursor-pointer p-0"
                    title="Escolher cor personalizada"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Atalhos para Regras Financeiras e Pacotes */}
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-3">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider block">
              Recursos Avançados para seu Link
            </span>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <Link
                href="/owner/finance/online-payments"
                className="flex items-start gap-3 rounded-xl border border-border-subtle bg-canvas/40 p-3 hover:border-accent transition-colors"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
                  <Sparkles size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-ink">Cobrar Sinal / Depósito Online</p>
                  <p className="text-[11px] text-ink-muted mt-0.5">Exija 30% a 50% antecipado para evitar faltas.</p>
                </div>
              </Link>

              <Link
                href="/owner/services/packages"
                className="flex items-start gap-3 rounded-xl border border-border-subtle bg-canvas/40 p-3 hover:border-accent transition-colors"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
                  <Calendar size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-ink">Venda de Pacotes de Sessões</p>
                  <p className="text-[11px] text-ink-muted mt-0.5">Disponibilize planos de 4 cortes ou combos.</p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUNA DIREITA: MOCKUP INTERATIVO DE SMARTPHONE (5 cols) */}
        {/* ======================================================== */}
        <div className="flex flex-col items-center lg:col-span-5">
          {/* Seletor de dispositivo */}
          <div className="mb-4 flex items-center rounded-xl border border-border-subtle bg-surface p-1 text-xs">
            <button
              type="button"
              onClick={() => setDeviceType("iphone")}
              className={`rounded-lg px-3 py-1 font-semibold transition-colors cursor-pointer ${
                deviceType === "iphone"
                  ? "bg-accent text-accent-ink"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              iPhone (iOS)
            </button>
            <button
              type="button"
              onClick={() => setDeviceType("android")}
              className={`rounded-lg px-3 py-1 font-semibold transition-colors cursor-pointer ${
                deviceType === "android"
                  ? "bg-accent text-accent-ink"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              Android
            </button>
          </div>

          {/* Carcaça do Smartphone */}
          <div
            className={`relative w-[320px] sm:w-[340px] overflow-hidden rounded-[44px] border-[10px] bg-slate-900 shadow-2xl transition-all ${
              deviceType === "iphone"
                ? "border-slate-800 ring-2 ring-slate-700/50"
                : "border-slate-800 rounded-[36px]"
            }`}
            style={{ height: "640px" }}
          >
            {/* Dynamic Island / Notch */}
            {deviceType === "iphone" ? (
              <div className="absolute left-1/2 top-3 z-30 h-5 w-24 -translate-x-1/2 rounded-full bg-black flex items-center justify-end pr-2">
                <span className="size-2 rounded-full bg-emerald-500/60" />
              </div>
            ) : (
              <div className="absolute left-1/2 top-3 z-30 size-3 -translate-x-1/2 rounded-full bg-black ring-1 ring-slate-700" />
            )}

            {/* Tela Interna do Celular */}
            <div className="relative h-full w-full overflow-y-auto bg-slate-950 text-slate-100 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pt-10 pb-6">
              {/* Header do Salão */}
              <div className="px-5 text-center space-y-2">
                <div className="mx-auto size-16 rounded-2xl p-1 border-2 shadow-lg flex items-center justify-center overflow-hidden" style={{ borderColor: primaryColor }}>
                  <CompanyAvatar url={company.avatarUrl} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <h3 className="text-base font-bold text-white tracking-tight">{customTitle}</h3>
                    <CompanyRating rating={displayCompanyRating(settings)} />
                  </div>
                  {address && <p className="mt-0.5 flex items-start justify-center gap-1 text-[11px] text-slate-400">
                    <MapPin size={12} className="mt-0.5 shrink-0" style={{ color: primaryColor }} />
                    <span>{address}</span>
                  </p>}
                </div>

                {instagram && (
                  <p className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] text-slate-300">
                    <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                    </svg>
                    <span>{instagram}</span>
                  </p>
                )}
              </div>

              {/* Botões de Ação Principais no Celular */}
              <div className="mt-5 px-5 space-y-2">
                <button
                  type="button"
                  style={{ backgroundColor: primaryColor }}
                  className="w-full rounded-xl py-3 text-xs font-bold text-slate-950 shadow-md hover:opacity-95 transition-opacity"
                >
                  + Agendar Novo Horário
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors"
                >
                  Minhas Reservas
                </button>
              </div>

              {/* Serviços em Destaque no Mockup */}
              <div className="mt-6 px-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Serviços Populares
                  </span>
                  <span className="text-[10px] text-slate-500">Ver todos</span>
                </div>

                <div className="space-y-2">
                  {[
                    { name: "Corte Degradê / Fade", duration: "40 min", price: "R$ 55,00" },
                    { name: "Barba Terapia com Toalha", duration: "35 min", price: "R$ 45,00" },
                    { name: "Combo Completo (Cabelo + Barba)", duration: "70 min", price: "R$ 90,00" },
                  ].map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 hover:border-white/20 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-semibold text-white truncate">{s.name}</p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock size={10} />
                          <span>{s.duration}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold" style={{ color: primaryColor }}>
                          {s.price}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Banner de Fidelidade no Mockup */}
              <div className="mt-5 mx-5 rounded-2xl border border-white/10 bg-white/8 p-3 text-center space-y-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                  <Sparkles size={11} aria-hidden="true" />
                  Programa de Pontos
                </span>
                <p className="text-[11px] text-slate-300">
                  Acumule pontos a cada atendimento e troque por benefícios!
                </p>
              </div>

              {/* Footer do Mockup */}
              <div className="mt-6 text-center text-[10px] text-slate-400">
                <span>Agendamento online seguro · {t.common.appName}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
