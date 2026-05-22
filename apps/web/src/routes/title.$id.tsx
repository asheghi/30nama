import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  getSingle,
  getDownloads,
  type TitleDetail,
  type DownloadGroup,
} from "@30nama/api";
import { createClient, getStoredToken } from "@/lib/api";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/title/$id")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getStoredToken()) {
      throw redirect({ to: "/" });
    }
  },
  component: TitlePage,
});

interface TitleData {
  detail: TitleDetail;
  groups: DownloadGroup[];
  isSeries: boolean;
}

function TitlePage() {
  const { id } = Route.useParams();
  const [data, setData] = useState<TitleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    const client = createClient();
    Promise.all([getSingle(client, id), getDownloads(client, id).catch(() => null)])
      .then(([detail, downloads]) => {
        setData({
          detail,
          groups: downloads?.download ?? [],
          isSeries: detail.is_series || (downloads?.is_series ?? false),
        });
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-6 py-3 backdrop-blur">
        <Link to="/" className="text-xl font-bold tracking-tight">
          30nama
        </Link>
        <Link to="/">
          <Button variant="ghost" size="sm">
            Home
          </Button>
        </Link>
      </header>

      {loading && (
        <div className="p-8 text-muted-foreground">Loading…</div>
      )}
      {error && (
        <div className="m-6 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {data && <Detail data={data} />}
    </div>
  );
}

function Detail({ data }: { data: TitleData }) {
  const { detail, groups, isSeries } = data;
  const cover = detail.image.cover_webp || detail.image.cover || null;
  const poster =
    detail.image.poster.big_webp ||
    detail.image.poster.big ||
    detail.image.poster.medium;

  return (
    <>
      <div className="relative h-[40vh] min-h-[280px] w-full overflow-hidden bg-muted">
        {cover && (
          <img
            src={cover}
            alt=""
            className="h-full w-full object-cover opacity-60"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      </div>

      <main className="mx-auto -mt-32 max-w-5xl px-6 pb-16">
        <div className="flex flex-col gap-6 sm:flex-row">
          <img
            src={poster}
            alt={detail.title}
            className="aspect-[2/3] w-40 shrink-0 rounded-lg border border-border object-cover shadow-xl sm:w-48"
          />
          <div className="flex-1 space-y-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {detail.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {detail.year}
                {detail.year_end ? `–${detail.year_end}` : ""}
                {detail.time && ` · ${detail.time}`}
                {isSeries ? " · Series" : " · Movie"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {detail.genre_full.map((g) => (
                <span
                  key={g.slug}
                  className="rounded-full border border-border bg-secondary px-3 py-0.5 text-xs"
                >
                  {g.slug}
                </span>
              ))}
            </div>

            <div className="flex gap-6 text-sm">
              {detail.imdb_score && (
                <span>
                  <span className="text-muted-foreground">IMDB </span>
                  <span className="font-semibold">{detail.imdb_score}</span>
                  {detail.imdb_votes && (
                    <span className="text-muted-foreground">
                      {" "}
                      ({detail.imdb_votes})
                    </span>
                  )}
                </span>
              )}
              {detail["30nama_score"] > 0 && (
                <span>
                  <span className="text-muted-foreground">30nama </span>
                  <span className="font-semibold">
                    {detail["30nama_score"]}
                  </span>
                </span>
              )}
            </div>

            {detail.english_plot && (
              <p className="text-sm leading-relaxed text-foreground/90">
                {detail.english_plot}
              </p>
            )}

            {detail.coming_soon && (
              <div className="rounded border border-yellow-700/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-300">
                Coming soon — no downloads available yet.
              </div>
            )}
          </div>
        </div>

        <DownloadsSection groups={groups} isSeries={isSeries} />
      </main>
    </>
  );
}

function DownloadsSection({
  groups,
  isSeries,
}: {
  groups: DownloadGroup[];
  isSeries: boolean;
}) {
  if (groups.length === 0) {
    return (
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Downloads</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No downloads available.
        </p>
      </section>
    );
  }

  if (!isSeries) {
    return (
      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold">Downloads</h2>
        <div className="space-y-2">
          {groups.map((g) => (
            <MovieGroupRow key={g.id} group={g} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-10 space-y-6">
      <h2 className="text-xl font-semibold">Episodes</h2>
      <SeasonsView groups={groups} />
    </section>
  );
}

function MovieGroupRow({ group }: { group: DownloadGroup }) {
  const link = group.link[0];
  if (!link) return null;
  return (
    <a
      href={link.dl}
      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3 hover:bg-accent"
    >
      <div className="min-w-0">
        <div className="font-medium">{group.quality.trim()}</div>
        <div className="text-xs text-muted-foreground">
          {[group.encoder, group.size, group.tags].filter(Boolean).join(" · ")}
        </div>
      </div>
      <Button size="sm" variant="secondary">
        Download
      </Button>
    </a>
  );
}

function SeasonsView({ groups }: { groups: DownloadGroup[] }) {
  const bySeason = useMemo(() => {
    const map = new Map<number, DownloadGroup[]>();
    for (const g of groups) {
      const arr = map.get(g.season_int) ?? [];
      arr.push(g);
      map.set(g.season_int, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [groups]);

  return (
    <div className="space-y-8">
      {bySeason.map(([season, seasonGroups]) => (
        <SeasonBlock key={season} season={season} groups={seasonGroups} />
      ))}
    </div>
  );
}

function SeasonBlock({
  season,
  groups,
}: {
  season: number;
  groups: DownloadGroup[];
}) {
  const [selectedId, setSelectedId] = useState<string>(groups[0]?.id ?? "");
  const selected = groups.find((g) => g.id === selectedId) ?? groups[0];

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Season {season}</h3>
        <div className="flex flex-wrap gap-1">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedId(g.id)}
              className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                g.id === selected.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent"
              }`}
            >
              {g.quality.trim()}
              <span className="ml-1 text-muted-foreground">· {g.encoder}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {selected.total_episode} episodes · avg {selected.size}
        {selected.tags && ` · ${selected.tags}`}
      </div>
      <div className="divide-y divide-border">
        {selected.link.map((l) => (
          <a
            key={l.id}
            href={l.dl}
            className="flex items-center justify-between gap-4 py-2 hover:bg-accent/50"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="w-10 shrink-0 font-mono text-sm text-muted-foreground">
                E{l.episode.padStart(2, "0")}
              </span>
              <span className="truncate text-sm" title={l.source}>
                {l.source || `Episode ${l.episode}`}
              </span>
            </div>
            <Button size="sm" variant="ghost">
              Download
            </Button>
          </a>
        ))}
      </div>
    </div>
  );
}
