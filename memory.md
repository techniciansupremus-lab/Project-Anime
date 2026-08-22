# EetNet — Codebase Memory (Project Anime)

> Single source of truth for the entire codebase. Last rebuilt by reading every core file
> (README, package.json, all 4 services, compile_monolith.js, runtimeConfig.js, proxy.py,
> Android app, repowiki docs, architecture briefs). Update this file whenever the architecture shifts.

---

## 1. What this project is

**EetNet** (folder name: `Project Anime`) is a Netflix-style streaming aggregator for
**anime, Asian dramas, manga/manhwa/webtoons, movies, and Hindi/Indian dubs**.

- **Frontend:** React 19 + Vite (SPA / PWA). Deploys to **Vercel**.
- **Backend:** Node.js / Express scraper + stream proxy.
- **Runtime model (KEY):** the backend is **NOT** a cloud server. It runs on a
  **second Android phone via Termux** ("Mike"), exposed to the internet through a
  **Cloudflare Tunnel (trycloudflare.com) or ngrok**, and consumed by the Vercel frontend.
- **Mobile app:** Same Vite build wrapped in **Capacitor** → native Android APK
  (`com.eetnet.app`).
- **Optional auth/sync:** **Supabase** (watch history, watchlist, login) — fully optional,
  falls back to local storage when creds are absent.

Brand/naming: the README calls the product "AniStream"; the code/branding is "EetNet".
Both refer to the same project.

---

## 2. Deployment Topology (how it actually runs)

```
 Browser / Capacitor WebView (Vercel or APK)
        │  GET /api/... (via apiUrl() base resolved at runtime)
        ▼
 Public tunnel URL  ──►  Phone (Termux) on a RESIDENTIAL IP
        │                ├─ node "the compilation/server.js"   (PORT 8080)
        │                ├─ proxy.py  (optional KissKH relay)   (PROXY_PORT 9090)
        │                └─ cloudflared / ngrok  (the public tunnel)
        ▼
 Content providers (HiAnime, AnimeKai, AnimeRulz/StreamIndia, KissKH, ComicK,
                     TMDB, DesiCinemas, MoviePlex, NetMirror, etc.)
```

### Critical operational rules (from README)
- **`node server.js` (API) = PORT 8080. `proxy.py` (KissKH relay) = PROXY_PORT 9090.**
  They MUST NOT share a port. If the relay grabs 8080, the tunnel serves KissKH HTML
  instead of the API (e.g. `/api/search` returns the KissKH homepage).
- The phone is on a **residential IP**, so most providers (KissKH, etc.) can be hit
  **directly**. `proxy.py` is only needed if a provider starts blocking the phone IP.
- `KISSKH_BASE` defaults to `https://kisskh.co`; override to `http://localhost:9090`
  only when the relay is needed.
- **Vite inlines `VITE_API_BASE` at build time.** A free ngrok URL rotates on every
  restart, so the frontend must be redeployed — OR use a stable named Cloudflare Tunnel.
  The app mitigates this with runtime config (see §5).
- Tunnel provider note: Cloudflare-edge challenges can 403 datacenter (Vercel) IPs.
  Named Cloudflare Tunnel with Bot Fight Mode off is the recommended stable option.

---

## 3. Backend — Monolith Compiler Pattern (the "JS makes a monolithic JSON" the user described)

The backend is authored as **4 separate, readable service modules**, then compiled into
ONE monolithic server file that actually runs.

| Source module | Compiled into | Domain |
|---|---|---|
| `services/anime/server.js` | `the compilation/server.js` | Anime (EN/JP/Hindi/Tamil/Telugu dubs) + AniList + HiAnime + AnimeKai + AnimeRulz |
| `services/drama/server.js` | (same file) | Asian dramas via KissKH |
| `services/comics/server.js` | (same file) | Manga / Manhwa / Manhua / Webtoons via ComicK + AniList + Hivetoons |
| `services/movies/server.js` | (same file) | Movies/Series via MoviePlex → **now migrated to DesiCinemas** + NetMirror + TMDB + OMDb |

### Compilation
- Script: `scripts/compile_monolith.js` (`npm run build:server`).
- Reads `services/{name}/server.js` for `name` in `['anime','drama','comics','movies']`.
- Strips boilerplate from each child module (imports, `express()` app creation, `PORT`,
  cors/json middleware, `publicHost`/`safeOrigin`/`streamProxyHeaders` helpers, `app.listen`)
  and concatenates the route handlers under a shared header/footer.
