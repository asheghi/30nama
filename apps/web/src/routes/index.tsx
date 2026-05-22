import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getMainV2, type MainV2Result } from "@30nama/api";
import { createClient, getStoredToken, setStoredToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PosterRow } from "@/components/PosterCard";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<MainV2Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setToken(getStoredToken());
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    getMainV2(createClient(token))
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (!token) return <TokenPrompt onSave={setToken} />;

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 px-6 py-3 backdrop-blur">
        <h1 className="text-xl font-bold tracking-tight">30nama</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setStoredToken(null);
            setToken(null);
            setData(null);
          }}
        >
          Sign out
        </Button>
      </header>

      <main className="mx-auto max-w-7xl space-y-10 px-6 py-8">
        {loading && <p className="text-muted-foreground">Loading…</p>}
        {error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {data && (
          <>
            <PosterRow title="Hero" posts={data.hero_section.posts} />
            <PosterRow title="Top 10" posts={data.top10} />
            <PosterRow title="New Releases" posts={data.new_releases.posts} />
            <PosterRow title="Suggested" posts={data.suggested.posts} />
            <PosterRow title="Movies" posts={data.movies.posts} />
            <PosterRow title="Series" posts={data.series.posts} />
            <PosterRow title="Anime" posts={data.anime.posts} />
          </>
        )}
      </main>
    </div>
  );
}

function TokenPrompt({ onSave }: { onSave: (token: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="dark flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-bold">Welcome</h1>
        <p className="text-sm text-muted-foreground">
          Paste your usertoken to continue. Get it from DevTools after logging
          in at 30nama.com (POST /api/v1/action/loginV2 → result.usertoken).
        </p>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="usertoken"
          className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          className="w-full"
          disabled={!value.trim()}
          onClick={() => {
            const t = value.trim();
            setStoredToken(t);
            onSave(t);
          }}
        >
          Save token
        </Button>
      </div>
    </div>
  );
}
