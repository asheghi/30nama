import {
  createFileRoute,
  notFound,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  getArchive,
  type ArchiveOrderBy,
  type ArchiveOrder,
} from "@30nama/api";
import { createClient, getStoredToken } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { PosterCard } from "@/components/PosterCard";
import { SiteHeader } from "@/components/SiteHeader";

const CATS = ["movie", "series", "anime"] as const;
type Cat = (typeof CATS)[number];

const ARCHIVE_STALE_TIME = 30 * 1000; // 30s, not persisted

const GENRES = [
  "all",
  "action",
  "adventure",
  "animation",
  "comedy",
  "crime",
  "documentary",
  "drama",
  "family",
  "fantasy",
  "history",
  "horror",
  "music",
  "musical",
  "mystery",
  "romance",
  "sci-fi",
  "sitcom",
  "sport",
  "thriller",
  "war",
  "western",
];

const CAT_LABELS: Record<Cat, string> = {
  movie: "Movies",
  series: "Series",
  anime: "Anime",
};

const ORDER_BY_OPTIONS: { value: ArchiveOrderBy; label: string }[] = [
  { value: "update", label: "Recently updated" },
  { value: "year", label: "Year" },
  { value: "favorite", label: "Most popular" },
  { value: "imdb-rate", label: "IMDb score" },
  { value: "30nama-rate", label: "30nama score" },
  { value: "relevant", label: "Relevant" },
];

interface CategorySearch {
  page?: number;
  genre?: string;
  orderBy?: ArchiveOrderBy;
  order?: "ASC" | "DESC";
  streamOnly?: boolean;
}

function isCat(v: unknown): v is Cat {
  return CATS.includes(v as Cat);
}

function isOrderBy(v: unknown): v is ArchiveOrderBy {
  return ORDER_BY_OPTIONS.some((o) => o.value === v);
}

function archiveQueryArgs(
  cat: Cat,
  genre: string,
  page: number,
  streamOnly: boolean,
  orderBy: ArchiveOrderBy,
  order: ArchiveOrder,
) {
  const slugs = genre === "all" ? [cat] : [cat, genre];
  return {
    queryKey: queryKeys.archive(cat, genre, page, orderBy, order, streamOnly),
    queryFn: () =>
      getArchive(createClient(), slugs, page, streamOnly, orderBy, order),
    staleTime: ARCHIVE_STALE_TIME,
  };
}

export const Route = createFileRoute("/category/$cat")({
  beforeLoad: ({ params }) => {
    if (!isCat(params.cat)) throw notFound();
    if (typeof window !== "undefined" && !getStoredToken()) {
      throw redirect({ to: "/" });
    }
  },
  validateSearch: (raw: Record<string, unknown>): CategorySearch => {
    const out: CategorySearch = {};
    const p = Number(raw.page);
    if (p > 1) out.page = p;
    if (typeof raw.genre === "string" && raw.genre && raw.genre !== "all") {
      out.genre = raw.genre;
    }
    if (isOrderBy(raw.orderBy)) out.orderBy = raw.orderBy;
    if (raw.order === "ASC") out.order = "ASC";
    if (raw.streamOnly === true || raw.streamOnly === "true") {
      out.streamOnly = true;
    }
    return out;
  },
  loaderDeps: ({ search }) => ({
    page: search.page ?? 1,
    genre: search.genre ?? "all",
    orderBy: search.orderBy ?? "update",
    order: search.order ?? "DESC",
    streamOnly: search.streamOnly ?? false,
  }),
  loader: async ({ params, deps, context }) => {
    const token = getStoredToken();
    if (!token) return;
    if (!isCat(params.cat)) return;
    await context.queryClient.prefetchQuery(
      archiveQueryArgs(
        params.cat,
        deps.genre,
        deps.page,
        deps.streamOnly,
        deps.orderBy,
        deps.order,
      ),
    );
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { cat } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const category = cat as Cat;
  const page = search.page ?? 1;
  const genre = search.genre ?? "all";
  const orderBy = search.orderBy ?? "update";
  const order = search.order ?? "DESC";
  const streamOnly = search.streamOnly ?? false;

  const query = useQuery({
    ...archiveQueryArgs(category, genre, page, streamOnly, orderBy, order),
    // Keep the previous page's posters on screen while the new page loads —
    // pagination feels less jarring this way.
    placeholderData: (prev) => prev,
  });

  const { data, error, isLoading } = query;

  const updateSearch = (patch: CategorySearch) => {
    navigate({
      to: "/category/$cat",
      params: { cat: category },
      search: { ...search, ...patch },
    });
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto max-w-[1600px] space-y-8 px-6 pb-20 pt-10 lg:px-10">
        <div className="space-y-5">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {CAT_LABELS[category]}
            {genre !== "all" && (
              <span className="ml-3 text-2xl font-normal text-white/50">
                {genre}
              </span>
            )}
          </h1>
          <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
            <FilterSelect
              value={orderBy}
              onChange={(v) =>
                updateSearch({ orderBy: v as ArchiveOrderBy, page: 1 })
              }
              options={ORDER_BY_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
            />
            <FilterSelect
              value={genre}
              onChange={(v) => updateSearch({ genre: v, page: 1 })}
              options={GENRES.map((g) => ({
                value: g,
                label: g === "all" ? "All genres" : g,
              }))}
            />
            <button
              type="button"
              onClick={() =>
                updateSearch({ streamOnly: !streamOnly, page: 1 })
              }
              className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
                streamOnly
                  ? "bg-white text-black"
                  : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              Stream only
            </button>
          </div>
        </div>

        {isLoading && !data && (
          <p className="text-white/50">Loading…</p>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error.message}
          </div>
        )}
        {data && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-5 xl:grid-cols-6">
              {data.posts.map((p) => (
                <PosterCard key={p.id} post={p} />
              ))}
            </div>
            <Pagination
              page={data.page}
              pages={data.pages}
              onChange={(page) => updateSearch({ page })}
            />
          </>
        )}
      </main>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-full border border-white/10 bg-white/5 px-4 py-1.5 pr-9 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:border-white/30 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-black">
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-white/50"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.24 4.38a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}

function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (p: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-4 py-8">
      <Button
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="h-9 rounded-full border border-white/10 bg-white/5 px-5 text-[13px] font-medium text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30"
      >
        Previous
      </Button>
      <span className="text-[13px] text-white/50">
        Page {page} of {pages}
      </span>
      <Button
        size="sm"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        className="h-9 rounded-full border border-white/10 bg-white/5 px-5 text-[13px] font-medium text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30"
      >
        Next
      </Button>
    </div>
  );
}
