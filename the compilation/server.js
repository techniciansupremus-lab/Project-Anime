/**
 * ============================================================================
 * ⚠️ AUTO-GENERATED MONOLITH SERVER — DO NOT EDIT DIRECTLY!
 * ============================================================================
 *
 * Source of Truth:
 *   - services/anime/server.js
 *   - services/drama/server.js
 *   - services/comics/server.js
 *   - services/movies/server.js
 *
 * Recompile with:
 *   npm run build:server   (or: node scripts/compile_monolith.js)
 *
 * Run with:
 *   npm start              (or: node "the compilation/server.js")
 * ============================================================================
 */

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import crypto from 'crypto';
import vm from 'node:vm';
import { ANIME, META } from '@consumet/extensions';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 8080;
const startedAt = new Date();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));

// URL Normalizer: Ensures /anime/..., /drama/..., /manga/..., /movies/... map to /api/...
app.use((req, res, next) => {
  if (req.url && !req.url.startsWith('/api/') && req.url !== '/api') {
    req.url = '/api' + req.url;
  }
  next();
});

// Global Shared Helpers
function publicHost(req) {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http')
    .toString().split(',')[0].trim();
  return `${proto}://${req.get('host')}`;
}

function safeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return value || '';
  }
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function streamProxyHeaders(targetUrl, referer, extraHeaders = {}) {
  return {
    'User-Agent': BROWSER_UA,
    'Accept': '*/*',
    ...extraHeaders,
    'Referer': referer,
    'Origin': safeOrigin(referer),
  };
}

// ============================================================================
// 📦 MODULE: ANIME SERVICE
// ============================================================================




// Normalizer


// Helpers



}

function unwrapM3u8ProxyUrl(value, maxDepth = 8) {
  let resolved = value;
  for (let depth = 0; depth < maxDepth; depth += 1) {
    try {
      const parsed = new URL(resolved);
      if (parsed.pathname !== '/api/m3u8-proxy') break;
      const nested = parsed.searchParams.get('url');
      if (!nested) break;
      resolved = nested;
    } catch {
      break;
    }
  }
  return resolved;
}

function unwrapStreamIndiaRelayUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.hostname !== 'proxy.streamindia.co.in' || parsed.pathname !== '/proxy') return value;
    const directUrl = parsed.searchParams.get('url');
    return directUrl?.startsWith('http') ? directUrl : value;
  } catch {
    return value;
  }
}





function streamProxyReferers(targetUrl, primaryReferer) {
  const candidates = [primaryReferer];
  if (targetUrl.includes('streamindia.co.in')) {
    candidates.push(
      'https://animerulzapp.buzz/',
      'https://animelok.streamindia.co.in/',
      'https://extract.streamindia.co.in/',
      'https://proxy.streamindia.co.in/',
      new URL(targetUrl).origin + '/',
    );
  }
  return [...new Set(candidates.filter(Boolean))];
}

async function fetchStreamProxyTarget(targetUrl, primaryReferer, options = {}) {
  const { headers: extraHeaders = {}, ...axiosOptions } = options;
  let lastError;

  for (const referer of streamProxyReferers(targetUrl, primaryReferer)) {
    try {
      const response = await axios.get(targetUrl, {
        ...axiosOptions,
        headers: {
          ...streamProxyHeaders(targetUrl, referer, extraHeaders),
        },
      });
      return response;
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      const canRetry = targetUrl.includes('streamindia.co.in') && [401, 403, 429, 502].includes(status);
      if (!canRetry) throw err;
    }
  }

  throw lastError;
}

// ─────────────────────────────────────────────────────
// CONSUMET & SCRAPER PROVIDERS
// ─────────────────────────────────────────────────────
const animeUnity = new ANIME.AnimeUnity();
const anilistMeta = new META.Anilist(animeUnity);

const hianime = new ANIME.Hianime();
const anilistHianime = new META.Anilist(hianime);

const hiAnimeEpCache = new Map();
const HIANIME_TTL = 30 * 60 * 1000;

const ANIMEKAI_BASE = 'https://anikai.cc';
const AXIOS_OPTS = {
  timeout: 12000,
  maxRedirects: 5,
  httpsAgent,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': ANIMEKAI_BASE + '/',
  }
};

const animeCache = new Map();
const CACHE_TTL = 60 * 60 * 1000;

const streamCache = new Map();
const STREAM_CACHE_TTL = 20 * 60 * 1000;

const jikanCache = new Map();
const JIKAN_TTL = 60 * 60 * 1000;

// ─────────────────────────────────────────────────────
// ANIMERULZ (HINDI DUB) CONFIG
// ─────────────────────────────────────────────────────
const ANIMERULZ_FALLBACK = process.env.ANIMERULZ_FALLBACK || 'https://fallback.streamindia.co.in';
const ANIMERULZ_DATA     = process.env.ANIMERULZ_DATA     || 'https://data.streamindia.co.in';
const ANIMERULZ_ANIMELOK = process.env.ANIMERULZ_ANIMELOK || 'https://animelok.streamindia.co.in';
const ANIMERULZ_EXTRACT  = process.env.ANIMERULZ_EXTRACT  || 'https://extract.streamindia.co.in';
const ANIMERULZ_HIANIME  = process.env.ANIMERULZ_HIANIME  || 'https://hianime.streamindia.co.in';
const ANIMERULZ_CACHE_TTL = 30 * 60 * 1000;

const ANIMERULZ_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://animerulzapp.buzz/',
  'Origin': 'https://animerulzapp.buzz',
};

const animerulzStreamCache = new Map();
const animerulzDataCache   = new Map();

// ─────────────────────────────────────────────────────
// ANIMEKAI SCRAPER FUNCTIONS
// ─────────────────────────────────────────────────────
async function extractDirectStream(embedUrl) {
  try {
    const { data } = await axios.get(embedUrl, {
      ...AXIOS_OPTS,
      headers: {
        ...AXIOS_OPTS.headers,
        'Referer': ANIMEKAI_BASE + '/'
      }
    });

    const srcMatch = data.match(/const\s+src\s*=\s*["']([^"']+\.m3u8[^"']*)["']/);
    const m3u8Match = data.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
    const streamUrl = srcMatch?.[1] || m3u8Match?.[1];

    if (!streamUrl) return null;

    const url = new URL(embedUrl);
    const subtitleUrl = url.searchParams.get('sub') || null;

    return {
      streamUrl,
      subtitleUrl,
      headers: { 'Referer': new URL(embedUrl).origin + '/' }
    };
  } catch (err) {
    return null;
  }
}

function cleanAnimeTitle(t) {
  return t.toLowerCase()
    .replace(/\s*\((tv|sub|dub|uncensored|media)\)/gi, '')
    .replace(/\s*\(season\s*\d+\)/gi, '')
    .trim();
}

function titleMatchScore(resultName, targetTitle) {
  const r = resultName.toLowerCase().trim();
  const t = targetTitle.toLowerCase().trim();
  const rClean = cleanAnimeTitle(resultName);
  const tClean = cleanAnimeTitle(targetTitle);

  if (r === t || rClean === tClean) return 100;

  const isSequel = /\b(season\s*\d|\d+(st|nd|rd|th)\s+season|part\s*\d|cour\s*\d|movie|movie\s*\d)\b/i.test(r) ||
                   /\b(culling game|shibuya|mugen train|entertainment district|swordsmith|hashira)\b/i.test(r);

  const targetHasSequel = /\b(season\s*\d|\d+(st|nd|rd|th)\s+season|part\s*\d)\b/i.test(t);

  let score = 50;
  if (rClean.startsWith(tClean)) {
    score = 80;
  } else if (rClean.includes(tClean)) {
    score = 60;
  }

  if (isSequel && !targetHasSequel) {
    score -= 45;
  } else if (isSequel && targetHasSequel) {
    score += 20;
  }

  return Math.max(0, score);
}

async function animeKaiSearch(title, seasonNum = null) {
  const performSearch = async (query) => {
    try {
      const url = `${ANIMEKAI_BASE}/browser?keyword=${encodeURIComponent(query)}`;
      const { data } = await axios.get(url, AXIOS_OPTS);
      const $ = cheerio.load(data);
      const results = [];
      $('.aitem').each((_, el) => {
        const poster = $(el).find('a.poster');
        const href = poster.attr('href') || '';
        const slug = href.replace('/watch/', '').trim();
        const name = $(el).find('a.title').text().trim();
        if (slug && name) results.push({ slug, name });
      });
      return results;
    } catch (err) {
      return [];
    }
  };

  const pickBest = (results, targetTitle) => {
    if (results.length === 0) return null;
    const scored = results.map(r => {
      let score = titleMatchScore(r.name, targetTitle);
      if (seasonNum !== null) {
        const nameLC = r.name.toLowerCase();
        const seasonPatterns = [
          new RegExp(`season\\s*${seasonNum}\\b`, 'i'),
          new RegExp(`\\b${seasonNum}(st|nd|rd|th)\\s+season\\b`, 'i'),
          new RegExp(`part\\s*${seasonNum}\\b`, 'i'),
        ];
        if (seasonPatterns.some(p => p.test(nameLC))) score += 30;
        const otherSeasonMatch = nameLC.match(/season\s*(\d+)/i) || nameLC.match(/(\d+)(?:st|nd|rd|th)\s+season/i);
        if (otherSeasonMatch) {
          const foundSeason = parseInt(otherSeasonMatch[1]);
          if (foundSeason !== seasonNum) score -= 50;
        }
        if (seasonNum === 1 && !nameLC.match(/season\s*\d/i)) score += 10;
      }
      return { ...r, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].slug;
  };

  if (seasonNum && seasonNum > 1) {
    const seasonQuery = `${title} Season ${seasonNum}`;
    let results = await performSearch(seasonQuery);
    const best = pickBest(results, seasonQuery);
    if (best) return best;
  }

  let results = await performSearch(title);
  {
    const best = pickBest(results, title);
    if (best) return best;
  }

  const sanitized = title.replace(/[.\-\u2013\u2014:,\s]+$/, '').replace(/\([^)]*\)/g, '').trim();
  if (sanitized && sanitized !== title) {
    results = await performSearch(sanitized);
    const best = pickBest(results, sanitized);
    if (best) return best;
  }

  const parts = sanitized.split(/[:\-\u2013\u2014]/);
  if (parts.length > 1) {
    const base = parts[0].trim();
    if (base && base !== sanitized) {
      results = await performSearch(base);
      const best = pickBest(results, base);
      if (best) return best;
    }
  }

  return null;
}

async function animeKaiGetEpisodeEmbeds(slug, episodeNum) {
  const url = `${ANIMEKAI_BASE}/watch/${slug}/ep-${episodeNum}`;
  const { data } = await axios.get(url, AXIOS_OPTS);
  const $ = cheerio.load(data);
  const servers = { sub: [], dub: [], hsub: [] };

  $('.server-items.lang-group').each((_, group) => {
    const langId = $(group).attr('data-id') || 'sub';
    $(group).find('.server-video').each((_, el) => {
      const embedUrl = $(el).attr('data-video') || '';
      const serverName = $(el).text().trim();
      const isDefault = $(el).hasClass('default');
      if (embedUrl) {
        servers[langId] = servers[langId] || [];
        servers[langId].push({ embedUrl, serverName, isDefault });
      }
    });
  });

  return servers;
}

// ─────────────────────────────────────────────────────
// ANIMERULZ (HINDI DUB) FUNCTIONS
// ─────────────────────────────────────────────────────
function normalizeAnimerulzCatalog(data) {
  const rawItems = Array.isArray(data) ? data : data?.data || data?.results || [];
  return rawItems
    .filter(item => item?.animerulz_id && Array.isArray(item.languages))
    .map(item => ({
      animerulz_id: item.animerulz_id,
      animelok_id: item.animelok_id,
      languages: item.languages.map(language => String(language).toLowerCase()),
    }));
}

async function fetchAnimerulzCatalog() {
  const cacheKey = 'catalog';
  const cached = animerulzDataCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ANIMERULZ_CACHE_TTL) return cached.data;

  const { data } = await axios.get(`${ANIMERULZ_DATA}/api/dub.json`, {
    timeout: 12000,
    headers: ANIMERULZ_HEADERS,
  });
  const catalog = normalizeAnimerulzCatalog(data);
  animerulzDataCache.set(cacheKey, { data: catalog, ts: Date.now() });
  return catalog;
}

async function fetchAnimerulzEpisodes(anilistId) {
  const cacheKey = `episodes:${anilistId}`;
  const cached = animerulzDataCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ANIMERULZ_CACHE_TTL) return cached.data;

  try {
    const { data } = await axios.get(`${ANIMERULZ_FALLBACK}/episodes/${anilistId}`, {
      timeout: 10000,
      headers: ANIMERULZ_HEADERS,
    });
    if (data?.data) {
      animerulzDataCache.set(cacheKey, { data: data.data, ts: Date.now() });
      return data.data;
    }
  } catch (err) {}
  return [];
}

async function checkAnimerulzAvailability(anilistId) {
  const cacheKey = `avail:${anilistId}`;
  const cached = animerulzDataCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ANIMERULZ_CACHE_TTL) return cached.data;

  try {
    const catalog = await fetchAnimerulzCatalog();
    const catalogItem = catalog.find(item => item.animerulz_id === `anime-${anilistId}`);
    if (catalogItem) {
      animerulzDataCache.set(cacheKey, { data: catalogItem, ts: Date.now() });
      return catalogItem;
    }
  } catch (err) {}

  try {
    const { data } = await axios.get(`${ANIMERULZ_DATA}/api/animerulz-id=anime-${anilistId}`, {
      timeout: 8000,
      headers: ANIMERULZ_HEADERS,
    });
    if (data?.languages) {
      animerulzDataCache.set(cacheKey, { data, ts: Date.now() });
      return data;
    }
  } catch (err) {}
  return null;
}

