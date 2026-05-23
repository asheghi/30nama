import type { Title } from "@30nama/api";
import { Link } from "@tanstack/react-router";

export function PosterCard({ post }: { post: Title }) {
  const poster =
    post.image.poster.webp?.medium ||
    post.image.poster.jpg?.medium ||
    post.image.poster.preview;

  const displayTitle = post.title.english || post.title.local || "";
  const year = post.info?.year;

  return (
    <Link
      to="/title/$id"
      params={{ id: String(post.id) }}
      className="group block focus:outline-none"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/5 transition-all duration-300 group-hover:ring-white/30 group-hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.9)] group-focus-visible:ring-2 group-focus-visible:ring-white">
        <img
          src={poster}
          alt={displayTitle}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
        />
        {/* Bottom-aligned dark gradient — ensures the in-card title stays
            readable over bright artwork without darkening the whole image. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black via-black/75 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div
            className="line-clamp-2 text-[13px] font-semibold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
            title={displayTitle}
          >
            {displayTitle}
          </div>
          {year && (
            <div className="mt-1 text-[11px] font-medium text-white/70">
              {year}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function PosterCardSkeleton() {
  return (
    <div aria-hidden className="block animate-pulse">
      <div className="aspect-[2/3] rounded-xl bg-white/[0.04]" />
    </div>
  );
}

/**
 * Horizontal-scroll rail of posters. AppleTV+ style: invisible scrollbar,
 * snap-to-start, fixed card width that lets cards bleed off the right edge
 * to hint at more content.
 */
export function PosterRow({
  title,
  posts,
  seeMoreCat,
}: {
  title: string;
  posts: Title[];
  seeMoreCat?: "movie" | "series" | "anime";
}) {
  if (!posts.length) return null;
  return (
    <section className="space-y-3">
      <div className="mx-auto flex max-w-[1600px] items-end justify-between px-6 lg:px-10">
        <h2 className="text-[15px] font-semibold tracking-tight text-white/90">
          {title}
        </h2>
        {seeMoreCat && (
          <Link
            to="/category/$cat"
            params={{ cat: seeMoreCat }}
            search={{}}
            className="text-[12px] text-white/50 transition-colors hover:text-white"
          >
            See all
          </Link>
        )}
      </div>
      <div className="no-scrollbar overflow-x-auto">
        <div className="mx-auto flex max-w-[1600px] gap-5 px-6 pb-2 lg:gap-6 lg:px-10">
          {posts.map((p) => (
            <div
              key={`${title}-${p.id}`}
              className="w-[180px] shrink-0 snap-start sm:w-[200px] lg:w-[230px]"
            >
              <PosterCard post={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
