---
kind: error_handling
name: Express Route-Level try/catch + Frontend Promise Rejection with Fallback Chains
category: error_handling
scope:
    - '**'
source_files:
    - server.js
    - src/mockData.js
    - src/features/movie/api/movieApi.js
    - src/runtimeConfig.js
    - api/index.js
    - public/sw.js
---

## What system/approach is used

The codebase uses a **simple, ad-hoc error-handling pattern** rather than a centralized framework. There are no custom `Error` subclasses, no global Express error middleware (`app.use((err, req, res, next) => ...)`), and no structured error codes. Errors are handled in two layers:

1. **Backend (Node/Express)** — each route handler wraps its body in a `try/catch`, logs the error via `console.error` / `console.warn` with a tagged prefix (e.g. `[M3U8-PROXY]`, `[TS-PROXY]`, `[JIKAN]`, `[ANIMERULZ]`), then returns an HTTP response directly: `res.status(502).send(err.message)`, `res.status(502).json({ error, message })`, or `res.status(400).send('Missing url')`. Validation failures return `400`; upstream proxy/streaming failures return `502`; missing data returns `404`.
2. **Frontend (React/Vite)** — API modules use `fetch` and check `response.ok`; on failure they either throw a plain `new Error('Failed to fetch ...')` (e.g. `movieApi.js`) or swallow the error and return a sentinel value (empty array, empty object, or `{ provider: 'unavailable', sources: [], subtitles: [], error: '...' }`). The dominant pattern is **graceful degradation**: catch per-call, log with `console.warn`, and return a safe default so the UI keeps rendering.

There is no `throw new Error(...)` propagation across the stack on the backend; errors are caught at the route boundary and converted to HTTP responses immediately. On the frontend, `Promise.reject` from `fetch` is caught inside each API function and turned into a fallback result.

## Key files and packages

- **`server.js`** — the single Express application containing every route and helper. All error handling lives here: image proxy, subtitle proxy, M3U8/HLS manifest proxy, TS segment proxy, Jikan episode proxy, AnimeRulz/AnimeKai/HiAnime watch routes, health endpoint, etc.
- **`src/mockData.js`** — the main frontend API layer for anime/manga content. Implements multi-tier fallback chains (backend proxy → direct AniList GraphQL → local dev proxy) and swallows errors at each tier.
- **`src/features/movie/api/movieApi.js`** — the only module that explicitly throws `new Error(...)` on non-OK responses; other feature APIs follow the swallow-and-return-default pattern.
- **`src/runtimeConfig.js`** — runtime configuration loader that catches config-fetch failures and falls back to environment variables or a hard-coded Cloudflare tunnel URL.
- **`api/index.js`** — re-exports the Express app for Vercel serverless; no error handling of its own.
- **`public/sw.js`** — service worker that silently `.catch()`s cache operations.

## Architecture and conventions

### Backend (Express)

- **Per-route try/catch blocks** are the universal pattern. Every network call (Axios requests to upstream providers like HiAnime, AnimeKai, StreamIndia, Jikan, TMDB) is wrapped in `try/catch`. Errors are logged with a bracketed tag identifying the subsystem, e.g. `console.error('[M3U8-PROXY] Error:', err.message)`.
- **HTTP status mapping is manual and route-specific**: validation errors → `400`; upstream proxy failures → `502`; not-found cases (e.g. 404 from AnimeRulz catalog) are treated as "not an error" and return `null`/`[]`.
- **Retry/recovery logic is embedded inline**, not in a middleware. For example, `fetchStreamProxyTarget` retries multiple referer candidates and only re-throws after exhausting them, tracking `lastError` to propagate the final failure.
- **No global error handler exists.** If a route throws without a `try/catch`, Express will crash the process. This is a risk surface in this architecture.
- **CORS and trust-proxy** are configured globally but there is no central logging/error formatter.

### Frontend (React/Vite)

- **Swallow-and-fallback is the norm**. Almost every async API method catches errors and returns a safe default: empty arrays for lists, empty objects for details, `{ provider: 'unavailable', ... }` for streaming resolution. This keeps the UI resilient when any single upstream fails.
- **Multi-tier fallback chains** are built into callers. `fetchAniList` tries: Express backend proxy → direct AniList GraphQL → local dev `/anilist-proxy`. Each tier is independently `try/catch`'d.
- **Structured error objects** are returned by `getEpisodeSources` for the player: `{ provider, sources, subtitles, error }` so the UI can display a user-friendly message instead of crashing.
- **Runtime config loading** is designed to never fail the app startup: if `/api/runtime-config` or `/eetnet-config.json` fail, it falls through to build-time env vars, then to a hardcoded Cloudflare tunnel URL, then to localhost detection.

## Conventions and constraints

- **Tagged console logging** is the de facto error-tracking mechanism. Every error path prefixes logs with a subsystem tag (`[IMAGE PROXY WARNING]`, `[SUBTITLE-PROXY]`, `[M3U8-PROXY]`, `[TS-PROXY]`, `[EXTRACT]`, `[ANIMEKAI]`, `[JIKAN]`, `[ANIMERULZ]`, `[API]`, `[Config]`). No structured logger (pino, winston, etc.) is used.
- **Validation errors return 400 with a short string body** (e.g. `'Missing url'`); business errors return JSON with `{ error, message }`; transport/network errors return `502` with the raw Axios error message.
- **Upstream provider failures are treated as recoverable** — the code frequently retries with different referers, different providers (HiAnime → AnimeKai → AnimeUnity), or falls back to cached/local data. A failed upstream does not bubble up as a thrown exception to the caller.
- **No `throw` propagation across module boundaries on the backend** — all Axios calls are caught inside their route/helper scope. The only `throw` on the backend is in `archive_movies_netmirror/server_netmirror_movies_routes.js` where a missing cookie triggers `throw new Error('No t_hash_t cookie returned')`, which is then caught by the caller.
- **Frontend API modules do not share a base class or interceptor** — each file implements its own `fetch` + `try/catch` pattern. `movieApi.js` is the outlier that throws on non-OK responses; most others swallow and return defaults.
- **Service workers and static assets** use silent `.catch(() => {})` patterns, indicating that transient fetch/cache failures are considered acceptable noise.