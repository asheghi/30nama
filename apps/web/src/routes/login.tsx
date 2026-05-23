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
    <div className="dark relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 20%, rgba(120,120,255,0.18), transparent 70%), radial-gradient(50% 40% at 80% 90%, rgba(255,80,80,0.12), transparent 70%)",
        }}
      />
      <main className="relative mx-auto flex max-w-md flex-col items-center gap-7 px-6 py-20">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            Sign in to Potato<span className="text-white/60">+</span>
          </h1>
          <p className="text-[14px] text-white/60">
            Scan the QR code with the 30nama app on your phone.
          </p>
        </div>

        {codeQuery.isLoading && (
          <p className="text-white/50">Loading…</p>
        )}

        {codeQuery.error && !codeQuery.isLoading && (
          <>
            <p className="text-destructive">
              {codeQuery.error instanceof Error
                ? codeQuery.error.message
                : "Failed to fetch QR code"}
            </p>
            <Button
              onClick={requestNewCode}
              className="h-11 rounded-full bg-white px-6 text-[14px] font-semibold text-black hover:bg-white/90"
            >
              Retry
            </Button>
          </>
        )}

        {code && !expired && !success && (
          <>
            <div className="rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-white/10">
              <QRCode value={code.url} size={224} />
            </div>
            <a
              href={code.url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-center text-[12px] text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
            >
              {code.url}
            </a>
            <div className="flex items-center gap-2 text-[13px] text-white/50">
              <span className="size-1.5 animate-pulse rounded-full bg-white/60" />
              Waiting for confirmation…
            </div>
          </>
        )}

        {expired && !success && (
          <>
            <p className="text-white/70">The code expired.</p>
            <Button
              onClick={requestNewCode}
              className="h-11 rounded-full bg-white px-6 text-[14px] font-semibold text-black hover:bg-white/90"
            >
              Get a new code
            </Button>
          </>
        )}

        {success && (
          <p className="text-green-400">Signed in. Redirecting…</p>
        )}
      </main>
    </div>
  );
}
