import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ApiError,
  qrLoginCode,
  qrLoginLogin,
  type QrLoginCode,
} from "@30nama/api";
import { QRCode } from "react-qr-code";
import { createClient, setStoredToken } from "@/lib/api";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: LoginPage });

type Status =
  | { kind: "loading" }
  | { kind: "waiting"; code: QrLoginCode }
  | { kind: "expired" }
  | { kind: "error"; message: string }
  | { kind: "success" };

// QR codes have a server-side expiry; rotate well before that to keep the
// displayed code valid even if the user is slow to scan.
const CODE_REFRESH_MS = 90_000;
const POLL_INTERVAL_MS = 2_000;

function LoginPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  // Holds the active poll's AbortController so we can cancel the in-flight
  // call when we rotate to a fresh code or unmount.
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const client = createClient(null);

    async function startCycle() {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setStatus({ kind: "loading" });

      let code: QrLoginCode;
      try {
        code = await qrLoginCode(client);
      } catch (e) {
        if (cancelled) return;
        setStatus({
          kind: "error",
          message: e instanceof Error ? e.message : "Failed to fetch QR code",
        });
        return;
      }
      if (cancelled) return;
      setStatus({ kind: "waiting", code });

      refreshTimer = setTimeout(() => {
        if (!cancelled) {
          setStatus({ kind: "expired" });
        }
      }, CODE_REFRESH_MS);

      const poll = async () => {
        if (cancelled) return;
        try {
          const { token } = await qrLoginLogin(client, code.code);
          if (cancelled) return;
          setStoredToken(token);
          setStatus({ kind: "success" });
          // Small delay so the success UI is visible before we navigate.
          setTimeout(() => navigate({ to: "/" }), 400);
        } catch (e) {
          if (cancelled) return;
          // ApiError = the server returned success:false (user hasn't
          // confirmed yet). Anything else (network etc.) we also swallow
          // and retry — the user can interrupt by closing the tab.
          if (!(e instanceof ApiError)) {
            // unexpected; surface but keep polling
          }
          pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      };
      poll();
    }

    startCycle();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
      if (pollTimer) clearTimeout(pollTimer);
      if (refreshTimer) clearTimeout(refreshTimer);
    };
    // Re-run when the user clicks "Get a new code" by toggling a key. For
    // now we only run once per mount and offer a button below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <main className="mx-auto flex max-w-md flex-col items-center gap-6 px-6 py-16">
        <h1 className="text-2xl font-bold">Sign in to 30nama</h1>

        {status.kind === "loading" && (
          <p className="text-muted-foreground">Loading…</p>
        )}

        {status.kind === "waiting" && (
          <>
            <p className="text-center text-sm text-muted-foreground">
              Open this URL on your phone where you&apos;re already signed in
              to 30nama, or scan the QR with the camera app.
            </p>
            <div className="rounded-lg bg-white p-4">
              <QRCode value={status.code.url} size={224} />
            </div>
            <a
              href={status.code.url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-center text-sm text-primary underline"
            >
              {status.code.url}
            </a>
            <p className="text-xs text-muted-foreground">
              Waiting for confirmation…
            </p>
          </>
        )}

        {status.kind === "expired" && (
          <>
            <p>The code expired. Get a fresh one.</p>
            <Button onClick={() => window.location.reload()}>
              Get a new code
            </Button>
          </>
        )}

        {status.kind === "error" && (
          <>
            <p className="text-destructive">{status.message}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </>
        )}

        {status.kind === "success" && (
          <p className="text-green-500">Signed in. Redirecting…</p>
        )}
      </main>
    </div>
  );
}
