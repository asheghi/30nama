import { ApiClient } from "@30nama/api";

const TOKEN_KEY = "30nama:token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function createClient(token?: string | null): ApiClient {
  return new ApiClient({ token: token ?? getStoredToken() });
}
