import { useEffect, useMemo, useState } from "react";
import {
  createFileRoute,
  Link,
  redirect,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getStream, type StreamEpisode } from "@30nama/api";
import { ArrowLeft } from "lucide-react";
import { createInterfaceClient, getStoredToken } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { HlsPlayer } from "@/components/HlsPlayer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/play/$id")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getStoredToken()) {
      throw redirect({ to: "/login" });
    }
  },
  component: PlayPage,
});

/**
 * Flattens the API's `list` (season string → episodes) into ordered tuples
 * `[season, episode][]`. Seasons are sorted numerically by string key,
 * which matches the natural display order ("1", "2", …, "10", "11", …).
 * Within a season, episodes preserve API ordering.
 */
function flattenList(
  list: Record<string, StreamEpisode[]>,
): { season: string; episodes: StreamEpisode[] }[] {
  return Object.entries(list)
    .map(([season, episodes]) => ({ season, episodes }))
    .sort((a, b) => {
      const ai = Number.parseInt(a.season, 10);
      const bi = Number.parseInt(b.season, 10);
      if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
      return a.season.localeCompare(b.season);
    });
}

function PlayPage() {
  const { id } = Route.useParams();

  const streamQuery = useQuery({
    queryKey: queryKeys.stream(id),
    queryFn: () => getStream(createInterfaceClient(), id),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const seasons = useMemo(
    () => (streamQuery.data ? flattenList(streamQuery.data.list) : []),
    [streamQuery.data],
  );

  // Flat playlist used by the player for "Next Episode" navigation.
  const flatPlaylist = useMemo(
    () => seasons.flatMap((s) => s.episodes),
    [seasons],
  );

  const watched = streamQuery.data?.watched;

  // Default selection: the watched episode if available, else the first.
  const defaultEpisode = useMemo(() => {
    if (flatPlaylist.length === 0) return null;
    if (watched) {
      const match = flatPlaylist.find(
        (e) =>
          e.data.season === watched.season &&
          e.data.episode === watched.episode,
      );
      if (match) return match;
    }
    return flatPlaylist[0];
  }, [flatPlaylist, watched]);

  const [activeId, setActiveId] = useState<string | null>(null);

  // Sync default → active once the data loads.
  useEffect(() => {
    if (!activeId && defaultEpisode) setActiveId(defaultEpisode.data.id);
  }, [activeId, defaultEpisode]);

  const activeEpisode = useMemo(
    () => flatPlaylist.find((e) => e.data.id === activeId) ?? defaultEpisode,
    [flatPlaylist, activeId, defaultEpisode],
  );

  const isSeries =
    seasons.length > 1 ||
    (seasons.length === 1 && seasons[0].episodes.length > 1);

  // Resume only when the active episode is the same one the user last
  // watched. Subsequent episodes start at zero.
  const resumeFrom = useMemo(() => {
    if (!activeEpisode || !watched) return 0;
    if (
      activeEpisode.data.season === watched.season &&
      activeEpisode.data.episode === watched.episode
    ) {
      const t = Number.parseFloat(watched.time);
      return Number.isFinite(t) ? t : 0;
    }
    return 0;
  }, [activeEpisode, watched]);

  const token =
    typeof window !== "undefined" ? getStoredToken() ?? "" : "";

  if (streamQuery.isLoading) {
    return (
      <div className="dark grid min-h-screen place-items-center bg-black text-white">
        Loading…
      </div>
    );
  }

  if (streamQuery.error || !streamQuery.data) {
    return (
      <div className="dark grid min-h-screen place-items-center bg-black text-white">
        <div className="space-y-3 text-center">
          <p className="text-sm text-red-400">
            {streamQuery.error instanceof Error
              ? streamQuery.error.message
              : "Stream unavailable"}
          </p>
          <Link
            to="/title/$id"
            params={{ id }}
            className="text-sm text-white/80 underline"
          >
            Back to title
          </Link>
        </div>
      </div>
    );
  }

  if (!activeEpisode) {
    return (
      <div className="dark grid min-h-screen place-items-center bg-black text-white">
        <div className="space-y-3 text-center">
          <p className="text-sm">No streams available for this title.</p>
          <Link
            to="/title/$id"
            params={{ id }}
            className="text-sm text-white/80 underline"
          >
            Back
          </Link>
        </div>
      </div>
    );
  }

  const titleText = streamQuery.data.data.title;

  return (
    <div className="dark min-h-screen bg-black text-white">
      {/* Top-left back link, floating over the player */}
      <div className="absolute left-4 top-4 z-30">
        <Link
          to="/title/$id"
          params={{ id }}
          className="flex items-center gap-2 rounded-md bg-black/40 px-3 py-1.5 text-sm text-white/90 backdrop-blur-md hover:bg-black/60"
        >
          <ArrowLeft className="size-4" />
          <span className="truncate max-w-[16rem]">{titleText}</span>
        </Link>
      </div>

      <div className="relative w-full">
        <HlsPlayer
          key={activeEpisode.data.id}
          episode={activeEpisode}
          postId={streamQuery.data.data.post_id}
          playlist={flatPlaylist}
          resumeFrom={resumeFrom}
          token={token}
          onNextEpisode={(next) => {
            setActiveId(next.data.id);
            // Scroll back to top so the player is in view.
            if (typeof window !== "undefined") {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
        />
      </div>

      {isSeries && (
        <EpisodePicker
          seasons={seasons}
          activeId={activeEpisode.data.id}
          onSelect={(ep) => {
            setActiveId(ep.data.id);
            if (typeof window !== "undefined") {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
        />
      )}

    </div>
  );
}

function EpisodePicker({
  seasons,
  activeId,
  onSelect,
}: {
  seasons: { season: string; episodes: StreamEpisode[] }[];
  activeId: string;
  onSelect: (ep: StreamEpisode) => void;
}) {
  // Default to the season containing the active episode.
  const activeSeasonInitial =
    seasons.find((s) => s.episodes.some((e) => e.data.id === activeId))
      ?.season ?? seasons[0]?.season ?? "1";

  const [activeSeason, setActiveSeason] = useState<string>(activeSeasonInitial);

  // Keep tab in sync if active episode is changed externally (Next Episode).
  useEffect(() => {
    const s = seasons.find((s) =>
      s.episodes.some((e) => e.data.id === activeId),
    );
    if (s) setActiveSeason(s.season);
  }, [activeId, seasons]);

  const current = seasons.find((s) => s.season === activeSeason);

  return (
    <section className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-semibold">Episodes</h2>
        {seasons.length > 1 && (
          <div className="ml-4 flex flex-wrap gap-1">
            {seasons.map((s) => (
              <button
                key={s.season}
                type="button"
                onClick={() => setActiveSeason(s.season)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs",
                  s.season === activeSeason
                    ? "bg-white text-black"
                    : "bg-white/10 hover:bg-white/20",
                )}
              >
                Season {s.season}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {current?.episodes.map((ep) => {
          const isActive = ep.data.id === activeId;
          const epLabel = ep.data.episode.includes(",")
            ? `E${ep.data.episode.split(",").join("–")}`
            : `E${ep.data.episode.padStart(2, "0")}`;
          return (
            <button
              key={ep.data.id}
              type="button"
              onClick={() => onSelect(ep)}
              className={cn(
                "group flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors",
                isActive
                  ? "border-white bg-white/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-xs text-white/60">
                  {epLabel}
                </span>
                {isActive && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                    Now
                  </span>
                )}
              </div>
              <div
                className="text-sm leading-snug text-white/90 line-clamp-2"
                dir="auto"
              >
                {ep.data.title || `Episode ${ep.data.number}`}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
