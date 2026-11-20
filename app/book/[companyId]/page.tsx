import { Suspense } from "react";
import type { Metadata } from "next";
import BookingLoading from "./loading";
import { PublicCatalogLoader } from "./_components/public-catalog-loader";

export const metadata: Metadata = {
  title: "Agendamento Online",
  description: "Escolha o serviço, profissional e horário disponível.",
};

export default function PublicBookingPage(props: {
  params: Promise<{ companyId: string }>;
}) {
  return (
    <Suspense fallback={<BookingLoading />}>
      <PublicCatalogLoader params={props.params} />
    </Suspense>
  );
}
