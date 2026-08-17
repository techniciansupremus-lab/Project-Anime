# EetNet Web App — Architecture & Developer Guide

Welcome to the **EetNet Website** project. This is a lightweight, high-performance, pure frontend application (SPA / PWA) designed to stream Anime, Asian Dramas, Manga/Webtoons, and Movies by consuming the 4 decoupled EetNet Microservice APIs.

---

## 🏗️ 1. Core Architecture & Philosophy

```
                               ┌────────────────────────┐
                               │     EetNet Website     │
                               │  (Pure React Frontend) │
                               └───────────┬────────────┘
                                           │
         ┌───────────────────┬─────────────┴───────┬──────────────────┐
         │                   │                     │                  │
         ▼                   ▼                     ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ eetnet-anime-api│ │ eetnet-drama-api│ │eetnet-comics-api│ │eetnet-movies-api│
│   (Port 8080)   │ │   (Port 8081)   │ │   (Port 8082)   │ │   (Port 8083)   │
│  Anime & Hindi  │ │ KissKH Dramas   │ │ Manga & Webtoon │ │ MoviePlex & OTT │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

### ⚡ Key Rules for Building This Frontend:
1. **Zero Scraping on the Client**: The frontend does not parse third-party HTML or execute scraping. All data comes cleanly formatted as JSON from the microservice APIs.
2. **Display & Streaming Layer Only**: The website only handles state management, UI rendering, user interaction, bookmarking/history, and HLS video/image playback.
3. **No Heavy Monolithic State**: Each section (Anime, Drama, Comics, Movies) is modular and fetches from its respective microservice endpoint.

---

## 🌐 2. Microservice API Connection Config

The website connects to the microservices using a simple configuration object (e.g. `src/config/api.js` or `public/eetnet-config.json`):

```json
{
  "ANIME_API":  "http://localhost:8080",
  "DRAMA_API":  "http://localhost:8081",
  "COMICS_API": "http://localhost:8082",
  "MOVIES_API": "http://localhost:8083"
}
```

*In production on Termux / Cloudflare Tunnels, replace `localhost:808x` with the tunnel URLs (or dynamic resolver).*

---

## 📺 3. Content Modules & How They Work

### 🎌 Anime Section
- **Home Feed**: Uses `POST /api/anilist` to load trending, popular, and seasonal anime directly from AniList GraphQL.
- **Detail View**: `GET /api/info/:anilistId` gives clean metadata and episode lists.
- **Episode Titles & Filler Badges**: `GET /api/episodes/mal/:malId` fetches episode metadata via Jikan.
- **Video Streaming**:
  - Primary (English Sub/Dub): `GET /api/hianime/watch?anilistId=...&episode=...`
  - Fallback (AnimeKai): `GET /api/gogoanime/watch?title=...&episode=...`
  - Hindi Dubs: `GET /api/animerulz/watch?anilistId=...&episode=...&lang=hin`
  - Streams play in custom `<video>` element using `hls.js`.

---

### 🎭 Asian Drama Section
- **Home Feed**: `GET /api/drama/home` returns curated carousels:
  - Featured Shows
  - Korean Dramas
  - Chinese Dramas
  - Top Rated & Recently Updated
- **Search & Filter**: `GET /api/drama/list?type=0&q=...`
- **Episodes**: `GET /api/drama/info/:dramaId`
- **Playback**: `GET /api/drama/stream/:episodeId` provides the HLS stream URL and WebVTT subtitle tracks.

---

### 📚 Comics / Manga / Webtoons Section
- **Home Feed**: `GET /api/manga/home` delivers a modern **Bento Grid (Top 10)** + Manga/Manhwa/Manhua previews.
- **Webtoons Hub**: `GET /api/webtoon/home` provides Korean webtoons categorized by release days (`MON`, `TUE`, `WED`, etc.).
- **Search**: `GET /api/manga/search?q=...`
- **Detail & Chapters**: `GET /api/manga/info/:slug`
- **Reader View**: `GET /api/manga/read/:chapterId` returns high-res image page URLs routed through `/api/manga/image-proxy` to prevent hotlink 403 blocks. Supports vertical webtoon scrolling and manga page flipping.

---

### 🎬 Movies & Web Series Section
- **Home Feed**: `GET /api/movies/home` returns categorized rows:
  - Trending & Featured Spotlight
  - Bollywood & Hollywood
  - South Indian Hindi Dubbed
  - OTT Web Series & Short Films
  - TMDB/OMDb official posters & backdrops attached automatically
- **Search & Filter**: `GET /api/movieplex/catalog?category=...&search=...`
- **Playback**: `GET /api/movieplex/stream?slug=...`
  - If direct HLS stream is extracted: plays in our native player.
  - If host is obfuscated: switches gracefully to compatibility iframe mode.

---

## 🎨 4. Design & UI Requirements for Future Developers/AIs

1. **Aesthetics**: Premium, dark-mode first, glassmorphic accents, fluid transitions, and smooth hover micro-animations (inspired by Netflix & Crunchyroll).
2. **Typography**: Clean modern sans-serif (Inter / Outfit / Plus Jakarta Sans).
3. **Player**: Unified, customizable video player with speed controls, quality switcher, subtitle selector, theater mode, and picture-in-picture.
4. **State & Storage**: LocalStorage / IndexedDB for user watch progress, history, and favorite bookmarks.
5. **Mobile Responsiveness**: Bottom navigation bar for mobile / sidebar or top navbar on desktop.

---

## 🚀 5. How to Start Building

When you are ready to construct the website:
1. Initialize a modern Vite + React app inside this folder:
   ```bash
   npm create vite@latest . -- --template react
   ```
2. Install dependencies:
   ```bash
   npm install hls.js lucide-react axios
   ```
3. Read the 4 API documentation files in `../services/*/README.md` to see exact endpoint schemas.
4. Build the modular UI components and enjoy seamless streaming!
