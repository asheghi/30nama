# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **reverse-engineered third-party client** for 30nama.com (a Persian/Iranian video streaming service the maintainer pays for). It scrapes direct `.mkv`/`.mp4` URLs from the same internal API the official site uses. None of the endpoints are documented or stable — they can break any time the site updates. Treat every new behavior as a fresh capture from the user's browser DevTools, not as something to invent.

## Layout

pnpm workspaces + Turbo monorepo. Three packages:

- `packages/api` (`@30nama/api`) — storage-agnostic API client + endpoint functions. Consumed by everything else.
- `apps/cli` (`@30nama/cli`) — Node/TS CLI. Uses Playwright (headed) for the login-once flow because reCAPTCHA can't be solved headlessly. Token saved to `~/.config/30nama/session.json` (mode 0600).
- `apps/web` (`@30nama/web`) — TanStack Start (file-based routing, Vite 8, React 19) + Tailwind v4 + shadcn/ui. Token lives in `localStorage` under key `30nama:token`.

Future clients (desktop, mobile) are expected to also consume `packages/api`.

## Commands

```bash
pnpm install                              # install everything; turbo + builds run on demand
pnpm cli -- login                         # interactive Playwright login (CLI)
pnpm cli -- downloads <urlOrId>           # print direct .mkv URLs
pnpm --filter @30nama/web dev             # web dev server (default port 3000)
pnpm --filter @30nama/web typecheck       # tsc --noEmit for the web app
pnpm typecheck                            # turbo: typecheck every workspace
```

There's no shared test runner yet. The web app inherits `vitest` from the TanStack scaffold but has no tests.

The CLI's interactive login requires `npx playwright install chromium` to have been run at least once.

## Architecture, the parts that aren't obvious from a single file

### API client (`packages/api/src/client.ts`)

Single `ApiClient` class. All endpoints are plain functions that take a client as the first argument — this keeps the package storage-agnostic so Node (CLI) and the browser (web) can both consume it.

Two body shapes are supported and must be chosen correctly per endpoint:
- `formBody` → `application/x-www-form-urlencoded` (used by `loginV2`, `downloads`)
- `jsonBody` → `application/json` (used by `mainV2`, `single`, `list`)

The response envelope `{ success, msg, result }` is unwrapped automatically; `success: false` is thrown as an `ApiError` with the server's `msg`. Endpoint functions return the inner `result` directly.

### Auth model

Pure bearer token, no cookies. After `loginV2`, the server returns `result.usertoken` as a JSON field — there is no `Set-Cookie`. That token is sent back on every authenticated request as the `c-token` header (note the lowercase `c-` prefix; the API uses several `c-*` headers — `c-api-key`, `c-app-version`, `c-platform`, `c-useragent`, `c-token`). All of these except `c-token` are hardcoded static values in `packages/api/src/config.ts`.

The `c-api-key` value is not a secret — it's embedded in 30nama's public JS bundle. The repo can stay private but the key isn't sensitive.

### Login is captcha-gated

`/action/loginV2` requires a Google reCAPTCHA response, which can't be solved headlessly. The CLI handles this by launching a real Chromium window (`apps/cli/src/login-browser.ts`), letting the human sign in, intercepting the `loginV2` POST response, extracting `result.usertoken`, and closing the window. The web app has no login UI yet — first-load shows a paste-the-token prompt; long-term either it gets a similar flow or it embeds a reCAPTCHA component.

### Download URLs

The `dl` field in a download response is a one-shot URL signed with the user's IP and an expiry timestamp baked into the path. They rotate per request — don't cache them, and don't ship them anywhere else.

### Endpoints discovered so far

| Function | Path | Body | Notes |
|---|---|---|---|
| `login` | POST `/action/loginV2` | form | Returns `usertoken` |
| `getMainV2` | POST `/action/mainV2/` | `{}` | Home page sections (hero, top10, new_releases, suggested, movies, series, anime, news) |
| `getSingle` | POST `/action/single/id/{id}` | `{}` | Title detail metadata |
| `getDownloads` | POST `/action/download/id/{id}` | `freeDownload=false` | File list grouped by season + quality |
| `getList` | POST `/action/list/type/category/value/{cat}/page/{p}/orderby/{ob}/order/{o}/streamonly/{yes\|no}/genre/{g}` | `{}` | Paginated browse; params are URL **path segments**, not query string |

`stream_watched` (continue-watching) is captured but not wired up yet.

### Web routing (TanStack Start)

File-based routing in `apps/web/src/routes/`:
- `__root.tsx` — root layout (`<html>`, `<head>`, devtools)
- `index.tsx` — `/` (home, calls mainV2)
- `title.$id.tsx` — `/title/$id` (single + downloads)
- `category.$cat.tsx` — `/category/movie|series|anime` (list, with search params for genre/page/sort)

Search params for the category route are validated with `validateSearch` returning a `Partial<>` shape. This is deliberate: if it returned a fully-required type, every `<Link to="/category/$cat">` would have to pass all five params. Inside the component, fall back to defaults via `??` when reading them.

### Auth-guard pattern in routes

Routes that need a token use `beforeLoad` with a `typeof window !== "undefined"` check before reading localStorage, then `throw redirect({ to: "/" })`. The window check matters because the loader runs on the SSR server too, where localStorage doesn't exist.

### shadcn/ui setup

The shadcn `init` CLI kept hanging on interactive prompts even with `--yes` (TypeScript prompt, style prompt). The fix in `apps/web` was to hand-write `components.json`, `src/lib/utils.ts`, and the theme block in `src/styles.css`. Adding new components works fine after that:

```bash
pnpm dlx shadcn@latest add <name> --cwd apps/web --yes
```

### pnpm gotchas

1. `pnpm-workspace.yaml` has an `allowBuilds:` block listing `esbuild: true` and `lightningcss: true`. pnpm 11 won't run their postinstalls without this and dev/build will fail with cryptic errors.
2. pnpm's strict node_modules means transitive deps that *aren't* declared in peerDependencies don't get hoisted. `radix-ui` uses `tslib` but doesn't declare it — `tslib` is therefore a direct dep of `apps/web`. If you see "Failed to resolve import 'tslib'" or similar after adding shadcn components that pull in new Radix sub-packages, the fix is usually `pnpm --filter @30nama/web add <missing-dep>`.
3. If pnpm gets into a "Already up to date" state but symlinks are missing, the nuclear fix is `rm -rf node_modules apps/*/node_modules packages/*/node_modules pnpm-lock.yaml && pnpm install`. Don't reach for this without checking the workspace yaml first.

### Locale

UI is English-only by design. The API returns mostly Persian text — use `english_plot`/`title` fields, ignore `persian_*` ones. Don't add RTL support unless we explicitly switch direction; mixing LTR UI chrome with RTL content blocks is the current trade-off.

### When new endpoints surface

The pattern for adding one (the user typically pastes a `fetch(...)` and response from DevTools):

1. New file in `packages/api/src/endpoints/<name>.ts` — export typed `Result` interfaces and a function that takes `(client, ...args)` and calls `client.post`.
2. Re-export from `packages/api/src/index.ts`.
3. Wire into a route/component.

Reuse types from `packages/api/src/types.ts` where possible — `Post`, `Page<T>`, `Genre`, `PostImage` are shared across `mainV2`, `single`, `list`. New endpoints often return the same `Post` shape.