- Writes `the compilation/server.js` and runs `node --check` to validate syntax.
- **Header provides the shared libs + helpers once:** express, cors, axios, cheerio,
  https, crypto, vm, `@consumet/extensions`; `NODE_TLS_REJECT_UNAUTHORIZED='0'`,
  `httpsAgent`, `publicHost(req)`, `safeOrigin(value)`, `streamProxyHeaders(...)`,
  the `/api` URL normalizer, and `app.listen(PORT,'0.0.0.0')`.
- **Footer adds:** `/api/health` (uptime/services) and `/api/status` (provider probe),
  a global error handler, and `app.listen`.
- Run compiled output with `npm start` → `node "the compilation/server.js"`.

### The URL normalizer (important)
```
req.url: if not starting with /api/, prepend /api
```
So `/anime/...`, `/movies/...`, `/manga/...`, `/drama/...` all map to `/api/...`.

### Shared HLS / asset proxies (defined per-service but logically shared)
- `/api/m3u8-proxy?url=<...>&referer=<...>` — rewrites HLS manifests so segments route
  through the backend (avoids CORS/mixed-content). Public host derived from
  `X-Forwarded-*` headers so it stays `https` behind the tunnel.
- `/api/ts-proxy?url=<...>&referer=<...>` — pipes `.ts` segments with **HTTP Range** support.
- `/api/subtitle-proxy?url=<...>` — subtitle fetch/convert (drama converts SRT→VTT).
- `/api/img-proxy?url=<...>` — image proxy with CORS + Referer + 429 retry/backoff.

---

## 4. Backend Endpoints (compiled routes)

### ANIME (`services/anime/server.js`, ~1123 lines)
- `POST /api/anilist` — cached/rate-limited AniList GraphQL proxy.
- `GET  /api/info/:anilistId` — metadata + full episode list.
- `GET  /api/hianime/watch?anilistId=&episode=&dub=sub|eng` — primary stream (HiAnime via AniList ID).
- `GET  /api/gogoanime/watch?title=&episode=&season=&dub=` — AnimeKai fallback (EN sub/dub).
- `GET  /api/watch/:episodeId` — generic watch resolver.
- `GET  /api/search?q=` — AnimeKai title search.
- `GET  /api/animerulz/watch?anilistId=&episode=&lang=hin|tam|tel` — Hindi/Tamil/Telugu dubs.
- `GET  /api/animerulz/episodes?anilistId=` — available episodes.
- `GET  /api/animerulz/availability?anilistId=` — is Hindi dub present?
- `GET  /api/animerulz/catalog?language=&page=&limit=` — paginated Hindi catalog.
- `GET  /api/episodes/mal/:malId?page=` — Jikan/MAL episode titles (filler/recap).
- `GET  /api/m3u8-proxy`, `/api/ts-proxy`, `/api/subtitle-proxy`, `/api/img-proxy`.
- Providers: HiAnime (primary), AnimeKai (secondary), Consumet/AnimeUnity (fallback),
  AnimeRulz/StreamIndia (Indian dubs). AnimeRulz hosts via env: `ANIMERULZ_FALLBACK/DATA/
  ANIMELOK/EXTRACT/HIANIME` (defaults to `*.streamindia.co.in`).

### DRAMA (`services/drama/server.js`, ~410 lines) — KissKH
- `GET /api/drama/home` — curated sections (show, korean, chinese, topRating, lastUpdate).
- `GET /api/drama/list?type=&q=` — type 0=All,1=Chinese,2=Korean,3=Japanese,4=Thai.
- `GET /api/drama/search?q=`.
- `GET /api/drama/info/:dramaId` — details + episode list.
- `GET /api/drama/stream/:episodeId` — HLS streamUrl + subtitles.
- `GET /api/drama/subtitle?url=` — SRT→VTT converter/proxy.
- `GET /api/m3u8-proxy`, `/api/ts-proxy`.
- Stream resolution uses the **EncDec** resolver (`ENCDEC_BASE` default `https://enc-dec.app`).

