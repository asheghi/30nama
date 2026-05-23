import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getHome, type Title } from "@30nama/api";
import { Info, Play } from "lucide-react";
import { createClient, getStoredToken } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { PosterRow } from "@/components/PosterCard";
import { SiteHeader } from "@/components/SiteHeader";

const HOME_STALE_TIME = 10 * 60 * 1000; // 10 min

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
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
  // Pick the first featured post that actually has a wide cover image —
  // poster-only items make for a poor full-bleed hero.
  const hero = data?.hero_header.posts.find((p) => !!p.image.cover) ??
    data?.hero_header.posts[0];

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <SiteHeader onSignOut={() => setToken(null)} />

      {/* Header sits over the hero on the home page. Pull main up under it. */}
      <main className="-mt-14 space-y-12 pb-20">
        {isLoading && (
          <div className="flex h-[80vh] items-center justify-center text-muted-foreground">
            Loading…
          </div>
        )}
        {error && (
          <div className="mx-auto mt-20 max-w-2xl rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error.message}
          </div>
        )}
        {data && hero && <HeroBanner post={hero} />}
        {data && (
          <div className="space-y-10">
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
                title="TV Shows"
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
          </div>
        )}
      </main>
    </div>
  );
}

function HeroBanner({ post }: { post: Title }) {
  const cover =
    post.image.cover?.webp ||
    post.image.cover?.jpg ||
    post.image.poster.webp?.big ||
    post.image.poster.jpg?.big;
  const title = post.title.english || post.title.local || "";
  const plot = post.plot.english;
  const year = post.info?.year;
  const isSeries = post.options.is_series;
  const genres = post.genre.slice(0, 3).map((g) => g.slug).join(" · ");

  return (
    <section className="relative h-[78vh] min-h-[520px] w-full overflow-hidden">
      {cover && (
        <img
          src={cover}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {/* Bottom-to-top fade lets text sit on the dark portion while the
          top half of the artwork stays visible. The right-to-left side
          gradient adds extra contrast for left-aligned text on bright
          backdrops. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent" />

      <div className="relative z-10 mx-auto flex h-full max-w-[1600px] flex-col justify-end px-6 pb-16 lg:px-10 lg:pb-24">
        <div className="max-w-2xl space-y-5">
          <div className="flex items-center gap-3 text-[12px] font-medium uppercase tracking-[0.18em] text-white/70">
            <span>{isSeries ? "Series" : "Movie"}</span>
            {year && (
              <>
                <span className="text-white/30">·</span>
                <span>{year}</span>
              </>
            )}
            {genres && (
              <>
                <span className="text-white/30">·</span>
                <span className="normal-case tracking-normal text-white/60">
                  {genres}
                </span>
              </>
            )}
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-lg sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          {plot && (
            <p className="line-clamp-3 max-w-xl text-[15px] leading-relaxed text-white/80">
              {plot}
            </p>
          )}
          <div className="flex items-center gap-3 pt-1">
            {post.options.stream && (
              <Button
                asChild
                className="h-11 gap-2 rounded-full bg-white px-6 text-[14px] font-semibold text-black hover:bg-white/90"
              >
                <Link to="/play/$id" params={{ id: String(post.id) }}>
                  <Play className="size-4 fill-black" />
                  Play
                </Link>
              </Button>
            )}
            <Button
              asChild
              variant="secondary"
              className="h-11 gap-2 rounded-full border border-white/20 bg-white/10 px-6 text-[14px] font-semibold text-white backdrop-blur hover:bg-white/20"
            >
              <Link to="/title/$id" params={{ id: String(post.id) }}>
                <Info className="size-4" />
                More Info
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SignInPrompt() {
  return (
    <div className="dark relative flex min-h-screen items-center justify-center bg-background text-foreground">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 30%, rgba(120,120,255,0.15), transparent 70%), radial-gradient(50% 40% at 80% 80%, rgba(255,80,80,0.12), transparent 70%)",
        }}
      />
      <div className="relative w-full max-w-md space-y-5 px-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Potato<span className="text-white/60">+</span>
        </h1>
        <p className="text-[15px] text-white/70">
          Endless entertainment. Cinematic originals, blockbusters, and the shows
          everyone&apos;s talking about — all in one place.
        </p>
        <Button
          asChild
          className="h-11 w-full rounded-full bg-white text-[14px] font-semibold text-black hover:bg-white/90"
        >
          <Link to="/login">Sign In</Link>
        </Button>
        <p className="text-[12px] text-white/40">
          Sign in by scanning a QR code with the 30nama app.
        </p>
      </div>
    </div>
  );
}
