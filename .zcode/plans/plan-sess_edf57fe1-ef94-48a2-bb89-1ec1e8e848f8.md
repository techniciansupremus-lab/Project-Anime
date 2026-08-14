
# Movie Section Visual Overhaul — Complete Plan

## Root Cause: No Thumbnails
The **primary reason the movies section looks cheap** is that MoviePlex catalog posts have empty `coverImage`/`thumbnail`/`bannerImage` fields. The backend's `mpNormalizePost()` returns empty strings because the WP REST API doesn't include video thumbnails. They're only fetched later via the slow `/api/movieplex/post-info` endpoint (which scrapes the full post HTML).

## Part 1: Backend — Thumbnail Pre-Fetching in Catalog Build

**File: `server.js`**

### 1A: Extract bfmovies video IDs during `buildMpCatalog()`
After normalizing all posts, do a lightweight batch scrape of the first 200 posts' HTML pages to extract bfmovies video IDs. From each post page HTML, regex for `bfmovies.online/d/([a-z0-9]+)` or `bfmovies.online/e/([a-z0-9]+)` patterns. Construct thumbnail URL: `https://img.lulucdn.com/{videoId}_xt.jpg`.

- Scrape in batches of 10 concurrent requests with 200ms delays between batches
- Store thumbnails directly in `mpCache.posts[i].thumbnail` and `.coverImage` and `.bannerImage`
- This runs in the background on server startup (via `setImmediate`) alongside the existing catalog build
- Log progress: `[MoviePlex] Thumbnails: 45/200...`

### 1B: Also update `scrapeMoviePlexPost()` to extract from `/d/` links
Currently only looks for `#tab1 iframe data-lazy-src` containing `bfmovies.online/e/`. Also add regex for `bfmovies.online/d/([a-z0-9]+)` anchor links in the page body. This makes `post-info` work for posts that only have download links, not embed iframes.

### 1C: Update `/api/movies/home` to return thumbnails
Since the cache now has thumbnails, the home endpoint automatically returns them. Also populate `featured.bannerImage` from the first featured post's thumbnail.

## Part 2: Frontend — Visual Overhaul

**File: `src/App.jsx`** (all inline styles, no new files)

### Design System Constants
```js
const MP = {
  bg: '#0a0a0a',         // Deep black (darker than Netflix's #141414 for richer feel)
  surface: '#161618',      // Card/elevated surface
  surface2: '#1e1e22',    // Hover surface
  brand: '#E50914',        // Netflix red for Play buttons
  brandHover: '#F6121D',
  text: '#ffffff',
  text2: '#b3b3b3',       // Secondary text (metadata)
  text3: '#737373',       // Tertiary (inactive)
  border: 'rgba(255,255,255,0.08)',
  cardRadius: '6px',      // Slightly rounded (between Netflix 0px and Apple 8px)
  cardGap: '10px',        // Tight card spacing
  rowGap: '2.5rem',       // Space between content rows
  heroH: '70vh',          // Hero billboard height
  hoverScale: 1.08,       // Subtle scale (1.5 is too aggressive for mobile)
};
```

### 2A: MovieCard Redesign
- **Poster aspect ratio**: 2:3 (vertical movie poster format)
- **No title below card** — title appears inside the card on hover overlay (cleaner grid, more cinematic)
- **Hover effect**: Scale to 1.08, subtle box-shadow lift, gradient overlay slides up revealing title + "▶ Play" button + metadata
- **Empty state**: Dark gradient placeholder with first letter of title (existing pattern, refined)
- **Rating badge**: Small pill in top-right corner
- **Hover delay**: 300ms before triggering expansion (prevents accidental triggers on scroll)

### 2B: MovieRow Redesign
- **True horizontal scroll** (not CSS grid) — `display: flex; overflow-x: auto; scroll-snap-type: x mandatory`
- **Scroll arrows**: Left/right chevron buttons appear on row hover, circular dark buttons with white chevrons
- **Hide scrollbar**: `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`
- **Card width**: Fixed `140px` with `flex: 0 0 140px` (prevents responsive grid from changing card count)
- **Row header**: Clean section title in white, bold, with subtle accent line underneath
- **Scroll snap**: Cards snap to position for mobile-friendly scrolling

### 2C: MovieHomeView Redesign
1. **Navigation bar** at top:
   - Logo "CINEMA" or "MOVIES" in white, bold
   - Search icon button on the right
   - Blur backdrop, fixed position

2. **Hero Billboard**:
   - Full-bleed 70vh with featured movie thumbnail as background
   - Two-axis gradient scrim (left-to-right dark + bottom-to-top fade)
   - Left-aligned content (NOT centered — Netflix positions text bottom-left)
   - Shows: Title, year, category tags, "▶ Play" white button + "More Info" translucent button
   - Auto-rotate: Cycle through top 3-4 featured movies every 8 seconds with crossfade

3. **Category filter pills**:
   - Horizontal row of pill buttons below hero
   - `border-radius: 20px`, border `1px solid rgba(255,255,255,0.15)`
   - Active: white bg, black text (Netflix 2025 style)
   - Inactive: transparent bg, white text
   - Horizontally scrollable on mobile

4. **Content rows** below categories (the MovieRow components)

### 2D: MovieDetailView Redesign
- Full-bleed hero background with strong gradient
- Back button with glassmorphism effect (blur backdrop)
- Title, year, rating, HD badge as metadata row
- White "▶ Play" button + translucent "Details" button
- Synopsis section with subtle card background
- Genre tags as pills

### 2E: Search Integration
- Replace the broken `/api/movies/search` call with `/api/movieplex/catalog?search=query`
- Search results render in the same MovieCard grid layout

## Part 3: CSS Additions

**File: `src/index.css`** — Add MoviePlex-specific utility classes:
- `.mp-scroll-row` — horizontal scroll container with hidden scrollbar
- `.mp-scroll-row::-webkit-scrollbar { display: none }`
- `.mp-skeleton-card` — shimmer animation for 2:3 card shape
- `.mp-hero-shimmer` — shimmer for hero billboard loading state
- `@keyframes mp-shimmer` — the shimmer gradient sweep animation

## Implementation Order
1. Backend thumbnail pre-fetch (server.js) — this is the critical fix
2. MovieCard redesign (App.jsx)
3. MovieRow with horizontal scroll + arrows (App.jsx)
4. MovieHomeView hero + nav + categories (App.jsx)
5. MovieDetailView polish (App.jsx)
6. Search fix (App.jsx — point to movieplex catalog)
7. CSS skeleton utilities (index.css)
8. Build test + browser verification