### COMICS / MANGA / MANHWA / WEBTOON (`services/comics/server.js`, ~787 lines)
- `GET /api/manga/home` — bentoTop10 + manhwa/manga/manhua previews + trending/popular/topRated.
- `GET /api/manga/category/:type?genre=&page=&perPage=` — type: manga|manhwa|manhua.
- `GET /api/webtoon/home` — AniList webtoons grouped by weekday (MON…SUN, COMPLETED).
- `GET /api/manga/search?q=`.
- `GET /api/manga/info/:id` — `:id` = slug OR numeric AniList ID.
- `GET /api/manga/read/:chapterId` — page list (chapterId format `slug___hidxxx-chapter-n-en`).
- `GET /api/manhwa/chapter/:slug/:chapter`.
- `GET /api/manga/image-proxy` / `/api/img-proxy` → `handleImageProxy` (ComicK/MangaDex CDN,
  Referer + 429 exponential backoff).
- Providers: ComicKz, AniList GraphQL, Hivetoons.

### MOVIES (`services/movies/server.js`, ~1117 lines)
- `GET /api/movies/home` — featured + movieplex sections + TMDB poster enrichment.
- `GET /api/movieplex/catalog?page=&limit=&category=&search=&is18=` — category IDs
  (17=Hindi Dubbed, 10=Bollywood, 19=Hollywood, 33=Web Series, 21=Hot).
- `GET /api/movieplex/stream?slug=` — LuluStream/StreamTape HLS extractor, or `fallbackIframe`.
- `GET /api/movieplex/post-info`, `/api/movieplex/catalog/status`.
- `GET /api/netmirror/trending|search|post/:id|playlist/:id|stream-resolve` — OTT aggregator.
- `GET /api/m3u8-proxy`, `/api/ts-proxy`, `/api/img-proxy`.
- **CURRENT STATE:** Movies section migrated from MoviePlex → **DesiCinemas
  (`desicinemas.pk`)** (WordPress + Toroflix theme, TMDB posters, hosts: Morencius/VidHide
  & Vidmoly). See `MOVIES_SECTION_STATE.md` + `desimovies/RESEARCH_NOTES.md`.
- TMDB + OMDb used for poster/metadata enrichment.

---

## 5. Frontend — Runtime Config (the tunnel-URL problem solved)

`src/runtimeConfig.js` resolves the backend base URL **at runtime** (not build-time-only),
priority order:
1. `?apiBase=` query param (emergency override, session only, stripped from URL bar).
2. `GET /api/runtime-config` (Vercel serverless fn — always fresh, reads `API_BASE` env).
3. `/eetnet-config.json` (static fallback).
4. `VITE_API_BASE` (build-time; stripped if localhost on `*.vercel.app`).
5. localhost:8080 (local dev auto-detect).

- Capacitor native APK: if all empty → defaults to `FALLBACK_TUNNEL`
  (`https://nylon-overhead-sodium-warm.trycloudflare.com`), and ignores trycloudflare URLs
  when running as localhost PC dev.
- Result stored on `window.__EETNET_CONFIG__`; `apiUrl(path)` builds full URLs.
- `main.jsx` awaits `loadRuntimeConfig()` BEFORE mounting `<App/>`.

### Frontend structure
- `src/App.jsx` — **monolithic 166KB router/state controller** (hash-less pushState router,
  view switching for anime/drama/movies/manga/comics, Supabase auth, watch history).
- `src/App.tsx` + `src/main.tsx` — a **parallel TypeScript frontend** (newer, under
  `src/shared/*` and `src/features/*`). The JS `App.jsx` is the currently-built one; the TS
  tree is the in-progress migration (React components, `.tsx`, `src/shared/api/*.ts`,
  `src/shared/components/*`).
- `src/features/<domain>/{api,components}/` — per-content feature modules:
  - `anime/` (AnimeView, AnimeCard) + `anime/hindi/` (HindiView, HindiYTCard)
  - `drama/`, `manga/`, `manhwa/`, `movie/`
- `src/components/` — shared UI: `VideoPlayer.jsx` (40KB — HLS.js, quality/audio/subtitle,
  skip-intro/end, error recovery), `Navbar.jsx`, `Sidebar.jsx`, `SectionSlider.jsx`,
  `WebtoonComicView.jsx`, `WebtoonDetailView.jsx`, `AuthModal.jsx`, `YTPlaylistsComponents.jsx`.
- `src/pages/` (`anime`, `drama`, `movies`, `comics`, `home`) — older page-based layout
  (being superseded by `features/`).
