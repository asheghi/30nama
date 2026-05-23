import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getHome, type HomeData } from "@30nama/api";
import { createClient, getStoredToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PosterRow } from "@/components/PosterCard";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setToken(getStoredToken());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    getHome(createClient(token))
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  // Render nothing until we've actually checked localStorage — otherwise
  // SSR and the first client render flash <SignInPrompt> before the effect.
  if (!ready) {
    return <div className="dark min-h-screen bg-background" />;
  }
  if (!token) return <SignInPrompt />;

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <SiteHeader
        onSignOut={() => {
          setToken(null);
          setData(null);
        }}
      />

      <main className="mx-auto max-w-7xl space-y-10 px-6 py-8">
        {loading && <p className="text-muted-foreground">Loading…</p>}
        {error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
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
