import type { ApiClient } from "../client.ts";
import type {
  Airstatus,
  Genre,
  NextEpisode,
  PostImage,
  TitleType,
} from "../types.ts";

export interface SingleNewsItem {
  id: number;
  title: string;
  date: string;
  poster: { large: string; thumbnail: string };
  image: {
    full: string;
    full_webp: string;
    thumb: string;
    thumb_webp: string;
  };
  length: number;
  description: string;
  comments: number;
}

// Cast/crew entries surface on the paginated `/single/id/{id}/page/{p}` form.
// Shape is best-effort — tighten once a real response is captured.
export interface CastPerson {
  id?: number | string;
  name?: string;
  persian_name?: string | null;
  role?: string | null;
  character?: string | null;
  image?: string | null;
  [key: string]: unknown;
}

export interface TitleDetail {
  id: number;
  title: string;
  persian_title: string;
  stream: boolean;
  is_series: boolean;
  year: string;
  year_end: string;
  title_type: TitleType;
  persian_subtitle: boolean;
  persian_plot: string;
  english_plot: string;
  director: string | string[] | null;
  creator: string | string[] | null;
  writer: string | string[] | null;
  genre: string[];
  genre_full: Genre[];
  country: string | string[] | null;
  language: string | string[] | null;
  primary_language: string | null;
  time: string;
  budget: string;
  age: string;
  imdb: string;
  imdb_score: string;
  imdb_votes: string;
  "30nama_score": number;
  "30nama_votes": string;
  "30nama_userrate": unknown | null;
  total_watchlist: string;
  total_favorite: string;
  coming_soon: boolean;
  free_stream: boolean;
  free_download: boolean;
  imdb_250: string | null;
  release_date: string | null;
  web_release_date: string | null;
  bluray_release_date: string | null;
  post_note: string;
  updates_note: unknown[];
  airstatus: Airstatus | null;
  nextepisode: NextEpisode | null;
  image: PostImage;
  subtitle: unknown | null;
  collections: unknown | null;
  soundtracks: unknown | null;
  reviews: unknown | null;
  news: SingleNewsItem[] | null;
  quotes: unknown | null;
  related_posts: unknown | null;
  cast?: CastPerson[] | null;
  crew?: CastPerson[] | null;
  seo: Record<string, unknown>;
}

export function getSingle(
  client: ApiClient,
  id: string | number,
  page: number = 1,
): Promise<TitleDetail> {
  return client.post<TitleDetail>(`/action/single/id/${id}/page/${page}`, {
    jsonBody: {},
  });
}