- `src/utils/` — `storage.js` (Capacitor Prefs + localStorage), `nativeApp.js`,
  `sessionRestore.js`, `useDeviceType.js`, `cbf.js`.
- `src/supabaseClient.js` — Supabase client with Capacitor storage adapter; **mock no-op
  client** when creds missing (so app still runs fully local-only).

### Video playback
- `VideoPlayer.jsx` uses **HLS.js** for adaptive HLS; native HLS for iOS Safari.
- All playback goes through `/api/m3u8-proxy` + `/api/ts-proxy` so the browser only talks
  to the backend's public URL.

---

## 6. The "Headless Browser Worker" architecture (research brief)

`ARCHITECTURE_RESEARCH_BRIEF.txt` documents the chosen design for protected providers
(MoviePlex / LuluStream / tnmr.org / VidHide):

- Entities: **Me/Website** (Vercel frontend), **Backend** (Vercel serverless), **Mike**
  (the Termux phone, Samsung Exynos 7885, Android 9, screen-off 24/7, `termux-wake-lock`),
  **The Machine** (headless Chromium inside Termux), **Alex** (external provider).
- Flow: User clicks Play → Backend checks cache → if uncached, dispatches task to Mike over
  Cloudflare Tunnel → Mike's headless Chromium runs the provider's packed JS natively →
  Mike network-sniffs the emitted `*.m3u8`/`urlset` URL (The Package) → returns it → Backend
  caches (~8h) and pipes through `/api/m3u8-proxy`.
- Why: 4 prior approaches failed (server regex scraping, node:vm emulation blocked by WAF,
  client-direct HLS blocked by CORS, full reverse-proxy cat-and-mouse). Lesson: provide a
  **genuine browser**, observe the output, don't fake/reverse it.

---

## 7. Android / Capacitor

- `capacitor.config.json`: appId `com.eetnet.app`, appName `EetNet`, `webDir: "dist"`,
  `android.allowMixedContent: true`, SplashScreen + StatusBar dark, Keyboard resize.
- `android/` — full Gradle/Android Studio project; `MainActivity.java`,
  `AndroidManifest.xml`, bundled `assets/public/` = the built `dist/` (so the APK works
  offline against the tunnel URL). Capacitor 8.
- Build: `npm run build` (vite) → `npx cap sync android` → Gradle build.

---

## 8. Environment Variables

### Backend (`services/*.server.js` → compiled)
| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | API listen port (what the tunnel targets). |
| `PROXY_PORT` | `9090` | KissKH relay port (MUST differ from PORT). |
| `CORS_ORIGIN` | `*` | Allowed frontend origin. |
| `KISSKH_BASE` | `https://kisskh.co` | Override to relay only if blocked. |
| `ENCDEC_BASE` | `https://enc-dec.app` | EncDec resolver override. |
| `ANIMERULZ_FALLBACK/DATA/ANIMELOK/EXTRACT/HIANIME` | `*.streamindia.co.in` | AnimeRulz/StreamIndia hosts. |

### Frontend
| Var | Where | Purpose |
|---|---|---|
| `VITE_API_BASE` | Vercel/.env | Backend origin (build-time; runtime config overrides). |
| `API_BASE` | Vercel / `public/eetnet-config.json` | Runtime backend origin. |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Vercel/.env | Optional Supabase (enables cloud sync/login). |

- `.env` is gitignored; `.env.example` is the template. Current `public/eetnet-config.json`
  `API_BASE` = `https://nylon-overhead-sodium-warm.trycloudflare.com` (the live tunnel).

---

## 9. Key files index (where to look)

