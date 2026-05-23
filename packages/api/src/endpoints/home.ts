import type { ApiClient } from "../client.ts";
import type { Title } from "../types.ts";

export interface HomeNotes {
  title: string;
  features: string[];
}

export interface HomeData {
  hero_header: {
    posts: Title[];
    notes: HomeNotes;
  };
  new_releases?: { posts: Title[] };
  suggested?: { posts: Title[] };
  top_10?: { posts: Title[] };
  movies?: { posts: Title[] };
  series?: { posts: Title[] };
  anime?: { posts: Title[] };
}

/** Main home-page payload (replaces the legacy mainV2). */
export function getHome(client: ApiClient): Promise<HomeData> {
  return client.call<HomeData>("home");
}

/** Stream-only home variant (movies/series/anime that are streamable). */
export function getHomeStream(client: ApiClient): Promise<HomeData> {
  return client.call<HomeData>("home_stream");
}
