---
kind: business_term
name: Business Glossary
category: business_term
scope:
    - '**'
---

### EetNet
- Definition：Internal product name of the Netflix-style streaming aggregator for anime, Asian dramas, and manhwa/webtoons. The Android app bundle ID is `com.eetnet.app` and the app name is 'EetNet'.
- Aliases：Project Anime、AniStream

### Mike
- Definition：Codename for the dedicated Android phone that runs the Termux backend (Node.js + Python relay + headless Chromium worker) and stays online 24/7 behind a Cloudflare Tunnel. Also called 'the Worker' or 'The Machine' in architecture docs.
- Aliases：Worker、The Machine、phone backend

### Alex
- Definition：Codename for an external video provider/host (e.g., bfmovies.online, tnmr.org, LuluStream) whose embedded player scripts must execute in a genuine browser environment to produce stream URLs.
- Aliases：provider host、external provider

### Package
- Definition：In the headless browser worker pattern, the decrypted, signed .m3u8 stream manifest URL plus associated auth tokens captured by intercepting Chromium's outbound network requests during provider playback.
- Aliases：stream package、signed URL

### Headless Browser Worker Pattern
- Definition：Architecture where a dedicated Android phone runs a headless Chromium instance to natively execute hostile provider JavaScript, intercept the resulting stream URL, and return it to the Vercel backend — chosen because server-side JS emulation and direct client playback both fail against modern anti-bot protections.
- Aliases：Alex -> Mike -> Machine -> Me、worker pattern

### m3u8-proxy
- Definition：Backend route (`/api/m3u8-proxy`) that fetches an upstream HLS master playlist, rewrites all sub-playlist and segment URLs to pass through the backend's own public host, and returns the rewritten manifest so browsers never talk directly to the video CDN.
- Aliases：manifest proxy、playlist proxy

### ts-proxy
- Definition：Backend route (`/api/ts-proxy`) that pipes raw video/audio segments (`.ts`, `.aac`, etc.) from upstream CDNs while forwarding Range headers so HLS.js can perform byte-range requests instead of downloading entire files.
- Aliases：segment proxy、video segment proxy

### subtitle-proxy
- Definition：Backend route (`/api/subtitle-proxy`) that proxies VTT subtitle files from external CDNs (e.g., cdn.anizara.store) so browser `<track>` elements can load them without CORS blocks.
- Aliases：vtt proxy、caption proxy

### img-proxy
- Definition：Backend route (`/api/img-proxy`, also mirrored at `/api/manga/image-proxy`) that proxies images from sources that hotlink-block or enforce CORS (AniList, ComicK, TMDB), setting appropriate image content types and a 24-hour cache.
- Aliases：image proxy、poster proxy

### Jikan cache
- Definition：In-memory cache keyed by `malId:page` storing MyAnimeList episode metadata fetched from `api.jikan.moe/v4/anime/:malId/episodes`, with a 1-hour TTL. Used to populate episode titles, air dates, filler/recap flags.
- Aliases：MAL episode cache、jikan.moe cache

### hiAnimeEpCache
- Definition：In-memory cache keyed by AniList ID storing HiAnime episode lists with a 30-minute TTL, used to avoid repeated expensive episode-page scrapes.
- Aliases：HiAnime episode cache

### mpCache
- Definition：In-memory cache for the MoviePlex WordPress catalog (paginated 100/post, 5 parallel fetches) rebuilt every 24 hours via `setImmediate`. Stores normalized posts with `id: 'mp-{id}'` and `movieplexSlug`.
- Aliases：MoviePlex catalog cache

### animerulzDataCache
- Definition：In-memory cache for AnimeRulz catalog, detail, and episode data with a 30-minute TTL, keyed by `catalog`, `detail:{anilistId}`, `episodes:{anilistId}`, and `avail:{anilistId}`.
- Aliases：AnimeRulz data cache

### animerulzStreamCache
- Definition：In-memory cache for resolved AnimeRulz stream URLs keyed by `{anilistId}:e{episodeNum}:{lang}` with a 30-minute TTL.
- Aliases：AnimeRulz stream cache

### t_hash_t
- Definition：NetMirror session cookie obtained via the `verify.php` bypass; valid ~72 hours, required as part of the Cookie header for all NetMirror mobile API calls, along with `ott` and `hd=on` cookies.
- Aliases：NetMirror token、NetMirror cookie