async function resolveAnimerulzStream(anilistId, episodeNum, lang = 'hin') {
  const cacheKey = `${anilistId}:e${episodeNum}:${lang}`;
  const cached = animerulzStreamCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ANIMERULZ_CACHE_TTL) return cached.data;

  let result = null;
  const avail = await checkAnimerulzAvailability(anilistId);
  const languageNames = { hin: 'hindi', tam: 'tamil', tel: 'telugu', mal: 'malayalam', kan: 'kannada', ben: 'bengali' };
  const langCode = lang.toLowerCase();
  const requestedLanguage = languageNames[langCode];

  if (requestedLanguage && !avail?.languages?.includes(requestedLanguage)) {
    return null;
  }

  if (avail?.animelok_id && avail.languages) {
    const rawIds = Array.isArray(avail.animelok_id) ? avail.animelok_id : [avail.animelok_id];
    const seasons = rawIds.map(id => {
      const raw = String(id || '').trim();
      if (!raw) return null;
      const m = raw.match(/^(.+)-(\d+)x(\d+)$/);
      return m
        ? { slug: m[1], season: parseInt(m[2]), startEp: parseInt(m[3]), raw }
        : { slug: raw, season: 1, startEp: 1, raw };
    }).filter(Boolean).sort((a, b) => b.startEp - a.startEp);

    let targetSeason = seasons.find(s => s.startEp <= episodeNum) || seasons[seasons.length - 1];
    let relativeEp = targetSeason ? episodeNum - targetSeason.startEp + 1 : episodeNum;

    if (targetSeason && relativeEp >= 1) {
      try {
        const alUrl = `${ANIMERULZ_ANIMELOK}/api/anime?id=${encodeURIComponent(targetSeason.raw)}&ep=${relativeEp}`;
        const alRes = await axios.get(alUrl, {
          timeout: 10000,
          headers: ANIMERULZ_HEADERS,
        });

        if (alRes.data?.multi) {
          const extUrl = `${ANIMERULZ_EXTRACT}/api?url=${encodeURIComponent(alRes.data.multi)}`;
          const extRes = await axios.get(extUrl, {
            timeout: 12000,
            headers: ANIMERULZ_HEADERS,
          });

          if (extRes.data?.files?.[langCode]) {
            const m3u8Url = extRes.data.files[langCode];
            result = {
              type: 'hls',
              streamUrl: m3u8Url,
              sources: [{
                url: m3u8Url,
                isM3U8: true,
                quality: 'auto',
                language: langCode.toUpperCase() === 'HIN' ? 'Hindi Dub'
                       : langCode.toUpperCase() === 'TAM' ? 'Tamil Dub'
                       : langCode.toUpperCase() === 'TEL' ? 'Telugu Dub'
                       : langCode.toUpperCase() === 'ENG' ? 'English Dub'
                       : langCode.toUpperCase() === 'JPN' ? 'Japanese Sub'
                       : langCode.toUpperCase(),
                audioMode: 'hindi',
              }],
              subtitles: [],
              headers: {},
              provider: 'animerulz',
              language: langCode,
              audioMode: 'hindi',
              availableLanguages: extRes.data.available_categories || [],
            };
          }
        }
      } catch (err) {}
    }
  }

  if (result) {
    animerulzStreamCache.set(cacheKey, { data: result, ts: Date.now() });
  }
  return result;
}

// ─────────────────────────────────────────────────────
// ANIME ROUTES
// ─────────────────────────────────────────────────────

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'eetnet-anime-api',
    uptime: Math.floor((Date.now() - startedAt.getTime()) / 1000),
    port: PORT,
  });
});

// POST /api/anilist
const aniListServerCache = new Map();
const ANILIST_CACHE_TTL = 60 * 60 * 1000;

app.post('/api/anilist', async (req, res) => {
  try {
    const payload = JSON.stringify(req.body);
    const cached = aniListServerCache.get(payload);
    if (cached && Date.now() - cached.ts < ANILIST_CACHE_TTL) {
      return res.json({ data: cached.data });
    }

    let attempts = 0;
    let response = null;

    while (attempts < 3) {
      attempts++;
      try {
        response = await axios.post('https://graphql.anilist.co', req.body, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) EetNet/1.0'
          },
          timeout: 12000
        });
        if (response.status === 200 && response.data?.data) {
          aniListServerCache.set(payload, { data: response.data.data, ts: Date.now() });
          return res.json({ data: response.data.data });
        }
      } catch (e) {
        const status = e.response?.status;
        if (status === 429 && attempts < 3) {
          await new Promise(r => setTimeout(r, attempts * 500));
        } else {
          if (cached) return res.json({ data: cached.data });
          throw e;
        }
      }
    }

    if (cached) return res.json({ data: cached.data });
    res.status(502).json({ error: 'AniList GraphQL proxy failed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/info/:anilistId
app.get('/api/info/:anilistId', async (req, res) => {
  const { anilistId } = req.params;
  try {
    const info = await anilistMeta.fetchAnimeInfo(anilistId);
    res.json({
      id: info.id,
      title: info.title,
      description: info.description,
      image: info.image,
      cover: info.cover,
      rating: info.rating,
      type: info.type,
      status: info.status,
      totalEpisodes: info.totalEpisodes,
      currentEpisode: info.currentEpisode,
      duration: info.duration,
      genres: info.genres,
      subOrDub: info.subOrDub,
      episodes: (info.episodes || []).map(ep => ({
        id: ep.id,
        number: ep.number,
        title: ep.title || null,
        image: ep.image || null,
        url: ep.url || null
      }))
    });
  } catch (err) {
    res.status(502).json({ error: 'Could not fetch episode data', message: err.message });
  }
});

// GET /api/gogoanime/watch (AnimeKai stream)
app.get('/api/gogoanime/watch', async (req, res) => {
  const { title, episode, season, dub } = req.query;
  const episodeNum = parseInt(episode) || 1;
  const seasonNum = season ? parseInt(season) : null;
  const host = publicHost(req);
  const wantDub = dub === 'eng';

  if (!title) return res.status(400).json({ error: 'Missing title parameter' });

  const effectiveSeason = seasonNum || 1;
  const cacheKey = `${title.toUpperCase().trim()}::s${effectiveSeason}`;

  try {
    let cached = animeCache.get(cacheKey);
    const now = Date.now();

    if (!cached || now - cached.timestamp > CACHE_TTL) {
      const slug = await animeKaiSearch(title, seasonNum);
      if (!slug) {
        return res.status(404).json({ error: `Anime "${title}" not found on AnimeKai` });
      }
      cached = { slug, timestamp: now };
      animeCache.set(cacheKey, cached);
    }

    const servers = await animeKaiGetEpisodeEmbeds(cached.slug, episodeNum);
    const candidates = [];
    if (wantDub) {
      if (servers.dub?.length > 0) servers.dub.forEach(x => candidates.push({ embedUrl: x.embedUrl, language: 'English Dub', server: x.serverName }));
      if (servers.sub?.length > 0) servers.sub.forEach(x => candidates.push({ embedUrl: x.embedUrl, language: 'English Sub', server: x.serverName }));
    } else {
      if (servers.sub?.length > 0) {
        const s = servers.sub.find(x => x.isDefault) || servers.sub[0];
        candidates.push({ embedUrl: s.embedUrl, language: 'English Sub', server: s.serverName });
        servers.sub.filter(x => !x.isDefault).forEach(x => candidates.push({ embedUrl: x.embedUrl, language: 'English Sub', server: x.serverName }));
      }
      if (servers.hsub?.length > 0) servers.hsub.forEach(x => candidates.push({ embedUrl: x.embedUrl, language: 'English Sub (Hardsub)', server: x.serverName }));
      if (servers.dub?.length > 0) servers.dub.forEach(x => candidates.push({ embedUrl: x.embedUrl, language: 'English Dub', server: x.serverName }));
    }

    if (candidates.length === 0) return res.status(404).json({ error: `No streams found for episode ${episodeNum}` });

    const streamCacheKey = `${cached.slug}::ep${episodeNum}::${dub || 'sub'}`;
    const cachedStream = streamCache.get(streamCacheKey);
    if (cachedStream && Date.now() - cachedStream.timestamp < STREAM_CACHE_TTL) {
      const s = cachedStream.data;
      return res.json({
        provider: 'animekai',
        type: 'hls',
        streamUrl: `${host}/api/m3u8-proxy?url=${encodeURIComponent(s.streamUrl)}&referer=${encodeURIComponent(s.headers.Referer)}`,
        subtitleUrl: s.subtitleUrl,
        headers: s.headers,
        episode: episodeNum,
        language: s.language,
        server: s.server,
        cached: true
      });
    }

    let directStream = null;
    let chosenLanguage = 'English Sub';
    let chosenServer = 'unknown';

    const top3 = candidates.slice(0, 3);
    try {
      const result = await Promise.any(
        top3.map(async (candidate) => {
          const extracted = await extractDirectStream(candidate.embedUrl);
          if (!extracted) throw new Error(`${candidate.server} failed`);
          return { extracted, language: candidate.language, server: candidate.server };
        })
      );
      directStream = result.extracted;
      chosenLanguage = result.language;
      chosenServer = result.server;
    } catch {
      for (const candidate of candidates.slice(3)) {
        const extracted = await extractDirectStream(candidate.embedUrl);
        if (extracted) {
          directStream = extracted;
          chosenLanguage = candidate.language;
          chosenServer = candidate.server;
          break;
        }
      }
    }

    if (!directStream) {
      const fallback = candidates[0];
      return res.json({
        provider: 'animekai',
        type: 'iframe',
        iframeSrc: fallback.embedUrl,
        episode: episodeNum,
        language: fallback.language,
        allServers: servers
      });
    }

    streamCache.set(streamCacheKey, {
      data: {
        streamUrl: directStream.streamUrl,
        subtitleUrl: directStream.subtitleUrl,
        headers: directStream.headers,
        language: chosenLanguage,
        server: chosenServer
      },
      timestamp: Date.now()
    });

    res.json({
      provider: 'animekai',
      type: 'hls',
      streamUrl: `${host}/api/m3u8-proxy?url=${encodeURIComponent(directStream.streamUrl)}&referer=${encodeURIComponent(directStream.headers.Referer)}`,
      subtitleUrl: directStream.subtitleUrl,
      headers: directStream.headers,
      episode: episodeNum,
      language: chosenLanguage,
      server: chosenServer,
      allServers: servers
    });
  } catch (err) {
    res.status(500).json({ error: 'AnimeKai scraper error', message: err.message });
  }
});

// GET /api/hianime/watch (HiAnime stream)
app.get('/api/hianime/watch', async (req, res) => {
  const { anilistId, episode, dub } = req.query;
  const episodeNum = parseInt(episode) || 1;
  const subOrDub = dub === 'eng' ? 'dub' : 'sub';

  if (!anilistId) return res.status(400).json({ error: 'Missing anilistId parameter' });

  try {
    const cacheKey = `${anilistId}:${subOrDub}`;
    let epList = null;
    const cached = hiAnimeEpCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < HIANIME_TTL) {
      epList = cached.episodes;
    } else {
      const info = await anilistHianime.fetchAnimeInfo(anilistId, true);
      if (!info?.episodes?.length) {
        return res.status(404).json({ error: `No episodes found on HiAnime for AniList ID ${anilistId}` });
      }
      epList = info.episodes;
      hiAnimeEpCache.set(cacheKey, { episodes: epList, timestamp: Date.now() });
    }

    const ep = epList.find(e => e.number === episodeNum);
    if (!ep) return res.status(404).json({ error: `Episode ${episodeNum} not found on HiAnime` });

    const sources = await hianime.fetchEpisodeSources(ep.id, undefined, subOrDub);
    if (!sources?.sources?.length) {
      return res.status(404).json({ error: `No stream sources found for this episode` });
    }

    return res.json({
      provider: 'hianime',
      type: 'hls',
      sources: sources.sources,
      subtitles: sources.subtitles || [],
      episode: episodeNum,
      episodeTitle: ep.title || null,
      audioMode: subOrDub
    });
  } catch (err) {
    return res.status(500).json({ error: 'HiAnime lookup failed', message: err.message });
  }
});

// GET /api/watch/:episodeId (AnimeUnity fallback stream)
app.get('/api/watch/:episodeId', async (req, res) => {
  const episodeId = req.params.episodeId;
  try {
    const sources = await anilistMeta.fetchEpisodeSources(episodeId);
    if (sources.sources?.length > 0) {
      return res.json({
        provider: 'animeunity',
        type: 'hls',
        sources: sources.sources,
        subtitles: sources.subtitles || [],
        headers: sources.headers || {}
      });
    }
  } catch (err) {}

  try {
    const sources = await animeUnity.fetchEpisodeSources(episodeId);
    if (sources.sources?.length > 0) {
      return res.json({
        provider: 'animeunity-direct',
        type: 'hls',
        sources: sources.sources,
        subtitles: sources.subtitles || [],
        headers: sources.headers || {}
      });
    }
  } catch (err) {}

  res.status(404).json({ error: 'Could not find streaming sources for this episode' });
});

// GET /api/search
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing q parameter' });
  try {
    const slug = await animeKaiSearch(query);
    res.json({ slug, results: slug ? [{ slug }] : [] });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/animerulz/watch (Hindi Dub stream)
app.get('/api/animerulz/watch', async (req, res) => {
  const { anilistId, episode, lang } = req.query;
  const ep = parseInt(episode) || 1;
  const language = lang || 'hin';

  if (!anilistId) return res.status(400).json({ error: 'Missing anilistId parameter' });

  try {
    const result = await resolveAnimerulzStream(anilistId, ep, language);
    if (!result) {
      return res.status(404).json({
        error: 'Stream not found',
        message: `No stream found for anime ${anilistId} episode ${ep} language ${language}.`,
        anilistId, episode: ep, language,
      });
    }

    const host = publicHost(req);
    const referer = result.headers?.Referer || 'https://animerulzapp.buzz/';
    const proxyHlsUrl = (value) => {
      const rawUrl = unwrapM3u8ProxyUrl(value);
      if (!rawUrl || !rawUrl.includes('.m3u8')) return value;
      return `${host}/api/m3u8-proxy?url=${encodeURIComponent(rawUrl)}&referer=${encodeURIComponent(referer)}`;
    };

    res.json({
      ...result,
      streamUrl: proxyHlsUrl(result.streamUrl),
      sources: (result.sources || []).map(source => ({
        ...source,
        url: proxyHlsUrl(source.url),
      })),
    });
  } catch (err) {
    res.status(502).json({ error: 'Stream resolution failed', message: err.message });
  }
});

// GET /api/animerulz/episodes
app.get('/api/animerulz/episodes', async (req, res) => {
  const { anilistId } = req.query;
  if (!anilistId) return res.status(400).json({ error: 'Missing anilistId parameter' });

  try {
    const episodes = await fetchAnimerulzEpisodes(anilistId);
    res.json({ total: episodes.length, episodes });
  } catch (err) {
    res.status(502).json({ error: 'Episode fetch failed', message: err.message });
  }
});

// GET /api/animerulz/availability
app.get('/api/animerulz/availability', async (req, res) => {
  const { anilistId } = req.query;
  if (!anilistId) return res.status(400).json({ error: 'Missing anilistId parameter' });

  try {
    const avail = await checkAnimerulzAvailability(anilistId);
    if (avail) {
      res.json({ available: true, languages: avail.languages, animerulz_id: avail.animerulz_id });
    } else {
      res.json({ available: false });
    }
  } catch (err) {
    res.status(502).json({ error: 'Availability check failed', message: err.message });
  }
});

// GET /api/animerulz/catalog
app.get('/api/animerulz/catalog', async (req, res) => {
  const language = String(req.query.language || req.query.lang || 'hindi').toLowerCase();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 50));

  try {
    const items = (await fetchAnimerulzCatalog())
      .filter(item => item.languages.includes(language));
    const total = items.length;
    const start = (page - 1) * limit;

    res.json({
      language,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      items: items.slice(start, start + limit),
    });
  } catch (err) {
    res.status(502).json({ error: 'Hindi catalogue fetch failed', message: err.message });
  }
});

