import { notFound } from "next/navigation";
import { ApiError, apiRequest } from "@/lib/api-client";
import { defaultCompanySettings, type CompanySettings } from "@/lib/company-settings";
import type { PublicCatalogResponse } from "@/lib/types/public-booking";
import { BookingWizard } from "./booking-wizard";

interface PublicCatalogLoaderProps {
  params: Promise<{ companyId: string }>;
}

/**
 * Server Component assíncrono isolado dentro de <Suspense> para compatibilidade
 * com cacheComponents: true do Next.js 16. Empresa inexistente/inativa (404) aciona notFound().
 */
export async function PublicCatalogLoader({
  params,
}: PublicCatalogLoaderProps) {
  const { companyId } = await params;

  let catalog: PublicCatalogResponse;
  let settings: CompanySettings;
  try {
    const path = `/public/companies/${encodeURIComponent(companyId)}`;
    [catalog, settings] = await Promise.all([
      apiRequest<PublicCatalogResponse>(`${path}/services`, { auth: false }),
      apiRequest<CompanySettings>(`${path}/settings`, { auth: false }).catch((error) => {
        if (error instanceof ApiError && error.status === 404) return defaultCompanySettings;
        throw error;
      }),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <BookingWizard company={catalog.company} services={catalog.services} initialSettings={{ ...defaultCompanySettings, ...settings }} />
  );
}
