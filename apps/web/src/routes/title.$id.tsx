import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  getSingle,
  getDownload,
  getStream,
  type Single,
  type Download as DownloadItem,
} from "@30nama/api";
import { Check, Copy, Download, Play } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { createClient, getStoredToken } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";

const SINGLE_STALE_TIME = 60 * 60 * 1000; // 1h, persisted

export const Route = createFileRoute("/title/$id")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getStoredToken()) {
      throw redirect({ to: "/" });
    }
  },
  loader: async ({ params, context }) => {
    // Only prefetch `single` — `download` carries signed URLs we never cache.
    const token = getStoredToken();
    if (!token) return;
    await context.queryClient.prefetchQuery({
      queryKey: queryKeys.single(params.id),
      queryFn: () => getSingle(createClient(token), params.id),
      staleTime: SINGLE_STALE_TIME,
    });
  },
  component: TitlePage,
});

/**
 * Flattens the API's `download` payload (either an array or a grouped map)
 * and dedupes by `id`. The grouped form is keyed by season label, so a
 * single download group that spans multiple seasons (e.g. "all episodes"
 * packs) can appear under more than one key — without deduping we'd emit
 * duplicate React keys further down the tree.
 */
function flattenDownloads(
  download: Record<string, DownloadItem[]> | DownloadItem[] | undefined,
): DownloadItem[] {
  if (!download) return [];
  const raw = Array.isArray(download)
    ? download
    : Object.values(download).flat();
  const seen = new Set<number>();
  const out: DownloadItem[] = [];
  for (const g of raw) {
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    out.push(g);
  }
  return out;
}

