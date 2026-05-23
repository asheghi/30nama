import {
  DEFAULT_LANGUAGE,
  DEFAULT_PLATFORM,
  DEFAULT_USER_AGENT,
  DEFAULT_VERSION_NUMBER,
  HANA_API_WORLD,
  INTERFACE_API,
  INTERFACE_API_KEY,
  INTERFACE_APP_VERSION,
  INTERFACE_PLATFORM,
  PLATFORM_KEYS,
  SDK_ENDPOINT_JSON,
  type Platform,
} from "./config.ts";

export interface ApiEnvelope<T> {
  status: number;
  success: boolean;
  error?: boolean;
  msg: string | null;
  result?: T;
  action?: string[] | null;
  seo?: unknown;
  timestamp?: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
    readonly action?: string[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ActionBody = Record<string, string | number | boolean | undefined>;

export interface ApiTransport {
  call<T>(
    action: string,
    body: ActionBody,
    opts: { token?: string | null; signal?: AbortSignal },
  ): Promise<ApiEnvelope<T>>;
}

export interface DirectTransportOptions {
  baseUrl?: string;
  platform?: Platform;
  apiKey?: string;
  language?: "fa" | "en";
  userAgent?: string;
  versionNumber?: string;
}

/**
 * Hits the hana-api endpoint directly. Used by Node (CLI) and by the
 * server-side proxy that the browser delegates to. The browser must NOT use
 * this directly — Cloudflare bot protection rejects the cross-origin
 * preflight from third-party domains.
 *
 * Shells out to `curl` rather than using Node's fetch because Cloudflare
 * TLS-fingerprints node's HTTP stack as a bot. See curlFetch.ts.
 */
export function createDirectTransport(
  opts: DirectTransportOptions = {},
): ApiTransport {
  const baseUrl = opts.baseUrl ?? HANA_API_WORLD;
  const platform = opts.platform ?? DEFAULT_PLATFORM;
  const apiKey = opts.apiKey ?? PLATFORM_KEYS[platform];
  const language = opts.language ?? DEFAULT_LANGUAGE;
  const userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;
  const versionNumber = opts.versionNumber ?? DEFAULT_VERSION_NUMBER;

  return {
    async call<T>(
      action: string,
      body: ActionBody,
      { token, signal }: { token?: string | null; signal?: AbortSignal },
    ): Promise<ApiEnvelope<T>> {
      const headers: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
        // Standard browser headers — Cloudflare's managed bot detection
        // checks these alongside the TLS fingerprint.
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://30nama.com",
        "Referer": "https://30nama.com/",
        // hana-api c-* headers
        "c-api-key": apiKey,
        "c-version-number": versionNumber,
        "c-platform": platform,
        "c-language": language,
        "c-useragent": userAgent,
        "user-agent": userAgent,
      };
      if (token) headers["c-token"] = token;

      const form = new URLSearchParams();
      for (const [k, v] of Object.entries(body)) {
        if (v !== undefined && v !== null) form.append(k, String(v));
      }

      // Lazy-import the curl helper so this module stays importable in
      // any environment that doesn't actually call into the direct transport
      // (e.g. the browser bundle which uses createRpcTransport instead).
      const { curlPost } = await import("./curlFetch.ts");
      const res = await curlPost({
        url: `${baseUrl}/action/${action}`,
        headers,
        body: form.toString(),
        signal,
      });

      try {
        return JSON.parse(res.body) as ApiEnvelope<T>;
      } catch {
        throw new ApiError(
          `Non-JSON response from action/${action} (HTTP ${res.status})`,
          res.status,
          res.body.slice(0, 500),
        );
      }
    },
  };
}

export interface InterfaceDirectTransportOptions {
  baseUrl?: string;
  apiKey?: string;
  appVersion?: string;
  platform?: string;
  userAgent?: string;
}

/**
 * Direct transport for `interface.30nama.com` — the website's own backend.
 * Lives alongside the hana-api transport because the two services expose
 * different actions: hana-api has `single`/`download`/etc, interface has
 * `full_search` (the only keyword-search action that respects type/orderby
 * filters). Same response envelope shape; different headers + base URL.
 *
 * The action string passed to `call` becomes the URL path verbatim, so
 * path-segment style actions ("full_search/type/all/orderby/year/order/desc/page/1")
 * just work — that's how interface.30nama.com expresses query params.
 */
export function createInterfaceDirectTransport(
  opts: InterfaceDirectTransportOptions = {},
): ApiTransport {
  const baseUrl = opts.baseUrl ?? INTERFACE_API;
  const apiKey = opts.apiKey ?? INTERFACE_API_KEY;
  const appVersion = opts.appVersion ?? INTERFACE_APP_VERSION;
  const platform = opts.platform ?? INTERFACE_PLATFORM;
  const userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;

  return {
    async call<T>(
      action: string,
      body: ActionBody,
      { token, signal }: { token?: string | null; signal?: AbortSignal },
    ): Promise<ApiEnvelope<T>> {
      const headers: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
        "c-api-key": apiKey,
        "c-app-version": appVersion,
        "c-platform": platform,
        "c-useragent": userAgent,
        "user-agent": userAgent,
      };
      if (token) headers["c-token"] = token;

      const form = new URLSearchParams();
      for (const [k, v] of Object.entries(body)) {
        if (v !== undefined && v !== null) form.append(k, String(v));
      }

      const { curlPost } = await import("./curlFetch.ts");
      const res = await curlPost({
        url: `${baseUrl}/action/${action}`,
        headers,
        body: form.toString(),
        signal,
      });

      try {
        return JSON.parse(res.body) as ApiEnvelope<T>;
      } catch {
        throw new ApiError(
          `Non-JSON response from interface action/${action} (HTTP ${res.status})`,
          res.status,
          res.body.slice(0, 500),
        );
      }
    },
  };
}

