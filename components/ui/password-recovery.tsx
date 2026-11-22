"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, apiRequest } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";
import { Button } from "./button";
import { Input } from "./input";

export function validNewPassword(value: string) {
  return value.length >= 6 && value.length <= 15 && /[^\p{L}\p{N}\s]/u.test(value);
}

export function PasswordRecovery() {
  const dialog = useRef<HTMLDialogElement>(null);
  const { locale, t } = useLocale();
  const es = locale === "es";
  const [destination, setDestination] = useState("");
  const [stage, setStage] = useState<"request" | "verify" | "done">("request");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const title = es ? "Recuperar acceso" : "Recuperar acesso";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setError("");
    setPending(true);
    try {
      const contact = destination.includes("@") ? { email: destination.trim() } : { phone: destination.trim() };
      if (stage === "request") {
        await apiRequest("/auth/forgot-password", { method: "POST", auth: false, body: contact });
        setStage("verify");
      } else {
        const newPassword = String(fields.get("newPassword"));
        if (!validNewPassword(newPassword)) throw new Error(t.auth.passwordHint);
        if (newPassword !== fields.get("confirmation")) throw new Error(es ? "Las contraseñas no coinciden." : "As senhas não coincidem.");
        await apiRequest("/auth/reset-password", {
          method: "POST", auth: false, body: { ...contact, code: fields.get("code"), newPassword },
        });
        setStage("done");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setError(es ? "El envío de códigos aún no está configurado." : "O envio de códigos ainda não está configurado.");
      } else if (err instanceof ApiError && err.status === 429) {
        setError(es ? "Demasiados intentos. Intenta más tarde." : "Muitas tentativas. Tente novamente mais tarde.");
      } else if (err instanceof ApiError && err.status === 400 && stage === "request") {
        setError(es ? "Ingresa un correo electrónico o teléfono válido." : "Informe um e-mail ou telefone válido.");
      } else {
        setError(err instanceof Error && !(err instanceof ApiError) ? err.message :
          stage === "verify"
            ? es ? "No se pudo validar el código. Comprueba los datos e inténtalo de nuevo." : "Não foi possível validar o código. Confira os dados e tente novamente."
            : t.errors.networkDescription);
      }
    } finally {
      setPending(false);
    }
  }

  return <>
    <button type="button" className="min-h-11 text-sm font-semibold text-accent underline-offset-4 hover:underline"
      onClick={() => { setDestination(""); setStage("request"); setError(""); dialog.current?.showModal(); }}>
      {es ? "Olvidé mi contraseña" : "Esqueci minha senha"}
    </button>
    <dialog ref={dialog} aria-label={title} onCancel={(event) => { if (pending) event.preventDefault(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-auto rounded-2xl border border-border-subtle bg-surface p-5 text-ink shadow-xl backdrop:bg-black/50">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {stage === "done" ? <p role="status" className="mb-4 text-sm">{t.common.passwordUpdated}</p> :
        <form key={stage} onSubmit={submit} className="mb-3 space-y-3">
          {stage === "request" ? <label className="grid gap-2 text-sm font-medium">
            {es ? "Correo electrónico o WhatsApp registrado" : "E-mail ou WhatsApp cadastrado"}
            <Input name="destination" value={destination} required maxLength={254} onChange={(event) => setDestination(event.target.value)} />
          </label> : <>
            <p className="text-sm text-ink-secondary">{es ? "Si los datos están registrados, recibirás un código de verificación." : "Se os dados estiverem cadastrados, você receberá um código de verificação."}</p>
            <label className="grid gap-2 text-sm font-medium">{es ? "Código de verificación" : "Código de verificação"}
              <Input name="code" required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} />
            </label>
            <label className="grid gap-2 text-sm font-medium">{t.common.newPassword}
              <Input name="newPassword" type="password" required autoComplete="new-password" minLength={6} maxLength={15} />
            </label>
            <label className="grid gap-2 text-sm font-medium">{es ? "Confirmar nueva contraseña" : "Confirmar nova senha"}
              <Input name="confirmation" type="password" required autoComplete="new-password" minLength={6} maxLength={15} />
            </label>
          </>}
          {stage === "verify" && <Button type="button" variant="ghost" disabled={pending} onClick={() => { setError(""); setStage("request"); }}>{es ? "Solicitar otro código" : "Solicitar outro código"}</Button>}
          {error && <p role="alert" className="text-sm text-[var(--status-danger-ink)]">{error}</p>}
          <Button type="submit" disabled={pending}>{pending ? t.common.saving : stage === "request" ? "Solicitar código" : t.common.save}</Button>
        </form>}
      <Button type="button" variant="outline" disabled={pending} onClick={() => dialog.current?.close()}>{stage === "done" ? (es ? "Cerrar" : "Fechar") : t.common.cancel}</Button>
    </dialog>
  </>;
}

