# Movies Section — Current State (Aug 2026)

## Provider: MoviePlex (movieplex.co.in)
The entire movies section is powered by MoviePlex. Previous providers (NetMirror, TMDB) were removed by a prior AI session.

## Backend Architecture (server.js)

### MoviePlex Engine (lines ~2739-3046)
- **Source**: WordPress REST API at `movieplex.co.in/wp-json/wp/v2/`
- **Catalog**: Paginated WP API fetch (100/page, 5 parallel), cached in `mpCache` in memory, rebuilt every 24h via `setImmediate`
- **Categories**: 14 WP category IDs mapped in `MP_CATS` (trending=29, hot=21, bollywood=10, hollywood=19, action=6, web_series=33, hindi_dubbed=17, short_film=26, thriller=28, romance=24, drama=14, comedy=11, horror=20, bengali=9, south_indian=27)
- **Post normalization**: `mpNormalizePost()` creates `{ id: "mp-{id}", movieplexSlug: slug, source: "movieplex" }` — thumbnails are EMPTY initially

### Stream Extraction Pipeline
1. `scrapeMoviePlexPost(slug)` → fetches post HTML, extracts iframe URLs from `#tab1/#tab2/#tab3`
2. `extractLuluHLS(embedUrl)` → fetches bfmovies.online embed, finds `eval(function(p,a,c,k)...)` packed JS, runs in `node:vm` sandbox with mocked `jwplayer()` to capture m3u8 URL
3. `extractStreamTapeUrl(embedUrl)` → regex-based token concatenation for split StreamTape tokens
4. `resolveMoviePlexStream(slug)` → chains LuluStream → StreamTape → fallback iframe

### API Routes
| Route | Purpose |
|---|---|
| `GET /api/movies/home` | 10 MoviePlex category rows + featured, cached 30min in `moviesHomeCache` |
| `GET /api/movieplex/catalog` | Paginated catalog with category/search filters |
| `GET /api/movieplex/stream?slug=` | On-demand stream resolution |
| `GET /api/movieplex/post-info?slug=` | Fast thumbnail + iframe scraper |
| `GET /api/movieplex/catalog/status` | Cache status (post count, last refresh) |

### Deleted Endpoints (removed by prior AI)
- `GET /api/movies/search` — TMDB search, GONE
- `GET /api/movies/info/:id` — TMDB movie detail, GONE
- The functions `mapTmdbMovie()`, `mapTmdbMovieDetail()`, `getTmdbUrl()` still exist (~lines 2151-2181) but are orphaned

## Frontend Architecture (src/App.jsx)

### MovieHomeView (~lines 5066-5298)
- Dark theme (#000 bg, #06b900 green accent)
- Expects `data.movieplex.*` arrays (trending, hot, webSeries, hindiDubbed, bollywood, hollywood, action, shortFilm, thriller, romance)
- Falls back to `data.trending`, `data.bollywood` etc. for compat
- 11 category filter pills: All, Trending, Hot, Web Series, Hindi Dubbed, Bollywood, Hollywood, Action, Short Film, Thriller, Romance
- Featured hero at top with Play button

### MoviePlexPlayerView (~lines 5401-5522)
- Dedicated player for MoviePlex content
- Fetches `/api/movieplex/post-info?slug=` for thumbnail
- Fetches `/api/movieplex/stream?slug=` for stream
- If HLS extracted → uses own `VideoPlayer` component
- If extraction fails → iframe fallback with toggle buttons

### MovieWatchView (~line 5525)
- Routing layer: detects MoviePlex by `movie.movieplexSlug || movie.source === 'movieplex'`
- Routes MoviePlex → `MoviePlexPlayerView`
- Non-MoviePlex branch exists but calls deleted endpoints (broken for non-MoviePlex)

### handleMovieClick (~lines 1826-1867)
- MoviePlex: fetches post-info for thumbnail
- Default: called deleted `/api/movies/info` — user says they fixed this

### handleMovieSearch (~lines 1869-1880)
- Called deleted `/api/movies/search` — user says they fixed this

## Key Design Decisions
- **Streams are NEVER cached** — LuluCDN URLs contain expiry tokens, always extracted fresh
- **Catalog IS cached** — in-memory, rebuilt every 24h
- **Thumbnails fetched lazily** — populated on detail click via post-info scrape
- **Fallback chain**: LuluStream HLS → StreamTape MP4 → Original iframe

## Infrastructure
- Frontend: Vite SPA on Vercel (eetnnet.ooguy.com)
- Backend: Express on Android phone via Termux, tunneled via Cloudflare Tunnel
- Static config: `public/eetnet-config.json` contains current tunnel URL
