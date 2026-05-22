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

export interface RequestOpts {
  token?: string | null;
  body?: Record<string, string | number | boolean>;
}

export async function apiPost<T>(
  path: string,
  { token, body }: RequestOpts = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    ...STATIC_HEADERS,
    "content-type": "application/x-www-form-urlencoded",
  };
  if (token) headers["c-token"] = token;

  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body ?? {})) {
    form.append(k, String(v));
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: form.toString(),
  });

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
    throw new ApiError(
      `${path} returned ${res.status}`,
      res.status,
      parsed,
    );
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