function TitlePage() {
  const { id } = Route.useParams();

  const singleQuery = useQuery({
    queryKey: queryKeys.single(id),
    queryFn: () => getSingle(createClient(), id),
    staleTime: SINGLE_STALE_TIME,
  });

  // Downloads carry signed, one-shot URLs (IP- and expiry-bound — see
  // CLAUDE.md). We use `useQuery` for the unified loading/error UI but
  // disable both staleTime AND gcTime so each visit re-fetches and nothing
  // ever ends up in the persisted localStorage cache.
  const downloadsQuery = useQuery({
    queryKey: queryKeys.download(id),
    queryFn: () => getDownload(createClient(), id),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  // Stream availability check — same caching rules as download (signed,
  // short-lived URLs). The query result drives whether the Watch button
  // is rendered; errors silently hide it rather than surfacing.
  const streamQuery = useQuery({
    queryKey: queryKeys.stream(id),
    queryFn: () => getStream(createClient(), id),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const loading = singleQuery.isLoading;
  const error = singleQuery.error;

  // Combine: detail is required, downloads is best-effort.
  const detail = singleQuery.data;
  const groups = flattenDownloads(downloadsQuery.data?.download);
  const isSeries = detail?.options.is_series ?? false;
  const hasStream =
    !!streamQuery.data &&
    Object.values(streamQuery.data.list).some((eps) => eps.length > 0);

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <SiteHeader />

      {loading && <div className="p-8 text-muted-foreground">Loading…</div>}
      {error && (
        <div className="m-6 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error.message}
        </div>
      )}
      {detail && (
        <Detail
          detail={detail}
          groups={groups}
          isSeries={isSeries}
          hasStream={hasStream}
          titleId={id}
        />
      )}
    </div>
  );
}

function Detail({
  detail,
  groups,
  isSeries,
  hasStream,
  titleId,
}: {
  detail: Single;
  groups: DownloadItem[];
  isSeries: boolean;
  hasStream: boolean;
  titleId: string;
}) {
  const cover = detail.image.cover?.webp ?? detail.image.cover?.jpg ?? null;
  const poster =
    detail.image.poster.webp?.big ||
    detail.image.poster.jpg?.big ||
    detail.image.poster.preview;

  const displayTitle = detail.title.english || detail.title.local || "";
  const year = detail.info.year;
  const yearEnd = detail.info.year_end;
  const minutes = detail.info.time?.default;
  const imdb = detail.score?.imdb;
  const localScore = detail.score?.["30nama"]?.score;

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
            alt={displayTitle}
            className="aspect-[2/3] w-40 shrink-0 rounded-lg border border-border object-cover shadow-xl sm:w-48"
          />
          <div className="flex-1 space-y-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {displayTitle}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {year}
                {yearEnd ? `–${yearEnd}` : ""}
                {minutes ? ` · ${minutes} min` : ""}
                {isSeries ? " · Series" : " · Movie"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {detail.genre.map((g) => (
                <span
                  key={g.slug}
                  className="rounded-full border border-border bg-secondary px-3 py-0.5 text-xs"
                >
                  {g.slug}
                </span>
              ))}
            </div>

            <div className="flex gap-6 text-sm">
              {imdb && (
                <span>
                  <span className="text-muted-foreground">IMDB </span>
                  <span className="font-semibold">{imdb.score}</span>
                  {imdb.votes > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      ({imdb.votes.toLocaleString()})
                    </span>
                  )}
                </span>
              )}
              {localScore !== undefined && localScore > 0 && (
                <span>
                  <span className="text-muted-foreground">30nama </span>
                  <span className="font-semibold">{localScore}</span>
                </span>
              )}
            </div>

            {detail.plot.english && (
              <p className="text-sm leading-relaxed text-foreground/90">
                {detail.plot.english}
              </p>
            )}

            {hasStream && (
              <div className="pt-2">
                <Button asChild size="lg" className="gap-2">
                  <Link to="/play/$id" params={{ id: titleId }}>
                    <Play className="size-4" />
                    Watch
                  </Link>
                </Button>
              </div>
            )}

            {detail.options.coming_soon && (
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
  groups: DownloadItem[];
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

function MovieGroupRow({ group }: { group: DownloadItem }) {
  // `link` is declared as a required `DownloadLink[]` in the type, but the
  // API sometimes omits it entirely on movie groups — the URL lives in
  // `group.dl` for those. Guard the array access so a missing `link` field
  // doesn't blow up the whole title page.
  const link = group.link?.[0];
  const url = link?.dl ?? group.dl;
  if (!url) return null;
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3 hover:bg-accent/40">
      <div className="min-w-0">
        <div className="font-medium">{group.quality.trim()}</div>
        <div className="text-xs text-muted-foreground">
          {[group.encoder, group.size, group.tags.join(" / ")]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
      <DownloadActions url={url} />
    </div>
  );
}

function SeasonsView({ groups }: { groups: DownloadItem[] }) {
  const bySeason = useMemo(() => {
    const map = new Map<number, DownloadItem[]>();
    for (const g of groups) {
      const key = g.season_int ?? g.season ?? 0;
      const arr = map.get(key) ?? [];
      arr.push(g);
      map.set(key, arr);
    }
    return [...map.entries()].sort(([a], [b]) => b - a);
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
  groups: DownloadItem[];
}) {
  const [selectedId, setSelectedId] = useState<number>(groups[0]?.id ?? 0);
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
              {g.encoder && (
                <span className="ml-1 text-muted-foreground">
                  · {g.encoder}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {selected.total_episode ?? selected.link?.length ?? 0} episodes · avg{" "}
        {selected.size}
        {selected.tags.length > 0 && ` · ${selected.tags.join(" / ")}`}
      </div>
      <div className="divide-y divide-border">
        {[...(selected.link ?? [])]
          .sort((a, b) => b.episode - a.episode)
          .map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between gap-4 py-2 hover:bg-accent/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-10 shrink-0 font-mono text-sm text-muted-foreground">
                  E{String(l.episode).padStart(2, "0")}
                </span>
                <span className="truncate text-sm" title={l.source}>
                  {l.source || `Episode ${l.episode}`}
                </span>
              </div>
              <DownloadActions url={l.dl} />
            </div>
          ))}
      </div>
    </div>
  );
}

function DownloadActions({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable (insecure context, permissions)
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        asChild
        size="icon-xs"
        variant="ghost"
        title="Open in VLC"
        aria-label="Open in VLC"
      >
        <a href={`vlc://${url}`}>
          <Play />
        </a>
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={onCopy}
        title={copied ? "Copied!" : "Copy link"}
        aria-label="Copy link"
      >
        {copied ? <Check /> : <Copy />}
      </Button>
      <Button
        asChild
        size="sm"
        variant="secondary"
        title="Download"
        aria-label="Download"
      >
        <a href={url}>
          <Download />
          <span className="hidden sm:inline">Download</span>
        </a>
      </Button>
    </div>
  );
}
