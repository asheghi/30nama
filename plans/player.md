# Player route — Apple TV+-style HLS streaming

**Status:** done (merged into main)
**Created:** 2026-05-23
**Worktree:** /home/bahman/github/30nama/.claude/worktrees/agent-af679b660547018f2 (branch: worktree-agent-af679b660547018f2)
**Integration target:** main
**Owner:** orchestrator agent

## Goal

Add `/play/$id` route backed by `POST /action/stream/id/{id}`. Series get a full-screen Apple TV+-style player with episode picker below; movies go straight to playback. Render the Watch button on `title.$id.tsx` only when HLS streams are actually available. Acceptance: hls.js playback, controls overlay (play/pause/seek/volume/fullscreen), quality + audio picker, Skip Intro / Next Episode buttons, FA/EN/Off subtitles (SRT→VTT), resume from `watched.time`, observer pings every 30 s + on pause/unload, `pnpm typecheck` clean.

## Context & constraints

- Stack: pnpm workspaces + Turbo monorepo. Three packages — `packages/api`, `apps/cli`, `apps/web`.
- Web app: TanStack Start (file-based routing in `apps/web/src/routes/`), React 19, Tailwind v4, shadcn/ui.
- Browser must NOT call hana-api directly (Cloudflare bot challenge on cross-origin preflight). All API traffic from the browser goes through the `callHanaApi` server function in `apps/web/src/server/hana-api.ts`, which `apps/web/src/lib/api.ts` wires up via `createRpcTransport`. Calling `getStream(createClient(), id)` from a component just works — the transport already proxies through.
- Endpoint pattern (per CLAUDE.md): new file under `packages/api/src/endpoints/`, re-exported from `packages/api/src/index.ts`. Endpoint functions take `(client, ...args)` and call `client.call(action, body)`.
- Auth-guard pattern: `beforeLoad` with `typeof window !== "undefined"` then `getStoredToken()` and `throw redirect({ to: "/login" })`.
- Token in `localStorage` under `30nama:token`.
- Brand: UI is Potato+ (English). Persian titles allowed for episode names since the API returns Persian.
- Gate: `pnpm typecheck` (turbo runs each workspace's `tsc --noEmit`).
- Stream URLs are IP-signed and short-TTL → `staleTime: 0, gcTime: 0` (same pattern already used for `download` in `title.$id.tsx`).
- Observer endpoint is on the SAME hana-api host (`/observer/observer`, not under `/action/`). The existing `ApiClient` only handles `action/{name}` paths, so observer ping needs its own thin server function (separate from `callHanaApi`).
- `user_id` for observer pings is parseable from the CDN URL: `https://{cdn}/stream/1/6/{user_id}/{fid}/...` — segment index 5 in the path.

## Tasks

- [x] T1 — Add `getStream` endpoint + types to `packages/api/src/endpoints/stream.ts`, re-export from index.
- [x] T2 — Add `hls.js` to `apps/web`.
- [x] T3 — Add `pingObserver` server function in `apps/web/src/server/observer.ts` (separate from `callHanaApi` because path differs).
- [x] T4 — Add stream query key + helpers (`apps/web/src/lib/query-keys.ts`).
- [x] T5 — Create `<HlsPlayer>` component at `apps/web/src/components/HlsPlayer.tsx` — manages Hls instance lifecycle, Apple TV+-style overlay controls, quality/audio/subtitle pickers, skip-intro / next-episode buttons, observer pings, resume.
- [x] T6 — Add SRT→VTT util at `apps/web/src/lib/srt.ts`.
- [x] T7 — Create `apps/web/src/routes/play.$id.tsx` route: auth-guard, fetch stream, render player + (series) episode picker.
- [x] T8 — Show Watch button on `title.$id.tsx` only when stream list is non-empty (prefetch stream in loader, or check after fetch).
- [x] T9 — Gate: `pnpm typecheck` clean.
- [x] T10 — Commit on worktree branch, merge into main.

## Decisions

- 2026-05-23 — Observer endpoint not co-located under `/action/`. Decided to keep `ApiClient` action-only and add a tiny separate `pingObserver` server function rather than generalising the client. Smaller surface area, no risk to existing endpoints.
- 2026-05-23 — `user_id` for observer pings: parse from `file.url` path segment (index 5 after `stream/1/6/`). Avoids adding a `getUser` call dependency and the value is right there in the data we already have.
- 2026-05-23 — Watch button gating: cheapest correct check is to call `getStream` in the title page loader and look at `Object.values(list).flat().length > 0`. This adds one extra request per title page load, but the cache is `staleTime:0` so it's always fresh and tiny. Avoids the alternative of trying to infer streamability from `single` (which has `options.is_stream`-ish flags but they aren't always accurate per HAR).
- 2026-05-23 — Apple TV+ styling: dark translucent overlay (`bg-black/40`), large center play/pause button on hover, bottom control bar with seek scrubber + chapter-like progress, top-right settings popovers for quality/audio/subtitles. Skip Intro and Next Episode appear bottom-right as pill buttons.
- 2026-05-23 — Quality/audio preferences: stored in `sessionStorage` under `30nama:playerPrefs` as JSON `{ quality: string, channel: "auto"|"6ch"|"2ch", subtitle: "fa"|"en"|"off" }`. Not persisted across browser sessions per brief.
- 2026-05-23 — Resume logic: on episode change, if `watched.season === episode.season && watched.episode === episode.episode`, seek to `parseFloat(watched.time)` once. Don't auto-resume on subsequent episodes — they start at 0.

