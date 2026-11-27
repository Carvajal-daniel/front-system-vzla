import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api-client";
import { getPublicPortal } from "@/src/services/public-portal";
import { PublicPortalShell } from "./public-portal-shell";

interface PublicPortalLoaderProps {
  params: Promise<{ slug: string }>;
}

/**
 * Server Component isolado dentro de <Suspense> para compatibilidade com
 * cacheComponents: true no Next.js 16. Retorna notFound() quando a API responde 404.
 */
export async function PublicPortalLoader({ params }: PublicPortalLoaderProps) {
  const { slug } = await params;

  try {
    const portalData = await getPublicPortal(slug);
    return <PublicPortalShell data={portalData} />;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