// GET /api/episodes/mal/:malId (Jikan MAL Episode Metadata)
app.get('/api/episodes/mal/:malId', async (req, res) => {
  const { malId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const cacheKey = `${malId}:${page}`;

  const cached = jikanCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < JIKAN_TTL) {
    return res.json(cached.data);
  }

  try {
    const jikanUrl = `https://api.jikan.moe/v4/anime/${malId}/episodes?page=${page}`;
    const { data } = await axios.get(jikanUrl, {
      timeout: 10000,
      headers: { 'Accept': 'application/json', 'User-Agent': 'EetNet/1.0' }
    });

    const episodes = (data.data || []).map(ep => ({
      number: ep.mal_id,
      title: ep.title || `Episode ${ep.mal_id}`,
      titleJapanese: ep.title_japanese || null,
      aired: ep.aired ? ep.aired.split('T')[0] : null,
      score: ep.score || null,
      filler: ep.filler || false,
      recap: ep.recap || false,
    }));

    const result = {
      episodes,
      pagination: {
        currentPage: page,
        lastPage: data.pagination?.last_visible_page || 1,
        hasNextPage: data.pagination?.has_next_page || false,
        total: (data.pagination?.last_visible_page || 1) * 100
      }
    };

    jikanCache.set(cacheKey, { data: result, timestamp: Date.now() });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'Could not fetch episode data from Jikan', message: err.message });
  }
});

// GET /api/status
app.get('/api/status', async (req, res) => {
  res.json({
    status: 'ok',
    service: 'eetnet-anime-api',
    uptime: Math.floor((Date.now() - startedAt.getTime()) / 1000),
    checkedAt: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────
// HLS & ASSET PROXIES
// ─────────────────────────────────────────────────────
app.get('/api/m3u8-proxy', async (req, res) => {
  const { url, referer } = req.query;
  if (!url) return res.status(400).send('Missing url');

  try {
    const decodedUrl  = unwrapM3u8ProxyUrl(decodeURIComponent(url));
    const decodedRef  = referer ? decodeURIComponent(referer) : (new URL(decodedUrl).origin + '/');

    const { data } = await fetchStreamProxyTarget(decodedUrl, decodedRef, {
      responseType: 'text',
    });

    const host = publicHost(req);
    const childReferer = new URL(decodedUrl).origin + '/';
    const resolveManifestUrl = (value) => {
      let v = String(value || '').trim();
      if (v.startsWith('//')) {
        v = 'https:' + v;
      }
      return unwrapStreamIndiaRelayUrl(new URL(v, decodedUrl).toString());
    };
    const proxyManifestUrl = (value) =>
      `${host}/api/m3u8-proxy?url=${encodeURIComponent(resolveManifestUrl(value))}&referer=${encodeURIComponent(childReferer)}`;
    const proxySegmentUrl = (value) =>
      `${host}/api/ts-proxy?url=${encodeURIComponent(resolveManifestUrl(value))}&referer=${encodeURIComponent(childReferer)}`;

    let isStreamInf = false;

    const rewritten = data.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith('#')) {
        if (trimmed.startsWith('#EXT-X-STREAM-INF') || trimmed.startsWith('#EXT-X-I-FRAME-STREAM-INF')) {
          isStreamInf = true;
        }
        return line.replace(/(URI=)(["'])([^"']+)\2/gi, (match, prefix, quote, uri) => {
          if (!uri || uri.startsWith('data:')) return match;
          const isPlaylist = uri.includes('.m3u8') || trimmed.toUpperCase().startsWith('#EXT-X-MEDIA');
          const proxied = isPlaylist ? proxyManifestUrl(uri) : proxySegmentUrl(uri);
          return `${prefix}${quote}${proxied}${quote}`;
        });
      }

      const abs = resolveManifestUrl(trimmed);
      const isSubPlaylist = isStreamInf || abs.includes('.m3u8');
      isStreamInf = false;

      if (isSubPlaylist) {
        return proxyManifestUrl(abs);
      }
      return proxySegmentUrl(abs);
    }).join('\n');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(rewritten);
  } catch (err) {
    res.status(502).send(err.message);
  }
});

app.get('/api/ts-proxy', async (req, res) => {
  const { url, referer } = req.query;
  if (!url) return res.status(400).send('Missing url');

  try {
    const decodedUrl = decodeURIComponent(url);
    const decodedRef = referer ? decodeURIComponent(referer) : (new URL(decodedUrl).origin + '/');

    const reqHeaders = streamProxyHeaders(decodedUrl, decodedRef);
    if (req.headers['range']) {
      reqHeaders['Range'] = req.headers['range'];
    }

    const upstream = await fetchStreamProxyTarget(decodedUrl, decodedRef, {
      headers: reqHeaders,
      responseType: 'stream',
      timeout: 30000,
      validateStatus: s => s < 400,
    });

    const proxyHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Accept-Ranges': upstream.headers['accept-ranges'] || 'bytes',
      'Content-Type': upstream.headers['content-type'] || 'video/MP2T',
    };
    if (upstream.headers['content-length'])   proxyHeaders['Content-Length']   = upstream.headers['content-length'];
    if (upstream.headers['content-range'])    proxyHeaders['Content-Range']    = upstream.headers['content-range'];
    if (upstream.headers['content-encoding']) proxyHeaders['Content-Encoding'] = upstream.headers['content-encoding'];

    res.writeHead(upstream.status, proxyHeaders);
    upstream.data.pipe(res);
  } catch (err) {
    if (!res.headersSent) res.status(502).send(err.message);
  }
});

app.get('/api/subtitle-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url');
  try {
    const decodedUrl = decodeURIComponent(url);
    const { data } = await axios.get(decodedUrl, {
      ...AXIOS_OPTS,
      responseType: 'text',
      headers: {
        ...AXIOS_OPTS.headers,
        'Referer': safeOrigin(decodedUrl) + '/',
      }
    });
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(data);
  } catch (err) {
    res.status(502).send('Failed to fetch subtitle');
  }
});

app.get('/api/img-proxy', async (req, res) => {
  const rawUrl = req.query.url;
  if (!rawUrl) return res.status(400).send('Missing url');

  const targetUrl = decodeURIComponent(rawUrl);
  try {
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': BROWSER_UA,
        'Referer': safeOrigin(targetUrl) + '/'
      },
      timeout: 12000
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(response.data);
  } catch (err) {
    return res.status(404).send('Image not found');
  }
});

// START SERVER

// ============================================================================
// 📦 MODULE: DRAMA SERVICE
// ============================================================================


const KISSKH_BASE = process.env.KISSKH_BASE || 'https://kisskh.co';
const ENCDEC_BASE = process.env.ENCDEC_BASE || 'https://enc-dec.app';




// Normalizer: ensure /drama/... maps to /api/drama/...


// Helpers



}



// ─────────────────────────────────────────────────────
// CACHES & TTLs
// ─────────────────────────────────────────────────────
const DRAMA_LIST_TTL  = 30 * 60 * 1000; // 30 min
const STREAM_TTL      =  2 * 60 * 60 * 1000; // 2 hours

const dramaHomeCache   = new Map();
const dramaListCache   = new Map();
const dramaInfoCache   = new Map();
const dramaStreamCache = new Map();

async function kissKhGet(url) {
  const res = await axios.get(url, {
    headers: {
      'User-Agent': BROWSER_UA,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 15000,
  });
  return res;
}

async function kissKhFetch(url) {
  const res = await kissKhGet(url);
  return res.data;
}

// ─────────────────────────────────────────────────────
// DRAMA ROUTES
// ─────────────────────────────────────────────────────

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'eetnet-drama-api',
    uptime: Math.floor((Date.now() - startedAt.getTime()) / 1000),
    port: PORT,
  });
});

// GET /api/drama/home
app.get('/api/drama/home', async (req, res) => {
  console.log('[DRAMA HOME] Fetching home catalog...');
  const cacheKey = 'home';
  const cached = dramaHomeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < DRAMA_LIST_TTL) {
    return res.json(cached.data);
  }

  try {
    const [showRes, koreanRes, chineseRes, topRatingRes, lastUpdateRes] = await Promise.all([
      kissKhFetch(`${KISSKH_BASE}/api/DramaList/Show`),
      kissKhFetch(`${KISSKH_BASE}/api/DramaList/MostView?ispc=false&c=2`),
      kissKhFetch(`${KISSKH_BASE}/api/DramaList/MostView?ispc=false&c=1`),
      kissKhFetch(`${KISSKH_BASE}/api/DramaList/TopRating?ispc=false`),
      kissKhFetch(`${KISSKH_BASE}/api/DramaList/LastUpdate?ispc=false`),
    ]);
    const data = {
      show:       Array.isArray(showRes)       ? showRes       : [],
      korean:     Array.isArray(koreanRes)     ? koreanRes     : [],
      chinese:    Array.isArray(chineseRes)    ? chineseRes    : [],
      topRating:  Array.isArray(topRatingRes)  ? topRatingRes  : [],
      lastUpdate: Array.isArray(lastUpdateRes) ? lastUpdateRes : [],
    };
    dramaHomeCache.set(cacheKey, { data, timestamp: Date.now() });
    res.json(data);
  } catch (err) {
    console.error('[DRAMA HOME] Error:', err.message);
    res.status(502).json({ error: 'KissKH home fetch failed', message: err.message });
  }
});

// GET /api/drama/list
app.get('/api/drama/list', async (req, res) => {
  const type = req.query.type || 0;
  const q    = req.query.q    || '';
  const cacheKey = `list:${type}:${q}`;

  const cached = dramaListCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < DRAMA_LIST_TTL) {
    return res.json(cached.data);
  }

  try {
    const data = await kissKhFetch(`${KISSKH_BASE}/api/DramaList/Search?q=${encodeURIComponent(q)}&type=${type}`);
    dramaListCache.set(cacheKey, { data, timestamp: Date.now() });
    res.json(data);
  } catch (err) {
    console.error('[DRAMA LIST] Error:', err.message);
    res.status(502).json({ error: 'KissKH drama list failed', message: err.message });
  }
});

// GET /api/drama/search
app.get('/api/drama/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Missing q parameter' });

  try {
    const data = await kissKhFetch(`${KISSKH_BASE}/api/DramaList/Search?q=${encodeURIComponent(q)}&type=0`);
    res.json(data);
  } catch (err) {
    console.error('[DRAMA SEARCH] Error:', err.message);
    res.status(502).json({ error: 'KissKH search failed', message: err.message });
  }
});

// GET /api/drama/info/:dramaId
app.get('/api/drama/info/:dramaId', async (req, res) => {
  const { dramaId } = req.params;

  const cached = dramaInfoCache.get(dramaId);
  if (cached && Date.now() - cached.timestamp < DRAMA_LIST_TTL) {
    return res.json(cached.data);
  }

  try {
    const data = await kissKhFetch(`${KISSKH_BASE}/api/DramaList/Drama/${dramaId}?isq=false`);
    dramaInfoCache.set(dramaId, { data, timestamp: Date.now() });
    res.json(data);
  } catch (err) {
    console.error('[DRAMA INFO] Error:', err.message);
    res.status(502).json({ error: 'KissKH episode list failed', message: err.message });
  }
});

// GET /api/drama/stream/:episodeId
app.get('/api/drama/stream/:episodeId', async (req, res) => {
  const { episodeId } = req.params;
  const host = publicHost(req);

  const cached = dramaStreamCache.get(episodeId);
  if (cached && Date.now() - cached.timestamp < STREAM_TTL) {
    return res.json(cached.data);
  }

  try {
    const vidKeyRes = await axios.get(
      `${ENCDEC_BASE}/api/enc-kisskh?text=${episodeId}&type=vid`,
      { timeout: 10000 }
    );
    const vidKkey = vidKeyRes.data?.result;
    if (!vidKkey) {
      return res.status(502).json({ error: 'enc-dec.app returned no video kkey' });
    }

    const streamResData = await kissKhFetch(
      `${KISSKH_BASE}/api/DramaList/Episode/${episodeId}.png?err=false&ts=&time=&kkey=${vidKkey}`
    );
    const videoUrl = streamResData?.Video;
    if (!videoUrl) {
      return res.status(404).json({ error: 'No stream URL found for this episode' });
    }

    let subtitles = [];
    try {
      const subKeyRes = await axios.get(
        `${ENCDEC_BASE}/api/enc-kisskh?text=${episodeId}&type=sub`,
        { timeout: 8000 }
      );
      const subKkey = subKeyRes.data?.result;
      if (subKkey) {
        const rawSubs = await kissKhFetch(`${KISSKH_BASE}/api/Sub/${episodeId}?kkey=${subKkey}`);
        if (Array.isArray(rawSubs)) {
          subtitles = rawSubs.map(s => ({
            label: s.label || s.language || 'English',
            file: `${host}/api/drama/subtitle?url=${encodeURIComponent(s.src)}`,
            rawFile: s.src,
            default: (s.label || s.language || '').toLowerCase().includes('en'),
          }));
        }
      }
    } catch (subErr) {
      console.warn('[DRAMA STREAM] Subtitle fetch failed (non-fatal):', subErr.message);
    }

    const isM3U8 = videoUrl.includes('.m3u8');
    const proxiedStream = isM3U8
      ? `${host}/api/m3u8-proxy?url=${encodeURIComponent(videoUrl)}&referer=${encodeURIComponent(KISSKH_BASE + '/')}`
      : videoUrl;

    const result = {
      episodeId,
      type: isM3U8 ? 'hls' : 'mp4',
      streamUrl: proxiedStream,
      subtitles,
    };

    dramaStreamCache.set(episodeId, { data: result, timestamp: Date.now() });
    res.json(result);

  } catch (err) {
    console.error('[DRAMA STREAM] Fatal error:', err.message);
    res.status(502).json({ error: 'Drama stream fetch failed', message: err.message });
  }
});

