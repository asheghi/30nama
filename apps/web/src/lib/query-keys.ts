/**
 * Central registry of TanStack Query keys.
 *
 * Keep the first segment of each key a stable string that identifies the
 * endpoint — the persister allowlist in `query-client.ts` filters by
 * `key[0]`, so changing the first segment will silently break persistence.
 *
 * Persisted to localStorage: `home`, `single`.
 * Not persisted: `archive`, `search`, `user`, `download`.
 * Never cached at all (staleTime:0/gcTime:0 at the useQuery call): `download`.
 */

import type { ArchiveOrder, ArchiveOrderBy } from "@30nama/api";

export const PERSISTED_KEY_PREFIXES = new Set<string>(["home", "single"]);

export const queryKeys = {
  home: () => ["home"] as const,
  single: (id: string) => ["single", id] as const,
  download: (id: string) => ["download", id] as const,
  archive: (
    cat: string,
    genre: string,
    page: number,
    orderBy: ArchiveOrderBy,
    order: ArchiveOrder,
    streamOnly: boolean,
  ) =>
    [
      "archive",
      cat,
      genre,
      page,
      orderBy,
      order,
      streamOnly,
    ] as const,
  search: (query: string, page: number) =>
    ["search", query, page] as const,
  user: () => ["user"] as const,
  qrLoginCode: () => ["qrLoginCode"] as const,
};
