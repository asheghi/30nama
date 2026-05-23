import { createServerFn } from "@tanstack/react-start";
import { type ActionBody, createDirectTransport } from "@30nama/api";

// Loose envelope: the proxy is generic so TanStack Start's serializer can't
// verify the `result` field statically. We type `result` as JSON-shaped and
// let `ApiClient` on the browser side narrow it back to per-endpoint types.
export type SerializableJson =
  | null
  | string
  | number
  | boolean
  | SerializableJson[]
  | { [key: string]: SerializableJson };

export interface ProxyEnvelope {
  status: number;
  success: boolean;
  error?: boolean;
  msg: string | null;
  result?: SerializableJson;
  action?: string[] | null;
  seo?: SerializableJson;
  timestamp?: number;
}

const transport = createDirectTransport({
  // platform default DESKTOP is fine; server geo-locates as non-IR which
  // means we'll always be served by the WORLD host.
});

export interface CallHanaInput {
  action: string;
  body?: ActionBody;
  token?: string | null;
}

/**
 * Single server-side proxy for every hana-api call the browser makes.
 *
 * The browser cannot call hana-api directly because Cloudflare bot
 * protection rejects the cross-origin preflight from third-party domains
 * (see `cf-mitigated: challenge` on OPTIONS). This server function makes
 * the actual POST from our server, with no Origin/Referer headers, then
 * relays the JSON envelope back to the browser unchanged.
 */
export const callHanaApi = createServerFn({ method: "POST" })
  .inputValidator((input: CallHanaInput): CallHanaInput => {
    if (!input || typeof input.action !== "string" || !input.action) {
      throw new Error("callHanaApi: action is required");
    }
    return {
      action: input.action,
      body: input.body ?? {},
      token: input.token ?? null,
    };
  })
  .handler(async ({ data }): Promise<ProxyEnvelope> => {
    const env = await transport.call<SerializableJson>(
      data.action,
      data.body ?? {},
      { token: data.token },
    );
    return env as ProxyEnvelope;
  });
