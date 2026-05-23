import type { ApiClient } from "../client.ts";
import type { Page, Title, ArchiveSlug } from "../types.ts";

export type ArchiveOrderBy =
  | "relevant"
  | "update"
  | "year"
  | "favorite"
  | "imdb-rate"
  | "30nama-rate";

export type ArchiveOrder = "ASC" | "DESC";

/**
 * Paginated browsing by category + (optional) genre. `slugs` is a small array
 * of slug strings — typically `[category]` or `[category, genre]`. The order
 * within the array matters (category first).
 */
export function getArchive(
  client: ApiClient,
  slugs: string[],
  page = 1,
  streamonly = false,
  orderby: ArchiveOrderBy = "relevant",
  order: ArchiveOrder = "DESC",
): Promise<Page<Title>> {
  return client.call<Page<Title>>("archive", {
    slugs: slugs.join(","),
    streamonly,
    page,
    orderby,
    order,
  });
}

export interface MenuData {
  genres: ArchiveSlug[];
  categories: ArchiveSlug[];
}

/** Top-level menu lists (genres + categories) used for nav rendering. */
export function getMenu(client: ApiClient): Promise<MenuData> {
  return client.call<MenuData>("menu");
}
