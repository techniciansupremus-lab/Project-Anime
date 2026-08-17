# EetNet Website — API Connection Guide

This folder is reserved for the website frontend built by ChatGPT.

---

## What are the APIs?

EetNet runs **4 independent backend servers** (called microservices). Each one handles a specific content category:

| API Name | Port | What it serves |
|---|---|---|
| **Anime API** | `8080` | Anime streaming (Japanese Sub, English Dub, Hindi Dub via AnimeRulz) |
| **Drama API** | `8081` | Asian Dramas — Korean, Chinese, Thai (via KissKH) |
| **Comics API** | `8082` | Manga, Manhwa, Webtoons (via ComicKz, Hivetoons, AniList) |
| **Movies API** | `8083` | Bollywood, Hollywood, Hindi Dubbed movies (via MoviePlex, NetMirror) |

These servers run locally (or via Cloudflare tunnels if hosted). They serve clean **JSON data** that the website fetches and displays.

---

## How the Website Connects to the APIs

The website is a **pure frontend** — it does NOT scrape anything itself. All content comes from these 4 backend APIs.

### Step 1 — Configure the API endpoints

Create a file at the root of your frontend project:

```json
// public/eetnet-config.json
{
  "ANIME_API":  "http://localhost:8080",
  "DRAMA_API":  "http://localhost:8081",
  "COMICS_API": "http://localhost:8082",
  "MOVIES_API": "http://localhost:8083"
}
```

> **When using Cloudflare Tunnels** (for hosting from Termux/phone), replace `localhost:808x` with the public tunnel URLs like `https://your-tunnel.trycloudflare.com`.

### Step 2 — Fetch data from the APIs

The website makes simple `fetch()` or `axios.get()` calls to the endpoints:

```js
// Example: Load trending anime from AniList
const res = await fetch("http://localhost:8080/api/anilist", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    query: `{ Page(page:1, perPage:12) { media(type: ANIME, sort: TRENDING_DESC) { id title { english } coverImage { large } } } }`
  })
});
const data = await res.json();
// data.data.Page.media → array of trending anime with IDs, titles, covers

// Example: Get a streaming URL for an anime episode
const stream = await fetch("http://localhost:8080/api/hianime/watch?anilistId=21&episode=1&dub=sub");
const { sources } = await stream.json();
// sources[0].url → HLS (.m3u8) stream URL to play in hls.js
```

---

## Key Endpoints to Know

### 🎌 Anime (port 8080)
- `POST /api/anilist` → Trending, seasonal, and search via AniList GraphQL
- `GET /api/info/:anilistId` → Full anime info + episode list
- `GET /api/hianime/watch?anilistId=&episode=&dub=sub` → HLS stream URL
- `GET /api/gogoanime/watch?title=&episode=` → Fallback stream (AnimeKai)
- `GET /api/animerulz/watch?anilistId=&episode=&lang=hin` → Hindi Dub stream

### 🎭 Drama (port 8081)
- `GET /api/drama/home` → Home feed carousels
- `GET /api/drama/search?q=` → Search dramas
- `GET /api/drama/info/:dramaId` → Drama details + episode list
- `GET /api/drama/stream/:episodeId` → HLS stream URL

### 📚 Comics (port 8082)
- `GET /api/manga/home` → Trending manga/manhwa
- `GET /api/manga/search?q=` → Search
- `GET /api/manga/info/:id` → Manga details + chapter list
- `GET /api/manga/read/:chapterId` → Chapter page images

### 🎬 Movies (port 8083)
- `GET /api/movies/home` → Home feed
- `GET /api/movieplex/catalog?search=&category=` → Browse catalog
- `GET /api/movieplex/stream?slug=` → Stream URL

---

## Video Playback

All stream URLs returned are **HLS format** (`.m3u8` files). Use **[hls.js](https://github.com/video-dev/hls.js/)** to play them:

```js
import Hls from 'hls.js';

const hls = new Hls();
hls.loadSource(sources[0].url); // the .m3u8 URL from the API
hls.attachMedia(videoElement);  // your <video> DOM element
```

Subtitles come as **WebVTT** (`.vtt`) files from the `subtitles` array in the API response. Add them as `<track>` elements inside `<video>`.

---

## Summary

```
ChatGPT Frontend  ──────►  Anime API  (port 8080)  ──► HiAnime / AnimeKai / AnimeRulz
                  ──────►  Drama API  (port 8081)  ──► KissKH
                  ──────►  Comics API (port 8082)  ──► ComicKz / Hivetoons / AniList
                  ──────►  Movies API (port 8083)  ──► MoviePlex / NetMirror
```

For full endpoint documentation, see each service's `README.md`:
- [`services/anime/README.md`](../../services/anime/README.md)
- [`services/drama/README.md`](../../services/drama/README.md)
- [`services/comics/README.md`](../../services/comics/README.md)
- [`services/movies/README.md`](../../services/movies/README.md)
