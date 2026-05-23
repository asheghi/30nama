import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getHome } from "@30nama/api";
import { createClient, getStoredToken } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { PosterRow } from "@/components/PosterCard";
import { SiteHeader } from "@/components/SiteHeader";

const HOME_STALE_TIME = 10 * 60 * 1000; // 10 min

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    // Only prefetch on the server (or first browser hit when we have a
    // token). `getStoredToken` returns null during SSR, so the prefetch is
    // effectively a no-op there — the browser will fire it once hydrated.
    const token = getStoredToken();
    if (!token) return;
    await context.queryClient.prefetchQuery({
      queryKey: queryKeys.home(),
      queryFn: () => getHome(createClient(token)),
      staleTime: HOME_STALE_TIME,
    });
  },
  component: Home,
});

function Home() {
  // Track the token in state so a sign-out (which now lives in SiteHeader
  // and just navigates away after clearing localStorage) and a fresh login
  // both surface here. `ready` gates the first paint until the localStorage
  // check has actually run on the client.
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(getStoredToken());
    setReady(true);
  }, []);

  const query = useQuery({
    queryKey: queryKeys.home(),
    queryFn: () => getHome(createClient(token)),
    enabled: Boolean(token),
    staleTime: HOME_STALE_TIME,
  });

  if (!ready) {
    return <div className="dark min-h-screen bg-background" />;
  }
  if (!token) return <SignInPrompt />;

  const { data, error, isLoading } = query;

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      {/* SiteHeader handles the actual sign-out work (clearing token,
          QueryClient, and the persisted localStorage snapshot) and then
          navigates back to "/", which remounts this component. */}
      <SiteHeader onSignOut={() => setToken(null)} />

      <main className="mx-auto max-w-7xl space-y-10 px-6 py-8">
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error.message}
          </div>
        )}
        {data && (
          <>
            <PosterRow
              title="Featured"
              posts={data.hero_header.posts}
            />
            {data.top_10 && (
              <PosterRow title="Top 10" posts={data.top_10.posts} />
            )}
            {data.new_releases && (
              <PosterRow
                title="New Releases"
                posts={data.new_releases.posts}
              />
            )}
            {data.suggested && (
              <PosterRow title="Suggested" posts={data.suggested.posts} />
            )}
            {data.movies && (
              <PosterRow
                title="Movies"
                posts={data.movies.posts}
                seeMoreCat="movie"
              />
            )}
            {data.series && (
              <PosterRow
                title="Series"
                posts={data.series.posts}
                seeMoreCat="series"
              />
            )}
            {data.anime && (
              <PosterRow
                title="Anime"
                posts={data.anime.posts}
                seeMoreCat="anime"
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SignInPrompt() {
  return (
    <div className="dark flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 text-center">
        <h1 className="text-xl font-bold">Welcome to 30nama</h1>
        <p className="text-sm text-muted-foreground">
          Sign in by scanning a QR code with the 30nama app on your phone.
          No password or SMS code required.
        </p>
        <Button asChild className="w-full">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
