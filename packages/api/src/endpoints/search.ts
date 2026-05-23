import type { ApiClient } from "../client.ts";
import type { Page, Post } from "../types.ts";

export type FullSearchType = "all" | "movie" | "series" | "anime";
export type FullSearchOrderBy =
  | "relevant"
  | "date"
  | "imdb_score"
  | "30nama_score";
export type SearchOrder = "asc" | "desc";

export interface FullSearchParams {
  query: string;
  type?: FullSearchType;
  orderBy?: FullSearchOrderBy;
  order?: SearchOrder;
  page?: number;
}

export type SearchResult = Page<Post>;

export function fullSearch(
  client: ApiClient,
  params: FullSearchParams,
): Promise<SearchResult> {
  const {
    query,
    type = "all",
    orderBy = "relevant",
    order = "desc",
    page = 1,
  } = params;
  const path =
    `/action/full_search` +
    `/type/${type}` +
    `/orderby/${orderBy}` +
    `/order/${order}` +
    `/page/${page}`;
  return client.post<SearchResult>(path, { formBody: { query } });
}

// Separate endpoint from full_search — different path layout (page/order/orderby
// instead of type/orderby/order/page), different orderby values, and a trailing
// slash that the server appears to require. Used by the site's search box.
export type SearchOrderBy =
  | "favorite"
  | "id"
  | "imdb"
  | "user_rate"
  | "year"
  | "all";

export interface SearchParams {
  query: string;
  page?: number;
  order?: SearchOrder;
  orderBy?: SearchOrderBy;
}

export function search(
  client: ApiClient,
  params: SearchParams,
): Promise<SearchResult> {
  const { query, page = 1, order = "desc", orderBy = "favorite" } = params;
  const path =
    `/action/search` +
    `/page/${page}` +
    `/order/${order}` +
    `/orderby/${orderBy}/`;
  return client.post<SearchResult>(path, { formBody: { query } });
}
