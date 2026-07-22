import { apiUrl, getBackendConfigError } from './runtimeConfig';

const ANILIST_API = 'https://graphql.anilist.co';
const backendApi = (path) => apiUrl(`/api${path.startsWith('/') ? path : `/${path}`}`);

export const animeCategories = [
  "Action", "Adventure", "Fantasy", "Sci-Fi", "Romance", "Shounen", "Drama", "Slice of Life", "Mystery"
];

export const recentReleases = [];

// List of anime series known to have official/popular Hindi Dubs
export const HINDI_DUB_ANIME_KEYWORDS = [
  'naruto', 'dragon ball', 'dragonball', 'demon slayer', 'kimetsu', 'jujutsu kaisen',
  'solo leveling', 'chainsaw man', 'my hero academia', 'boku no hero',
  'spy x family', 'blue lock', 'kaiju', 'wind breaker', 'black clover',
  'one piece', 'death note', 'tokyo revengers', 'monster', 'ranking of kings',
  'iruma-kun', 'iruma', 'shin-chan', 'shinchan', 'doraemon', 'pokemon', 'pokémon',
  'beyblade', 'detective conan', 'attack on titan'
];

export function hasHindiDubAvailable(title = '', japaneseTitle = '') {
  const combined = `${title || ''} ${japaneseTitle || ''}`.toLowerCase();
  return HINDI_DUB_ANIME_KEYWORDS.some(kw => combined.includes(kw));
}

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
    malId: media.idMal || null,
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
    season: media.season || null,
    seasonYear: media.seasonYear || null,
    synonyms: media.synonyms || [],
    // Episodes will be populated from Jikan / backend provider
    episodes: null
  };
}

// AniList media fragment used in queries
const MEDIA_FRAGMENT = `
  id
  idMal
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
  season
  seasonYear
  synonyms
  nextAiringEpisode { episode }
  relations {
    edges {
      relationType
      node {
        id
        title { english romaji userPreferred }
        format
        type
        coverImage { large }
        bannerImage
        averageScore
      }
    }
  }
`;