// GET /api/drama/subtitle?url=<url>
app.get('/api/drama/subtitle', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    const subRes = await axios.get(url, { timeout: 10000, responseType: 'text' });
    let content = subRes.data;

    if (typeof content !== 'string') {
      content = String(content);
    }

    if (!content.trimStart().startsWith('WEBVTT')) {
      content = 'WEBVTT\n\n' + content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    }

    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(content);
  } catch (err) {
    console.error('[DRAMA SUB] Error:', err.message);
    res.status(502).json({ error: 'Subtitle retrieval failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────
// HLS M3U8 & TS PROXY
// ─────────────────────────────────────────────────────
app.get('/api/m3u8-proxy', async (req, res) => {
  const { url, referer } = req.query;
  if (!url) return res.status(400).send('Missing url');

  try {
    const decodedUrl  = decodeURIComponent(url);
    const decodedRef  = referer ? decodeURIComponent(referer) : (new URL(decodedUrl).origin + '/');

    const { data } = await axios.get(decodedUrl, {
      responseType: 'text',
      headers: streamProxyHeaders(decodedUrl, decodedRef),
      timeout: 15000,
    });

    const host = publicHost(req);
    const childReferer = new URL(decodedUrl).origin + '/';

    const proxyManifestUrl = (value) =>
      `${host}/api/m3u8-proxy?url=${encodeURIComponent(new URL(value, decodedUrl).toString())}&referer=${encodeURIComponent(childReferer)}`;
    const proxySegmentUrl = (value) =>
      `${host}/api/ts-proxy?url=${encodeURIComponent(new URL(value, decodedUrl).toString())}&referer=${encodeURIComponent(childReferer)}`;

    let isStreamInf = false;

    const rewritten = data.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith('#')) {
        if (trimmed.startsWith('#EXT-X-STREAM-INF') || trimmed.startsWith('#EXT-X-I-FRAME-STREAM-INF')) {
          isStreamInf = true;
        }
        return line.replace(/(URI=)(["'])([^"']+)\2/gi, (match, prefix, quote, uri) => {
          if (!uri || uri.startsWith('data:')) return match;
          const isPlaylist = uri.includes('.m3u8') || trimmed.toUpperCase().startsWith('#EXT-X-MEDIA');
          const proxied = isPlaylist ? proxyManifestUrl(uri) : proxySegmentUrl(uri);
          return `${prefix}${quote}${proxied}${quote}`;
        });
      }

      const abs = new URL(trimmed, decodedUrl).toString();
      const isSubPlaylist = isStreamInf || abs.includes('.m3u8');
      isStreamInf = false;

      if (isSubPlaylist) {
        return proxyManifestUrl(abs);
      }
      return proxySegmentUrl(abs);
    }).join('\n');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(rewritten);
  } catch (err) {
    console.error('[M3U8-PROXY] Error:', err.message);
    res.status(502).send(err.message);
  }
});

app.get('/api/ts-proxy', async (req, res) => {
  const { url, referer } = req.query;
  if (!url) return res.status(400).send('Missing url');

  try {
    const decodedUrl = decodeURIComponent(url);
    const decodedRef = referer ? decodeURIComponent(referer) : (new URL(decodedUrl).origin + '/');

    const reqHeaders = streamProxyHeaders(decodedUrl, decodedRef);
    if (req.headers['range']) {
      reqHeaders['Range'] = req.headers['range'];
    }

    const upstream = await axios.get(decodedUrl, {
      headers: reqHeaders,
      responseType: 'stream',
      timeout: 30000,
      validateStatus: s => s < 400,
    });

    const proxyHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Accept-Ranges': upstream.headers['accept-ranges'] || 'bytes',
      'Content-Type': upstream.headers['content-type'] || 'video/MP2T',
    };
    if (upstream.headers['content-length'])   proxyHeaders['Content-Length']   = upstream.headers['content-length'];
    if (upstream.headers['content-range'])    proxyHeaders['Content-Range']    = upstream.headers['content-range'];
    if (upstream.headers['content-encoding']) proxyHeaders['Content-Encoding'] = upstream.headers['content-encoding'];

    res.writeHead(upstream.status, proxyHeaders);
    upstream.data.pipe(res);
  } catch (err) {
    console.error('[TS-PROXY] Error:', err.message);
    if (!res.headersSent) res.status(502).send(err.message);
  }
});

// START SERVER

// ============================================================================
// 📦 MODULE: COMICS SERVICE
// ============================================================================



const COMICKZ_BASE   = process.env.COMICKZ_BASE || 'https://comickz.co.uk';
const HIVETOONS_BASE = process.env.HIVETOONS_BASE || 'https://hivetoons.com';
const HT_HEADERS     = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };


// Normalizer: ensure /manga/..., /webtoon/... maps to /api/...


// Helpers



}

function proxyCoverUrl(host, rawUrl) {
  if (!rawUrl) return null;
  let fullUrl = String(rawUrl).trim();
  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    if (fullUrl.startsWith('//')) {
      fullUrl = 'https:' + fullUrl;
    } else {
      fullUrl = 'https://meo.comick.pictures/' + fullUrl.replace(/^\/+/, '');
    }
  }
  return `${host}/api/manga/image-proxy?url=${encodeURIComponent(fullUrl)}`;
}

// ─────────────────────────────────────────────────────
// CACHES & HELPERS
// ─────────────────────────────────────────────────────
const MANGA_GENRE_CACHE_TTL_MS = 15 * 60 * 1000;
const MANGA_GENRE_CACHE_MAX_ITEMS = 240;
const mangaGenreCatalogCache = new Map();
const comickSlugMap = new Map();
const htChapterCache = new Map();

function mapComicKCatalogItem(host, item, countryCode, type) {
  const rawCover = item.default_thumbnail || (item.cover ? `${item.cover}` : (item.md_covers?.[0]?.b2key ? `https://meo.comick.pictures/${item.md_covers[0].b2key}` : null));
  const proxiedCover = proxyCoverUrl(host, rawCover);
  return {
    id: item.slug || String(item.id),
    comickSlug: item.slug,
    hid: item.hid,
    title: item.title || 'Manga',
    cover: proxiedCover,
    banner: proxiedCover,
    coverImage: proxiedCover,
    bannerImage: proxiedCover,
    description: item.desc ? item.desc.replace(/<[^>]*>?/gm, '') : (item.description || ''),
    rating: item.bayesian_rating ? (parseFloat(item.bayesian_rating)).toFixed(1) : '8.7',
    country: item.country || countryCode,
    status: item.status === 2 ? 'Completed' : 'Ongoing',
    type: (type || 'manhwa').toLowerCase()
  };
}

function buildComicKGenreUrl(countryCode, genre) {
  const params = new URLSearchParams({ country: countryCode, genres: genre, limit: '50' });
  return `${COMICKZ_BASE}/api/search?${params.toString()}`;
}

function normalizeComicKPageUrl(candidate) {
  if (!candidate) return null;
  try {
    const url = new URL(candidate, COMICKZ_BASE);
    const trustedHosts = new Set([
      new URL(COMICKZ_BASE).host,
      'api.comick.dev',
      'api.comick.fun',
      'api.comick.io'
    ]);
    if (!trustedHosts.has(url.host) || !url.pathname.includes('search')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchComicKGenreBatch(url) {
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: `${COMICKZ_BASE}/` },
    timeout: 10000
  });
  return {
    items: response.data?.data || (Array.isArray(response.data) ? response.data : []),
    nextPageUrl: normalizeComicKPageUrl(response.data?.next_page_url)
  };
}

async function getComicKGenreCatalog(countryCode, genre, requiredCount) {
  const cacheKey = `${countryCode}:${genre}`;
  const now = Date.now();
  let cache = mangaGenreCatalogCache.get(cacheKey);

  if (!cache || now - cache.updatedAt > MANGA_GENRE_CACHE_TTL_MS) {
    cache = {
      items: [],
      seenIds: new Set(),
      seenPageUrls: new Set(),
      nextPageUrl: buildComicKGenreUrl(countryCode, genre),
      updatedAt: now,
      fetching: null
    };
    mangaGenreCatalogCache.set(cacheKey, cache);
  }

  while (cache.items.length < requiredCount && cache.nextPageUrl && cache.items.length < MANGA_GENRE_CACHE_MAX_ITEMS) {
    if (cache.seenPageUrls.has(cache.nextPageUrl)) {
      cache.nextPageUrl = null;
      break;
    }
    if (!cache.fetching) {
      const nextUrl = cache.nextPageUrl;
      cache.seenPageUrls.add(nextUrl);
      cache.fetching = fetchComicKGenreBatch(nextUrl)
        .then(({ items, nextPageUrl }) => {
          for (const item of items) {
            const id = item.slug || String(item.id || '');
            if (!id || cache.seenIds.has(id)) continue;
            cache.seenIds.add(id);
            cache.items.push(item);
            if (cache.items.length >= MANGA_GENRE_CACHE_MAX_ITEMS) break;
          }
          cache.nextPageUrl = nextPageUrl && !cache.seenPageUrls.has(nextPageUrl) ? nextPageUrl : null;
          cache.updatedAt = Date.now();
        })
        .finally(() => { cache.fetching = null; });
    }
    await cache.fetching;
  }

  return cache;
}

async function fetchAniListWebtoons(host) {
  const query = `
    query {
      trending: Page(page: 1, perPage: 24) {
        media(type: MANGA, countryOfOrigin: "KR", sort: TRENDING_DESC) {
          id
          title { english romaji userPreferred }
          description
          coverImage { extraLarge large medium color }
          bannerImage
          genres
          averageScore
          popularity
          status
        }
      }
      popular: Page(page: 1, perPage: 24) {
        media(type: MANGA, countryOfOrigin: "KR", sort: POPULARITY_DESC) {
          id
          title { english romaji userPreferred }
          description
          coverImage { extraLarge large medium color }
          bannerImage
          genres
          averageScore
          popularity
          status
        }
      }
    }
  `;

  try {
    const r = await axios.post('https://graphql.anilist.co', { query }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    const trendingRaw = r.data?.data?.trending?.media || [];
    const popularRaw = r.data?.data?.popular?.media || [];

    const mapItem = (m) => {
      const titleStr = m.title.english || m.title.romaji || m.title.userPreferred || 'Webtoon';
      const coverUrl = m.coverImage?.extraLarge || m.coverImage?.large || m.bannerImage;
      const bannerUrl = m.bannerImage || m.coverImage?.extraLarge || m.coverImage?.large;

      return {
        id: String(m.id),
        anilistId: m.id,
        title: titleStr,
        description: m.description ? m.description.replace(/<[^>]*>?/gm, '') : '',
        cover: proxyCoverUrl(host, coverUrl),
        banner: proxyCoverUrl(host, bannerUrl),
        coverImage: proxyCoverUrl(host, coverUrl),
        bannerImage: proxyCoverUrl(host, bannerUrl),
        rating: m.averageScore ? (m.averageScore / 10).toFixed(1) : '9.2',
        popularity: m.popularity || 850000,
        genres: m.genres || ['Fantasy', 'Action'],
        status: m.status === 'FINISHED' ? 'Completed' : 'Ongoing',
        country: 'kr',
        type: 'manhwa'
      };
    };

    const trending = trendingRaw.map(mapItem);
    const popular = popularRaw.map(mapItem);

    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const schedule = { MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [], COMPLETED: [] };

    const allCombined = [...trending, ...popular];
    const seenIds = new Set();
    const uniqueComics = [];

    for (const item of allCombined) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        uniqueComics.push(item);
      }
    }

    uniqueComics.forEach((item, index) => {
      if (item.status === 'Completed') {
        schedule.COMPLETED.push(item);
      } else {
        const dayKey = days[index % days.length];
        schedule[dayKey].push(item);
      }
    });

    return {
      trending,
      popular,
      featured: trending.slice(0, 5),
      schedule,
      all: uniqueComics
    };
  } catch (err) {
    console.error('[HYBRID WEBTOON] AniList query failed:', err.message);
    return null;
  }
}

async function htGet(url) {
  const res = await axios.get(url, { headers: HT_HEADERS, timeout: 15000 });
  return cheerio.load(res.data);
}

// ─────────────────────────────────────────────────────
// COMICS & MANGA ROUTES
// ─────────────────────────────────────────────────────

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'eetnet-comics-api',
    uptime: Math.floor((Date.now() - startedAt.getTime()) / 1000),
    port: PORT,
  });
});

// GET /api/manga/home
app.get('/api/manga/home', async (req, res) => {
  const host = publicHost(req);
  try {
    const fetchComicKzList = async (query = '', country = '', limit = 16) => {
      try {
        let url = `${COMICKZ_BASE}/api/search?limit=${limit}`;
        if (query) url += `&q=${encodeURIComponent(query)}`;
        if (country) url += `&country=${encodeURIComponent(country)}`;

        const r = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: `${COMICKZ_BASE}/` },
          timeout: 7000
        });
        const rawList = r.data?.data || (Array.isArray(r.data) ? r.data : []);
        return rawList.map(item => {
          const rawCover = item.default_thumbnail || (item.cover ? `${item.cover}` : (item.md_covers?.[0]?.b2key ? `https://meo.comick.pictures/${item.md_covers[0].b2key}` : null));
          const proxiedCover = proxyCoverUrl(host, rawCover);
          return {
            id: item.slug || String(item.id),
            comickSlug: item.slug,
            hid: item.hid,
            title: item.title || 'Manga',
            cover: proxiedCover,
            banner: proxiedCover,
            coverImage: proxiedCover,
            bannerImage: proxiedCover,
            description: item.desc ? item.desc.replace(/<[^>]*>?/gm, '') : (item.description || ''),
            rating: item.bayesian_rating ? (parseFloat(item.bayesian_rating)).toFixed(1) : '8.8',
            country: item.country || country || 'jp',
            status: item.status === 2 ? 'Completed' : 'Ongoing',
            type: item.country === 'kr' ? 'manhwa' : item.country === 'cn' ? 'manhua' : 'manga'
          };
        });
      } catch (e) {
        return [];
      }
    };

    let [bentoRaw, manhwaPreview, mangaPreview, manhuaPreview] = await Promise.all([
      fetchComicKzList('leveling', '', 12),
      fetchComicKzList('', 'kr', 12),
      fetchComicKzList('', 'jp', 12),
      fetchComicKzList('', 'cn', 12)
    ]);

    const bentoTop10 = bentoRaw.slice(0, 10);

    return res.json({
      bentoTop10,
      manhwaPreview,
      mangaPreview,
      manhuaPreview,
      trending: bentoRaw,
      popular: manhwaPreview,
      topRated: mangaPreview,
      featured: bentoTop10[0] || null
    });
  } catch (err) {
    console.error('[MANGA HOME] Error:', err.message);
    res.status(500).json({ error: 'Failed to load manga home', message: err.message });
  }
});

