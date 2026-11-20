import type { Metadata } from "next";
import { RegisterForm } from "../_components/register-form";

export const metadata: Metadata = {
  title: "Criar empresa",
  description: "Cadastre sua barbearia ou salão com fuso horário oficial.",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
