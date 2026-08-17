# EetNet Frontend — Developer Readiness & Tooling Guide

This document prepares the entire environment, state models, player contracts, and API integration layers so that frontend development can begin immediately with zero friction.

---

## 🎨 1. Design Token Specifications (Netflix/Apple TV+ Tier)

### 🌑 Color System (Tailored OLED Dark Mode)
```css
:root {
  /* Backgrounds */
  --bg-primary: #08090C;         /* Deep OLED Canvas */
  --bg-secondary: #101218;       /* Surface / Card Background */
  --bg-tertiary: #181B24;        /* Elevated Surface / Hover */
  --bg-glass: rgba(16, 18, 24, 0.75); /* Glassmorphism Overlay */

  /* Borders & Dividers */
  --border-subtle: rgba(255, 255, 255, 0.07);
  --border-active: rgba(255, 255, 255, 0.20);
  --border-glow: rgba(99, 102, 241, 0.35);

  /* Accents & Brand Gradients */
  --accent-primary: #6366F1;     /* Vibrant Indigo */
  --accent-hover: #4F46E5;
  --accent-crimson: #E50914;     /* Cinematic Crimson */
  --accent-gold: #F59E0B;        /* Rating Gold */
  
  /* Text Ramps */
  --text-primary: #FFFFFF;
  --text-secondary: #94A3B8;     /* Slate Muted */
  --text-tertiary: #64748B;

  /* Elevation Shadows & Blurs */
  --glass-blur: blur(16px);
  --shadow-card: 0 10px 30px -10px rgba(0, 0, 0, 0.7);
  --shadow-glow: 0 0 25px rgba(99, 102, 241, 0.25);
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 22px;
}
```

---

## 🎬 2. Video Player Integration & AniSkip Ready Kit

### AniSkip API Specification (Auto "Skip Intro" / "Skip Outro")
- **Endpoint**: `https://api.aniskip.com/v2/skip-times/{malId}/{episodeNumber}?types=op&types=ed&episodeLength=0`
- **Response Format**:
  ```json
  {
    "found": true,
    "results": [
      {
        "skipType": "op",
        "interval": { "startTime": 85.5, "endTime": 175.2 }
      },
      {
        "skipType": "ed",
        "interval": { "startTime": 1340.0, "endTime": 1430.0 }
      }
    ]
  }
  ```
- **Player Action**: When `currentTime >= startTime && currentTime < endTime`, show the smooth glassmorphic `[⚡ Skip Intro]` button. When clicked: `video.currentTime = endTime`.

### Keyboard Shortcuts Mapping Matrix
| Key | Action |
|---|---|
| `Space` / `K` | Toggle Play / Pause |
| `F` | Toggle Fullscreen |
| `M` | Toggle Mute |
| `←` / `→` | Seek -10s / +10s |
| `J` / `L` | Seek -10s / +10s |
| `↑` / `↓` | Volume +10% / -10% |
| `C` | Toggle Subtitles On/Off |
| `S` | Skip Intro (if available) |
| `T` | Toggle Theater Mode |

---

## 📦 3. Zustand Global State Models

### 1. `useWatchProgressStore` (Local-First Persistence)
```typescript
interface WatchProgressItem {
  id: string;               // e.g. "mp-1234" or "anilist-21"
  mediaType: 'anime' | 'drama' | 'movie';
  title: string;
  poster: string;
  backdrop: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  currentTime: number;     // seconds
  duration: number;        // seconds
  percentage: number;      // 0 - 100
  updatedAt: number;       // timestamp
}
```

### 2. `useBookmarkStore` (Library / Watchlist)
```typescript
interface BookmarkItem {
  id: string;
  mediaType: 'anime' | 'drama' | 'manga' | 'movie';
  title: string;
  coverImage: string;
  rating?: string;
  genres?: string[];
  addedAt: number;
}
```

### 3. `useMangaHistoryStore`
```typescript
interface MangaReadProgress {
  slug: string;
  title: string;
  cover: string;
  lastChapterId: string;
  lastChapterNumber: string;
  lastPage: number;
  updatedAt: number;
}
```

---

## 🌐 4. Microservice API Client Contracts

The frontend will consume all 4 backend microservices using standardized client wrappers:

### 🎌 `animeApi` (Port `8080`)
- `getAnimeInfo(anilistId)` → `/api/info/:anilistId`
- `getHiAnimeStream(anilistId, ep, dub)` → `/api/hianime/watch`
- `getAnimeKaiStream(title, ep, season, dub)` → `/api/gogoanime/watch`
- `getHindiDubStream(anilistId, ep, lang)` → `/api/animerulz/watch`
- `getHindiCatalog(page, limit)` → `/api/animerulz/catalog`
- `getMalEpisodes(malId, page)` → `/api/episodes/mal/:malId`

### 🎭 `dramaApi` (Port `8081`)
- `getDramaHome()` → `/api/drama/home`
- `getDramaList(type, query)` → `/api/drama/list`
- `getDramaInfo(dramaId)` → `/api/drama/info/:dramaId`
- `getDramaStream(episodeId)` → `/api/drama/stream/:episodeId`

### 📚 `comicsApi` (Port `8082`)
- `getMangaHome()` → `/api/manga/home` (Bento Top 10 + Previews)
- `getMangaCategory(type, genre, page)` → `/api/manga/category/:type`
- `getWebtoonHome()` → `/api/webtoon/home`
- `getMangaInfo(slugOrId)` → `/api/manga/info/:id`
- `getChapterPages(chapterId)` → `/api/manga/read/:chapterId`

### 🎬 `moviesApi` (Port `8083`)
- `getMoviesHome()` → `/api/movies/home`
- `getMoviePlexCatalog(page, limit, category, search)` → `/api/movieplex/catalog`
- `getMovieStream(slug)` → `/api/movieplex/stream?slug=...`
- `getNetmirrorTrending()` → `/api/netmirror/trending`
- `getNetmirrorStream(title, year)` → `/api/netmirror/stream-resolve`

---

## 📐 5. Component Layout Tree

```
App.jsx
├── Navbar (Floating Glass, Category Switcher, Global Search Trigger, Bookmarks Icon)
├── Router Switch:
│   ├── / (Unified Home / Hero Billboard / Continue Watching Row / Trending Carousels)
│   ├── /anime (Anime Hub / Seasonal Bento / Hindi Dubbed Shelf)
│   ├── /drama (Asian Drama Hub / Korean / Chinese / Thai Carousels)
│   ├── /comics (Manga & Webtoon Hub / Daily Release Schedule / Bento Grid)
│   ├── /movies (Movies Hub / Bollywood / Hollywood / Web Series)
│   ├── /watch/:type/:id (Pro Custom Video Player View + Episode Grid + Related Titles)
│   ├── /read/:slug/:chapterId (Continuous Scroll Webtoon / Manga Viewer)
│   └── /library (User Watchlist, History, Resume Queue, Export/Import Data)
└── Footer (Minimalist, Quick links, Service Status Indicator)
```

Everything is fully defined, documented, and prepared for instant frontend assembly!