## Open questions (resolved internally)

- **Movies and `getStream`?** — Per the brief, movies go "straight to playback". The `list` map is keyed by season string; assume a movie returns a single key (e.g. `"0"` or `"1"`) with one entry. Render path: if `Object.keys(list).length <= 1 && episodes.length === 1` treat as movie (no episode picker). Otherwise series.
- **Combined episodes (`episode: "17,18"`)** — Display as `E17–18` in the picker. No special playback handling; treat as one entry.
- **Subtitle CORS** — `subtitle.30nama.com` may or may not allow cross-origin XHR from our domain. The brief says fetch as blob + convert SRT→VTT. If CORS blocks the fetch from the browser, we'll proxy via a thin server function. Try direct fetch first to keep it simple; fall back to a `fetchSubtitle` server fn if observed to fail. Logged as a follow-up.

## Log

- 2026-05-23 — Plan created.
- 2026-05-23 — T1: `getStream` endpoint added; uses path-segment action `stream/id/{id}` like `fullSearch`. Also exported `curlPost` from `@30nama/api` so the observer server function can reuse it.
- 2026-05-23 — T2: `hls.js@^1.6.16` added to `apps/web`.
- 2026-05-23 — T3: `pingObserver` server function (`apps/web/src/server/observer.ts`) hits `/observer/observer` on interface.30nama.com with the c-* header stack + `c-output-requests: true`. Returns `{ok, status}`; swallows errors so player UX is unaffected.
- 2026-05-23 — T4: `queryKeys.stream(id)` added.
- 2026-05-23 — T5+T6: `HlsPlayer` + `srtToVtt` shipped. Player: hls.js lifecycle (also handles Safari native HLS path); top-right Settings/Subtitles popovers; bottom scrubber + volume + play/pause + next + fullscreen; Skip Intro pill between `intro_start..intro_end`; Next Episode pill once past `options.end`; subtitles via `<track>` from a VTT Blob URL; observer pings on mount, every 30s while playing, on pause, on `beforeunload`, on unmount; prefs in `sessionStorage`.
- 2026-05-23 — T7: `/play/$id` route with auth-guard, season tabs + episode grid, default-to-watched selection, resume only when active episode matches `watched.season/episode`.
- 2026-05-23 — T8: Watch button on title page gated on `streamQuery.data` having at least one episode in any season key. Stream query uses `staleTime:0 gcTime:0` like downloads — same IP-signed/short-lived URL concern.
- 2026-05-23 — Gate: `pnpm typecheck` (all 3 workspaces) and `pnpm --filter @30nama/web build` both green. Build emits `play._id-*.js` chunks.
