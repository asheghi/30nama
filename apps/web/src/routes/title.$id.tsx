import { useEffect, useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  getSingle,
  getDownload,
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
 * single download group that spans multiple seasons can appear under more
 * than one key — without deduping we'd emit duplicate React keys.
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

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    setIsLoggedIn(!!getStoredToken());
  }, []);

  const singleQuery = useQuery({
    queryKey: queryKeys.single(id),
    queryFn: () => getSingle(createClient(), id),
    staleTime: SINGLE_STALE_TIME,
  });

  const downloadsQuery = useQuery({
    queryKey: queryKeys.download(id),
    queryFn: () => getDownload(createClient(), id),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    enabled: isLoggedIn,
  });

  const loading = singleQuery.isLoading;
  const error = singleQuery.error;

  const detail = singleQuery.data;
  const groups = flattenDownloads(downloadsQuery.data?.download);
  const isSeries = detail?.options.is_series ?? false;
  const canStream = detail?.options.stream ?? false;

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <SiteHeader />

      {loading && (
        <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
          Loading…
        </div>
      )}
      {error && (
        <div className="mx-auto mt-10 max-w-2xl rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error.message}
        </div>
      )}
      {detail && (
        <Detail
          detail={detail}
          groups={groups}
          isSeries={isSeries}
          canStream={canStream}
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
  canStream,
  titleId,
}: {
  detail: Single;
  groups: DownloadItem[];
  isSeries: boolean;
  canStream: boolean;
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
      {/* Cinematic hero. Pulled up under the (transparent at top) header
          and faded into the page so the metadata block reads as part of
          the artwork. */}
      <section className="relative -mt-14 h-[85vh] min-h-[560px] w-full overflow-hidden">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <img
            src={poster}
            alt=""
            className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110 opacity-60"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent" />

        <div className="relative z-10 mx-auto flex h-full max-w-[1600px] flex-col justify-end px-6 pb-14 lg:px-10 lg:pb-20">
          <div className="grid gap-8 sm:grid-cols-[180px_1fr] sm:items-end lg:grid-cols-[220px_1fr]">
            <img
              src={poster}
              alt={displayTitle}
              className="hidden aspect-[2/3] w-[180px] rounded-xl object-cover shadow-2xl ring-1 ring-white/10 sm:block lg:w-[220px]"
            />
            <div className="max-w-2xl space-y-4">
              <div className="flex items-center gap-3 text-[12px] font-medium uppercase tracking-[0.18em] text-white/70">
                <span>{isSeries ? "Series" : "Movie"}</span>
                <span className="text-white/30">·</span>
                <span>
                  {year}
                  {yearEnd ? `–${yearEnd}` : ""}
                </span>
                {minutes && (
                  <>
                    <span className="text-white/30">·</span>
                    <span>{minutes} min</span>
                  </>
                )}
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-lg sm:text-5xl lg:text-6xl">
                {displayTitle}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-[13px] text-white/70">
                {imdb && (
                  <span className="flex items-center gap-1.5">
                    <span className="rounded bg-yellow-400/90 px-1.5 py-0.5 text-[10px] font-bold text-black">
                      IMDb
                    </span>
                    <span className="font-medium text-white">
                      {imdb.score}
                    </span>
                    {imdb.votes > 0 && (
                      <span className="text-white/50">
                        ({imdb.votes.toLocaleString()})
                      </span>
                    )}
                  </span>
                )}
                {localScore !== undefined && localScore > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      30nama
                    </span>
                    <span className="font-medium text-white">{localScore}</span>
                  </span>
                )}
                {detail.genre.length > 0 && (
                  <span className="text-white/60">
                    {detail.genre
                      .slice(0, 4)
                      .map((g) => g.slug)
                      .join(" · ")}
                  </span>
                )}
              </div>

              {detail.plot.english && (
                <p className="line-clamp-4 max-w-xl text-[15px] leading-relaxed text-white/80">
                  {detail.plot.english}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                {canStream && (
                  <Button
                    asChild
                    className="h-11 gap-2 rounded-full bg-white px-6 text-[14px] font-semibold text-black hover:bg-white/90"
                  >
                    <Link to="/play/$id" params={{ id: titleId }}>
                      <Play className="size-4 fill-black" />
                      Play
                    </Link>
                  </Button>
                )}
                {detail.options.coming_soon && (
                  <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-[13px] font-medium text-yellow-300">
                    Coming soon
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1600px] px-6 pb-20 lg:px-10">
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
      <section className="mt-12">
        <h2 className="text-[20px] font-semibold tracking-tight">Downloads</h2>
        <p className="mt-2 text-[14px] text-white/50">
          No downloads available.
        </p>
      </section>
    );
  }

  if (!isSeries) {
    return (
      <section className="mt-12 space-y-4">
        <h2 className="text-[20px] font-semibold tracking-tight">Downloads</h2>
        <div className="space-y-2">
          {groups.map((g) => (
            <MovieGroupRow key={g.id} group={g} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-12 space-y-6">
      <h2 className="text-[20px] font-semibold tracking-tight">Episodes</h2>
      <SeasonsView groups={groups} />
    </section>
  );
}

function MovieGroupRow({ group }: { group: DownloadItem }) {
  const link = group.link?.[0];
  const url = link?.dl ?? group.dl;
  if (!url) return null;
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06]">
      <div className="min-w-0">
        <div className="text-[14px] font-medium">{group.quality.trim()}</div>
        <div className="text-[12px] text-white/50">
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
    <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[18px] font-semibold tracking-tight">
          Season {season}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedId(g.id)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                g.id === selected.id
                  ? "bg-white text-black"
                  : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {g.quality.trim()}
              {g.encoder && (
                <span className="ml-1 opacity-60">· {g.encoder}</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="text-[12px] text-white/50">
        {selected.total_episode ?? selected.link?.length ?? 0} episodes · avg{" "}
        {selected.size}
        {selected.tags.length > 0 && ` · ${selected.tags.join(" / ")}`}
      </div>
      <div className="divide-y divide-white/5">
        {[...(selected.link ?? [])]
          .sort((a, b) => b.episode - a.episode)
          .map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-white/[0.03]"
            >
              <div className="flex min-w-0 items-center gap-4">
                <span className="w-10 shrink-0 font-mono text-[13px] text-white/40">
                  E{String(l.episode).padStart(2, "0")}
                </span>
                <span className="truncate text-[14px]" title={l.source}>
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
        size="icon-sm"
        variant="ghost"
        className="rounded-full text-white/70 hover:bg-white/10 hover:text-white"
        title="Open in VLC"
        aria-label="Open in VLC"
      >
        <a href={`vlc://${url}`}>
          <Play />
        </a>
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={onCopy}
        className="rounded-full text-white/70 hover:bg-white/10 hover:text-white"
        title={copied ? "Copied!" : "Copy link"}
        aria-label="Copy link"
      >
        {copied ? <Check /> : <Copy />}
      </Button>
      <Button
        asChild
        size="sm"
        className="ml-1 h-8 gap-1.5 rounded-full bg-white px-3 text-[12px] font-semibold text-black hover:bg-white/90"
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