// GET /api/manga/category/:type
app.get('/api/manga/category/:type', async (req, res) => {
  const { type } = req.params;
  const { genre } = req.query;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const perPage = Math.min(50, Math.max(12, Number.parseInt(req.query.perPage, 10) || 24));
  const host = publicHost(req);

  const countryMap = {
    manga: 'jp',
    manhwa: 'kr',
    manhua: 'cn'
  };

  const countryCode = countryMap[type?.toLowerCase()] || 'jp';

  try {
    if (genre && genre !== 'all') {
      const catalog = await getComicKGenreCatalog(countryCode, genre, page * perPage);
      const start = (page - 1) * perPage;
      const pageItems = catalog.items
        .slice(start, start + perPage)
        .map(item => mapComicKCatalogItem(host, item, countryCode, type));
      const hasCachedItemsAhead = catalog.items.length > start + pageItems.length;
      const canFetchMore = Boolean(catalog.nextPageUrl) && catalog.items.length < MANGA_GENRE_CACHE_MAX_ITEMS;

      return res.json({
        type,
        country: countryCode,
        genre,
        page,
        perPage,
        total: catalog.items.length,
        hasMore: hasCachedItemsAhead || canFetchMore,
        items: pageItems,
        trending: [],
        popular: [],
        topPick: [],
        recent: []
      });
    }

    const limit = 48;
    const searchParams = new URLSearchParams({ country: countryCode, limit: String(limit) });
    const url = `${COMICKZ_BASE}/api/search?${searchParams.toString()}`;

    const r = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: `${COMICKZ_BASE}/` },
      timeout: 8000
    });

    const rawList = r.data?.data || (Array.isArray(r.data) ? r.data : []);
    const items = rawList.map(item => mapComicKCatalogItem(host, item, countryCode, type));

    const trending = items.slice(0, 12);
    const popular = items.slice(12, 24).length ? items.slice(12, 24) : items.slice(0, 12);
    const topPick = items.slice(24, 36).length ? items.slice(24, 36) : items.slice(0, 12);
    const recent = items.slice(36, 48).length ? items.slice(36, 48) : items.slice(0, 12);

    return res.json({
      type,
      country: countryCode,
      genre: genre || 'all',
      page,
      perPage,
      total: items.length,
      hasMore: false,
      trending,
      popular,
      topPick,
      recent,
      items
    });

  } catch (err) {
    console.error(`[MANGA CATEGORY] Error for ${type}:`, err.message);
    return res.status(500).json({ error: `Failed to load ${type} category`, message: err.message });
  }
});

// GET /api/webtoon/home
app.get('/api/webtoon/home', async (req, res) => {
  const host = publicHost(req);
  try {
    const data = await fetchAniListWebtoons(host);
    if (data) {
      return res.json(data);
    }
  } catch (e) {
    console.warn('[WEBTOON HOME] Hybrid fetch failed:', e.message);
  }
  return res.redirect(`${host}/api/manga/home`);
});

// GET /api/webtoon/category/:type
app.get('/api/webtoon/category/:type', async (req, res) => {
  const { type } = req.params;
  const { genre } = req.query;
  const host = publicHost(req);

  try {
    const data = await fetchAniListWebtoons(host);
    if (data && data.all) {
      let filtered = data.all;
      if (genre && genre !== 'all') {
        const gLC = genre.toLowerCase();
        filtered = data.all.filter(item =>
          item.genres.some(g => g.toLowerCase().includes(gLC) || gLC.includes(g.toLowerCase()))
        );
      }
      return res.json({
        type,
        genre: genre || 'all',
        trending: filtered.slice(0, 12),
        popular: filtered.slice(0, 12),
        items: filtered,
        recent: filtered.slice(0, 12)
      });
    }
  } catch (e) {}

  return res.redirect(`${host}/api/manga/category/${type}?genre=${encodeURIComponent(genre || 'all')}`);
});

// GET /api/manga/search?q=<query>
app.get('/api/manga/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.json([]);
  const host = publicHost(req);

  try {
    const searchRes = await axios.get(`${COMICKZ_BASE}/api/search?q=${encodeURIComponent(q)}&limit=20`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': `${COMICKZ_BASE}/`
      },
      timeout: 8000
    });

    const rawList = searchRes.data?.data || searchRes.data || [];
    const results = (Array.isArray(rawList) ? rawList : []).map(m => ({
      id: m.slug || String(m.id),
      comickSlug: m.slug,
      hid: m.hid,
      title: m.title || 'Unknown Manga',
      cover: proxyCoverUrl(host, m.default_thumbnail),
      description: m.desc ? m.desc.replace(/<[^>]*>?/gm, '') : '',
      rating: '8.5',
      status: m.status === 2 ? 'Completed' : 'Ongoing',
      genres: [],
      type: 'manga'
    }));

    return res.json(results);
  } catch (e) {
    console.error('[MANGA SEARCH] ComicKz search failed:', e.message);
    return res.json([]);
  }
});

// GET /api/manga/info/:id
app.get('/api/manga/info/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[MANGA INFO] Request for: ${id}`);
  const host = publicHost(req);
  let slug = id;

  if (/^\d+$/.test(id)) {
    try {
      const aniQuery = `query ($id: Int) { Media(id: $id, type: MANGA) { title { english romaji native } } }`;
      const aniRes = await axios.post('https://graphql.anilist.co', { query: aniQuery, variables: { id: parseInt(id) } }, { timeout: 5000 });
      const t = aniRes.data?.data?.Media?.title;
      const searchTitle = t?.english || t?.romaji || t?.native;
      if (searchTitle) {
        const sRes = await axios.get(`${COMICKZ_BASE}/api/search?q=${encodeURIComponent(searchTitle)}&limit=3`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: `${COMICKZ_BASE}/` },
          timeout: 5000
        });
        const first = sRes.data?.data?.[0];
        if (first?.slug) slug = first.slug;
      }
    } catch (e) {
      console.warn('[MANGA INFO] AniList resolution error:', e.message);
    }
  }

  try {
    let allRawChs = [];
    let page = 1;
    while (true) {
      const chRes = await axios.get(`${COMICKZ_BASE}/api/comics/${encodeURIComponent(slug)}/chapter-list?lang=en&page=${page}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: `${COMICKZ_BASE}/` },
        timeout: 10000
      });
      const list = chRes.data?.data || (Array.isArray(chRes.data) ? chRes.data : []);
      if (!Array.isArray(list) || list.length === 0) break;
      allRawChs = allRawChs.concat(list);

      const lastPage = chRes.data?.pagination?.last_page || 1;
      if (page >= lastPage) break;
      page++;
      if (page > 30) break;
    }

    const seenCh = new Set();
    const chapters = [];

    for (const c of allRawChs) {
      const chNum = c.chap || '1';
      if (seenCh.has(chNum)) continue;
      seenCh.add(chNum);

      const chPath = `${c.hid}-chapter-${c.chap}-${c.lang || 'en'}`;
      chapters.push({
        id: `${slug}___${chPath}`,
        chapter: chNum,
        title: c.title || `Chapter ${chNum}`,
        volume: c.vol || null,
        pages: 0,
        publishAt: c.publish_at || c.created_at
      });
    }

    chapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));

    let title = slug.replace(/^[0-9]+-/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    let rawCover = null;
    let description = '';

    try {
      const pageRes = await axios.get(`${COMICKZ_BASE}/comic/${encodeURIComponent(slug)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: `${COMICKZ_BASE}/` },
        timeout: 6000
      });
      const html = pageRes.data || '';
      const cMatch = html.match(/<script type="application\/json" id="comic-data">([\s\S]*?)<\/script>/i);
      if (cMatch) {
        const cData = JSON.parse(cMatch[1]);
        if (cData.title) title = cData.title;
        if (cData.default_thumbnail) rawCover = cData.default_thumbnail;
        if (cData.desc) description = cData.desc.replace(/<[^>]*>?/gm, '');
      }
    } catch (e) {
      console.warn('[MANGA INFO] Comic page scrape failed, using defaults:', e.message);
    }

    const cover = proxyCoverUrl(host, rawCover);

    return res.json({
      id: slug,
      comickSlug: slug,
      title,
      cover,
      banner: cover,
      description,
      status: 'Ongoing',
      rating: '8.8',
      genres: ['Action', 'Fantasy', 'Adventure'],
      chapters
    });

  } catch (err) {
    console.error(`[MANGA INFO] Failed for ${slug}:`, err.message);
    return res.status(500).json({ error: 'Failed to fetch manga info', message: err.message });
  }
});

// GET /api/manga/read/:chapterId
app.get('/api/manga/read/:chapterId', async (req, res) => {
  const { chapterId } = req.params;
  console.log(`[MANGA READ] Fetching pages for chapter: ${chapterId}`);
  const host = publicHost(req);

  try {
    let slug, chPath;
    if (chapterId.includes('___')) {
      const sepIdx = chapterId.indexOf('___');
      slug = chapterId.substring(0, sepIdx);
      chPath = chapterId.substring(sepIdx + 3);
    } else {
      slug = 'manga';
      chPath = chapterId;
    }

    const chUrl = `${COMICKZ_BASE}/comic/${slug}/${chPath}`;

    const pageRes = await axios.get(chUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': `${COMICKZ_BASE}/comic/${slug}`,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      },
      timeout: 15000,
      maxRedirects: 5
    });

    const html = pageRes.data || '';
    const svMatch = html.match(/<script\s+id="sv-data"\s+type="application\/json">([\s\S]*?)<\/script>/i);

    if (svMatch) {
      let svData;
      try {
        svData = JSON.parse(svMatch[1].trim());
      } catch (parseErr) {
        console.error(`[MANGA READ] JSON parse error:`, parseErr.message);
      }

      if (svData) {
        const rawImages = svData.chapter?.images || [];
        if (rawImages.length) {
          const pages = rawImages.map((imgObj, idx) => {
            let rawUrl = imgObj.url || '';
            if (rawUrl.startsWith('/')) rawUrl = 'https://cdn2.comicknew.pictures' + rawUrl;
            return {
              page: idx + 1,
              url: `${host}/api/manga/image-proxy?url=${encodeURIComponent(rawUrl)}`,
              rawUrl
            };
          });

          return res.json({ chapterId, pageCount: pages.length, pages });
        }
      }
    }

    return res.json({ chapterId, pageCount: 0, pages: [] });
  } catch (err) {
    console.error(`[MANGA READ] Error fetching chapter ${chapterId}:`, err.message);
    return res.json({ chapterId, pageCount: 0, pages: [] });
  }
});

// GET /api/manhwa/chapter/:slug/:chapter (Hivetoons)
app.get('/api/manhwa/chapter/:slug/:chapter', async (req, res) => {
  const { slug, chapter } = req.params;
  const cacheKey = `${slug}:${chapter}`;
  const cached = htChapterCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 3600000) {
    return res.json(cached.data);
  }

  try {
    console.log(`[MANHWA CHAPTER] Fetching: ${slug}/${chapter}`);
    const $ = await htGet(`${HIVETOONS_BASE}/series/${slug}/${chapter}`);

    const seen = new Set();
    const images = [];
    $('img[src*="storage.hivetoon"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src && src.includes('/series/') && !seen.has(src)) {
        seen.add(src);
        images.push(src);
      }
    });

    const data = { slug, chapter, images };
    htChapterCache.set(cacheKey, { data, timestamp: Date.now() });
    res.json(data);
  } catch (err) {
    console.error('[MANHWA CHAPTER] Error:', err.message);
    res.status(502).json({ error: 'Hivetoons chapter fetch failed', message: err.message });
  }
});

// GET /api/manga/image-proxy & GET /api/img-proxy
const handleImageProxy = async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url parameter');

  const targetUrl = decodeURIComponent(url);
  const maxRetries = 5;

  const referer = targetUrl.includes('comicknew.pictures') ? 'https://comickz.co.uk/' :
    targetUrl.includes('comick.pictures') ? 'https://comick.io/' :
    'https://comickz.co.uk/';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(targetUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': referer,
          'Accept': 'image/webp,image/avif,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://comickz.co.uk'
        },
        timeout: 12000
      });

      const contentType = response.headers['content-type'] || 'image/webp';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(Buffer.from(response.data));

    } catch (err) {
      const status = err.response?.status;
      if (status === 429 && attempt < maxRetries) {
        const backoff = attempt * 350 + Math.floor(Math.random() * 200);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      if (status === 403 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 200));
        continue;
      }
      console.error(`[MANGA IMAGE PROXY] Error (attempt ${attempt}/${maxRetries}):`, err.message);
      if (!res.headersSent) {
        return res.status(status || 500).send('Image proxy error');
      }
      return;
    }
  }
};

app.get('/api/manga/image-proxy', handleImageProxy);
app.get('/api/img-proxy', handleImageProxy);

// START SERVER

// ============================================================================
// 📦 MODULE: MOVIES SERVICE
// ============================================================================




// Normalizer: ensure /movies/..., /movieplex/..., /netmirror/... map to /api/...


// Helpers



}





// ─────────────────────────────────────────────────────
// NETMIRROR INTEGRATION (net52.cc)
// ─────────────────────────────────────────────────────
const NETMIRROR_BASE = process.env.NETMIRROR_BASE || 'https://net52.cc';
const NETMIRROR_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36 /OS.Gatu v3.0';
let netmirrorToken = null;
let netmirrorTokenExpiry = 0;

