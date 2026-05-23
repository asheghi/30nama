import type { ApiClient } from "../client.ts";
import type { Page, Title } from "../types.ts";

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