| File | Role |
|---|---|
| `README.md` | Setup/deploy (Termux + ngrok + Vercel), env reference, tunnel rules. |
| `package.json` | Scripts: `build:server` (compile), `start`/`server` (run compiled). Deps: React19, Vite8, Express5, @consumet/extensions, hls.js, Capacitor8, Supabase, cheerio, axios. |
| `scripts/compile_monolith.js` | Builds `the compilation/server.js` from 4 services. |
| `the compilation/server.js` | **The actual running backend** (auto-generated, do not hand-edit). |
| `services/{anime,drama,comics,movies}/server.js` | Source-of-truth service modules. |
| `services/{...}/README.md` | Per-service endpoint reference. |
| `src/runtimeConfig.js` | Dynamic backend-URL resolution. |
| `src/App.jsx` | Main SPA router/state (JS). |
| `src/main.{jsx,tsx}` | App entry (JS awaits runtimeConfig; TS is the migration target). |
| `src/components/VideoPlayer.jsx` | HLS player. |
| `src/supabaseClient.js` | Optional auth; mock fallback. |
| `proxy.py` | Optional KissKH relay (port 9090). |
| `capacitor.config.json` / `android/` | Native mobile wrapper. |
| `api/runtime-config.js` | Vercel serverless fn returning `API_BASE`. |
| `vercel.json` | Vercel rewrites (`/api/*` → serverless, SPA fallback). |
| `ARCHITECTURE_RESEARCH_BRIEF.txt` | Worker/headless-browser architecture rationale. |
| `MOVIES_SECTION_STATE.md` + `desimovies/` | DesiCinemas migration + RESEARCH_NOTES. |
| `.qoder/repowiki/` | AI-generated wiki (Architecture Overview, API refs, provider integration). Authoritative-ish but secondary to the code. |
| `website/` | Alternate pure-frontend builds (by ChatGPT/Gemini) consuming the 4 microservices on separate ports (8080–8083). Not the primary build. |
| `author added/next-app/` | A Next.js experiment added by the author (separate stack). |

---

## 10. Things to remember / gotchas

1. **Edit `services/*.server.js`, never `the compilation/server.js`** — recompile with
   `npm run build:server` and run with `npm start`.
2. **⚠️ THE DEPLOYED FRONTEND IS `website/website by chatgpt/`, NOT the repo root.**
   Verified by fingerprinting the live bundle at `www.eetnet.ooguy.com` (1216 KB, contains
   "Explore All Movies"/"Stream Not Found", matches that subproject's build byte-for-byte in
   size; the root build is 1148 KB and is the legacy `App.jsx` app). So:
   - **Vercel's Root Directory is set to `website/website by chatgpt`.** Editing root
     `src/**` changes NOTHING on the live site — the fix must be applied there too.
   - That subproject is a **separate npm project** (own `package.json`, vite 6, its own
     `node_modules`, `tailwindcss` correctly declared) but is tracked inside the SAME root git repo.
   - It reads config via `src/shared/api/config.ts` → **`/eetnet-config.json` with the 5-key
     shape** (`ANIME_API`/`DRAMA_API`/`COMICS_API`/`MOVIES_API`/`API_BASE`). It does NOT read
     `/api/runtime-config`, so **setting `API_BASE` as a Vercel env var has no effect** — the
     static JSON is the only lever.
   - Repo root's `src/App.tsx` + `src/App.jsx` are BOTH effectively dead for production.
   - Root `package.json` was missing `tailwindcss`/`autoprefixer`/`postcss` entirely (its
     `postcss.config.js` requires them) → root `npm run build` failed until they were added.
3. **Port discipline:** API=8080, relay=9090. Mixing them silently breaks `/api` (returns
   KissKH HTML).
4. **Tunnel URL rotates** (ngrok free). Runtime config + `?apiBase=` + `API_BASE` env on
   Vercel is the fix; stable option = named Cloudflare Tunnel.
5. **Residential-IP advantage:** the phone can hit providers directly that block datacenters;
   `proxy.py` is a last resort.
6. **Supabase is optional** — app fully works local-only (mock client).
7. **Protected streams (MoviePlex/DesiCinemas VidHide):** extracted via `node:vm` (Morencius
   packed JS → `jwplayer().setup`) or regex (Vidmoly); DesiCinemas is the current movies
   provider, not MoviePlex.
8. `scratch_*.cjs` / `gen_ids.cjs` / `get_hindi_list.*` are one-off research/dev scripts
   (Hindi-dub ID harvesting, MoviePlex research) — not part of the running app.
9. **Movies backend lives ONLY in root `server.js`, NOT the monolith.** The DesiCinemas
   engine (`dcGetCatalog`/`dcSearch`/`dcResolveStream`, `/api/desicinemas/*`) was added by
   commit `f6f195b` to the root `server.js` only. `services/movies/server.js` and
   `the compilation/server.js` still contain the OLD MoviePlex/NetMirror code and have NO
   DesiCinemas. The root `server.js` is the canonical/deployed movies backend (Vercel
   `api/index.js` imports it). Editing the monolith for movies has no effect.

---

## 11. Movies section — known trap & fix (Aug 2026)

