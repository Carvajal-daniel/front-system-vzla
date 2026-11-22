import { redirect } from "next/navigation";

// Redireciona a rota raiz (/owner) diretamente para a Agenda operacional (/owner/appointments)
export default function OwnerRootPage() {
  redirect("/owner/appointments");
}
