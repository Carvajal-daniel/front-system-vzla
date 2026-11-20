import { notFound } from "next/navigation";
import { ApiError, apiRequest } from "@/lib/api-client";
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
  try {
    catalog = await apiRequest<PublicCatalogResponse>(
      `/public/companies/${encodeURIComponent(companyId)}/services`,
      { auth: false, cache: "no-store" },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <BookingWizard company={catalog.company} services={catalog.services} />
  );
}
