import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ApiError } from "@/lib/api-client";
import { getPublicCompanySlug } from "@/src/services/public-portal";
import BookingLoading from "./loading";

export const metadata: Metadata = {
  title: "Agendamento Online",
  description: "Escolha o serviço, profissional e horário disponível.",
};

/**
 * Redireciona automaticamente a URL legada /book/[companyId] para o novo Portal Público /[slug].
 * Isolado em Server Component dentro de <Suspense> por compatibilidade com cacheComponents: true.
 */
async function LegacyBookingRedirect({
  params,
}: {
  params: Promise<{ companyId: string }>;
}): Promise<never> {
  const { companyId } = await params;

  let slug: string | null = null;
  try {
    const response = await getPublicCompanySlug(companyId);
    slug = response.slug?.trim() || null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  if (!slug) {
    notFound();
  }

  redirect(`/${encodeURIComponent(slug)}`);
}

export default function PublicBookingPage(props: {
  params: Promise<{ companyId: string }>;
}) {
  return (
    <Suspense fallback={<BookingLoading />}>
      <LegacyBookingRedirect params={props.params} />
    </Suspense>
  );
}