function getBaseTitle(title) {
  if (!title) return '';
  // Clean common season indicators
  let clean = title.replace(/\b(season|part|cour|ova|oad|specials?|movie|tv|series)\b.*/gi, '');
  // Clean trailing punctuation, colons, hyphens
  clean = clean.replace(/[:\-–—,\s]+$/, '').trim();
  return clean || title;
}

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

  // Top 10 famous anime of all time
  getTop10Famous: async () => {
    const data = await fetchAniList(`
      query { Page(page: 1, perPage: 10) { media(type: ANIME, sort: POPULARITY_DESC) { ${MEDIA_FRAGMENT} } } }
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

  // TV shows category
  getTVShows: async () => {
    const data = await fetchAniList(`
      query { Page(page: 1, perPage: 24) { media(type: ANIME, format_in: [TV, TV_SHORT], sort: POPULARITY_DESC) { ${MEDIA_FRAGMENT} } } }
    `);
    if (data?.Page?.media) return data.Page.media.map(mapMediaToDetail);
    return [];
  },

  // Movies category
  getMovies: async () => {
    const data = await fetchAniList(`
      query { Page(page: 1, perPage: 24) { media(type: ANIME, format: MOVIE, sort: POPULARITY_DESC) { ${MEDIA_FRAGMENT} } } }
    `);
    if (data?.Page?.media) return data.Page.media.map(mapMediaToDetail);
    return [];
  },

  // New & Popular category (airing now)
  getNewAndPopular: async () => {
    const data = await fetchAniList(`
      query { Page(page: 1, perPage: 24) { media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) { ${MEDIA_FRAGMENT} } } }
    `);
    if (data?.Page?.media) return data.Page.media.map(mapMediaToDetail);
    return [];
  },

  // Fetch lists filtered by format and genre for custom category horizontal rows
  getGenreList: async (format, genre) => {
    const formatFilter = format === 'TV' ? 'format_in: [TV, TV_SHORT],' : 'format: MOVIE,';
    const data = await fetchAniList(`
      query {
        Page(page: 1, perPage: 24) {
          media(type: ANIME, ${formatFilter} genre: "${genre}", sort: POPULARITY_DESC) {
            ${MEDIA_FRAGMENT}
          }
        }
      }
    `);
    if (data?.Page?.media) return data.Page.media.map(mapMediaToDetail);
    return [];
  },

  // Full details for an anime (AniList metadata + Jikan episode list)
  getAnimeDetails: async (id) => {
    const data = await fetchAniList(`
      query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FRAGMENT} } }
    `, { id: parseInt(id) });
    
    if (!data?.Media) return null;
    
    const anime = mapMediaToDetail(data.Media);

    // 1. Try Jikan (MAL) for episode metadata — real titles, air dates, filler flags
    if (anime.malId) {
      try {
        console.log(`[API] Fetching Jikan episode list for MAL ID ${anime.malId} (page 1)...`);
        const jikanRes = await fetch(backendApi(`/episodes/mal/${anime.malId}?page=1`));
        if (jikanRes.ok) {
          const jikanData = await jikanRes.json();
          if (jikanData.episodes && jikanData.episodes.length > 0) {
            console.log(`[API] Got ${jikanData.episodes.length} episodes from Jikan (total pages: ${jikanData.pagination.lastPage})`);
            anime.episodes = jikanData.episodes.map(ep => ({
              id: null,
              number: ep.number,
              title: ep.title,
              aired: ep.aired,
              score: ep.score,
              filler: ep.filler,
              recap: ep.recap,
              thumbnail: anime.bannerImage || anime.coverImage,
              sources: []
            }));

            // Pad missing aired episodes if AniList totalEpisodes is higher than Jikan's list
            const currentCount = anime.episodes.length;
            const targetCount = Math.max(anime.totalEpisodes || 0, currentCount);
            if (targetCount > currentCount) {
              console.log(`[API] Padding ${targetCount - currentCount} missing episode(s) up to Episode ${targetCount}`);
              for (let i = currentCount + 1; i <= targetCount; i++) {
                anime.episodes.push({
                  id: null,
                  number: i,
                  title: `Episode ${i}`,
                  aired: null,
                  score: null,
                  filler: false,
                  recap: false,
                  thumbnail: anime.bannerImage || anime.coverImage,
                  sources: []
                });
              }
            }

            anime.episodePagination = jikanData.pagination;
            // If Jikan reports more pages, reflect real total count
            if (jikanData.pagination.lastPage > 1) {
              anime.totalEpisodes = jikanData.pagination.lastPage * 100; // approximate
            }
            return anime;
          }
        }
      } catch (err) {
        console.warn(`[API] Jikan fetch failed:`, err.message);
      }
    }

    // 2. Try AnimeUnity/Consumet for episode list (has provider episode IDs for streaming)
    try {
      console.log(`[API] Fetching episode list from backend for AniList ID ${id}...`);
      const backendRes = await fetch(backendApi(`/info/${id}`));
      
      if (backendRes.ok) {
        const backendData = await backendRes.json();
        
        if (backendData.episodes && backendData.episodes.length > 0) {
          console.log(`[API] Got ${backendData.episodes.length} real episodes from backend! (total: ${backendData.totalEpisodes})`);
          anime.episodes = backendData.episodes.map(ep => ({
            id: ep.id,
            number: ep.number,
            title: ep.title || `Episode ${ep.number}`,
            filler: false,
            recap: false,
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

    // 3. Last resort: generate numbered placeholders from AniList count (no hard cap)
    const fallbackCount = anime.totalEpisodes || 12;
    console.log(`[API] Using AniList episode count fallback: ${fallbackCount} episodes`);
    anime.episodes = Array.from({ length: fallbackCount }, (_, i) => ({
      id: null,
      number: i + 1,
      title: `Episode ${i + 1}`,
      filler: false,
      recap: false,
      thumbnail: anime.bannerImage,
      sources: []
    }));
    
    return anime;
  },

  // Lazy-load a specific page of Jikan episodes (for long-running shows)
  getEpisodePage: async (malId, page) => {
    if (!malId) return null;
    try {
      const res = await fetch(backendApi(`/episodes/mal/${malId}?page=${page}`));
      if (!res.ok) return null;
      const data = await res.json();
      return data; // { episodes, pagination }
    } catch (err) {
      console.warn(`[API] Jikan page ${page} fetch failed:`, err.message);
      return null;
    }
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
  // anilistId: AniList ID (for HiAnime primary lookup)
  // seasonNum: season number (for AnimeKai fallback filtering)
  // audioMode: 'sub' | 'dub' | 'hindi'
  getEpisodeSources: async (episodeId, animeTitle, japaneseTitle, episodeNumber, anilistId = null, seasonNum = null, audioMode = 'sub') => {
    const configError = getBackendConfigError();
    if (configError) {
      return {
        provider: 'unavailable',
        sources: [],
        subtitles: [],
        error: configError
      };
    }

    const dubParam = audioMode === 'hindi' ? '&dub=hindi' : audioMode === 'dub' ? '&dub=eng' : '';

    // ═══════════════════════════════════════════════
    // PROVIDER 1 (PRIMARY): HiAnime via AniList ID
    // Deterministic: AniList ID → exact season page
    // Episode numbers are season-relative (ep 1 = S1E1)
    // Zero title-search ambiguity.
    // ═══════════════════════════════════════════════
    if (anilistId) {
      try {
        console.log(`[API] HiAnime primary (${audioMode}): AniList ID ${anilistId} Episode ${episodeNumber}`);
        const response = await fetch(
          backendApi(`/hianime/watch?anilistId=${encodeURIComponent(anilistId)}&episode=${episodeNumber}${dubParam}`)
        );
        if (response.ok) {
          const data = await response.json();
          if (data.sources && data.sources.length > 0) {
            console.log(`[API] ✅ HiAnime: ${data.sources.length} source(s)`);
            return {
              provider: 'hianime',
              type: 'hls',
              sources: data.sources,
              subtitles: data.subtitles || [],
              audioMode: audioMode
            };
          }
        }
      } catch (err) {
        console.warn(`[API] HiAnime fetch failed, falling back to AnimeKai:`, err.message);
      }
    }

    // ═══════════════════════════════════════════════
    // PROVIDER 2 (FALLBACK): AnimeKai title search
    // Used when HiAnime is unavailable.
    // ═══════════════════════════════════════════════
    const titleToSearch = animeTitle || japaneseTitle;
    if (titleToSearch) {
      try {
        const seasonParam = seasonNum ? `&season=${seasonNum}` : '';
        console.log(`[API] AnimeKai fallback (${audioMode}): "${titleToSearch}" S${seasonNum ?? '?'} E${episodeNumber}`);
        const response = await fetch(
          backendApi(`/gogoanime/watch?title=${encodeURIComponent(titleToSearch)}&episode=${episodeNumber}${seasonParam}${dubParam}`)
        );
        if (response.ok) {
          const data = await response.json();
          if (data.type === 'hls' && data.streamUrl) {
            console.log(`[API] ✅ AnimeKai HLS stream`);
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
            console.log(`[API] AnimeKai iframe fallback`);
            return data;
          }
        }
      } catch (err) {
        console.warn(`[API] AnimeKai fetch failed:`, err.message);
      }
    }

    // ═══════════════════════════════════════════════
    // PROVIDER 3 (LAST RESORT): AnimeUnity via Consumet
    // ═══════════════════════════════════════════════
    if (episodeId) {
      try {
        console.log(`[API] AnimeUnity last resort for episode ID: ${episodeId}`);
        const response = await fetch(backendApi(`/watch/${encodeURIComponent(episodeId)}`));
        if (response.ok) {
          const data = await response.json();
          if (data.sources && data.sources.length > 0) {
            console.log(`[API] ✅ AnimeUnity sources found`);
            return data;
          }
        }
      } catch (err) {
        console.error('[API] AnimeUnity fetch error:', err.message);
      }
    }

    console.warn(`[API] All providers failed. No playable stream found.`);
    return {
      provider: 'unavailable',
      sources: [],
      subtitles: [],
      error: 'No playable source was found for this episode. Try another episode.'
    };
  },

  // Builds a complete franchise list (all seasons, movies, OVAs)
  getFranchise: async (anilistId, title, relations) => {
    const baseTitle = getBaseTitle(title);
    if (!baseTitle) return [];

    console.log(`[API] Building franchise for: "${baseTitle}"`);

    // Map to keep track of franchise entries
    const franchiseMap = new Map();

    // Helper to format item for dropdown selection list
    const formatItem = (node) => ({
      id: node.id.toString(),
      title: node.title.english || node.title.romaji || node.title.userPreferred,
      format: node.format,
      coverImage: node.coverImage?.large || node.coverImage?.extraLarge,
      bannerImage: node.bannerImage,
      rating: node.averageScore ? (node.averageScore / 10).toFixed(1) : "N/A",
    });

    // 1. Add relations from current anime details
    if (relations?.edges) {
      for (const edge of relations.edges) {
        const node = edge.node;
        if (node.type === 'ANIME') {
          franchiseMap.set(node.id.toString(), formatItem(node));
        }
      }
    }

    // 2. Perform base title search on AniList to discover all seasons/movies (even indirect relations)
    try {
      const searchData = await fetchAniList(`
        query ($search: String) {
          Page(page: 1, perPage: 25) {
            media(type: ANIME, search: $search) {
              id
              title { english romaji userPreferred }
              format
              coverImage { large }
              bannerImage
              averageScore
            }
          }
        }
      `, { search: baseTitle });

      if (searchData?.Page?.media) {
        const baseWords = baseTitle.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        for (const item of searchData.Page.media) {
          const itemTitle = (item.title.english || item.title.romaji || item.title.userPreferred || '').toLowerCase();
          // Check if itemTitle contains all base words to keep results relevant
          const isMatch = baseWords.every(word => itemTitle.includes(word));
          if (isMatch) {
            franchiseMap.set(item.id.toString(), formatItem(item));
          }
        }
      }
    } catch (err) {
      console.warn(`[API] Franchise search failed:`, err.message);
    }

    // 3. Convert map to array and sort logically: TV (chronological) -> MOVIE -> OVA/ONA/SPECIAL
    const sortedList = Array.from(franchiseMap.values()).sort((a, b) => {
      const formatOrder = { 'TV': 1, 'TV_SHORT': 1, 'MOVIE': 2, 'OVA': 3, 'ONA': 4, 'SPECIAL': 5 };
      const orderA = formatOrder[a.format] || 99;
      const orderB = formatOrder[b.format] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return parseInt(a.id) - parseInt(b.id);
    });

    console.log(`[API] Found ${sortedList.length} items in franchise franchise for "${baseTitle}"`);
    return sortedList;
  }
};
