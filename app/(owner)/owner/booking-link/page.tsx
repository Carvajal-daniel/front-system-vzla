"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Globe,
  MapPin,
  MessageCircle,
  Palette,
  Phone,
  Printer,
  QrCode,
  Share2,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/ui/auth-guard";
import { CompanyAvatar } from "@/components/ui/company-avatar";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";

export default function BookingLinkPage() {
  const { session } = useSession();
  const company = session.company;
  const companyId = company.id;

  const [copied, setCopied] = useState(false);
  const [deviceType, setDeviceType] = useState<"iphone" | "android">("iphone");
  const [primaryColor, setPrimaryColor] = useState("#10b981");
  const [instagram, setInstagram] = useState("@salao_vip");
  const [customTitle, setCustomTitle] = useState(company.companyName);

  // URL pública do link de agendamento
  const bookingUrl = typeof window !== "undefined"
    ? `${window.location.origin}/book/${encodeURIComponent(companyId)}`
    : `https://seusalao.com.br/book/${companyId}`;

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
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Não foi possível abrir a janela de impressão.");
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code de Agendamento - ${customTitle}</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 90vh; text-align: center; }
            h1 { margin-bottom: 8px; font-size: 28px; }
            p { color: #555; margin-bottom: 24px; font-size: 16px; }
            .qr-box { border: 4px solid #000; padding: 20px; border-radius: 20px; display: inline-block; }
            .url { margin-top: 16px; font-size: 14px; color: #2563eb; }
          </style>
        </head>
        <body>
          <h1>${customTitle}</h1>
          <p>Aponte a câmera do seu celular para agendar seu horário online!</p>
          <div class="qr-box">
            <svg width="240" height="240" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="100" height="100" fill="white"/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M10 10h30v30H10V10zm5 5h20v20H15V15zm5 5h10v10H20V20zm40-10h30v30H60V10zm5 5h20v20H65V15zm5 5h10v10H70V20zM10 60h30v30H10V60zm5 5h20v20H15V65zm5 5h10v10H20V70zm45-10h10v10H65V60zm15 0h10v10H80V60zm-15 15h10v10H65V75zm15 0h10v10H80V75zm-35-25h10v10H45V50zm15 0h10v10H60V50zm-15 15h10v10H45V65zm15 15h10v10H60V80zm15 5h10v10H75V85z" fill="black"/>
            </svg>
          </div>
          <div class="url">${bookingUrl}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  }

  function handleDownloadSvg() {
    const svgEl = document.getElementById("booking-qr-code-svg");
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgEl);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qrcode-agendamento-${companyId}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("QR Code baixado em SVG com sucesso!");
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
                <svg
                  id="booking-qr-code-svg"
                  width="140"
                  height="140"
                  viewBox="0 0 100 100"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect width="100" height="100" fill="white" />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M10 10h30v30H10V10zm5 5h20v20H15V15zm5 5h10v10H20V20zm40-10h30v30H60V10zm5 5h20v20H65V15zm5 5h10v10H70V20zM10 60h30v30H10V60zm5 5h20v20H15V65zm5 5h10v10H20V70zm45-10h10v10H65V60zm15 0h10v10H80V60zm-15 15h10v10H65V75zm15 0h10v10H80V75zm-35-25h10v10H45V50zm15 0h10v10H60V50zm-15 15h10v10H45V65zm15 15h10v10H60V80zm15 5h10v10H75V85z"
                    fill="black"
                  />
                  <rect x="42" y="42" width="16" height="16" rx="4" fill={primaryColor} />
                </svg>
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
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:text-accent hover:border-accent transition-colors cursor-pointer"
                  >
                    <Printer size={13} />
                    <span>Imprimir Flyer</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadSvg}
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
                  <h3 className="text-base font-bold text-white tracking-tight">{customTitle}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center justify-center gap-1">
                    <MapPin size={10} style={{ color: primaryColor }} />
                    <span>São Paulo, SP · Aberto Hoje</span>
                  </p>
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
              <div className="mt-5 mx-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-3 text-center space-y-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                  <Sparkles size={11} />
                  Programa de Pontos
                </span>
                <p className="text-[11px] text-slate-300">
                  Acumule 1 ponto a cada R$ 1 gasto e troque por serviços grátis!
                </p>
              </div>

              {/* Footer do Mockup */}
              <div className="mt-6 text-center text-[10px] text-slate-500">
                <span>Agendamento online seguro · Powered by Antigravity</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
