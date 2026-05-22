export type TitleType = "movie" | "series" | "anime";

export interface Genre {
  name: string;
  slug: string;
}

export interface PosterSet {
  big: string;
  big_webp: string;
  large: string;
  large_webp: string;
  medium: string;
  medium_webp: string;
  small: string;
  small_webp: string;
}

export interface PostImage {
  cover: string | false;
  cover_webp: string | false;
  poster: PosterSet;
}

export interface Airstatus {
  status: string | null;
  data: string | null;
}

export interface NextEpisode {
  caption: string | null;
  date: string | null;
}

export interface Seo {
  title: string;
  description: string | null;
  alt: string;
}

export interface Post {
  id: number;
  title_type: TitleType;
  stream: boolean;
  is_series: boolean;
  coming_soon: boolean;
  free_stream: boolean;
  free_download: boolean;
  persian_subtitle: boolean;
  imdb_250: string | null;
  title: string;
  persian_title: string;
  budget: string;
  persian_plot: string;
  english_plot: string;
  imdb_id: string;
  imdb_score: string;
  imdb_votes: string;
  "30nama_score": number;
  "30nama_votes": string;
  myanimelist: string | null;
  myanimelist_score: number | null;
  myanimelist_votes: string | null;
  mydramalist: string | null;
  mydramalist_score: string | null;
  mydramalist_votes: string | null;
  seo: Seo;
  image: PostImage;
  genre: Genre[];
  airstatus: Airstatus;
  nextepisode: NextEpisode;
}

export interface Page<T> {
  page: number;
  pages: number;
  posts: T[];
  cache?: boolean;
  cache_key?: string;
}