async function getNetmirrorToken() {
  const now = Date.now();
  if (netmirrorToken && now < netmirrorTokenExpiry) return netmirrorToken;

  const fakeCaptcha = crypto.randomUUID();
  try {
    const res = await axios.post(`${NETMIRROR_BASE}/verify.php`,
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

    const setCookies = res.headers['set-cookie'];
    const cookieStr = Array.isArray(setCookies) ? setCookies.join('; ') : (setCookies || '');
    const match = cookieStr.match(/t_hash_t=([^;]+)/);
    if (!match) throw new Error('No t_hash_t in verify response');

    netmirrorToken = decodeURIComponent(match[1]);
    netmirrorTokenExpiry = now + (15 * 60 * 60 * 1000);
    console.log('[NetMirror] Token obtained, valid ~72h');
    return netmirrorToken;
  } catch (err) {
    console.error('[NetMirror] Token fetch failed:', err.message);
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
      console.log('[NetMirror] Token expired (status:n), refreshing...');
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

// ─────────────────────────────────────────────────────
// MOVIEPLEX INTEGRATION (movieplex.co.in)
// ─────────────────────────────────────────────────────
const MOVIEPLEX_BASE = 'https://movieplex.co.in';
const MOVIEPLEX_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const MP_CATS = {
  hindi_dubbed: 17, hot: 21, romance: 24, web_series: 33,
  drama: 14, short_film: 26, trending: 29, action: 6,
  bollywood: 10, hollywood: 19, thriller: 28, comedy: 11,
  horror: 20, bengali: 9, south_indian: 27,
};

const mpCache = { posts: [], byCategory: {}, categoryMap: {}, lastBuilt: 0, building: false };
const MP_TTL = 24 * 60 * 60 * 1000;

function mpDecodeTitle(raw) {
  return (raw || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'").replace(/&#8220;/g, '"').replace(/&#8221;/g, '"');
}

async function mpWpApi(path) {
  const res = await axios.get(`${MOVIEPLEX_BASE}/wp-json/wp/v2/${path}`, {
    headers: { 'User-Agent': MOVIEPLEX_UA, 'Accept': 'application/json' },
    timeout: 20000,
  });
  return {
    data: res.data,
    total: parseInt(res.headers['x-wp-total'] || '0'),
    totalPages: parseInt(res.headers['x-wp-totalpages'] || '1'),
  };
}

function mpIs18Plus(p, title) {
  const catIds = Array.isArray(p.categories) ? p.categories : [];
  if (catIds.includes(21)) return true;
  const text = (title || '') + ' ' + (p.slug || '');
  return /\b(18\+|Ullu|Hotshots|Moodx|Kooku|Uncut|PrimeShots|Rabbit|RabbitMovies|Voovi|Chikooflix|Balloons|Besharams|Cinemadosti|Hot Web Series|Adult)\b/i.test(text);
}

function mpNormalizePost(p) {
  const title = mpDecodeTitle(p.title && p.title.rendered ? p.title.rendered : '');
  const is18 = mpIs18Plus(p, title);
  return {
    id: `mp-${p.id}`, movieplexId: p.id, movieplexSlug: p.slug,
    title: title,
    slug: p.slug, date: (p.date || '').substring(0, 10),
    categoryIds: Array.isArray(p.categories) ? p.categories : [],
    is18Plus: is18,
    thumbnail: '', coverImage: '', bannerImage: '', source: 'movieplex',
  };
}

// Poster API Keys
const TMDB_KEY = process.env.TMDB_API_KEY || '4e44d9029b1270a757cddc766a1bcb63';
const OMDB_KEY = process.env.OMDB_API_KEY || 'trilogy';

function mpExtractYear(raw) {
  const m = (raw || '').match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  return m ? parseInt(m[1]) : null;
}

function mpCleanTitle(raw) {
  return (raw || '')
    .replace(/&#\d+;/g, function(m) { try { return String.fromCharCode(parseInt(m.slice(2))); } catch(e) { return ''; } })
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\bWatch\s+Online\b/gi, '')
    .replace(/\bFull\s+Movie\b/gi, '')
    .replace(/\bFull\s+Web\s+Series\b/gi, '')
    .replace(/\bDownload\s+Now\b/gi, '')
    .replace(/\(\d{4}\)/g, '').replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/E\d+[-T]\d+/gi, '').replace(/\bE\d+\b/gi, '').replace(/\bS\d+\b/gi, '')
    .replace(/\bPart\s*\d+\b/gi, '').replace(/\bVolume\s*\d+\b/gi, '').replace(/\bVol\.?\s*\d+\b/gi, '')
    .replace(/\bEpisode\s*\d+\b/gi, '').replace(/\bSeason\s*\d+\b/gi, '').replace(/\bComplete\b/gi, '')
    .replace(/\b(Hindi Dubbed|Hindi Dub|Hindi|Bengali|Malayalam|Tamil|Telugu|Kannada|Marathi|Punjabi|Gujarati|English|Bangladeshi|South Indian|Korean|Japanese|Chinese|Thai)\b/gi, '')
    .replace(/\b(HDRip|BluRay|WEB-DL|WEBRip|UNCUT|HDTS|HDTC|HDCam|HDCAM|CAMRip|CAM|DVDSCR|DVDScr|SCR|TS|DVDRIP|DVDRip|HD|4K|1080p|720p|480p|360p|Extended|Directors.?Cut)\b/gi, '')
    .replace(/\b(Hollywood|Bollywood|Tollywood|Mollywood|Kollywood|Pollywood)\b/gi, '')
    .replace(/\b(Short Film|App Video|Webseries|Web Series|OTT|Originals|Exclusive)\b/gi, '')
    .replace(/\b(Sigmaseries|Sigma|Cukkuboo|Hulchul|HulChul|Hoichoi|Moodx|Kooku|Ullu|ALTBalaji|PrimeShots|Rabbit|RabbitMovies|Voovi|Chikooflix|Atrangii|NewSensations|LookEnt|Nuefliks|GupChup|Hotshots|Flizmovies|Mastram|DigiMoviePlex|Balloons|Besharams|Cinemadosti|Netflix|Amazon|Hotstar|SonyLiv|ZEE5|Voot|MXPlayer|JioCinema|Aha|Hoichoi|Lionsgate|Disney)\b/gi, '')
    .replace(/\bMovie\b/gi, '').replace(/\bSeries\b/gi, '').replace(/\bFilm\b/gi, '')
    .replace(/[-_:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function _tmdbSearch(type, query, year) {
  const qs = 'api_key=' + TMDB_KEY + '&query=' + encodeURIComponent(query) + (year ? '&year=' + year : '');
  const r = await axios.get('https://api.themoviedb.org/3/search/' + type + '?' + qs, { timeout: 7000 });
  const results = (r.data && r.data.results) ? r.data.results : [];
  return results.find(function(x) { return !!x.poster_path; }) || null;
}

async function _omdbLookup(title, year) {
  const qs = 'apikey=' + OMDB_KEY + '&t=' + encodeURIComponent(title) + (year ? '&y=' + year : '') + '&r=json';
  const r = await axios.get('https://www.omdbapi.com/?' + qs, { timeout: 6000 });
  if (r.data && r.data.Poster && r.data.Poster !== 'N/A') {
    return { poster: r.data.Poster, backdrop: null, rating: r.data.imdbRating && r.data.imdbRating !== 'N/A' ? r.data.imdbRating : null };
  }
  return null;
}

async function _tmdbMultiSearch(query) {
  const r = await axios.get('https://api.themoviedb.org/3/search/multi?api_key=' + TMDB_KEY + '&query=' + encodeURIComponent(query), { timeout: 7000 });
  const results = (r.data && r.data.results) ? r.data.results : [];
  const hit = results.find(function(x) { return (x.media_type === 'movie' || x.media_type === 'tv') && !!x.poster_path; });
  if (!hit) return null;
  return {
    poster: 'https://image.tmdb.org/t/p/w500' + hit.poster_path,
    backdrop: hit.backdrop_path ? 'https://image.tmdb.org/t/p/w1280' + hit.backdrop_path : null,
    rating: hit.vote_average ? parseFloat(hit.vote_average).toFixed(1) : null
  };
}

async function mpTmdbPoster(rawTitle) {
  const clean = typeof rawTitle === 'string' && rawTitle.length < 100 && !rawTitle.includes(' ') ? rawTitle : mpCleanTitle(rawTitle);
  if (!clean || clean.length < 2) return null;
  const year = mpExtractYear(rawTitle);

  function fmt(item) {
    if (!item) return null;
    return {
      poster: 'https://image.tmdb.org/t/p/w500' + item.poster_path,
      backdrop: item.backdrop_path ? 'https://image.tmdb.org/t/p/w1280' + item.backdrop_path : null,
      rating: item.vote_average ? parseFloat(item.vote_average).toFixed(1) : null
    };
  }

  try {
    if (year) {
      const r1 = await _tmdbSearch('movie', clean, year);
      if (r1) return fmt(r1);
    }
    const r2 = await _tmdbSearch('movie', clean, null);
    if (r2) return fmt(r2);

    if (year) {
      const r3 = await _tmdbSearch('tv', clean, year);
      if (r3) return fmt(r3);
    }
    const r4 = await _tmdbSearch('tv', clean, null);
    if (r4) return fmt(r4);

    const shortTitle = clean.split(' ').slice(0, 3).join(' ');
    if (shortTitle !== clean && shortTitle.length > 2) {
      const r5 = await _tmdbSearch('movie', shortTitle, year || null);
      if (r5) return fmt(r5);
    }

    const omdb1 = await _omdbLookup(clean, year).catch(function() { return null; });
    if (omdb1) return omdb1;

    if (year) {
      const omdb2 = await _omdbLookup(clean, null).catch(function() { return null; });
      if (omdb2) return omdb2;
    }

    const multiHit = await _tmdbMultiSearch(shortTitle || clean).catch(function() { return null; });
    if (multiHit) return multiHit;
  } catch (e) {}
  return null;
}

async function buildMpCatalog() {
  if (mpCache.building) return;
  mpCache.building = true;
  console.log('[MoviePlex] Building catalog...');
  try {
    const catsRes = await mpWpApi('categories?per_page=100&_fields=id,name,slug,count');
    if (Array.isArray(catsRes.data)) {
      catsRes.data.forEach(function(c) { mpCache.categoryMap[c.id] = { name: c.name, slug: c.slug, count: c.count }; });
    }
    const first = await mpWpApi('posts?per_page=100&page=1&_fields=id,title,slug,date,categories&orderby=date&order=desc');
    const allPosts = Array.isArray(first.data) ? first.data.slice() : [];
    const totalPages = first.totalPages;
    for (let page = 2; page <= totalPages; page += 5) {
      const batch = [];
      for (let p = page; p < page + 5 && p <= totalPages; p++) {
        batch.push(mpWpApi(`posts?per_page=100&page=${p}&_fields=id,title,slug,date,categories&orderby=date&order=desc`));
      }
      const results = await Promise.allSettled(batch);
      results.forEach(function(r) { if (r.status === 'fulfilled' && Array.isArray(r.value.data)) allPosts.push.apply(allPosts, r.value.data); });
      await new Promise(function(r) { setTimeout(r, 150); });
    }
    const normalized = allPosts.map(mpNormalizePost);
    const byCategory = {};
    normalized.forEach(function(post) {
      post.categoryIds.forEach(function(catId) {
        if (!byCategory[catId]) byCategory[catId] = [];
        byCategory[catId].push(post);
      });
    });
    mpCache.posts = normalized;
    mpCache.byCategory = byCategory;
    mpCache.lastBuilt = Date.now();
    console.log('[MoviePlex] Catalog built: ' + normalized.length + ' posts');
  } catch (err) {
    console.error('[MoviePlex] Catalog build failed:', err.message);
  } finally {
    mpCache.building = false;
  }
}

async function buildMpThumbnails(maxPosts = 500) {
  const posts = mpCache.posts;
  if (!posts.length) return;
  const targetPosts = posts.slice(0, maxPosts);

  const TMDB_BATCH = 8;
  for (let i = 0; i < targetPosts.length; i += TMDB_BATCH) {
    const batch = targetPosts.slice(i, i + TMDB_BATCH);
    await Promise.allSettled(batch.map(async function(post) {
      const clean = mpCleanTitle(post.title);
      if (!clean) return;
      const tmdb = await mpTmdbPoster(clean);
      if (tmdb && tmdb.poster) {
        post.thumbnail = tmdb.poster;
        post.coverImage = tmdb.poster;
        post.bannerImage = tmdb.backdrop || tmdb.poster;
        if (tmdb.rating) post.rating = tmdb.rating;
      }
    }));
    await new Promise(function(r) { setTimeout(r, 120); });
  }

  const missing = targetPosts.filter(function(p) { return !p.thumbnail; });
  if (!missing.length) return;

  const BATCH = 8;
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    await Promise.allSettled(batch.map(async function(post) {
      try {
        const res = await axios.get(MOVIEPLEX_BASE + '/' + post.slug + '/', {
          headers: { 'User-Agent': MOVIEPLEX_UA, 'Accept': 'text/html' },
          timeout: 8000,
        });
        const html = typeof res.data === 'string' ? res.data : '';
        const bfEmbed = html.match(/bfmovies\.online\/e\/([a-z0-9]+)/i);
        const bfDown = !bfEmbed && html.match(/bfmovies\.online\/d\/([a-z0-9]+)/i);
        const tpeadMatch = !bfEmbed && !bfDown && html.match(/tpead\.net\/e\/([a-z0-9]+)/i);
        const vid = bfEmbed ? bfEmbed[1] : bfDown ? bfDown[1] : tpeadMatch ? tpeadMatch[1] : null;
        if (vid) {
          const thumb = 'https://img.lulucdn.com/' + vid + '_xt.jpg';
          post.thumbnail = thumb;
          post.coverImage = thumb;
          post.bannerImage = thumb;
        }
      } catch (e) {}
    }));
    await new Promise(function(r) { setTimeout(r, 150); });
  }
}

setImmediate(function() {
  buildMpCatalog()
    .then(function() { return buildMpThumbnails(300); })
    .catch(function() {});
  setInterval(function() {
    if (Date.now() - mpCache.lastBuilt > MP_TTL) {
      buildMpCatalog().then(function() { return buildMpThumbnails(300); }).catch(function() {});
    }
  }, 60 * 60 * 1000);
});

async function scrapeMoviePlexPost(slug) {
  const res = await axios.get(`${MOVIEPLEX_BASE}/${slug}/`, {
    headers: { 'User-Agent': MOVIEPLEX_UA, 'Accept': 'text/html', 'Referer': MOVIEPLEX_BASE },
    timeout: 20000,
  });
  const $ = cheerio.load(res.data);
  const ogImage = $('meta[property="og:image"]').attr('content') || '';
  const title = $('h1').first().text().trim() || '';
  const iframes = [];
  ['tab1', 'tab2', 'tab3'].forEach(function(tabId) {
    const src = $(`#${tabId} iframe`).attr('data-lazy-src') ||
                $(`#${tabId} iframe`).attr('data-src') ||
                $(`#${tabId} iframe`).attr('src') || '';
    if (src && src.startsWith('http') && src !== 'about:blank') iframes.push(src);
  });
  if (!iframes.length) {
    $('iframe').each(function(_, el) {
      const src = $(el).attr('data-lazy-src') || $(el).attr('data-src') || $(el).attr('src') || '';
      if (src && src.startsWith('http') && !iframes.includes(src)) iframes.push(src);
    });
  }
  let thumbnail = ogImage;
  if (!thumbnail) {
    const luluSrc = iframes.find(function(s) { return s.includes('bfmovies.online') || s.includes('lulustream.com') || s.includes('luluvdo.com'); });
    if (luluSrc) {
      const vid = (luluSrc.split('/e/')[1] || luluSrc.split('/d/')[1] || '').split('?')[0].split('/')[0];
      if (vid) thumbnail = `https://img.lulucdn.com/${vid}_xt.jpg`;
    }
  }
  if (!thumbnail) {
    const htmlStr = $.html();
    const bfMatch = htmlStr.match(/bfmovies\.online\/(?:e|d)\/([a-z0-9]+)/i);
    if (bfMatch) thumbnail = `https://img.lulucdn.com/${bfMatch[1]}_xt.jpg`;
  }
  return { thumbnail: thumbnail, iframes: iframes, title: title };
}

async function extractLuluHLS(embedUrl) {
  const res = await axios.get(embedUrl, {
    headers: { 'User-Agent': MOVIEPLEX_UA, 'Referer': MOVIEPLEX_BASE, 'Accept': 'text/html' },
    timeout: 20000, maxRedirects: 5,
  });
  let html = res.data;

  if (!html.includes('eval(function(p,a,c,k')) {
    const redir = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
    if (redir && redir[1]) {
      const res2 = await axios.get(redir[1], {
        headers: { 'User-Agent': MOVIEPLEX_UA, 'Referer': embedUrl, 'Accept': 'text/html' },
        timeout: 20000, maxRedirects: 5,
      });
      html = res2.data;
    }
  }

  const thumbM = html.match(/<meta[^>]+og:image[^>]+content="([^"]+)"/i);
  const thumbnail = thumbM ? thumbM[1] : '';

  const packedIdx = html.indexOf('eval(function(p,a,c,k,e,d)');
  if (packedIdx === -1) throw new Error('LuluStream: no packed JS found');

  let depth = 0, end = -1;
  for (let i = packedIdx + 4; i < Math.min(packedIdx + 50000, html.length); i++) {
    if (html[i] === '(') depth++;
    else if (html[i] === ')') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end === -1) throw new Error('LuluStream: could not find end of eval()');
  const packedBlock = html.substring(packedIdx, end);

  let captured = null;
  const ctx = vm.createContext({
    jwplayer: function() {
      return {
        setup: function(cfg) { captured = cfg; },
        on: function() { return {}; },
        bitrateSelection: function() { return {}; },
      };
    },
    document: { getElementById: function() { return null; }, querySelector: function() { return null; } },
    window: {}, console: { log: function() {} },
  });

  try { vm.runInContext(packedBlock, ctx, { timeout: 5000 }); } catch (e) {}

  if (!captured || !captured.sources || !captured.sources.length) {
    throw new Error('LuluStream: jwplayer.setup() not captured');
  }
  const m3u8 = (captured.sources.find(function(s) { return s.file && s.file.includes('m3u8'); }) || captured.sources[0] || {}).file;
  if (!m3u8) throw new Error('LuluStream: no m3u8 source');
  return { streamUrl: m3u8, thumbnail: thumbnail, source: 'lulustream' };
}

async function extractStreamTapeUrl(embedUrl) {
  const res = await axios.get(embedUrl, {
    headers: { 'User-Agent': MOVIEPLEX_UA, 'Referer': MOVIEPLEX_BASE },
    timeout: 20000,
  });
  const html = res.data;
  const p1m = html.match(/id="[^"]*"[^>]*>([^<]*\/get_video\?[^<]+)</);
  const p2m = html.match(/<span[^>]*id="[^"]*"[^>]*>([^<]{3,40})<\/span>/);
  if (!p1m || !p2m) throw new Error('StreamTape: split token not found');
  return { streamUrl: `https://streamtape.com${p1m[1].trim()}${p2m[1].trim()}&stream=1`, source: 'streamtape' };
}

async function resolveMoviePlexStream(slug, req) {
  const info = await scrapeMoviePlexPost(slug);
  if (!info.iframes.length) throw new Error('No video sources found');

  const luluSrc = info.iframes.find(function(s) { return s.includes('bfmovies.online') || s.includes('lulustream.com') || s.includes('luluvdo.com'); });
  if (luluSrc) {
    try {
      const r = await extractLuluHLS(luluSrc);
      const host = publicHost(req);
      const proxiedUrl = host + '/api/m3u8-proxy?url=' + encodeURIComponent(r.streamUrl) + '&referer=' + encodeURIComponent(luluSrc);
      return {
        streamUrl: proxiedUrl,
        thumbnail: r.thumbnail || info.thumbnail,
        title: info.title,
        source: 'lulustream',
        fallbackIframe: luluSrc,
      };
    } catch (e) { console.warn('[MP Stream] LuluStream failed (' + slug + '):', e.message); }
  }

  const tapeSrc = info.iframes.find(function(s) { return s.includes('tpead.net') || s.includes('streamtape.com'); });
  if (tapeSrc) {
    try {
      const r = await extractStreamTapeUrl(tapeSrc);
      return { streamUrl: r.streamUrl, thumbnail: info.thumbnail, title: info.title, source: r.source, fallbackIframe: info.iframes[0] };
    } catch (e) { console.warn('[MP Stream] StreamTape failed (' + slug + '):', e.message); }
  }

  return { streamUrl: null, thumbnail: info.thumbnail, title: info.title, fallbackIframe: info.iframes[0] || null, error: 'HLS extraction failed' };
}

// ─────────────────────────────────────────────────────
// MOVIE ROUTES
// ─────────────────────────────────────────────────────

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'eetnet-movies-api',
    uptime: Math.floor((Date.now() - startedAt.getTime()) / 1000),
    port: PORT,
  });
});

