import axios from 'axios';

// Default microservice endpoints (can be overridden via localStorage or public/eetnet-config.json)
const DEFAULT_CONFIG = {
  ANIME_API:  import.meta.env.VITE_ANIME_API  || 'http://localhost:8080',
  DRAMA_API:  import.meta.env.VITE_DRAMA_API  || 'http://localhost:8081',
  COMICS_API: import.meta.env.VITE_COMICS_API || 'http://localhost:8082',
  MOVIES_API: import.meta.env.VITE_MOVIES_API || 'http://localhost:8083',
};

// Global API configuration store with runtime dynamic override capability
export let API_CONFIG = { ...DEFAULT_CONFIG };

// Load custom runtime config if available
export async function initApiConfig() {
  try {
    const saved = localStorage.getItem('eetnet_custom_apis');
    if (saved) {
      API_CONFIG = { ...API_CONFIG, ...JSON.parse(saved) };
      return API_CONFIG;
    }

    const res = await axios.get('/eetnet-config.json', { timeout: 3000 });
    if (res.data) {
      if (res.data.API_BASE) {
        // Unified tunnel fallback
        API_CONFIG.ANIME_API  = res.data.ANIME_API  || res.data.API_BASE;
        API_CONFIG.DRAMA_API  = res.data.DRAMA_API  || res.data.API_BASE;
        API_CONFIG.COMICS_API = res.data.COMICS_API || res.data.API_BASE;
        API_CONFIG.MOVIES_API = res.data.MOVIES_API || res.data.API_BASE;
      } else {
        API_CONFIG = { ...API_CONFIG, ...res.data };
      }
    }
  } catch (err) {
    // Keep defaults
  }
  return API_CONFIG;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ANIME API CLIENT (Port 8080)
// ─────────────────────────────────────────────────────────────────────────────
export const animeApi = {
  // AniList GraphQL Proxy
  postAniList: async (query, variables = {}) => {
    const res = await axios.post(`${API_CONFIG.ANIME_API}/api/anilist`, { query, variables });
    return res.data?.data;
  },

  // Anime Info & Episodes
  getInfo: async (anilistId) => {
    const res = await axios.get(`${API_CONFIG.ANIME_API}/api/info/${anilistId}`);
    return res.data;
  },

  // Primary Stream: HiAnime
  getHiAnimeStream: async (anilistId, episode = 1, dub = 'sub') => {
    const res = await axios.get(`${API_CONFIG.ANIME_API}/api/hianime/watch`, {
      params: { anilistId, episode, dub }
    });
    return res.data;
  },

  // Secondary Stream: AnimeKai
  getAnimeKaiStream: async (title, episode = 1, season = 1, dub = 'sub') => {
    const res = await axios.get(`${API_CONFIG.ANIME_API}/api/gogoanime/watch`, {
      params: { title, episode, season, dub }
    });
    return res.data;
  },

  // Hindi Dub Stream: AnimeRulz
  getHindiStream: async (anilistId, episode = 1, lang = 'hin') => {
    const res = await axios.get(`${API_CONFIG.ANIME_API}/api/animerulz/watch`, {
      params: { anilistId, episode, lang }
    });
    return res.data;
  },

  // Hindi Catalog
  getHindiCatalog: async (page = 1, limit = 50) => {
    const res = await axios.get(`${API_CONFIG.ANIME_API}/api/animerulz/catalog`, {
      params: { language: 'hindi', page, limit }
    });
    return res.data;
  },

  // MAL Episode Metadata (Titles, Filler Flags)
  getMalEpisodes: async (malId, page = 1) => {
    const res = await axios.get(`${API_CONFIG.ANIME_API}/api/episodes/mal/${malId}`, {
      params: { page }
    });
    return res.data;
  },

  // Search AnimeKai
  search: async (q) => {
    const res = await axios.get(`${API_CONFIG.ANIME_API}/api/search`, { params: { q } });
    return res.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. DRAMA API CLIENT (Port 8081)
// ─────────────────────────────────────────────────────────────────────────────
export const dramaApi = {
  getHome: async () => {
    const res = await axios.get(`${API_CONFIG.DRAMA_API}/api/drama/home`);
    return res.data;
  },

  getList: async (type = 0, q = '') => {
    const res = await axios.get(`${API_CONFIG.DRAMA_API}/api/drama/list`, {
      params: { type, q }
    });
    return res.data;
  },

  search: async (q) => {
    const res = await axios.get(`${API_CONFIG.DRAMA_API}/api/drama/search`, {
      params: { q }
    });
    return res.data;
  },

  getInfo: async (dramaId) => {
    const res = await axios.get(`${API_CONFIG.DRAMA_API}/api/drama/info/${dramaId}`);
    return res.data;
  },

  getStream: async (episodeId) => {
    const res = await axios.get(`${API_CONFIG.DRAMA_API}/api/drama/stream/${episodeId}`);
    return res.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. COMICS & MANGA API CLIENT (Port 8082)
// ─────────────────────────────────────────────────────────────────────────────
export const comicsApi = {
  getHome: async () => {
    const res = await axios.get(`${API_CONFIG.COMICS_API}/api/manga/home`);
    return res.data;
  },

  getCategory: async (type = 'manga', genre = 'all', page = 1) => {
    const res = await axios.get(`${API_CONFIG.COMICS_API}/api/manga/category/${type}`, {
      params: { genre, page }
    });
    return res.data;
  },

  getWebtoonHome: async () => {
    const res = await axios.get(`${API_CONFIG.COMICS_API}/api/webtoon/home`);
    return res.data;
  },

  search: async (q) => {
    const res = await axios.get(`${API_CONFIG.COMICS_API}/api/manga/search`, {
      params: { q }
    });
    return res.data;
  },

  getInfo: async (idOrSlug) => {
    const res = await axios.get(`${API_CONFIG.COMICS_API}/api/manga/info/${idOrSlug}`);
    return res.data;
  },

  getChapterPages: async (chapterId) => {
    const res = await axios.get(`${API_CONFIG.COMICS_API}/api/manga/read/${chapterId}`);
    return res.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. MOVIES & OTT API CLIENT (Port 8083)
// ─────────────────────────────────────────────────────────────────────────────
export const moviesApi = {
  getHome: async () => {
    const res = await axios.get(`${API_CONFIG.MOVIES_API}/api/movies/home`);
    return res.data;
  },

  getCatalog: async (page = 1, limit = 40, category = '', search = '', is18 = false) => {
    const res = await axios.get(`${API_CONFIG.MOVIES_API}/api/movieplex/catalog`, {
      params: { page, limit, category, search, is18: is18 ? 'true' : 'false' }
    });
    return res.data;
  },

  getStream: async (slug) => {
    const res = await axios.get(`${API_CONFIG.MOVIES_API}/api/movieplex/stream`, {
      params: { slug }
    });
    return res.data;
  },

  getNetmirrorTrending: async () => {
    const res = await axios.get(`${API_CONFIG.MOVIES_API}/api/netmirror/trending`);
    return res.data;
  },

  getNetmirrorStream: async (title, year = '') => {
    const res = await axios.get(`${API_CONFIG.MOVIES_API}/api/netmirror/stream-resolve`, {
      params: { title, year }
    });
    return res.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. ANISKIP API CLIENT (Intro/Outro Detection)
// ─────────────────────────────────────────────────────────────────────────────
export const aniSkipApi = {
  getSkipTimes: async (malId, episodeNum) => {
    if (!malId || !episodeNum) return null;
    try {
      const url = `https://api.aniskip.com/v2/skip-times/${malId}/${episodeNum}?types=op&types=ed&episodeLength=0`;
      const res = await axios.get(url, { timeout: 4000 });
      if (res.data?.found && Array.isArray(res.data.results)) {
        return res.data.results;
      }
    } catch (e) {
      // Non-fatal if AniSkip is unreachable
    }
    return null;
  },
};