**DesiCinemas catch-all redirect (critical):** `desicinemas.pk` 302-redirects ANY unknown
`/movies/<slug>/` — including a bare numeric TMDB id like `/movies/550/` — to ONE constant
post `vanvaas-movies-video`. So passing a non-DesiCinemas slug silently resolves to the
SAME wrong movie ("Vanvaas") every time.

- The live "Explore Movies" grid is **TMDB-sourced** (numeric ids, no DC slug — see
  `pages/movies/api/tmdb.ts`), while the home **rails** are DesiCinemas-sourced (real word
  slugs like `fighter-q-k`). Only real DC word-slugs resolve correctly.
- **`dcResolveStream` now guards this**: it compares the final redirected slug to the
  requested slug and throws `DC_CATCHALL_REDIRECT` on mismatch; the `/api/desicinemas/stream`
  route then recovers by DesiCinemas title-search (`&title=`, `&year=`) and retries with the
  first real slug. It also iterates ALL `.ListOptions` server options to prefer an
  extractable host, and **proxies the extracted HLS URL through `/api/m3u8-proxy`**
  (raw CDN URLs are token/referer/IP-bound + CORS-locked and won't play raw in-browser).
- **Frontend contract (`shared/api/movies.ts` `resolveMovieStream`)**: never send a bare
  numeric id as a slug (`isRealSlug` = has a non-numeric segment); resolve by `title`+`year`.
  When the response has `streamUrl` (native HLS via proxy) the modal uses our **native
  `VideoPlayer`**; only hosts we can't extract (vidsrc/movieshub/peytonepre) fall back to an
  iframe — per-title, never the wrong movie.
## 14. Option C win — `links.hls2` is the REAL master (Aug 2026)

**Symptom:** most movies fell back to the morencius iframe (or spun forever on the
ad-decoy). I had assumed the embed's `jwplayer().setup()` `sources[].file` was the
stream, but it's the **`morencius.com/stream/...` decoy master** (segments are tiktokcdn
ad images). The *genuine* playable master is a **different string** embedded in the same
packed P.A.C.K.E.R. script.

**Root cause:** morencius packs the embed HTML with P.A.C.K.E.R. (`eval(function(p,a,c,k,e,d)…)`).
Unpacking it reveals `var links={"hls2":"https://<host>.acek-cdn.com/.../master.m3u8?..."}`
(and sometimes `dramiyos-cdn.com`). That `links.hls2` master is REAL video
(`video/MP2T`, 0 ad segments). The `jwplayer().setup()` `sources[0].file` decoy was what
the old extractor returned → ad-spinner / iframe fallback.

**Fix (`dcExtractMorenciusStream` in root `server.js`):** unpack the packed script with the
real `vm` (file is ESM — use the top-level `import vm`, NOT `require('vm')` which is not
defined), capture `unpacked`, then prefer `unpacked.match(/["']hls2["']\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i)`
as the master; only fall back to the jwplayer source if no `links.hls2` exists.

**Verified:** catalog sweep 17/18 NATIVE (94%, was ~10-20%); all native streams confirmed
real `video/MP2T`. Only non-Morencius hosts (ok.ru / vidsrc / movieshub) stay iframe.

**Why this matters for the "ads" question:** native playback means our own player renders
the HLS — no morencius iframe, therefore **no iframe ads and no sandbox-needed popup ads**
on those titles. The earlier `sandbox` idea (commit reverted) was unnecessary: native
extraction removes the ad surface entirely. Phone #2 / puppeteer is NOT needed for this.

**Gotcha that cost ~10 debug cycles:** `server.js` is ESM (`import vm from 'node:vm'`).
Inside the extractor, `require('vm')` throws `require is not defined` — use the imported
`vm` directly. Also: the `jwplayer` `vm.runInContext(evalMatch[0], sandbox)` and the new
`unpacked` capture both run the SAME packed code; don't declare `mock$`/`mockEl`/`sandbox`
twice in the function (collision → SyntaxError).
  → `jwplayer().setup`). Ultra-mainstream titles DC serves via vidsrc-style iframe hosts →
  iframe fallback. **NetMirror (`/api/netmirror/stream-resolve`) is a DEAD END for real
  content** — its fake `crypto.randomUUID()` captcha token returns a constant demo video
  (`files/220884`, `in=unknown`) for every title; do NOT use it as a stream source.

---

