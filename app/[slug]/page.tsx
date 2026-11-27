import { Suspense } from "react";
import type { Metadata } from "next";
import PortalLoading from "./loading";
import { PublicPortalLoader } from "./_components/public-portal-loader";

export const metadata: Metadata = {
  title: "Agendamento Online & Clube VIP",
  description:
    "Agende seu horário online ou assine o Clube VIP de forma rápida e prática.",
};

export default function PublicPortalPage(props: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<PortalLoading />}>
      <PublicPortalLoader params={props.params} />
    </Suspense>
  );
}
