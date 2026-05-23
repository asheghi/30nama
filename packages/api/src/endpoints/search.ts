import type { ApiClient } from "../client.ts";
import type { Genre, Page, Title, TitleType } from "../types.ts";

/** Simple search by title (English, Persian, or IMDb id). */
export function search(
  client: ApiClient,
  query: string,
  streamonly = false,
  page = 1,
): Promise<Page<Title>> {
  return client.call<Page<Title>>("search", {
    query,
    streamonly,
    page,
  });
}

export type FullSearchType = "all" | "movie" | "series" | "anime" | "news";

export type FullSearchOrderBy =
  | "relevant"
  | "id"
  | "year"
  | "favorite"
  | "imdb"
  | "user_rate";

export type FullSearchOrder = "asc" | "desc";

export interface FullSearchOptions {
  type?: FullSearchType;
  orderby?: FullSearchOrderBy;
  order?: FullSearchOrder;
  page?: number;
}

/**
 * Raw post shape returned by interface.30nama.com's `full_search` action.
 * Different from hana-api's `Title` (flat fields, snake_case, year baked
 * into the title string). Use `fullSearchPostToTitle` to convert.
 */
export interface FullSearchPost {
  id: number;
  title_type: TitleType;
  stream: boolean;
  is_series: boolean;
  coming_soon: boolean;
  free_stream: boolean;
  free_download: boolean;
  persian_subtitle: boolean;
  title: string;
  persian_title?: string;
  persian_plot?: string;
  english_plot?: string;
  imdb_id?: string;
  imdb_score?: string | number;
  imdb_votes?: string | number;
  "30nama_score"?: string | number;
  "30nama_votes"?: string | number;
  image: {
    cover?: string;
    cover_webp?: string;
    poster: {
      small?: string;
      small_webp?: string;
      medium?: string;
      medium_webp?: string;
      large?: string;
      large_webp?: string;
      big?: string;
      big_webp?: string;
    };
  };
  genre?: Genre[];
}

export interface FullSearchResult {
  // The server returns `null` for a bucket when the current page has no
  // results in it (e.g. searching for an actor's name with type=all may
  // return person matches but no title matches → `title: null`).
  title: Page<FullSearchPost> | null;
  person?: { page: number; pages: number; posts: unknown[] } | null;
  news?: { page: number; pages: number; posts: unknown[] } | null;
}

/**
 * Multi-type search backing the site header's search box. The website hits
 * `interface.30nama.com/full_search/...` (not hana-api — that route 404s
 * there) so this needs a client built from `createInterfaceDirectTransport`
 * or its RPC equivalent. Filters by content type and sort key.
 *
 * Returns a `Page<Title>` so existing UI components that consume `Title`
 * (PosterCard, etc.) can render the results unchanged.
 */
export async function fullSearch(
  client: ApiClient,
  query: string,
  {
    type = "all",
    orderby = "relevant",
    order = "desc",
    page = 1,
  }: FullSearchOptions = {},
): Promise<Page<Title>> {
  const action =
    `full_search/type/${type}/orderby/${orderby}/order/${order}/page/${page}`;
  const result = await client.call<FullSearchResult>(action, { query });
  const titles = result.title;
  if (!titles) {
    return { posts: [], page, pages: 0, total: 0 };
  }
  return {
    posts: titles.posts.map(fullSearchPostToTitle),
    page: titles.page,
    pages: titles.pages,
    total: (titles as Page<FullSearchPost> & { total?: number }).total ?? 0,
  };
}

/**
 * Convert an interface.30nama.com `full_search` post into the hana-api
 * `Title` shape used by the rest of the app. We fill the structural
 * fields PosterCard / list views read; other Title fields get safe empty
 * defaults rather than guessed values.
 */
export function fullSearchPostToTitle(p: FullSearchPost): Title {
  // Title strings come back as "The Dark Knight 2008"; split the trailing
  // 4-digit year off so we have a separate display title and year.
  const yearMatch = p.title.match(/\s(\d{4})$/);
  const english = yearMatch ? p.title.slice(0, -5).trim() : p.title;
  const year = yearMatch ? Number(yearMatch[1]) : 0;

  const poster = p.image.poster;
  const cover = p.image.cover_webp || p.image.cover;
  const num = (v: string | number | undefined): number =>
    typeof v === "number" ? v : v ? Number(v) || 0 : 0;

  return {
    id: p.id,
    post_type: "title",
    options: {
      title_type: p.title_type,
      stream: p.stream,
      is_series: p.is_series,
      persian_subtitle: p.persian_subtitle,
      exclusive_subtitle: false,
      coming_soon: p.coming_soon,
      free_download: p.free_download,
      free_stream: p.free_stream,
    },
    info: {
      seasons: 0,
      year,
      age: "",
      time: { default: 0 },
    },
    title: { english, local: p.persian_title },
    plot: {
      english: p.english_plot ?? "",
      local: p.persian_plot ?? "",
    },
    image: {
      poster: {
        preview: poster.small_webp || poster.small || "",
        webp: {
          small: poster.small_webp || "",
          medium: poster.medium_webp || "",
          large: poster.large_webp || "",
          big: poster.big_webp || "",
        },
        jpg: {
          small: poster.small || "",
          medium: poster.medium || "",
          large: poster.large || "",
          big: poster.big || "",
        },
      },
      ...(cover ? { cover: { webp: p.image.cover_webp ?? "", jpg: p.image.cover ?? "" } } : {}),
    },
    genre: p.genre ?? [],
    score: {
      "30nama": {
        score: num(p["30nama_score"]),
        votes: num(p["30nama_votes"]),
      },
      imdb: p.imdb_id
        ? {
            link: `https://www.imdb.com/title/${p.imdb_id}/`,
            score: num(p.imdb_score),
            votes: num(p.imdb_votes),
          }
        : undefined,
    },
    air: {
      air_status: "",
      next_episode_caption: "",
      next_episode_date: { g: "", j: "" },
    },
  };
}

export interface AdvancedSearchOption {
  title: string;
  value: string;
}

export interface AdvancedSearchParameters {
  genre: AdvancedSearchOption[];
  type: AdvancedSearchOption[];
  imdb_rate: AdvancedSearchOption[];
  country: AdvancedSearchOption[];
  language: AdvancedSearchOption[];
  min_year: number;
  max_year: number;
  cast: string;
  director: string;
  creator: string;
  channel: AdvancedSearchOption[];
  encoder: AdvancedSearchOption[];
  quality: AdvancedSearchOption[];
  x265: AdvancedSearchOption[];
  "3D": AdvancedSearchOption[];
  stream: AdvancedSearchOption[];
  age: AdvancedSearchOption[];
}

export function getAdvancedSearchParameters(
  client: ApiClient,
): Promise<AdvancedSearchParameters> {
  return client.call<AdvancedSearchParameters>("advanced_search_parameters");
}

export type AdvancedSearchOrderBy =
  | "relevant"
  | "update"
  | "year"
  | "favorite"
  | "imdb-rate"
  | "30nama-rate";

export function advancedSearch(
  client: ApiClient,
  parameters: Record<string, string | number | boolean | undefined>,
  orderby: AdvancedSearchOrderBy = "relevant",
  order: "ASC" | "DESC" = "ASC",
  page = 1,
): Promise<Page<Title>> {
  return client.call<Page<Title>>("advanced_search", {
    ...parameters,
    orderby,
    order,
    page,
  });
}
