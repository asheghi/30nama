import { createServerFn } from "@tanstack/react-start";
import {
  DEFAULT_USER_AGENT,
  INTERFACE_API_KEY,
  INTERFACE_APP_VERSION,
  INTERFACE_PLATFORM,
} from "@30nama/api";
import { curlPost } from "@30nama/api/server";

// `/observer/observer` lives on interface.30nama.com but is NOT under
// `/api/v1/action/...` like the other interface endpoints — it's a separate
// path that takes a different body shape and returns plain "ok"-style
// responses, not the standard `{ success, msg, result }` envelope. That's
// why this gets its own thin server function instead of going through the
// `callInterfaceApi` proxy (which assumes the `action/` path layout and
// the envelope shape).

const OBSERVER_URL = "https://interface.30nama.com/observer/observer";

export interface PingObserverInput {
  fid: string;
  pid: number;
  /** Current playback position in seconds. */
  t: number;
  /** Total duration in seconds. */
  d: number;
  /** Per-episode key from `options.key`. */
  k: string;
  /** User ID parsed from the CDN URL path. */
  uid: string;
  /** Bearer token. */
  token: string;
}

export const pingObserver = createServerFn({ method: "POST" })
  .inputValidator((input: PingObserverInput): PingObserverInput => {
    if (!input || typeof input.fid !== "string" || !input.fid) {
      throw new Error("pingObserver: fid is required");
    }
    if (typeof input.pid !== "number") {
      throw new Error("pingObserver: pid is required");
    }
    if (typeof input.token !== "string" || !input.token) {
      throw new Error("pingObserver: token is required");
    }
    return {
      fid: input.fid,
      pid: input.pid,
      t: Math.max(0, Math.floor(input.t)),
      d: Math.max(0, Math.floor(input.d)),
      k: input.k ?? "",
      uid: input.uid ?? "",
      token: input.token,
    };
  })
  .handler(async ({ data }): Promise<{ ok: boolean; status: number }> => {
    const form = new URLSearchParams();
    form.append("fid", data.fid);
    form.append("pid", String(data.pid));
    form.append("t", String(data.t));
    form.append("d", String(data.d));
    form.append("k", data.k);
    form.append("uid", data.uid);

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      "c-api-key": INTERFACE_API_KEY,
      "c-app-version": INTERFACE_APP_VERSION,
      "c-platform": INTERFACE_PLATFORM,
      "c-useragent": DEFAULT_USER_AGENT,
      "c-output-requests": "true",
      "c-token": data.token,
      "user-agent": DEFAULT_USER_AGENT,
    };

    // Reuse the curl helper that powers the other proxies — same
    // Cloudflare-bypass reason applies on this host.
    try {
      const res = await curlPost({
        url: OBSERVER_URL,
        headers,
        body: form.toString(),
      });
      return { ok: res.status >= 200 && res.status < 300, status: res.status };
    } catch {
      return { ok: false, status: 0 };
    }
  });
