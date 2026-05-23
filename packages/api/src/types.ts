// Shared types derived from the hana-api response shapes (matches the
// official 30nama-sdk's `dist/entities/*` definitions).

export type TitleType = "series" | "movie" | "anime";

export interface Genre {
  name: string;
  slug: string;
}

export interface PosterImages {
  preview: string;
  webp: { small: string; medium: string; large: string; big: string };
  jpg: { small: string; medium: string; large: string; big: string };
}

export interface CoverImages {
  webp: string;
  jpg: string;
}

export interface TitleImage {
  poster: PosterImages;
  cover?: CoverImages;
}

export interface Title {
  id: number;
  post_type: "title";
  options: {
    title_type: TitleType;
    stream: boolean;
    is_series: boolean;
    persian_subtitle: boolean;
    exclusive_subtitle: boolean;
    coming_soon: boolean;
    free_download: boolean;
    free_stream: boolean;
  };
  info: {
    seasons: number;
    year: number;
    year_end?: number;
    budget?: string;
    age: string;
    time: {
      default: number;
      others?: { name: string; time: number };
    };
  };
  title: { english: string; local?: string };
  plot: { english: string; local: string };
  image: TitleImage;
  genre: Genre[];
  score?: {
    "30nama"?: { score: number; votes: number; top_100?: string };
    imdb?: {
      link: string;
      score: number;
      votes: number;
      top_250?: string;
    };
    rottentomatoes?: { link: string; score: number };
    metacritic?: { link: string; score: number };
    mydramalist?: { link: string; score: number; votes: number };
    myanimelist?: { link: string; score: number; votes: number };
  };
  air: {
    air_status: string;
    air_data?: string;
    next_episode_caption: string;
    next_episode_date: { g: string; j: string };
  };
  seo?: Record<string, unknown>;
}

export interface ArchiveSlug {
  id: number;
  name: string;
  slug: string;
  count: number;
  image: {
    webp: { thumb: string; full: string };
    jpg: { thumb: string; full: string };
  };
}

export interface Page<T> {
  posts: T[];
  page: number;
  pages: number;
  total: number;
}
