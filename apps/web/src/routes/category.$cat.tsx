import { useEffect, useState } from "react";
import {
  createFileRoute,
  notFound,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import {
  getArchive,
  type Page,
  type Title,
  type ArchiveOrderBy,
} from "@30nama/api";
import { createClient, getStoredToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PosterCard } from "@/components/PosterCard";
import { SiteHeader } from "@/components/SiteHeader";

const CATS = ["movie", "series", "anime"] as const;
type Cat = (typeof CATS)[number];

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
  component: CategoryPage,
});

function CategoryPage() {
  const { cat } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [data, setData] = useState<Page<Title> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const category = cat as Cat;
  const page = search.page ?? 1;
  const genre = search.genre ?? "all";
  const orderBy = search.orderBy ?? "update";
  const order = search.order ?? "DESC";
  const streamOnly = search.streamOnly ?? false;

  useEffect(() => {
    setLoading(true);
    setError(null);
    const slugs = genre === "all" ? [category] : [category, genre];
    getArchive(createClient(), slugs, page, streamOnly, orderBy, order)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [category, page, genre, orderBy, order, streamOnly]);

  const updateSearch = (patch: CategorySearch) => {
    navigate({
      to: "/category/$cat",
      params: { cat: category },
      search: (prev: CategorySearch) => ({ ...prev, ...patch }),
    });
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight">
            {CAT_LABELS[category]}
            {genre !== "all" && (
              <span className="ml-2 text-base font-normal text-muted-foreground">
                · {genre}
              </span>
            )}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Genre</span>
              <select
                value={genre}
                onChange={(e) =>
                  updateSearch({ genre: e.target.value, page: 1 })
                }
                className="rounded border border-border bg-background px-2 py-1"
              >
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Sort</span>
              <select
                value={orderBy}
                onChange={(e) =>
                  updateSearch({
                    orderBy: e.target.value as ArchiveOrderBy,
                    page: 1,
                  })
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
              <input
                type="checkbox"
                checked={streamOnly}
                onChange={(e) =>
                  updateSearch({ streamOnly: e.target.checked, page: 1 })
                }
              />
              <span>Stream only</span>
            </label>
          </div>
        </div>

        {loading && !data && (
          <p className="text-muted-foreground">Loading…</p>
        )}
        {error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
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
    <div className="flex items-center justify-center gap-3 py-6">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {pages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
