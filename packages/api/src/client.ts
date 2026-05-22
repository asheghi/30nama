import { API_BASE, STATIC_HEADERS } from "./config.ts";

export interface ApiEnvelope<T> {
  success: boolean;
  msg: string | null;
  result: T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ClientOptions {
  baseUrl?: string;
  token?: string | null;
  fetch?: typeof fetch;
}

export interface PostOpts {
  formBody?: Record<string, string | number | boolean>;
  jsonBody?: unknown;
  token?: string | null;
}

export class ApiClient {
  private baseUrl: string;
  private token: string | null;
  private fetchImpl: typeof fetch;

  constructor(opts: ClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? API_BASE;
    this.token = opts.token ?? null;
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  async post<T>(path: string, opts: PostOpts = {}): Promise<T> {
    const token = opts.token !== undefined ? opts.token : this.token;
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;

    const headers: Record<string, string> = { ...STATIC_HEADERS };
    if (token) headers["c-token"] = token;

    let body: string;
    if (opts.jsonBody !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(opts.jsonBody);
    } else {
      headers["content-type"] = "application/x-www-form-urlencoded";
      const form = new URLSearchParams();
      for (const [k, v] of Object.entries(opts.formBody ?? {})) {
        form.append(k, String(v));
      }
      body = form.toString();
    }

    const res = await this.fetchImpl(url, { method: "POST", headers, body });
    const text = await res.text();

    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      throw new ApiError(
        `Non-JSON response from ${path} (status ${res.status})`,
        res.status,
        text.slice(0, 500),
      );
    }

    if (!res.ok) {
      throw new ApiError(`${path} returned ${res.status}`, res.status, parsed);
    }

    const envelope = parsed as ApiEnvelope<T>;
    if (envelope && typeof envelope === "object" && "success" in envelope) {
      if (!envelope.success) {
        throw new ApiError(
          envelope.msg ?? `${path} returned success=false`,
          res.status,
          envelope,
        );
      }
      return envelope.result;
    }
    return parsed as T;
  }
}
