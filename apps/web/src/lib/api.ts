import {
  ApiClient,
  type ActionBody,
  type ApiEnvelope,
  createRpcTransport,
} from "@30nama/api";
import { callHanaApi } from "@/server/hana-api";
import { callInterfaceApi } from "@/server/interface-api";

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

const transport = createRpcTransport({
  call: async <T>(
    action: string,
    body: ActionBody,
    opts: { token?: string | null; signal?: AbortSignal },
  ): Promise<ApiEnvelope<T>> => {
    // The server function rejects unserializable shapes; coerce to plain
    // string-keyed values up front.
    const serializableBody: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null) serializableBody[k] = v;
    }
    const envelope = (await callHanaApi({
      data: { action, body: serializableBody, token: opts.token ?? null },
      signal: opts.signal,
    })) as ApiEnvelope<T>;
    return envelope;
  },
});

export function createClient(token?: string | null): ApiClient {
  return new ApiClient(transport, { token: token ?? getStoredToken() });
}

// Separate client for the website's interface.30nama.com backend. Right
// now this only powers the search route (`full_search` action). Keep using
// `createClient` for everything else — interface.30nama.com doesn't host
// the other actions we depend on (home, single, download, etc).
const interfaceTransport = createRpcTransport({
  call: async <T>(
    action: string,
    body: ActionBody,
    opts: { token?: string | null; signal?: AbortSignal },
  ): Promise<ApiEnvelope<T>> => {
    const serializableBody: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null) serializableBody[k] = v;
    }
    const envelope = (await callInterfaceApi({
      data: { action, body: serializableBody, token: opts.token ?? null },
      signal: opts.signal,
    })) as ApiEnvelope<T>;
    return envelope;
  },
});

export function createInterfaceClient(token?: string | null): ApiClient {
  return new ApiClient(interfaceTransport, {
    token: token ?? getStoredToken(),
  });
}
