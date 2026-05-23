# Client-side caching layer via TanStack Query

**Status:** done (merged into main)
**Created:** 2026-05-23
**Worktree:** /home/bahman/github/30nama/.claude/worktrees/agent-a5e221ffb5eaedda4 (branch: worktree-agent-a5e221ffb5eaedda4)
**Integration target:** main
**Owner:** orchestrator agent

## Goal

Wire TanStack Query into the web app so home/single/list/search/user calls are deduplicated, cached with per-endpoint TTLs, and (for home/single only) persisted to localStorage. Downloads remain uncached because the `dl` URLs are one-shot and IP/expiry-signed (per CLAUDE.md). Route loaders should prefetch via `@tanstack/react-router-ssr-query` so first paint has data.

## Context & constraints

- Monorepo: pnpm workspaces + Turbo. Web app at `apps/web` (TanStack Start + Vite 8 + React 19).
- API package `@30nama/api` is storage-agnostic; endpoint funcs take `(client, ...args)`. Web wraps it via `apps/web/src/lib/api.ts#createClient(token?)`.
- Network actually goes through a server function `callHanaApi` in `apps/web/src/server/hana-api.ts` (Cloudflare-bot-protection workaround). TanStack Query still adds value because (a) it dedupes/caches across components, (b) avoids round trips on navigation, (c) persists to localStorage.
- Token storage: `localStorage["30nama:token"]` via `getStoredToken()`/`setStoredToken()`. `SiteHeader` sign-out calls `setStoredToken(null)` then `window.location.assign("/")`.
- Routes (`apps/web/src/routes/`): `__root.tsx`, `index.tsx` (home), `title.$id.tsx` (single + download), `category.$cat.tsx` (archive list), `login.tsx` (QR-based, no useQuery target except maybe the user fetch — but login itself is a poll loop, not a cacheable read).
- Endpoints available in `@30nama/api`: `getHome`, `getSingle`, `getDownload`, `getArchive`, `search`, `advancedSearch`, `getUser`, `qrLoginCode`, `qrLoginLogin`, etc.
- Gate: `pnpm typecheck` (turbo across workspaces). No tests beyond an empty vitest scaffold.
- Auth-guard pattern: `typeof window !== "undefined"` before localStorage. Required for persister setup too (SSR runs in Node).
- pnpm strict node_modules: if a transitive complains, add it as a direct dep of `apps/web`.
- `@tanstack/react-query@5.100.11` is already present in pnpm store as a transitive of `@tanstack/react-router-ssr-query` — but we still need to add it as an explicit dep of `apps/web`. `@tanstack/query-sync-storage-persister` and `@tanstack/react-query-persist-client` are NOT installed; must add.
- Router is set up via `getRouter()` in `apps/web/src/router.tsx`. The ssr-query integration uses `setupRouterSsrQueryIntegration({ router, queryClient, dehydrateOptions })`. The QueryClient must be created per-request when on the server (don't share between requests) — typical pattern is to create it inside `getRouter()`.

## Tasks

- [x] T1 — Add deps to `apps/web`: `@tanstack/react-query`, `@tanstack/query-sync-storage-persister`, `@tanstack/react-query-persist-client`. Run `pnpm install`.
- [x] T2 — Create `apps/web/src/lib/query-client.ts` exporting a `makeQueryClient()` factory with the global defaults.
- [x] T3 — Create `apps/web/src/lib/query-keys.ts` central key registry.
- [x] T4 — Update `apps/web/src/router.tsx` to create a `QueryClient` per `getRouter()` call and wire ssr-query.
- [x] T5 — Browser-only persister bootstrap inside `getRouter()` (dynamic import behind a `typeof window` guard).
- [x] T6 — Convert `routes/index.tsx` to `useQuery` + loader prefetch.
- [x] T7 — Convert `routes/title.$id.tsx`: single via useQuery (1h, persisted); download via useQuery with staleTime:0 gcTime:0; loader prefetches single only.
- [x] T8 — Convert `routes/category.$cat.tsx`: archive via useQuery (30s) + loader prefetch.
- [x] T9 — `routes/login.tsx`: initial `qrLoginCode` fetch via useQuery (staleTime:0, gcTime:0); poll loop kept as effect (not a cacheable read).
- [x] T10 — `SiteHeader` sign-out clears queryClient + removes `localStorage["30nama:query-cache"]`.
- [x] T11 — Gate passed: `pnpm --filter @30nama/web typecheck` and `pnpm typecheck` both clean.
- [x] T12 — Commit, merge into main, mark plan done.

## Decisions

<Append-only.>

- 2026-05-23 — Use `useQuery` with `staleTime: 0, gcTime: 0` for `getDownload` rather than dropping useQuery entirely. Reason: matches the brief's "all four routes use useQuery — no remaining useEffect+useState fetch patterns" while still guaranteeing fresh fetches. Persister allowlist excludes the `download` key by query-key name, so it's never written to localStorage even if the gcTime somehow leaks.
- 2026-05-23 — Login page keeps its imperative poll loop. QR polling is not a read-through cache concern, and `useQuery`'s refetch loop semantics don't fit a "wait until user confirms on phone" UX (no error → retry, no exponential backoff desired). The initial code fetch can be a `useQuery` if needed, but for now the existing useEffect is correct. Update: T9 converts the initial code fetch to `useQuery({staleTime:0, gcTime:0})` to satisfy the "no useEffect+useState fetch patterns" criterion; the poll itself stays imperative inside an effect that triggers off the query data.
- 2026-05-23 — Create the QueryClient inside `getRouter()` so each SSR request gets its own client (avoids cross-request leakage). On the browser, `getRouter()` is called once at hydration so we naturally get a single client there. The persister attaches only on the browser path.
- 2026-05-23 — Query key shape: `["home"]`, `["single", id]`, `["archive", cat, genre, page, orderBy, order, streamOnly]`, `["search", q, page]`, `["user"]`, `["download", id]`. Persister `shouldDehydrateQuery` allowlists `key[0] === "home" || key[0] === "single"`.

## Open questions (resolved internally)

- "Login token entry" in the acceptance criteria — the current login flow is QR-based (no token entry box anymore; see `routes/login.tsx`). The brief is slightly stale relative to the current code. Resolution: treat `login.tsx` as the route that fits the spirit of "login token entry" and convert the initial `qrLoginCode` fetch to `useQuery` with no caching. Document this in Decisions.
- Where should the `queryClient` reference come from in `SiteHeader`? It's a child of routes, so `useQueryClient()` from `@tanstack/react-query` is the cleanest path (works once `QueryClientProvider` is in scope — set up by `setupRouterSsrQueryIntegration` automatically when `wrapQueryClient !== false`).

## Log

- 2026-05-23 — Plan created. Intake confirmed: integration target `main`, gate `pnpm typecheck`, web app uses pnpm strict workspaces, ssr-query is already a dep but react-query/persister packages need to be added (or made explicit) for `apps/web`.
- 2026-05-23 — T1 installed `@tanstack/react-query@5.100.11`, `@tanstack/query-sync-storage-persister@5.100.11`, `@tanstack/react-query-persist-client@5.100.11` as direct deps of `apps/web`.
- 2026-05-23 — T2/T3 added `apps/web/src/lib/query-client.ts` and `apps/web/src/lib/query-keys.ts`. Persister allowlist works off `key[0]` membership in `PERSISTED_KEY_PREFIXES`.
- 2026-05-23 — T4/T5 rewrote `apps/web/src/router.tsx`: per-call QueryClient, `setupRouterSsrQueryIntegration` with the shared `shouldDehydrateQuery` filter, and a browser-only `bootstrapPersister` (dynamic import behind `typeof window !== 'undefined'`). Persister `maxAge` set to 24h, comfortably above the longest persisted staleTime (1h for `single`). `__root.tsx` switched to `createRootRouteWithContext<RouterContext>()` so loaders see `context.queryClient` with the right type.
- 2026-05-23 — T6 home route: useQuery + loader prefetch (10min staleTime, persisted). Sign-out side-effects moved fully into SiteHeader so the home component just resets its local `token` state.
- 2026-05-23 — T7 title route: split into two queries — `single` (1h, persisted, prefetched in loader) and `download` (staleTime:0, gcTime:0, retry:false, not prefetched, allowlist-excluded from persistence).
- 2026-05-23 — T8 category route: useQuery + loader prefetch (30s staleTime, not persisted). Added `placeholderData: prev => prev` so pagination doesn't flash empty state. `loaderDeps` derives from search params so loader re-runs on filter/page changes.
- 2026-05-23 — T9 login route: `qrLoginCode` via useQuery with no caching; `refreshTick` state forces a fresh key on user-driven retry. Poll loop for `qrLoginLogin` kept as effect (state-transition trigger, not a cacheable read).
- 2026-05-23 — T10 SiteHeader: `useQueryClient()` + `queryClient.clear()` + `localStorage.removeItem("30nama:query-cache")` on sign-out. The hook works because `setupRouterSsrQueryIntegration` auto-wraps the router with `QueryClientProvider`.
- 2026-05-23 — T11 gate: `pnpm --filter @30nama/web typecheck` and `pnpm typecheck` both pass clean. One stray-import warning fixed during the run.
