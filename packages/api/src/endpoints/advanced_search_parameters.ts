import type { ApiClient } from "../client.ts";
import type { Genre } from "../types.ts";

// API spells the path "parametres" (sic) — we expose it as "Parameters" in JS.
// Response shape is best-effort: 30nama returns ~18KB of filter options used to
// populate the advanced-search UI. Tighten once a real response is captured.
export interface AdvancedSearchParameters {
  genre?: Genre[];
  country?: Array<{ name: string; slug: string }>;
  year?: Array<{ name: string; slug: string }> | string[];
  language?: Array<{ name: string; slug: string }>;
  imdb_score?: Array<{ name: string; slug: string }>;
  [key: string]: unknown;
}

export function getAdvancedSearchParameters(
  client: ApiClient,
): Promise<AdvancedSearchParameters> {
  return client.post<AdvancedSearchParameters>(
    "/action/advanced_search_parametres",
    { jsonBody: {} },
  );
}
