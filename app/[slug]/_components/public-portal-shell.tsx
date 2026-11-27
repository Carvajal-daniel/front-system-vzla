"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarDays, Crown, MapPin, Scissors } from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { stripNonDigits } from "@/lib/format";
import {
  formatCompanyAddress,
  getPublicPortalErrorMessage,
  identifyPublicCustomer,
  type PublicIdentifyResponse,
  type PublicPortalResponse,
} from "@/src/services/public-portal";
import { BookingTab } from "./booking-tab";
import { ClubTab } from "./club-tab";

interface PublicPortalShellProps {
  data: PublicPortalResponse;
}

type PortalTab = "booking" | "club";

function buildWhatsAppUrl(
  whatsapp: string | null,
  phone: string | null,
  companyName: string,
): string | null {
  const raw = whatsapp || phone;
  if (!raw) return null;
  const digits = stripNonDigits(raw);
  if (digits.length < 10) return null;
  const fullNumber = digits.length <= 11 ? `55${digits}` : digits;
  const text = encodeURIComponent(
    `Olá! Gostaria de falar com ${companyName} sobre agendamento.`,
  );
  return `https://wa.me/${fullNumber}?text=${text}`;
}

export function PublicPortalShell({ data }: PublicPortalShellProps) {
  const { company, depositPolicy, services, clubPlans } = data;

  const [activeTab, setActiveTab] = useState<PortalTab>("booking");
  const [avatarFailed, setAvatarFailed] = useState(false);

  // Estado compartilhado de identificação entre as abas Agendar Horário e Clube VIP
  const [clientName, setClientName] = useState("");
  const [clientPhoneDigits, setClientPhoneDigits] = useState("");
  const [identification, setIdentification] =
    useState<PublicIdentifyResponse | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [identifyError, setIdentifyError] = useState<string | null>(null);

  const formattedAddress = useMemo(
    () => formatCompanyAddress(company.address),
    [company.address],
  );

  const whatsappUrl = useMemo(
    () => buildWhatsAppUrl(company.whatsapp, company.phone, company.companyName),
    [company.whatsapp, company.phone, company.companyName],
  );

  const handleIdentify = useCallback(
    async (digits: string, name?: string) => {
      if (digits.length < 10) {
        setIdentification(null);
        return;
      }
      setIdentifying(true);
      setIdentifyError(null);
      try {
        const result = await identifyPublicCustomer(company.slug, {
          phone: digits,
          name: name?.trim() ? name.trim() : undefined,
        });
        setIdentification(result);
      } catch (error) {
        setIdentifyError(
          getPublicPortalErrorMessage(
            error,
            "Não foi possível verificar sua assinatura no momento.",
          ),
        );
      } finally {
        setIdentifying(false);
      }
    },
    [company.slug],
  );

  const handlePhoneChange = useCallback((digits: string) => {
    setClientPhoneDigits(digits);
    if (digits.length < 10) {
      setIdentification(null);
      setIdentifyError(null);
    }
  }, []);

  return (
    <main className="min-h-dvh bg-canvas px-4 py-5 sm:py-8">
      <div className="mx-auto max-w-lg space-y-5">
        {/* Cabeçalho da Barbearia */}
        <header className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border-subtle bg-accent text-accent-ink shadow-xs">
              {company.avatarUrl && !avatarFailed ? (
                // eslint-disable-next-line @next/next/no-img-element -- logo externo configurado pela barbearia
                <img
                  src={company.avatarUrl}
                  alt={company.companyName}
                  onError={() => setAvatarFailed(true)}
                  className="size-full object-cover"
                />
              ) : (
                <Scissors className="size-6" aria-hidden="true" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold tracking-tight text-ink leading-snug">
                {company.companyName}
              </h1>
              {company.description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-secondary">
                  {company.description}
                </p>
              )}
              {formattedAddress && (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-muted">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>{formattedAddress}</span>
                </p>
              )}
            </div>
          </div>

          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border-subtle bg-subtle/60 px-4 text-sm font-semibold text-ink transition-colors hover:bg-subtle"
            >
              <WhatsAppIcon color="#25D366" className="size-5 shrink-0" />
              Falar no WhatsApp
            </a>
          )}

          {/* Abas principais */}
          <div
            role="tablist"
            aria-label="Navegação do portal"
            className="grid grid-cols-2 gap-1.5 rounded-xl bg-subtle p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "booking"}
              onClick={() => setActiveTab("booking")}
              className={[
                "cursor-pointer flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-all",
                activeTab === "booking"
                  ? "bg-surface text-ink shadow-xs"
                  : "text-ink-secondary hover:text-ink",
              ].join(" ")}
            >
              <CalendarDays className="size-4" aria-hidden="true" />
              Agendar Horário
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "club"}
              onClick={() => setActiveTab("club")}
              className={[
                "cursor-pointer flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-all",
                activeTab === "club"
                  ? "bg-surface text-ink shadow-xs"
                  : "text-ink-secondary hover:text-ink",
              ].join(" ")}
            >
              <Crown className="size-4" aria-hidden="true" />
              Clube VIP
              {clubPlans.length > 0 && (
                <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-accent">
                  {clubPlans.length}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Conteúdo da aba ativa */}
        {activeTab === "booking" ? (
          <BookingTab
            company={company}
            depositPolicy={depositPolicy}
            services={services}
            whatsappUrl={whatsappUrl}
            clientName={clientName}
            clientPhoneDigits={clientPhoneDigits}
            identification={identification}
            identifying={identifying}
            identifyError={identifyError}
            onClientNameChange={setClientName}
            onClientPhoneDigitsChange={handlePhoneChange}
            onIdentify={handleIdentify}
          />
        ) : (
          <ClubTab
            company={company}
            services={services}
            clubPlans={clubPlans}
            clientName={clientName}
            clientPhoneDigits={clientPhoneDigits}
            identification={identification}
            onClientNameChange={setClientName}
            onClientPhoneDigitsChange={handlePhoneChange}
            onSubscriptionConfirmed={handleIdentify}
            onGoToBooking={() => setActiveTab("booking")}
          />
        )}

        <footer className="pb-4 pt-2 text-center text-[11px] text-ink-muted">
          Agendamento online seguro • {company.companyName}
        </footer>
      </div>
    </main>
  );
}