// GET /api/movies/home
const moviesHomeCache = { data: null, builtAt: 0 };
app.get('/api/movies/home', async function(req, res) {
  if (mpCache.posts.length > 0) {
    const getCatPosts = function(catId, limit, isHotCat = false) {
      limit = limit || 24;
      let posts = mpCache.byCategory[catId] || [];
      if (!isHotCat) {
        posts = posts.filter(function(p) { return !p.is18Plus; });
      }
      return posts.slice(0, limit).map(function(p) {
        return Object.assign({}, p, {
          categories: (p.categoryIds || []).map(function(id) { return mpCache.categoryMap[id] && mpCache.categoryMap[id].name; }).filter(Boolean)
        });
      });
    };

    const trending = getCatPosts(MP_CATS.trending);
    const hot = getCatPosts(MP_CATS.hot, 24, true);
    const webSeries = getCatPosts(MP_CATS.web_series);
    const hindiDubbed = getCatPosts(MP_CATS.hindi_dubbed);
    const bollywood = getCatPosts(MP_CATS.bollywood);
    const hollywood = getCatPosts(MP_CATS.hollywood);
    const action = getCatPosts(MP_CATS.action);
    const shortFilm = getCatPosts(MP_CATS.short_film);
    const thriller = getCatPosts(MP_CATS.thriller);
    const romance = getCatPosts(MP_CATS.romance);

    const topRowItems = [
      ...trending.slice(0, 12),
      ...hindiDubbed.slice(0, 12),
      ...bollywood.slice(0, 12),
      ...hollywood.slice(0, 12),
      ...webSeries.slice(0, 12),
      ...action.slice(0, 12),
    ];
    await Promise.allSettled(topRowItems.map(async function(p) {
      if (!p.thumbnail) {
        const clean = mpCleanTitle(p.title);
        const tmdb = await mpTmdbPoster(clean);
        if (tmdb && tmdb.poster) {
          p.thumbnail = tmdb.poster;
          p.coverImage = tmdb.poster;
          p.bannerImage = tmdb.backdrop || tmdb.poster;
          if (tmdb.rating) p.rating = tmdb.rating;
        }
      }
    }));

    const withThumb = mpCache.posts.filter(function(p) { return !!p.thumbnail && !p.is18Plus; });
    const featured = withThumb[0] || trending[0] || hindiDubbed[0] || bollywood[0] || mpCache.posts.find(function(p) { return !p.is18Plus; }) || null;

    const data = {
      featured: featured, bollywood: bollywood, popular: trending, trending: trending,
      hollywood: hollywood, action: action, classics: [], topRated: [],
      netmirror: { trending: [], netflix: [], prime: [], hotstar: [] },
      movieplex: { trending, hot, webSeries, hindiDubbed, bollywood, hollywood, action, shortFilm, thriller, romance },
    };
    return res.json(data);
  }

  if (moviesHomeCache.data && Date.now() - moviesHomeCache.builtAt < 30 * 60 * 1000) {
    return res.json(moviesHomeCache.data);
  }
  try {
    const fetchCat = async function(catId, limit) {
      limit = limit || 24;
      try {
        const r = await mpWpApi(`posts?categories=${catId}&per_page=${limit}&_fields=id,title,slug,date,categories&orderby=date&order=desc`);
        return (Array.isArray(r.data) ? r.data : []).map(mpNormalizePost);
      } catch(e) { return []; }
    };
    const results = await Promise.all([
      fetchCat(MP_CATS.trending), fetchCat(MP_CATS.hot), fetchCat(MP_CATS.web_series),
      fetchCat(MP_CATS.hindi_dubbed), fetchCat(MP_CATS.bollywood), fetchCat(MP_CATS.hollywood),
      fetchCat(MP_CATS.action), fetchCat(MP_CATS.short_film), fetchCat(MP_CATS.thriller), fetchCat(MP_CATS.romance),
    ]);
    const [trending, hot, webSeries, hindiDubbed, bollywood, hollywood, action, shortFilm, thriller, romance] = results;
    const featured = trending[0] || hindiDubbed[0] || bollywood[0] || null;
    const data = {
      featured: featured, bollywood: bollywood, popular: trending, trending: trending,
      hollywood: hollywood, action: action, classics: [], topRated: [],
      netmirror: { trending: [], netflix: [], prime: [], hotstar: [] },
      movieplex: { trending, hot, webSeries, hindiDubbed, bollywood, hollywood, action, shortFilm, thriller, romance },
    };
    moviesHomeCache.data = data;
    moviesHomeCache.builtAt = Date.now();
    res.json(data);
  } catch (err) {
    console.error('[Movies Home]', err.message);
    res.status(502).json({ error: 'Movies home failed', message: err.message });
  }
});

// GET /api/movieplex/catalog
app.get('/api/movieplex/catalog', async function(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '40')));
    const catId = req.query.category ? parseInt(req.query.category) : null;
    const search = (req.query.search || '').toLowerCase().trim();
    if (!mpCache.posts.length) {
      const params = new URLSearchParams({ per_page: limit, page: page, _fields: 'id,title,slug,date,categories', orderby: 'date', order: 'desc' });
      if (catId) params.set('categories', catId);
      if (search) params.set('search', search);
      const r = await mpWpApi('posts?' + params.toString());
      return res.json({ movies: (Array.isArray(r.data) ? r.data : []).map(mpNormalizePost), total: r.total, page: page, totalPages: r.totalPages, cached: false });
    }
    let posts = catId ? (mpCache.byCategory[catId] || []) : mpCache.posts;

    const allow18 = catId === 21 || req.query.is18 === 'true';
    if (!allow18) {
      posts = posts.filter(function(p) { return !p.is18Plus; });
    } else if (req.query.is18 === 'true' && !catId) {
      posts = posts.filter(function(p) { return p.is18Plus; });
    }

    if (catId && posts.length === 0 && !search) {
      try {
        const params2 = new URLSearchParams({ categories: catId, per_page: limit, page: page, _fields: 'id,title,slug,date,categories', orderby: 'date', order: 'desc' });
        const r2 = await mpWpApi('posts?' + params2.toString());
        const movies2 = (Array.isArray(r2.data) ? r2.data : []).map(function(p) {
          return Object.assign(mpNormalizePost(p), { categories: (p.categories || []).map(function(id) { return mpCache.categoryMap[id] && mpCache.categoryMap[id].name; }).filter(Boolean) });
        });
        await Promise.allSettled(movies2.map(async function(p) {
          if (!p.thumbnail) {
            const clean = mpCleanTitle(p.title);
            const tmdb = await mpTmdbPoster(clean);
            if (tmdb && tmdb.poster) {
              p.thumbnail = tmdb.poster;
              p.coverImage = tmdb.poster;
              p.bannerImage = tmdb.backdrop || tmdb.poster;
              if (tmdb.rating) p.rating = tmdb.rating;
            }
          }
        }));
        return res.json({ movies: movies2, total: r2.total, page: page, totalPages: r2.totalPages, cached: false, note: 'live-fallback' });
      } catch(e2) {}
    }

    if (search) posts = posts.filter(function(p) { return p.title.toLowerCase().includes(search); });
    const total = posts.length;
    const paginated = posts.slice((page - 1) * limit, page * limit);

    await Promise.allSettled(paginated.map(async function(p) {
      if (!p.thumbnail) {
        const clean = mpCleanTitle(p.title);
        const tmdb = await mpTmdbPoster(clean);
        if (tmdb && tmdb.poster) {
          p.thumbnail = tmdb.poster;
          p.coverImage = tmdb.poster;
          p.bannerImage = tmdb.backdrop || tmdb.poster;
          if (tmdb.rating) p.rating = tmdb.rating;
        }
      }
    }));

    const withCats = paginated.map(function(p) {
      return Object.assign({}, p, { categories: p.categoryIds.map(function(id) { return mpCache.categoryMap[id] && mpCache.categoryMap[id].name; }).filter(Boolean) });
    });
    res.json({ movies: withCats, total: total, page: page, totalPages: Math.ceil(total / limit), cached: true });
  } catch (err) {
    console.error('[MP Catalog]', err.message);
    res.status(500).json({ error: 'Catalog fetch failed', message: err.message });
  }
});

// GET /api/movieplex/stream
app.get('/api/movieplex/stream', async function(req, res) {
  const slug = req.query.slug;
  if (!slug) return res.status(400).json({ error: 'Missing slug' });
  try {
    const result = await resolveMoviePlexStream(slug, req);
    res.json(result);
  } catch (err) {
    console.error('[MP Stream] ' + slug + ':', err.message);
    res.status(502).json({ error: 'Stream resolution failed', message: err.message });
  }
});

