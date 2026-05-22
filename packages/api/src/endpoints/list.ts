import type { ApiClient } from "../client.ts";
import type { Page, Post } from "../types.ts";

export type ListCategory = "movie" | "series" | "anime";
export type ListOrderBy = "id" | "date" | "imdb_score" | "30nama_score";
export type ListOrder = "asc" | "desc";

export interface ListParams {
  category: ListCategory;
  page?: number;
  orderBy?: ListOrderBy;
  order?: ListOrder;
  streamOnly?: boolean;
  genre?: string;
}

export type ListResult = Page<Post> & { seo?: Record<string, unknown> };

export function getList(
  client: ApiClient,
  params: ListParams,
): Promise<ListResult> {
  const {
    category,
    page = 1,
    orderBy = "date",
    order = "desc",
    streamOnly = false,
    genre = "all",
  } = params;
  const path =
    `/action/list` +
    `/type/category` +
    `/value/${category}` +
    `/page/${page}` +
    `/orderby/${orderBy}` +
    `/order/${order}` +
    `/streamonly/${streamOnly ? "yes" : "no"}` +
    `/genre/${genre}`;
  return client.post<ListResult>(path, { jsonBody: {} });
}