export interface RpcTransportOptions {
  call: <T>(
    action: string,
    body: ActionBody,
    opts: { token?: string | null; signal?: AbortSignal },
  ) => Promise<ApiEnvelope<T>>;
}

/**
 * Browser-side transport. Delegates every action to a server-supplied
 * function (typically a TanStack Start server function) so the actual
 * cross-origin POST is made from the server, not the user's browser.
 */
export function createRpcTransport(opts: RpcTransportOptions): ApiTransport {
  return { call: opts.call };
}

export interface ClientOptions {
  token?: string | null;
}

export class ApiClient {
  private token: string | null;

  constructor(
    private transport: ApiTransport,
    opts: ClientOptions = {},
  ) {
    this.token = opts.token ?? null;
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  async call<T>(
    action: string,
    body: ActionBody = {},
    opts: { token?: string | null; signal?: AbortSignal } = {},
  ): Promise<T> {
    const token = opts.token !== undefined ? opts.token : this.token;
    const envelope = await this.transport.call<T>(action, body, {
      token,
      signal: opts.signal,
    });
    if (!envelope.success) {
      throw new ApiError(
        envelope.msg ?? `action/${action} returned success=false`,
        envelope.status,
        envelope,
        envelope.action ?? undefined,
      );
    }
    return envelope.result as T;
  }
}

/**
 * Fetches the current world/IR endpoint list the official SDK uses to pick
 * the fastest reachable host. Call from Node; in the browser the proxy is
 * fixed to WORLD.
 */
export async function discoverEndpoints(
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<{ location: "WORLD" | "IR"; host: string }[]> {
  const res = await fetchImpl(SDK_ENDPOINT_JSON);
  if (!res.ok) {
    throw new ApiError(
      `endpoint discovery failed (HTTP ${res.status})`,
      res.status,
      null,
    );
  }
  return (await res.json()) as { location: "WORLD" | "IR"; host: string }[];
}
