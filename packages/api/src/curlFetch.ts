// Node-only HTTP helper that shells out to the system `curl` binary instead
// of using node's built-in fetch / undici.
//
// Why: hana-api.com is fronted by Cloudflare with managed bot protection
// (cf-mitigated: challenge). Cloudflare TLS-fingerprints requests and flags
// Node's TLS handshake as a bot regardless of which headers you send. Same
// machine, same headers, same HTTP/2 — curl passes, node fetch returns the
// "Just a moment..." challenge page. Until that changes, we route every
// Node-side request through `curl`.

import { spawn } from "node:child_process";

export interface CurlPostOptions {
  url: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface CurlResponse {
  status: number;
  body: string;
}

export class CurlError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
    readonly stderr: string,
  ) {
    super(message);
    this.name = "CurlError";
  }
}

export function curlPost(opts: CurlPostOptions): Promise<CurlResponse> {
  const timeoutSecs = Math.max(1, Math.ceil((opts.timeoutMs ?? 30_000) / 1000));
  const args = [
    "--silent",
    "--show-error",
    "--compressed",
    // Force HTTP/2 — Cloudflare's TLS fingerprinter expects it from browsers.
    // Falls back to HTTP/1.1 silently if the server doesn't support it.
    "--http2",
    "--max-time",
    String(timeoutSecs),
    "--request",
    "POST",
    "--write-out",
    "\n%{http_code}",
  ];
  for (const [k, v] of Object.entries(opts.headers)) {
    args.push("--header", `${k}: ${v}`);
  }
  args.push("--data-raw", opts.body, opts.url);

  return new Promise((resolve, reject) => {
    const proc = spawn("curl", args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    proc.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));

    const abortHandler = () => proc.kill("SIGTERM");
    opts.signal?.addEventListener("abort", abortHandler, { once: true });

    proc.on("error", (err: NodeJS.ErrnoException) => {
      opts.signal?.removeEventListener("abort", abortHandler);
      if (err.code === "ENOENT") {
        reject(
          new CurlError(
            "curl binary not found on PATH (required to bypass Cloudflare bot protection)",
            null,
            "",
          ),
        );
      } else {
        reject(err);
      }
    });

    proc.on("close", (code) => {
      opts.signal?.removeEventListener("abort", abortHandler);
      if (code !== 0) {
        reject(
          new CurlError(
            `curl exited with code ${code}: ${stderr.trim()}`,
            code,
            stderr,
          ),
        );
        return;
      }
      // The last line of stdout is the HTTP status code (from --write-out
      // "\n%{http_code}"). Everything before it is the response body.
      const nlIndex = stdout.lastIndexOf("\n");
      if (nlIndex < 0) {
        reject(new CurlError("curl produced no status line", code, stderr));
        return;
      }
      const status = Number.parseInt(stdout.slice(nlIndex + 1), 10);
      const body = stdout.slice(0, nlIndex);
      if (!Number.isFinite(status)) {
        reject(new CurlError("curl status line was not a number", code, stderr));
        return;
      }
      resolve({ status, body });
    });
  });
}
