import { getStoredToken, notifyUnauthorized } from "@/lib/auth";
import type { AuthTokenResponse } from "@/lib/types/auth";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  return raw.replace(/\/+$/, "");
}

export function extractAuthToken(payload: AuthTokenResponse): string | null {
  const token = payload.token ?? payload.accessToken;
  return typeof token === "string" && token.trim().length > 0 ? token : null;
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  auth?: boolean;
  token?: string | null;
  signal?: AbortSignal;
  cache?: RequestCache;
}

function buildUrl(
  path: string,
  query?: Record<string, string | number | boolean | undefined | null>,
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${getApiBaseUrl()}${normalizedPath}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim().length > 0) {
      return record.message;
    }
    if (typeof record.error === "string" && record.error.trim().length > 0) {
      return record.error;
    }
  }
  return fallback;
}

/**
 * Cliente HTTP centralizado para a API Fastify externa.
 * Toda regra de negócio, autenticação e persistência ocorre exclusivamente no backend.
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    query,
    auth = true,
    token: explicitToken,
    signal,
    cache,
  } = options;

  const headers = new Headers({
    Accept: "application/json",
  });

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  if (body !== undefined && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = explicitToken ?? getStoredToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      cache: cache ?? "no-store",
    });
  } catch (error) {
    throw new ApiError(
      error instanceof Error ? error.message : "Network error",
      0,
      "NETWORK_ERROR",
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const parsedBody: unknown =
    response.status === 204
      ? undefined
      : isJson
        ? await response.json().catch(() => undefined)
        : await response.text().catch(() => undefined);

  if (!response.ok) {
    if (response.status === 401 && auth) {
      notifyUnauthorized();
    }

    const code =
      parsedBody &&
      typeof parsedBody === "object" &&
      "code" in parsedBody &&
      typeof (parsedBody as Record<string, unknown>).code === "string"
        ? ((parsedBody as Record<string, unknown>).code as string)
        : undefined;

    throw new ApiError(
      extractErrorMessage(parsedBody, `HTTP ${response.status}`),
      response.status,
      code,
      parsedBody,
    );
  }

  return parsedBody as T;
}
