/**
 * ARCHIVE: NetMirror & Movies Backend Workload
 * Preserved on: 2026-08-06
 * Location: archive_movies_netmirror/server_netmirror_movies_routes.js
 */

const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

// ── NetMirror Auth & Config ──────────────────────────────────────────────────
const NETMIRROR_BASE = process.env.NETMIRROR_BASE || 'https://net52.cc';
const NETMIRROR_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36 /OS.Gatu v3.0';
let netmirrorToken = null;
let netmirrorTokenExpiry = 0;

async function getNetmirrorToken() {
  const now = Date.now();
  if (netmirrorToken && now < netmirrorTokenExpiry) return netmirrorToken;

  try {
    const fakeCaptcha = crypto.randomUUID();
    const tokenRes = await axios.post(`${NETMIRROR_BASE}/verify.php`,
      new URLSearchParams({ 'g-recaptcha-response': fakeCaptcha }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': NETMIRROR_BASE,
          'Referer': `${NETMIRROR_BASE}/verify2`,
          'User-Agent': NETMIRROR_UA,
        },
        maxRedirects: 0,
        validateStatus: () => true,
        timeout: 10000,
      }
    );

    const cookies = (tokenRes.headers['set-cookie'] || []).join('; ');
    const match = cookies.match(/t_hash_t=([^;]+)/);
    if (!match) throw new Error('No t_hash_t cookie returned');

    netmirrorToken = decodeURIComponent(match[1]);
    netmirrorTokenExpiry = now + (2 * 60 * 60 * 1000);
    return netmirrorToken;
  } catch (err) {
    console.error('[NetMirror] Auth token fetch failed:', err.message);
    throw err;
  }
}

async function netmirrorApi(path, { ott = 'nf', params = {}, expectJson = true } = {}) {
  const token = await getNetmirrorToken();
  const cookie = `t_hash_t=${token}; ott=${ott}; hd=on`;
  const fullParams = { t: Math.floor(Date.now() / 1000), ...params };

  try {
    const res = await axios.get(`${NETMIRROR_BASE}/mobile/${path}`, {
      params: fullParams,
      headers: {
        'Cookie': cookie,
        'User-Agent': NETMIRROR_UA,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `${NETMIRROR_BASE}/home`,
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
    });

    const data = res.data;
    if (expectJson && data && data.status === 'n') {
      netmirrorToken = null;
      netmirrorTokenExpiry = 0;
      return netmirrorApi(path, { ott, params, expectJson });
    }
    return data;
  } catch (err) {
    console.error(`[NetMirror] API call failed (${path}):`, err.message);
    throw err;
  }
}

// ── TMDB Config & Helpers ────────────────────────────────────────────────────
const TMDB_API_KEY = '4e44d9029b1270a757cddc766a1bcb63';
const TMDB_BASE = 'https://api.themoviedb.org/3';

const tmdbAxios = axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': 'application/json'
  }
});

const TMDB_GENRES = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
  10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western"
};

function getTmdbUrl(path, params = {}) {
  const urlParams = new URLSearchParams({ api_key: TMDB_API_KEY, ...params });
  return `${TMDB_BASE}${path}?${urlParams.toString()}`;
}

function mapTmdbMovie(m) {
  if (!m) return null;
  return {
    id: m.id,
    title: m.title || m.original_title,
    coverImage: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
    bannerImage: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : (m.poster_path ? `https://image.tmdb.org/t/p/w1280${m.poster_path}` : null),
    rating: typeof m.vote_average === 'number' ? m.vote_average.toFixed(1) : 'N/A',
    type: 'movie',
    releaseDate: m.release_date,
    description: m.overview || '',
    genres: (m.genre_ids || []).map(id => TMDB_GENRES[id]).filter(Boolean)
  };
}

// ── Archived Routes ──────────────────────────────────────────────────────────
module.exports = {
  getNetmirrorToken,
  netmirrorApi,
  getTmdbUrl,
  mapTmdbMovie,
};
