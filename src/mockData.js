const ANILIST_API = 'https://graphql.anilist.co';
const BACKEND_API = 'http://localhost:5000/api';

export const animeCategories = [
  "Action", "Adventure", "Fantasy", "Sci-Fi", "Romance", "Shounen", "Drama", "Slice of Life", "Mystery"
];

export const recentReleases = [];

// ─────────────────────────────────────────
// AniList GraphQL helper
// ─────────────────────────────────────────
async function fetchAniList(query, variables = {}) {
  try {
    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables })
    });

    if (response.status === 429) {
      // Rate limited — wait for Retry-After then retry once
      const retryAfter = parseInt(response.headers.get('Retry-After') || '3', 10);
      console.warn(`[AniList] Rate limited. Retrying in ${retryAfter}s...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return fetchAniList(query, variables);
    }

    if (!response.ok) throw new Error(`AniList returned status ${response.status}`);
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('AniList API error:', error);
    return null;
  }
}

// ─────────────────────────────────────────
// Map AniList media to our card format
// ─────────────────────────────────────────
function mapMediaToCard(media) {
  return {
    id: media.id.toString(),
    title: media.title.english || media.title.romaji || media.title.userPreferred,
    japaneseTitle: media.title.romaji,
    coverImage: media.coverImage?.extraLarge || media.coverImage?.large,
    bannerImage: media.bannerImage || media.coverImage?.extraLarge || media.coverImage?.large,
    rating: media.averageScore ? (media.averageScore / 10).toFixed(1) : "N/A",
    type: media.format || "TV",
    episodesCount: media.episodes || (media.nextAiringEpisode?.episode ? media.nextAiringEpisode.episode - 1 : null),
    genres: media.genres || [],
    status: media.status || "UNKNOWN"
  };
}

// ─────────────────────────────────────────
// Map AniList media to full detail format
// ─────────────────────────────────────────
function mapMediaToDetail(media) {
  const totalEps = media.episodes || (media.nextAiringEpisode?.episode ? media.nextAiringEpisode.episode - 1 : 12);
  
  return {
    id: media.id.toString(),
    title: media.title.english || media.title.romaji || media.title.userPreferred,
    japaneseTitle: media.title.romaji,
    description: media.description ? media.description.replace(/<[^>]*>/g, '') : "No synopsis available.",
    coverImage: media.coverImage?.extraLarge || media.coverImage?.large,
    bannerImage: media.bannerImage || media.coverImage?.extraLarge || media.coverImage?.large,
    rating: media.averageScore ? (media.averageScore / 10).toFixed(1) : "N/A",
    type: media.format || "TV",
    duration: media.duration ? `${media.duration}m` : "24m",
    quality: "HD",
    status: media.status || "Completed",
    genres: media.genres || [],
    totalEpisodes: totalEps,
    // Episodes will be populated from the backend provider
    episodes: null
  };
}

// AniList media fragment used in queries
const MEDIA_FRAGMENT = `
  id
  title { romaji english userPreferred }
  coverImage { extraLarge large }
  bannerImage
  averageScore
  format
  episodes
  genres
  description
  duration
  status
  nextAiringEpisode { episode }
`;

// ─────────────────────────────────────────
// API Methods
// ─────────────────────────────────────────
export const api = {
  // Trending anime for the grid
  getAnimeList: async () => {
    const data = await fetchAniList(`
      query { Page(page: 1, perPage: 18) { media(type: ANIME, sort: TRENDING_DESC) { ${MEDIA_FRAGMENT} } } }
    `);
    if (data?.Page?.media) return data.Page.media.map(mapMediaToCard);
    return [];
  },

  // Featured anime for the hero carousel
  getFeatured: async () => {
    const data = await fetchAniList(`
      query { Page(page: 1, perPage: 5) { media(type: ANIME, sort: POPULARITY_DESC, status: RELEASING) { ${MEDIA_FRAGMENT} } } }
    `);
    if (data?.Page?.media) return data.Page.media.map(mapMediaToDetail);
    return [];
  },

  // Full details for an anime (AniList metadata only — episodes come from backend)
  getAnimeDetails: async (id) => {
    const data = await fetchAniList(`
      query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FRAGMENT} } }
    `, { id: parseInt(id) });
    
    if (!data?.Media) return null;
    
    const anime = mapMediaToDetail(data.Media);
    
    // Now try to fetch the REAL episode list from the backend (Consumet META.Anilist + AnimeUnity)
    try {
      console.log(`[API] Fetching episode list from backend for AniList ID ${id}...`);
      const backendRes = await fetch(`${BACKEND_API}/info/${id}`);
      
      if (backendRes.ok) {
        const backendData = await backendRes.json();
        
        if (backendData.episodes && backendData.episodes.length > 0) {
          console.log(`[API] Got ${backendData.episodes.length} real episodes from backend! (total: ${backendData.totalEpisodes})`);
          anime.episodes = backendData.episodes.map(ep => ({
            id: ep.id,           // AnimeUnity episode ID — needed for streaming
            number: ep.number,
            title: ep.title || `Episode ${ep.number}`,
            thumbnail: ep.image || anime.bannerImage,
            sources: []
          }));
          anime.totalEpisodes = backendData.totalEpisodes || backendData.episodes.length;
          return anime;
        }
      }
    } catch (err) {
      console.warn(`[API] Backend episode fetch failed:`, err.message);
    }

    // Fallback: generate numbered episode placeholders from AniList count
    // Cap at 200 to avoid creating a massive DOM for long-running shows
    const fallbackCount = Math.min(anime.totalEpisodes || 12, 200);
    console.log(`[API] Using AniList episode count fallback: ${fallbackCount} episodes`);
    anime.episodes = Array.from({ length: fallbackCount }, (_, i) => ({
      id: null,            // No provider episode ID — streaming won't work
      number: i + 1,
      title: `Episode ${i + 1}`,
      thumbnail: anime.bannerImage,
      sources: []
    }));
    
    return anime;
  },

  // Search anime by title
  searchAnime: async (queryStr) => {
    const data = await fetchAniList(`
      query ($search: String) { Page(page: 1, perPage: 18) { media(type: ANIME, search: $search) { ${MEDIA_FRAGMENT} } } }
    `, { search: queryStr });
    if (data?.Page?.media) return data.Page.media.map(mapMediaToCard);
    return [];
  },

  // Fetch streaming sources for an episode
  getEpisodeSources: async (episodeId, animeTitle, japaneseTitle, episodeNumber) => {
    // 1. Try AnimeKai Primary Provider (English Subbed) — direct HLS extraction
    const titleToSearch = animeTitle || japaneseTitle;
    if (titleToSearch) {
      try {
        console.log(`[API] Fetching AnimeKai stream for title: "${titleToSearch}" Episode ${episodeNumber}`);
        const response = await fetch(`${BACKEND_API}/gogoanime/watch?title=${encodeURIComponent(titleToSearch)}&episode=${episodeNumber}`);
        if (response.ok) {
          const data = await response.json();
          // Backend returns type:'hls' (direct stream) or type:'iframe' (fallback)
          if (data.type === 'hls' && data.streamUrl) {
            console.log(`[API] ✅ AnimeKai direct HLS stream:`, data.streamUrl);
            return {
              provider: data.provider,
              type: 'hls',
              sources: [{ url: data.streamUrl, isM3U8: true, quality: 'HD' }],
              subtitles: data.subtitleUrl
                ? [{ url: data.subtitleUrl, lang: 'English', label: 'English' }]
                : [],
              headers: data.headers || {},
              language: data.language
            };
          }
          if (data.type === 'iframe' && data.iframeSrc) {
            console.log(`[API] AnimeKai iframe fallback:`, data.iframeSrc);
            return data;
          }
        }
      } catch (err) {
        console.warn(`[API] AnimeKai fetch failed:`, err.message);
      }
    }

    // 2. Try AnimeUnity Fallback Provider (Italian Subbed)
    if (episodeId) {
      try {
        console.log(`[API] Fetching AnimeUnity stream for episode ID: ${episodeId}`);
        const response = await fetch(`${BACKEND_API}/watch/${encodeURIComponent(episodeId)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.sources && data.sources.length > 0) {
            return data;
          }
        }
      } catch (err) {
        console.error('[API] AnimeUnity fetch error:', err.message);
      }
    }

    // Fallback: return test stream so the player doesn't break
    console.warn(`[API] All providers failed. Returning fallback test stream.`);
    return {
      provider: 'fallback',
      sources: [
        { url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", isM3U8: true, quality: "default" }
      ],
      subtitles: [],
      error: 'Streaming providers are currently unavailable. This is a test stream.'
    };
  }
};