// GET /api/movieplex/post-info
app.get('/api/movieplex/post-info', async function(req, res) {
  const slug = req.query.slug;
  if (!slug) return res.status(400).json({ error: 'Missing slug' });
  try {
    const info = await scrapeMoviePlexPost(slug);
    const luluSrc = info.iframes.find(function(s) { return s.includes('bfmovies.online'); });
    const vid = luluSrc ? (luluSrc.split('/e/')[1] || '').split('?')[0].split('/')[0] : null;
    let thumbnail = (vid ? 'https://img.lulucdn.com/' + vid + '_xt.jpg' : null) || info.thumbnail || null;

    if (!thumbnail && info.title) {
      const clean = mpCleanTitle(info.title);
      const tmdb = await mpTmdbPoster(clean).catch(function() { return null; });
      if (tmdb && tmdb.poster) thumbnail = tmdb.poster;
    }

    res.json({ thumbnail: thumbnail, title: info.title, iframes: info.iframes });
  } catch (err) { res.status(502).json({ error: err.message }); }
});

// GET /api/movieplex/catalog/status
app.get('/api/movieplex/catalog/status', function(req, res) {
  res.json({ total: mpCache.posts.length, built: mpCache.lastBuilt > 0, building: mpCache.building, lastRefresh: new Date(mpCache.lastBuilt).toISOString(), categoryCount: Object.keys(mpCache.categoryMap).length });
});

// ─────────────────────────────────────────────────────
// NETMIRROR ROUTES
// ─────────────────────────────────────────────────────

// GET /api/netmirror/search
app.get('/api/netmirror/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query param q' });

  try {
    const data = await netmirrorApi('search.php', { params: { s: q } });
    const results = (data?.searchResult || []).slice(0, 10).map(item => ({
      id: item.id,
      title: item.t,
      year: item.y || '',
      rating: item.r || '',
      type: 'movie',
    }));
    res.json(results);
  } catch (err) {
    res.status(502).json({ error: 'NetMirror search failed', message: err.message });
  }
});

// GET /api/netmirror/post/:id
app.get('/api/netmirror/post/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const data = await netmirrorApi('post.php', { params: { id } });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'NetMirror post fetch failed', message: err.message });
  }
});

// GET /api/netmirror/playlist/:id
app.get('/api/netmirror/playlist/:id', async (req, res) => {
  const { id } = req.params;
  const host = publicHost(req);
  try {
    const data = await netmirrorApi('playlist.php', { params: { id } });
    const entry = Array.isArray(data) ? data[0] : data;
    if (!entry || !entry.sources) {
      return res.status(404).json({ error: 'No sources found' });
    }

    const sources = (entry.sources || []).map(src => {
      if (!src.file) return null;
      const proxied = `${host}/api/m3u8-proxy?url=${encodeURIComponent(src.file)}&referer=${encodeURIComponent(NETMIRROR_BASE)}`;
      return {
        quality: src.label || 'Unknown',
        type: src.type || 'hls',
        url: proxied,
        originalUrl: src.file,
      };
    }).filter(Boolean);

    res.json({ sources, tracks: entry.tracks || [] });
  } catch (err) {
    res.status(502).json({ error: 'NetMirror playlist fetch failed', message: err.message });
  }
});

// GET /api/netmirror/trending
app.get('/api/netmirror/trending', async (req, res) => {
  const host = publicHost(req);
  try {
    const html = await netmirrorApi('home?app=1', { expectJson: false });
    const $ = cheerio.load(html);

    const movies = [];
    const seen = new Set();
    $('[data-post]').each((i, element) => {
      const id = $(element).attr('data-post');
      if (!id || seen.has(id)) return;
      seen.add(id);
      const poster = $(element).find('img').attr('data-src') || $(element).find('img').attr('src') || '';
      if (!poster || !poster.startsWith('http')) return;
      const proxiedPoster = `${host}/api/img-proxy?url=${encodeURIComponent(poster)}`;
      movies.push({
        id: String(id),
        title: '',
        year: '',
        coverImage: proxiedPoster,
        bannerImage: proxiedPoster,
        type: 'movie',
        netmirrorId: true,
      });
    });

    const token = await getNetmirrorToken();
    const postHeaders = {
      'Cookie': `t_hash_t=${token}; ott=nf; hd=on`,
      'User-Agent': NETMIRROR_UA,
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${NETMIRROR_BASE}/home`,
    };
    await Promise.all(movies.slice(0, 60).map(async (m) => {
      try {
        const r = await axios.get(`${NETMIRROR_BASE}/mobile/post.php`, {
          params: { id: m.id },
          headers: postHeaders,
          timeout: 8000,
        });
        const d = r.data;
        if (d && d.title) {
          m.title = d.title;
          m.year  = String(d.year || '');
        } else {
          m.title = `NetMirror #${m.id}`;
        }
      } catch (_) {
        m.title = `NetMirror #${m.id}`;
      }
    }));
    movies.slice(60).forEach(m => { if (!m.title) m.title = `NetMirror #${m.id}`; });

    const unique = movies.slice(0, 120);
    res.json(unique);
  } catch (err) {
    console.error('[NetMirror] Trending fetch failed:', err.message);
    res.status(502).json({ error: 'NetMirror trending failed', message: err.message });
  }
});

// GET /api/netmirror/stream-resolve
app.get('/api/netmirror/stream-resolve', async (req, res) => {
  const { id, title, year, type = 'movie', season = 1, episode = 1, ott = 'nf' } = req.query;
  if (!id && !title) return res.status(400).json({ error: 'Missing id or title param' });
  const host = publicHost(req);

  try {
    let targetId = id;
    let targetTitle = title || 'Media';
    let targetYear = year || '';

    if (!targetId) {
      let searchData = await netmirrorApi('search.php', { ott, params: { s: title } });
      let results = searchData?.searchResult || [];

      if (!results.length) {
        const words = title.split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0) {
          searchData = await netmirrorApi('search.php', { ott, params: { s: words[words.length - 1] } });
          results = searchData?.searchResult || [];
        }
      }

      if (!results.length) return res.status(404).json({ error: 'No NetMirror results for: ' + title });
      let best = results[0];
      if (year) {
        const exact = results.find(r => r.t && r.t.toLowerCase().includes(title.toLowerCase().slice(0, 12)) && String(r.y) === String(year));
        if (exact) best = exact;
      }
      targetId = best.id;
      targetTitle = best.t;
      targetYear = best.y || year;
    }

    let playlistId = targetId;
    try {
      const postData = await netmirrorApi('post.php', { ott, params: { id: targetId } });
      const episodes = (postData && Array.isArray(postData.episodes)) ? postData.episodes : [];
      if (episodes.length > 0) {
        const epIdx = Math.max(0, parseInt(episode) - 1);
        const selectedEp = episodes[epIdx] || episodes[0];
        if (selectedEp?.id) playlistId = selectedEp.id;
      }
      if (postData && postData.title) targetTitle = postData.title;
      if (postData && postData.year) targetYear = postData.year;
    } catch (e) {
      console.warn('[NetMirror] post info fetch skipped:', e.message);
    }

    const playlistData = await netmirrorApi('playlist.php', {
      ott,
      params: { id: playlistId, t: targetTitle, tm: Math.floor(Date.now() / 1000) },
    });
    const entry = Array.isArray(playlistData) ? playlistData[0] : playlistData;
    if (!entry?.sources?.length) return res.status(404).json({ error: 'No HLS sources for: ' + targetTitle });

    const normalizeNmUrl = (u) => {
      if (!u) return '';
      let s = String(u).trim();
      if (s.startsWith('//')) return 'https:' + s;
      if (s.startsWith('/')) return NETMIRROR_BASE + s;
      return s;
    };
    const sources = (entry.sources || []).map(src => {
      if (!src.file) return null;
      const fullUrl = normalizeNmUrl(src.file);
      return { quality: src.label || 'Unknown', type: src.type || 'hls', url: host + '/api/m3u8-proxy?url=' + encodeURIComponent(fullUrl) + '&referer=' + encodeURIComponent(NETMIRROR_BASE), originalUrl: fullUrl };
    }).filter(Boolean);

    res.json({ netmirrorId: targetId, title: targetTitle, year: targetYear, sources });
  } catch (err) {
    console.error('[NetMirror] stream-resolve failed:', err.message);
    res.status(502).json({ error: 'NetMirror stream-resolve failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────
// HLS M3U8 & TS PROXIES + IMAGE PROXY
// ─────────────────────────────────────────────────────
app.get('/api/m3u8-proxy', async (req, res) => {
  const { url, referer } = req.query;
  if (!url) return res.status(400).send('Missing url');

  try {
    const decodedUrl = decodeURIComponent(url);
    const decodedRef = referer ? decodeURIComponent(referer) : (new URL(decodedUrl).origin + '/');

    let netmirrorHeaders = {};
    if (decodedUrl.includes('net52.cc') || decodedUrl.includes('netmirror')) {
      try {
        const token = await getNetmirrorToken();
        netmirrorHeaders = {
          'Cookie': `t_hash_t=${token}; ott=nf; hd=on`,
          'User-Agent': NETMIRROR_UA,
          'X-Requested-With': 'XMLHttpRequest',
        };
      } catch (e) {}
    }

    const { data } = await axios.get(decodedUrl, {
      responseType: 'text',
      headers: {
        ...streamProxyHeaders(decodedUrl, decodedRef),
        ...netmirrorHeaders,
      },
      timeout: 15000,
    });

    const host = publicHost(req);
    const childReferer = new URL(decodedUrl).origin + '/';

    const proxyManifestUrl = (value) =>
      `${host}/api/m3u8-proxy?url=${encodeURIComponent(new URL(value, decodedUrl).toString())}&referer=${encodeURIComponent(childReferer)}`;
    const proxySegmentUrl = (value) =>
      `${host}/api/ts-proxy?url=${encodeURIComponent(new URL(value, decodedUrl).toString())}&referer=${encodeURIComponent(childReferer)}`;

    let isStreamInf = false;

    const rewritten = data.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith('#')) {
        if (trimmed.startsWith('#EXT-X-STREAM-INF') || trimmed.startsWith('#EXT-X-I-FRAME-STREAM-INF')) {
          isStreamInf = true;
        }
        if (trimmed.startsWith('#EXT-X-MEDIA:TYPE=AUDIO') && (trimmed.includes('https:///') || trimmed.includes('http:///'))) {
          return '';
        }
        return line.replace(/(URI=)(["'])([^"']+)\2/gi, (match, prefix, quote, uri) => {
          if (!uri || uri.startsWith('data:')) return match;
          const isPlaylist = uri.includes('.m3u8') || trimmed.toUpperCase().startsWith('#EXT-X-MEDIA');
          const proxied = isPlaylist ? proxyManifestUrl(uri) : proxySegmentUrl(uri);
          return `${prefix}${quote}${proxied}${quote}`;
        });
      }

      const abs = new URL(trimmed, decodedUrl).toString();
      const isSubPlaylist = isStreamInf || abs.includes('.m3u8');
      isStreamInf = false;

      if (isSubPlaylist) {
        return proxyManifestUrl(abs);
      }
      return proxySegmentUrl(abs);
    }).join('\n');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(rewritten);
  } catch (err) {
    console.error('[M3U8-PROXY] Error:', err.message);
    res.status(502).send(err.message);
  }
});

app.get('/api/ts-proxy', async (req, res) => {
  const { url, referer } = req.query;
  if (!url) return res.status(400).send('Missing url');

  try {
    const decodedUrl = decodeURIComponent(url);
    const decodedRef = referer ? decodeURIComponent(referer) : (new URL(decodedUrl).origin + '/');

    const reqHeaders = streamProxyHeaders(decodedUrl, decodedRef);
    if (req.headers['range']) {
      reqHeaders['Range'] = req.headers['range'];
    }

    if (decodedUrl.includes('net52.cc') || decodedUrl.includes('netmirror')) {
      try {
        const token = await getNetmirrorToken();
        reqHeaders['Cookie'] = `t_hash_t=${token}; ott=nf; hd=on`;
        reqHeaders['User-Agent'] = NETMIRROR_UA;
      } catch (e) {}
    }

    const upstream = await axios.get(decodedUrl, {
      headers: reqHeaders,
      responseType: 'stream',
      timeout: 30000,
      validateStatus: s => s < 400,
    });

    const proxyHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Accept-Ranges': upstream.headers['accept-ranges'] || 'bytes',
      'Content-Type': upstream.headers['content-type'] || 'video/MP2T',
    };
    if (upstream.headers['content-length'])   proxyHeaders['Content-Length']   = upstream.headers['content-length'];
    if (upstream.headers['content-range'])    proxyHeaders['Content-Range']    = upstream.headers['content-range'];
    if (upstream.headers['content-encoding']) proxyHeaders['Content-Encoding'] = upstream.headers['content-encoding'];

    res.writeHead(upstream.status, proxyHeaders);
    upstream.data.pipe(res);
  } catch (err) {
    console.error('[TS-PROXY] Error:', err.message);
    if (!res.headersSent) res.status(502).send(err.message);
  }
});

app.get('/api/img-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url parameter');

  try {
    const decodedUrl = decodeURIComponent(url);
    const response = await axios.get(decodedUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': BROWSER_UA,
        'Referer': safeOrigin(decodedUrl) + '/',
      },
      timeout: 12000,
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(Buffer.from(response.data));
  } catch (err) {
    res.status(502).send('Image proxy failed');
  }
});

// START SERVER

// ============================================================================
// 🏥 UNIFIED HEALTH & STATUS ENDPOINT
// ============================================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startedAt.getTime()) / 1000),
    startedAt: startedAt.toISOString(),
    services: ['anime', 'drama', 'comics', 'movies'],
    monolith: 'the compilation/server.js'
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    version: '2.0.0',
    mode: 'monolith-compilation',
    endpoints: {
      anime: ['/api/info/:anilistId', '/api/gogoanime/watch', '/api/hianime/watch', '/api/animerulz/watch'],
      drama: ['/api/drama/home', '/api/drama/list', '/api/drama/info/:dramaId', '/api/drama/stream/:episodeId'],
      comics: ['/api/manga/home', '/api/manga/search', '/api/manga/info/:id', '/api/manga/read/:chapterId'],
      movies: ['/api/movies/home', '/api/movieplex/catalog', '/api/movieplex/stream', '/api/netmirror/search']
    }
  });
});

// Fallback error handler
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// Start Monolith Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
====================================================================`);
  console.log(`🚀 EetNet Monolith Backend Running on http://localhost:${PORT}`);
  console.log(`📦 Compiled from: services/anime, drama, comics, movies`);
  console.log(`🕒 Started at: ${startedAt.toLocaleTimeString()}`);
  console.log(`====================================================================\n`);
});
