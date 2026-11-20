const TOKEN_STORAGE_KEY = "atelier_agenda_jwt";
const UNAUTHORIZED_EVENT = "atelier:unauthorized";

/**
 * Leitura/escrita de token ocorre exclusivamente no navegador (dentro de efeitos
 * ou manipuladores de eventos), nunca na renderização inicial de Server/Client Components.
 */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignora falhas de quota/modo privado sem quebrar o fluxo
  }
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignora falhas de acesso ao storage
  }
}

export function notifyUnauthorized(): void {
  clearStoredToken();
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
}

export function subscribeUnauthorized(handler: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  window.addEventListener(UNAUTHORIZED_EVENT, handler);
  return () => {
    window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  };
}
