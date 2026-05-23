import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ApiError,
  qrLoginCode,
  qrLoginLogin,
} from "@30nama/api";
import { QRCode } from "react-qr-code";
import { createClient, setStoredToken } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: LoginPage });

// QR codes have a server-side expiry; rotate well before that to keep the
// displayed code valid even if the user is slow to scan.
const CODE_REFRESH_MS = 90_000;
const POLL_INTERVAL_MS = 2_000;

function LoginPage() {
  const navigate = useNavigate();
  // `refreshTick` lets the user (or the auto-refresh timer) force a new QR
  // code by bumping a value the queryKey depends on.
  const [refreshTick, setRefreshTick] = useState(0);
  const [expired, setExpired] = useState(false);
  const [success, setSuccess] = useState(false);

  // Initial code fetch. Never cached — each QR cycle gets a fresh one and we
  // don't want the persister to write QR codes to localStorage.
  const codeQuery = useQuery({
    queryKey: [...queryKeys.qrLoginCode(), refreshTick] as const,
    queryFn: () => qrLoginCode(createClient(null)),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnMount: "always",
  });
  const code = codeQuery.data;

  // Auto-expire the displayed code so the user doesn't try to scan a stale
  // one. Triggered off `code` so we restart the timer on each fresh fetch.
  useEffect(() => {
    if (!code) return;
    setExpired(false);
    const timer = setTimeout(() => setExpired(true), CODE_REFRESH_MS);
    return () => clearTimeout(timer);
  }, [code]);

  // Long-poll loop: ask the server whether the user has confirmed yet.
  // Not a cacheable read — this is a state-transition trigger — so it stays
  // outside TanStack Query.
  useEffect(() => {
    if (!code || expired || success) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const client = createClient(null);

    const poll = async () => {
      if (cancelled) return;
      try {
        const { token } = await qrLoginLogin(client, code.code);
        if (cancelled) return;
        setStoredToken(token);
        setSuccess(true);
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
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };
    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [code, expired, success, navigate]);

  const requestNewCode = () => {
    setExpired(false);
    setRefreshTick((n) => n + 1);
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <main className="mx-auto flex max-w-md flex-col items-center gap-6 px-6 py-16">
        <h1 className="text-2xl font-bold">Sign in to 30nama</h1>

        {codeQuery.isLoading && (
          <p className="text-muted-foreground">Loading…</p>
        )}

        {codeQuery.error && !codeQuery.isLoading && (
          <>
            <p className="text-destructive">
              {codeQuery.error instanceof Error
                ? codeQuery.error.message
                : "Failed to fetch QR code"}
            </p>
            <Button onClick={requestNewCode}>Retry</Button>
          </>
        )}

        {code && !expired && !success && (
          <>
            <p className="text-center text-sm text-muted-foreground">
              Open this URL on your phone where you&apos;re already signed in
              to 30nama, or scan the QR with the camera app.
            </p>
            <div className="rounded-lg bg-white p-4">
              <QRCode value={code.url} size={224} />
            </div>
            <a
              href={code.url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-center text-sm text-primary underline"
            >
              {code.url}
            </a>
            <p className="text-xs text-muted-foreground">
              Waiting for confirmation…
            </p>
          </>
        )}

        {expired && !success && (
          <>
            <p>The code expired. Get a fresh one.</p>
            <Button onClick={requestNewCode}>Get a new code</Button>
          </>
        )}

        {success && (
          <p className="text-green-500">Signed in. Redirecting…</p>
        )}
      </main>
    </div>
  );
}
