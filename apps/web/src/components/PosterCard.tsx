import type { Post } from "@30nama/api";

export function PosterCard({ post }: { post: Post }) {
  const poster =
    post.image.poster.medium_webp ||
    post.image.poster.medium ||
    post.image.poster.small;

  const score = post["30nama_score"];
  const seriesBadge = post.is_series ? "Series" : "Movie";

  return (
    <a
      href={`/title/${post.id}`}
      className="group block overflow-hidden rounded-md bg-card transition-transform hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-[2/3] bg-muted">
        <img
          src={poster}
          alt={post.title}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        {score > 0 && (
          <div className="absolute top-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
            {score.toFixed(1)}
          </div>
        )}
      </div>
      <div className="p-2">
        <div className="truncate text-sm font-medium" title={post.title}>
          {post.title}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{seriesBadge}</span>
          {post.genre[0] && (
            <>
              <span>·</span>
              <span className="truncate">{post.genre[0].slug}</span>
            </>
          )}
        </div>
      </div>
    </a>
  );
}

export function PosterRow({
  title,
  posts,
}: {
  title: string;
  posts: Post[];
}) {
  if (!posts.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {posts.map((p) => (
          <PosterCard key={`${title}-${p.id}`} post={p} />
        ))}
      </div>
    </section>
  );
}
