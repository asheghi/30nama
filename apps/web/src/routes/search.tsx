import { useEffect, useMemo, useRef } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  fullSearch,
  type FullSearchOrder,
  type FullSearchOrderBy,
  type FullSearchType,
  type Page,
  type Title,
} from "@30nama/api";
import { createInterfaceClient, getStoredToken } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { PosterCard, PosterCardSkeleton } from "@/components/PosterCard";
import { SiteHeader } from "@/components/SiteHeader";

const SEARCH_STALE_TIME = 30 * 1000;

const TYPE_OPTIONS: { value: FullSearchType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "series", label: "Series" },
  { value: "anime", label: "Anime" },
];

const ORDER_BY_OPTIONS: { value: FullSearchOrderBy; label: string }[] = [
  { value: "relevant", label: "Relevance" },
  { value: "imdb", label: "IMDb score" },
  { value: "favorite", label: "30nama score" },
  { value: "year", label: "Year" },
];

interface SearchSearch {
  q?: string;
  type?: FullSearchType;
  orderBy?: FullSearchOrderBy;
  order?: FullSearchOrder;
}

function isType(v: unknown): v is FullSearchType {
  return TYPE_OPTIONS.some((o) => o.value === v);
}
function isOrderBy(v: unknown): v is FullSearchOrderBy {
  return ORDER_BY_OPTIONS.some((o) => o.value === v);
}

// interface.30nama.com's `full_search` only respects `query` and `page` —
// the type and orderby path segments are decorative on the server. Always
// fetch type=all, orderby=relevant, then apply the user's filter and sort
// client-side over the accumulated pages. The query key only varies on q,
// so toggling sort doesn't refetch; bumping q resets the infinite stack.
function searchInfiniteArgs(q: string) {
  return {
    queryKey: queryKeys.search(q),
    queryFn: ({ pageParam }: { pageParam: number }) =>
      fullSearch(createInterfaceClient(), q, {
        type: "all",
        orderby: "relevant",
        order: "desc",
        page: pageParam,
      }),
    initialPageParam: 1,
    getNextPageParam: (last: Page<Title>) =>
      last.page < last.pages ? last.page + 1 : undefined,
    staleTime: SEARCH_STALE_TIME,
    enabled: q.length > 0,
  };
}

export const Route = createFileRoute("/search")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getStoredToken()) {
      throw redirect({ to: "/" });
    }
  },
  validateSearch: (raw: Record<string, unknown>): SearchSearch => {
    const out: SearchSearch = {};
    if (typeof raw.q === "string" && raw.q) out.q = raw.q;
    if (isType(raw.type) && raw.type !== "all") out.type = raw.type;
    if (isOrderBy(raw.orderBy) && raw.orderBy !== "relevant") {
      out.orderBy = raw.orderBy;
    }
    if (raw.order === "asc") out.order = "asc";
    return out;
  },
  loaderDeps: ({ search }) => ({ q: search.q ?? "" }),
  loader: async ({ deps, context }) => {
    if (!getStoredToken() || !deps.q) return;
    await context.queryClient.prefetchInfiniteQuery(searchInfiniteArgs(deps.q));
  },
  component: SearchPage,
});

function SearchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const q = search.q ?? "";
  const type = search.type ?? "all";
  const orderBy = search.orderBy ?? "relevant";
  const order = search.order ?? "desc";

  const query = useInfiniteQuery(searchInfiniteArgs(q));
  const {
    data,
    error,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = query;

  const allPosts = useMemo(() => {
    if (!data) return [] as Title[];
    // Dedupe by id — full_search re-ranks against the same global pool on
    // each page request, so a post can land on page 1 *and* page 2 if its
    // relevance score wobbles between requests. Without this, React fires
    // "two children with the same key" and we double-render the poster.
    const seen = new Set<number>();
    const out: Title[] = [];
    for (const page of data.pages) {
      for (const post of page.posts) {
        if (seen.has(post.id)) continue;
        seen.add(post.id);
        out.push(post);
      }
    }
    return out;
  }, [data]);
  const displayed = useMemo(
    () => applyClientFilters(allPosts, type, orderBy, order),
    [allPosts, type, orderBy, order],
  );

  // Load the next page when the sentinel scrolls into view. Idle until the
  // sentinel exists (only rendered when there's at least one page) and
  // until the previous fetch settles.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void fetchNextPage();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const updateSearch = (patch: Partial<SearchSearch>) => {
    navigate({
      to: "/search",
      search: { ...search, ...patch },
    });
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight">
            Search
            {q && (
              <span className="ml-2 text-base font-normal text-muted-foreground">
                · {q}
              </span>
            )}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Type</span>
              <select
                value={type}
                onChange={(e) =>
                  updateSearch({ type: e.target.value as FullSearchType })
                }
                className="rounded border border-border bg-background px-2 py-1"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Sort</span>
              <select
                value={orderBy}
                onChange={(e) =>
                  updateSearch({ orderBy: e.target.value as FullSearchOrderBy })
                }
                className="rounded border border-border bg-background px-2 py-1"
              >
                {ORDER_BY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Order</span>
              <select
                value={order}
                onChange={(e) =>
                  updateSearch({ order: e.target.value as FullSearchOrder })
                }
                className="rounded border border-border bg-background px-2 py-1"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </label>
          </div>
        </div>

        {!q && (
          <p className="text-muted-foreground">
            Type a title in the header search box to begin.
          </p>
        )}
        {q && isLoading && !data && <PosterSkeletonGrid count={12} />}
        {error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error.message}
          </div>
        )}
        {q && data && allPosts.length === 0 && (
          <p className="text-muted-foreground">No results.</p>
        )}
        {q && data && allPosts.length > 0 && (
          <>
            {(type !== "all" || orderBy !== "relevant") &&
              displayed.length < allPosts.length && (
                <p className="text-sm text-muted-foreground">
                  Showing {displayed.length} of {allPosts.length} loaded. Type
                  / sort filters apply only to results already loaded — keep
                  scrolling to pull in more.
                </p>
              )}
            {displayed.length === 0 ? (
              <p className="text-muted-foreground">
                No loaded results match this filter — keep scrolling for more.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {displayed.map((p) => (
                  <PosterCard key={p.id} post={p} />
                ))}
                {/* Skeleton placeholders shown in the same grid while the
                    next page is in flight, so the layout doesn't jump and
                    the user gets immediate feedback on the scroll. */}
                {isFetchingNextPage &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <PosterCardSkeleton key={`skeleton-${i}`} />
                  ))}
              </div>
            )}

            {/* Sentinel — fires fetchNextPage when scrolled into view. */}
            {hasNextPage && (
              <div ref={sentinelRef} className="h-1" aria-hidden />
            )}
            {!hasNextPage && allPosts.length > 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                End of results.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function PosterSkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <PosterCardSkeleton key={i} />
      ))}
    </div>
  );
}

function applyClientFilters(
  posts: Title[],
  type: FullSearchType,
  orderBy: FullSearchOrderBy,
  order: FullSearchOrder,
): Title[] {
  const filtered =
    type === "all"
      ? posts
      : posts.filter((p) =>
          type === "movie"
            ? p.options.title_type === "movie"
            : type === "series"
              ? p.options.title_type === "series"
              : type === "anime"
                ? p.options.title_type === "anime"
                : true,
        );

  if (orderBy === "relevant") return filtered;

  const dir = order === "asc" ? 1 : -1;
  const sortKey = (t: Title): number => {
    switch (orderBy) {
      case "year":
        return t.info.year;
      case "imdb":
        return t.score?.imdb?.score ?? 0;
      case "favorite":
        return t.score?.["30nama"]?.score ?? 0;
      default:
        return 0;
    }
  };
  return [...filtered].sort((a, b) => (sortKey(a) - sortKey(b)) * dir);
}