## 12. Morencius ad-decoy playlists — the "infinite loading" bug (Aug 2026)

**Symptom:** many movies spun forever on the loading spinner; a few (`7-dogs`, `cup-bashi`)
played fine.

**Root cause — NOT latency.** Morencius serves **two different master-playlist shapes**, and
one is a decoy:

| shape | master URL | child segments | plays? |
|---|---|---|---|
| good | `https://<host>.solarpowersystems.space/.../master.txt` | `seg-N-v1-a1.woff2` on the same host | ✅ real `video/MP2T` |
| **decoy** | `https://morencius.com/stream/<tok>/.../master.m3u8` | **100% `p1x-ad-site-sign-sg.tiktokcdn.com/...~tplv-...image`** | ❌ HTTP 200 `image/png`, no video |

The decoy's "segments" are **ad images**: they download successfully, so hls.js keeps
buffering and never errors → infinite spinner. Both masters parse as valid `#EXTM3U`, so
checking the manifest alone is not enough. **Verified un-bypassable**: identical decoy
returned for referer=morencius / referer=embed / +cookies / +sec-fetch / no-referer, and the
`jwplayer()` config has only ONE source (no hidden real variant). The decoy is chosen
server-side per video.

**Fix:** `dcValidateHlsStream()` in root `server.js` walks master → child → first segment
before returning, and rejects when >50% of segments match `DC_AD_SEGMENT_HOSTS`
(tiktokcdn/ad-site-sign/byteoversea/pstatp/doubleclick/googlesyndication), the first segment
sniffs as `image/*`, or it 4xx/5xxs. Rejected candidates are reported in `rejectedStreams[]`
and the resolver falls through to the next server option / the provider iframe — a working
player instead of a spinner.

**Defence in depth (frontend):** `resolveMovieStream` has an `AbortController` budget
(30s movies / 45s series); `video-player.tsx` has a 25s manifest watchdog, a 45s
"no frame ever decoded" watchdog, and **bounded** hls.js retries (4 network / 2 media —
previously `startLoad()` retried forever); `movie-modal.tsx` keeps a `nativeFailed` flag so a
dying native player fails over to the iframe instead of hanging.

---

## 13. Web series / episodes (Aug 2026)

**Symptom:** every web-series title returned "Stream Not Found".

**Root cause:** DesiCinemas has **three page types** and series are not directly playable:
- `/movies/{slug}/` → has `.ListOptions`, embed router needs **`trtype=1`**
- `/episode/{slug}/` → has `.ListOptions`, embed router needs **`trtype=2`**
- `/series/{slug}/` → **`.ListOptions` count is 0**; only links to `/seasen/{slug}-N/`

The old resolver only ever fetched `/movies/{slug}/`, so a series slug hit the catch-all
guard and threw. Also note `?trtype=1` on an episode id returns **no iframe at all** — the
type must match the page kind.

**Path that works:** `/series/{slug}/` → `a[href*="/seasen/"]` → season page →
`a[href*="/episode/"]` → episode page → `.ListOptions` (`data-typ="episode"`) →
`/?trembed={key}&trid={id}&trtype=2` → iframe (ok.ru, Morencius, …).

**Fix (root `server.js`):**
- `dcGetSeriesInfo(slug)` — walks series → seasons → episodes, returns a sorted episode list.
- `dcResolvePlayablePage(slug, {episode, preferType})` — tries `/movies` → `/episode` →
  `/series`(→first/requested episode), picks the right `trtype`, keeps the catch-all guard.
- `dcResolveStream` accepts `episode` + `preferType`, returns `episodeNumber`/`episodeCount`.
- New endpoint **`GET /api/desicinemas/series/:slug`** → `{title, thumbnail, seasons, episodes[]}`.
- `/api/desicinemas/stream` accepts `?contentType=series&episode=N` and its title-search
  recovery now tries **up to 3** search hits (was 1) instead of giving up.

**Frontend:** `MovieSummary.contentType` carries DC `type` through `upgradePosters` →
`movie-modal` sends `contentType=series` (also inferred from "Season/Series/Episode" in the
title); `fetchSeriesEpisodes()` helper added for episode pickers.

**Verified live:** movies 10/10 playable, **0 dead ends** (7 ad-decoys caught and routed to
iframe); series **10/10 playable** (was 0/10); `?episode=1|2|3` returns the matching episode.
