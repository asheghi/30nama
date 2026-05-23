import { QueryClient, type Query } from "@tanstack/react-query";
import { PERSISTED_KEY_PREFIXES } from "./query-keys";

export const QUERY_CACHE_STORAGE_KEY = "30nama:query-cache";

/**
 * Factory for a fresh QueryClient. Always call this inside `getRouter()` so
 * each SSR request gets its own client and there's no leakage between
 * requests. On the browser, `getRouter()` runs once at hydration so we
 * naturally end up with a single shared client.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Per-endpoint staleTime overrides happen at the useQuery call site;
        // this is just the fallback when a query doesn't specify one.
        staleTime: 5 * 60 * 1000, // 5 min
        gcTime: 30 * 60 * 1000, // 30 min
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

/**
 * Allowlist filter for persistence: only home + single payloads get written
 * to localStorage. Download URLs are signed/IP-bound and must never be
 * cached. Archive/search/user are cheap to re-fetch and not worth the
 * staleness risk.
 *
 * Exported so both the persister setup and the ssr-query `dehydrateOptions`
 * can share the same predicate.
 */
export function shouldDehydrateQuery(query: Query): boolean {
  const head = query.queryKey[0];
  if (typeof head !== "string") return false;
  return PERSISTED_KEY_PREFIXES.has(head);
}
