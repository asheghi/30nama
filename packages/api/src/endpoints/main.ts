import type { ApiClient } from "../client.ts";
import type { Page, Post } from "../types.ts";

export interface NewsPost {
  id: number;
  title: string;
  poster: { large: string; thumbnail: string };
  image: {
    full: string;
    full_webp: string;
    thumb: string;
    thumb_webp: string;
  };
  comments: number;
  length: number;
  description: string;
  date: string;
}

export interface HeroSection extends Page<Post> {
  notes: {
    title: string;
    features: string[];
  };
}

export interface MainV2Result {
  featured: unknown | null;
  hero_section: HeroSection;
  new_releases: Page<Post>;
  suggested: Page<Post>;
  top: Post;
  movies: Page<Post>;
  series: Page<Post>;
  anime: Page<Post>;
  top10: Post[];
  top10_cache: boolean;
  top10_cache_key: string;
  news: Page<NewsPost>;
  review: Page<NewsPost>;
  seo: Record<string, unknown>;
}

export function getMainV2(client: ApiClient): Promise<MainV2Result> {
  return client.post<MainV2Result>("/action/mainV2/", { jsonBody: {} });
}
