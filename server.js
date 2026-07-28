import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { ANIME, META, MANGA } from '@consumet/extensions';

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 8080;
const startedAt = new Date();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Vercel serverless request URL normalizer (/movies/home -> /api/movies/home)
app.use((req, res, next) => {
  if (req.url && !req.url.startsWith('/api/') && req.url !== '/api') {
    req.url = '/api' + req.url;
  }
  next();
});

// Public base URL the browser should use to reach this server.
// Behind ngrok/Cloudflare the real protocol + host arrive via X-Forwarded-*.
function publicHost(req) {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http')
    .toString().split(',')[0].trim();
  return `${proto}://${req.get('host')}`;
}
app.use(express.json());

// Disable SSL verification for scraping (needed for anikai.cc)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function safeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return value || '';
  }
}

// ─────────────────────────────────────────────────────
// Providers:
//   PRIMARY:  HiAnime via META.Anilist (AniList ID → exact season/episode)
//   SECONDARY: AnimeKai (anikai.cc) — title-search English subs
//   FALLBACK: AnimeUnity (via Consumet) — last resort
// ─────────────────────────────────────────────────────
const animeUnity = new ANIME.AnimeUnity();
const anilistMeta = new META.Anilist(animeUnity);

// HiAnime provider — maps AniList ID → HiAnime ID → correct season page
const hianime = new ANIME.Hianime();
const anilistHianime = new META.Anilist(hianime);

// HiAnime episode list cache: anilistId → { episodes, timestamp }
const hiAnimeEpCache = new Map();
const HIANIME_TTL = 30 * 60 * 1000; // 30 minutes

// ─────────────────────────────────────────────────────
// HLS/M3U8 Referrer Bypass Proxy
// Rewrites both sub-playlists AND .ts segment URLs so
// the browser only ever talks to the backend's public URL.
// ─────────────────────────────────────────────────────
app.get('/api/m3u8-proxy', async (req, res) => {
  const { url, referer } = req.query;
  if (!url) return res.status(400).send('Missing url');

  try {
    const decodedUrl  = decodeURIComponent(url);
    const decodedRef  = referer ? decodeURIComponent(referer) : (new URL(decodedUrl).origin + '/');

    const { data } = await axios.get(decodedUrl, {
      ...AXIOS_OPTS,
      headers: {
        ...AXIOS_OPTS.headers,
        'Referer': decodedRef,
        'Origin':  new URL(decodedRef).origin,
      },
      responseType: 'text',
    });

    const host = publicHost(req);
    const resolveManifestUrl = (value) => new URL(value, decodedUrl).toString();
    const proxyManifestUrl = (value) =>
      `${host}/api/m3u8-proxy?url=${encodeURIComponent(resolveManifestUrl(value))}&referer=${encodeURIComponent(decodedRef)}`;
    const proxySegmentUrl = (value) =>
      `${host}/api/ts-proxy?url=${encodeURIComponent(resolveManifestUrl(value))}&referer=${encodeURIComponent(decodedRef)}`;

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

      // Resolve relative URL
      const abs = resolveManifestUrl(trimmed);
      const isSubPlaylist = isStreamInf || abs.includes('.m3u8');
      isStreamInf = false;

      // Sub-playlists (.m3u8 or variant stream after #EXT-X-STREAM-INF) → recurse through this same proxy
      if (isSubPlaylist) {
        return proxyManifestUrl(abs);
      }

      // Video segments (.ts / .aac / .js / .css / .woff / etc.) → pipe through ts-proxy
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

// ─────────────────────────────────────────────────────
// TS Segment Proxy — GET /api/ts-proxy?url=<url>&referer=<referer>
// Pipes raw video/audio segments through our server.
// CRITICAL: forwards the Range header so HLS.js byte-range
// requests only fetch the specific bytes needed (not the whole
// file), making startup near-instant.
// ─────────────────────────────────────────────────────
app.get('/api/ts-proxy', async (req, res) => {
  const { url, referer } = req.query;
  if (!url) return res.status(400).send('Missing url');

  try {
    const decodedUrl = decodeURIComponent(url);
    const decodedRef = referer ? decodeURIComponent(referer) : (new URL(decodedUrl).origin + '/');

    // Forward Range header — HLS.js uses byte-range requests
    // for EXT-X-BYTERANGE manifests. Without this we download
    // the full multi-hundred-MB file for every tiny segment.
    const reqHeaders = {
      ...AXIOS_OPTS.headers,
      'Referer': decodedRef,
      'Origin':  new URL(decodedRef).origin,
    };
    if (req.headers['range']) {
      reqHeaders['Range'] = req.headers['range'];
    }

    const upstream = await axios.get(decodedUrl, {
      ...AXIOS_OPTS,
      headers: reqHeaders,
      responseType: 'stream',
      timeout: 30000,
      validateStatus: s => s < 500, // allow 206 Partial Content
    });

    // Pass through all relevant headers from the CDN
    const proxyHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Accept-Ranges': upstream.headers['accept-ranges'] || 'bytes',
      'Content-Type': upstream.headers['content-type'] || 'video/MP2T',
    };
    if (upstream.headers['content-length'])  proxyHeaders['Content-Length']  = upstream.headers['content-length'];
    if (upstream.headers['content-range'])   proxyHeaders['Content-Range']   = upstream.headers['content-range'];
    if (upstream.headers['content-encoding'])proxyHeaders['Content-Encoding'] = upstream.headers['content-encoding'];

    res.writeHead(upstream.status, proxyHeaders);
    upstream.data.pipe(res);
  } catch (err) {
    console.error('[TS-PROXY] Error:', err.message);
    if (!res.headersSent) res.status(502).send(err.message);
  }
});


// ─────────────────────────────────────────────────────
// AnimeKai scraper helpers
// ─────────────────────────────────────────────────────
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

// Cache: title::sN → { slug, timestamp }
const animeCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Stream URL cache: "slug::epN" → { streamData, timestamp }
const streamCache = new Map();
const STREAM_CACHE_TTL = 20 * 60 * 1000; // 20 minutes
const hindiStreamCache = new Map();

// ─────────────────────────────────────────────────────
// Jikan episode cache: "malId:page" -> { data, timestamp }
// ─────────────────────────────────────────────────────
const jikanCache = new Map();
const JIKAN_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Given a vivibebe.site embed URL, extracts the direct HLS .m3u8 stream URL
 * and subtitle track. Returns null if extraction fails.
 */
async function extractDirectStream(embedUrl) {
  try {
    console.log(`[EXTRACT] Fetching player page: ${embedUrl}`);
    const { data } = await axios.get(embedUrl, {
      ...AXIOS_OPTS,
      headers: {
        ...AXIOS_OPTS.headers,
        'Referer': ANIMEKAI_BASE + '/'
      }
    });

    // Extract the .m3u8 stream URL from the JS const src = "..."
    const srcMatch = data.match(/const\s+src\s*=\s*["']([^"']+\.m3u8[^"']*)["']/);
    const m3u8Match = data.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
    const streamUrl = srcMatch?.[1] || m3u8Match?.[1];

    if (!streamUrl) {
      console.warn('[EXTRACT] No .m3u8 URL found in player page');
      return null;
    }

    // Extract subtitle track (passed as ?sub= query param)
    const url = new URL(embedUrl);
    const subtitleUrl = url.searchParams.get('sub') || null;

    console.log(`[EXTRACT] ✅ Direct stream: ${streamUrl}`);
    if (subtitleUrl) console.log(`[EXTRACT]    Subtitle: ${subtitleUrl}`);

    return {
      streamUrl,
      subtitleUrl,
      headers: { 'Referer': new URL(embedUrl).origin + '/' }
    };
  } catch (err) {
    console.warn('[EXTRACT] Failed:', err.message);
    return null;
  }
}

/* ── Extract clean title without (TV), (Sub), (Dub), etc. ── */
function cleanAnimeTitle(t) {
  return t.toLowerCase()
    .replace(/\s*\((tv|sub|dub|uncensored|media)\)/gi, '')
    .replace(/\s*\(season\s*\d+\)/gi, '')
    .trim();
}

/**
 * Score how well a result name matches the target title (0 = no match, higher = better).
 * Prefers: exact match > (TV) suffix match > base title > starts-with.
 * Heavily penalizes sequel keywords (Season 2, 3rd Season, Part 2, etc.) when the target
 * query is a plain base title.
 */
function titleMatchScore(resultName, targetTitle) {
  const r = resultName.toLowerCase().trim();
  const t = targetTitle.toLowerCase().trim();
  const rClean = cleanAnimeTitle(resultName);
  const tClean = cleanAnimeTitle(targetTitle);

  // 1. Exact match (e.g. "jujutsu kaisen" == "jujutsu kaisen")
  if (r === t || rClean === tClean) return 100;

  // 2. Sequel / Season detection in result name
  const isSequel = /\b(season\s*\d|\d+(st|nd|rd|th)\s+season|part\s*\d|cour\s*\d|movie|movie\s*\d)\b/i.test(r) ||
                   /\b(culling game|shibuya|mugen train|entertainment district|swordsmith|hashira)\b/i.test(r);

  // 3. Target query detection: does the search query specify a season/sequel?
  const targetHasSequel = /\b(season\s*\d|\d+(st|nd|rd|th)\s+season|part\s*\d)\b/i.test(t);

  // If result has sequel keywords but target query DOES NOT specify a sequel → heavy penalty!
  // (Prevents "Jujutsu Kaisen 3rd Season" from winning when searching "Jujutsu Kaisen")
  let score = 50;
  if (rClean.startsWith(tClean)) {
    score = 80;
  } else if (rClean.includes(tClean)) {
    score = 60;
  }

  if (isSequel && !targetHasSequel) {
    score -= 45; // Drop score so Season 1 / Base title always wins!
  } else if (isSequel && targetHasSequel) {
    score += 20; // Target asked for sequel, reward sequel matches
  }

  return Math.max(0, score);
}

async function animeKaiSearch(title, seasonNum = null) {
  console.log(`[ANIMEKAI] Searching: "${title}"${seasonNum ? ` (Season ${seasonNum})` : ''}`);

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
      console.warn(`[ANIMEKAI] Search failed for query "${query}":`, err.message);
      return [];
    }
  };

  /**
   * Pick the best matching slug from an array of results.
   * When seasonNum is provided, prefer results that mention that season;
   * penalise results that mention a different season number.
   */
  const pickBest = (results, targetTitle) => {
    if (results.length === 0) return null;
    const scored = results.map(r => {
      let score = titleMatchScore(r.name, targetTitle);
      if (seasonNum !== null) {
        const nameLC = r.name.toLowerCase();
        // Boost if the result explicitly names the right season
        const seasonPatterns = [
          new RegExp(`season\\s*${seasonNum}\\b`, 'i'),
          new RegExp(`\\b${seasonNum}(st|nd|rd|th)\\s+season\\b`, 'i'),
          new RegExp(`part\\s*${seasonNum}\\b`, 'i'),
        ];
        if (seasonPatterns.some(p => p.test(nameLC))) score += 30;
        // Penalise if a *different* season number is mentioned
        const otherSeasonMatch = nameLC.match(/season\s*(\d+)/i) || nameLC.match(/(\d+)(?:st|nd|rd|th)\s+season/i);
        if (otherSeasonMatch) {
          const foundSeason = parseInt(otherSeasonMatch[1]);
          if (foundSeason !== seasonNum) score -= 50;
        }
        // Season 1 is rarely labelled, so don't penalise unlabelled results for S1
        if (seasonNum === 1 && !nameLC.match(/season\s*\d/i)) score += 10;
      }
      return { ...r, score };
    });
    scored.sort((a, b) => b.score - a.score);
    console.log(`[ANIMEKAI] Scored results:`, scored.slice(0, 3).map(r => `"${r.name}" (${r.score})`).join(', '));
    return scored[0].slug;
  };

  // Try 1: Season-qualified title (e.g., "Jujutsu Kaisen Season 2") when season > 1
  if (seasonNum && seasonNum > 1) {
    const seasonQuery = `${title} Season ${seasonNum}`;
    console.log(`[ANIMEKAI] Trying season-qualified query: "${seasonQuery}"`);
    let results = await performSearch(seasonQuery);
    const best = pickBest(results, seasonQuery);
    if (best) {
      console.log(`[ANIMEKAI] Best match (season-qualified): slug=${best}`);
      return best;
    }
  }

  // Try 2: Original title — pick best match
  let results = await performSearch(title);
  {
    const best = pickBest(results, title);
    if (best) {
      console.log(`[ANIMEKAI] Best match (original title): slug=${best}`);
      return best;
    }
  }

  // Try 3: Sanitised title (strip trailing punctuation & parentheses)
  const sanitized = title.replace(/[.\-\u2013\u2014:,\s]+$/, '').replace(/\([^)]*\)/g, '').trim();
  if (sanitized && sanitized !== title) {
    console.log(`[ANIMEKAI] Trying sanitised query: "${sanitized}"`);
    results = await performSearch(sanitized);
    const best = pickBest(results, sanitized);
    if (best) {
      console.log(`[ANIMEKAI] Best match (sanitised): slug=${best}`);
      return best;
    }
  }

  // Try 4: Base title (before colon/hyphen)
  const parts = sanitized.split(/[:\-\u2013\u2014]/);
  if (parts.length > 1) {
    const base = parts[0].trim();
    if (base && base !== sanitized) {
      console.log(`[ANIMEKAI] Trying base title: "${base}"`);
      results = await performSearch(base);
      const best = pickBest(results, base);
      if (best) {
        console.log(`[ANIMEKAI] Best match (base): slug=${best}`);
        return best;
      }
    }
  }

  console.log('[ANIMEKAI] No results found.');
  return null;
}

/**
 * Given an AnimeKai slug + episode number → returns embed URLs for sub/dub
 */
async function animeKaiGetEpisodeEmbeds(slug, episodeNum) {
  const url = `${ANIMEKAI_BASE}/watch/${slug}/ep-${episodeNum}`;
  console.log(`[ANIMEKAI] Loading episode page: ${url}`);

  const { data } = await axios.get(url, AXIOS_OPTS);
  const $ = cheerio.load(data);

  const servers = { sub: [], dub: [], hsub: [] };

  // Parse all server-video elements grouped by language
  $('.server-items.lang-group').each((_, group) => {
    const langId = $(group).attr('data-id') || 'sub'; // sub, dub, hsub
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

  console.log(`[ANIMEKAI] Episode ${episodeNum} — sub: ${servers.sub?.length || 0}, dub: ${servers.dub?.length || 0}, hsub: ${servers.hsub?.length || 0} servers`);
  return servers;
}

// ─────────────────────────────────────────────────────
// Jikan (MyAnimeList) Episode Metadata Proxy
// Fetches episode titles, air dates, filler/recap flags
// ─────────────────────────────────────────────────────
app.get('/api/episodes/mal/:malId', async (req, res) => {
  const { malId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const cacheKey = `${malId}:${page}`;

  console.log(`\n[JIKAN] Episode list for MAL ID ${malId}, page ${page}`);

  // Serve from cache if fresh
  const cached = jikanCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < JIKAN_TTL) {
    console.log(`[JIKAN] Cache hit: ${cacheKey}`);
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
    console.log(`[JIKAN] ${episodes.length} episodes fetched (page ${page}/${data.pagination?.last_visible_page || 1})`);
    res.json(result);
  } catch (err) {
    console.error(`[JIKAN] Failed for MAL ID ${malId}:`, err.message);
    res.status(502).json({ error: 'Could not fetch episode data from Jikan', message: err.message });
  }
});

// ─────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'eetnet-backend',
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    publicBase: publicHost(req),
    port: Number(PORT),
    corsOrigin: process.env.CORS_ORIGIN || '*',
    providers: {
      anime: ['hianime-consumet (AniList ID primary)', 'animekai-scraper (title fallback)', 'animeunity-consumet (last resort)'],
      drama: 'kisskh',
      manhwa: 'hivetoons'
    },
    config: {
      kisskhBase: safeOrigin(KISSKH_BASE),
      encdecBase: safeOrigin(ENCDEC_BASE),
      manhwaBase: safeOrigin(HIVETOONS_BASE)
    }
  });
});

// ─────────────────────────────────────────────────────
// HiAnime watch — PRIMARY stream provider
// Uses AniList ID for deterministic season-correct lookup.
// No title search = no season ambiguity.
// GET /api/hianime/watch?anilistId=N&episode=N[&dub=eng|hindi]
// ─────────────────────────────────────────────────────
// Hindi Dub Anime provider (WordPress/Kiranime)
// Uses HindiDubAnime search + episode pages and returns the embedded player iframe.
const HINDI_ANIME_BASE = process.env.HINDI_ANIME_BASE || 'https://hindidubanime.com';
const hindiAnimeCache = new Map();
const HINDI_ANIME_TTL = 30 * 60 * 1000;

function decodeHtmlText(value = '') {
  return cheerio.load(`<textarea>${value}</textarea>`)('textarea').text();
}

function normalizeProviderTitle(value = '') {
  return decodeHtmlText(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\b(hindi\s+dubbed|hindi\s+dubed|hindi\s+dub|hindi\s+subbed|dual\s+audio)\b/gi, ' ')
    .replace(/\b(tv|ona|ova|movie)\b/gi, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function providerTitleScore(providerTitle, targetTitle, seasonNum = null) {
  const providerClean = normalizeProviderTitle(providerTitle);
  const targetClean = normalizeProviderTitle(targetTitle);
  
  // Use primary title (before colon/dash) for token matching so subtitles like "Kimetsu no Yaiba" don't lower overlap ratio
  const primaryTarget = targetTitle.split(/[:\-–—]/)[0].trim();
  const primaryClean = normalizeProviderTitle(primaryTarget);

  const targetTokens = primaryClean.split(/\s+/).filter(token => token.length >= 2 || /\d/.test(token));
  const providerTokens = new Set(providerClean.split(/\s+/).filter(Boolean));
  const overlap = targetTokens.filter(token => providerTokens.has(token)).length;

  if (targetTokens.length > 0 && overlap === 0) return 0;
  if (targetTokens.length >= 2 && overlap / targetTokens.length < 0.5) return 0;

  let score = titleMatchScore(providerClean, primaryClean);
  const title = decodeHtmlText(providerTitle).toLowerCase();
  const seasonMatch = title.match(/\bseason\s*(\d+)\b/i);

  if (seasonNum && seasonNum > 1) {
    if (seasonMatch && parseInt(seasonMatch[1], 10) === seasonNum) score += 25;
    if (seasonMatch && parseInt(seasonMatch[1], 10) !== seasonNum) score -= 20;
  } else if (seasonMatch && parseInt(seasonMatch[1], 10) > 1) {
    score -= 15;
  }

  if (/\bhindi\s+dub/i.test(title)) score += 15;
  return score;
}

async function hindiProviderJson(path, params = {}) {
  const url = new URL(path, HINDI_ANIME_BASE);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  const { data } = await axios.get(url.toString(), {
    timeout: 12000,
    headers: {
      'User-Agent': AXIOS_OPTS.headers['User-Agent'],
      'Accept': 'application/json, text/plain, */*',
      'Referer': HINDI_ANIME_BASE + '/',
    },
  });
  return data;
}

async function findHindiAnime(title, seasonNum = null) {
  const cacheKey = `${title.toLowerCase()}:s${seasonNum || 1}`;
  const cached = hindiAnimeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < HINDI_ANIME_TTL) return cached.data;

  const cleanTitle = normalizeProviderTitle(title);
  const primaryTitle = title.split(/[:\-–—]/)[0].trim();
  const cleanPrimary = normalizeProviderTitle(primaryTitle);
  const words = cleanTitle.split(/\s+/).filter(Boolean);
  const firstTwo = words.slice(0, 2).join(' ');

  const queries = [
    title,
    cleanTitle,
    primaryTitle,
    cleanPrimary,
    firstTwo
  ].filter(q => q && q.length >= 2);

  const seen = new Set();
  const candidates = [];
  for (const query of queries) {
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const rows = await hindiProviderJson('/wp-json/wp/v2/anime', {
        search: query,
        per_page: 10,
      });
      if (Array.isArray(rows)) candidates.push(...rows);
    } catch (err) {
      console.warn(`[HINDI] Anime search failed for "${query}":`, err.message);
    }
  }

  const scored = candidates
    .map(item => ({
      id: item.id,
      slug: item.slug,
      link: item.link,
      title: decodeHtmlText(item.title?.rendered || ''),
      score: providerTitleScore(item.title?.rendered || item.slug, title, seasonNum),
    }))
    .filter(item => item.score >= 35)
    .sort((a, b) => b.score - a.score);

  const best = scored[0] || null;
  hindiAnimeCache.set(cacheKey, { data: best, timestamp: Date.now() });
  return best;
}

function episodeNumberMatches(item, episodeNum) {
  const title = decodeHtmlText(item.title?.rendered || '').toLowerCase();
  const slug = (item.slug || '').toLowerCase();

  const titleNoSeason = title.replace(/\bseason\s*\d+\b/gi, '');
  const slugNoSeason = slug.replace(/\bseason-?\d+\b/gi, '');

  return (
    new RegExp(`\\bepisode\\s*[\\-–—:]?\\s*0*${episodeNum}\\b`, 'i').test(titleNoSeason) ||
    new RegExp(`episode-0*${episodeNum}(?:$|-)`, 'i').test(slugNoSeason)
  );
}

function scoreHindiEpisode(item, anime, targetTitle, episodeNum, seasonNum = null) {
  if (!episodeNumberMatches(item, episodeNum)) return -999;
  const episodeTitle = decodeHtmlText(item.title?.rendered || item.slug);
  let score = providerTitleScore(episodeTitle.replace(/\bepisode\b.*$/i, ''), targetTitle, seasonNum);
  const raw = `${episodeTitle} ${item.slug}`.toLowerCase();
  const seasonMatch = raw.match(/\bseason[\s-]*(\d+)\b/i);

  if (seasonNum && seasonNum > 1) {
    if (seasonMatch && parseInt(seasonMatch[1], 10) === seasonNum) score += 40;
    if (seasonMatch && parseInt(seasonMatch[1], 10) !== seasonNum) score -= 50;
  } else if (seasonMatch && parseInt(seasonMatch[1], 10) > 1) {
    score -= 45;
  }

  if (anime?.slug && item.slug.startsWith(anime.slug.replace(/-hindi-dubbed|-hindi-dubed|-hindi-dub$/i, ''))) {
    score += 10;
  }

  return score;
}

async function findHindiEpisode(anime, title, episodeNum, seasonNum = null) {
  const searchTitle = anime?.title || title;
  const cleanTitle = normalizeProviderTitle(searchTitle);
  const primaryTitle = searchTitle.split(/[:\-–—]/)[0].trim();
  const cleanPrimary = normalizeProviderTitle(primaryTitle);
  const firstTwo = cleanTitle.split(/\s+/).slice(0, 2).join(' ');

  const queries = [
    `${searchTitle} Episode ${episodeNum}`,
    `${cleanTitle} Episode ${episodeNum}`,
    `${primaryTitle} Episode ${episodeNum}`,
    `${cleanPrimary} Episode ${episodeNum}`,
    `${firstTwo} Episode ${episodeNum}`,
    `${cleanPrimary} ${episodeNum}`,
  ].filter(q => q && q.length >= 3);

  const seen = new Set();
  const candidates = [];
  for (const query of queries) {
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const rows = await hindiProviderJson('/wp-json/wp/v2/episode', {
        search: query,
        per_page: 50,
      });
      if (Array.isArray(rows)) candidates.push(...rows);
    } catch (err) {
      console.warn(`[HINDI] Episode search failed for "${query}":`, err.message);
    }
  }

  return candidates
    .map(item => ({
      id: item.id,
      slug: item.slug,
      link: item.link,
      title: decodeHtmlText(item.title?.rendered || ''),
      score: scoreHindiEpisode(item, anime, title, episodeNum, seasonNum),
    }))
    .filter(item => item.score >= 20)
    .sort((a, b) => b.score - a.score)[0] || null;
}

function extractHindiIframe(html) {
  const $ = cheerio.load(html);
  const scoped = $('.episode-player iframe').first().attr('src');
  if (scoped) return new URL(scoped, HINDI_ANIME_BASE).toString();

  const blocked = /adsterra|histats|google|doubleclick|environmenttalentrabble/i;
  let found = '';
  $('iframe').each((_, el) => {
    if (found) return;
    const src = $(el).attr('src') || '';
    if (src && !blocked.test(src)) found = new URL(src, HINDI_ANIME_BASE).toString();
  });
  return found;
}

function getHindiPlayerId(iframeSrc) {
  try {
    const url = new URL(iframeSrc);
    const match = url.pathname.match(/\/video\/([^/?#]+)/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

async function resolveHindiDirectStream(iframeSrc, episodeUrl, req) {
  const playerId = getHindiPlayerId(iframeSrc);
  if (!playerId) return null;

  const cacheKey = `${playerId}::hls`;
  const cached = hindiStreamCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < STREAM_CACHE_TTL) {
    return cached.data;
  }

  try {
    const iframeUrl = new URL(iframeSrc);
    const playerOrigin = iframeUrl.origin;
    const endpoint = `${playerOrigin}/player/index.php?data=${encodeURIComponent(playerId)}&do=getVideo`;
    const referer = iframeSrc;
    const body = new URLSearchParams({
      hash: playerId,
      r: episodeUrl || HINDI_ANIME_BASE + '/'
    }).toString();

    const { data } = await axios.post(endpoint, body, {
      ...AXIOS_OPTS,
      timeout: 12000,
      headers: {
        ...AXIOS_OPTS.headers,
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': playerOrigin,
        'Referer': referer,
      },
      responseType: 'text',
    });

    const payload = typeof data === 'string' ? JSON.parse(data) : data;
    const rawStreamUrl = payload?.videoSource || payload?.securedLink;
    if (!payload?.hls || !rawStreamUrl) return null;

    const streamUrl = `${publicHost(req)}/api/m3u8-proxy?url=${encodeURIComponent(rawStreamUrl)}&referer=${encodeURIComponent(referer)}`;
    const direct = {
      type: 'hls',
      streamUrl,
      rawStreamUrl,
      image: payload.videoImage || null,
      headers: { Referer: referer },
    };
    hindiStreamCache.set(cacheKey, { data: direct, timestamp: Date.now() });
    return direct;
  } catch (err) {
    console.warn('[HINDI] Direct stream extraction failed:', err.message);
    return null;
  }
}

app.get('/api/hindi/watch', async (req, res) => {
  const { title } = req.query;
  const episodeNum = parseInt(req.query.episode, 10) || 1;
  const seasonNum = req.query.season ? parseInt(req.query.season, 10) : null;

  if (!title) return res.status(400).json({ error: 'Missing title parameter' });

  try {
    console.log(`\n[HINDI] Request: "${title}" S${seasonNum || 1} E${episodeNum}`);
    const anime = await findHindiAnime(String(title), seasonNum);
    if (!anime) {
      return res.status(404).json({
        error: 'Hindi anime not found',
        message: 'No matching Hindi Dub anime entry was found for this title.',
      });
    }

    const episode = await findHindiEpisode(anime, String(title), episodeNum, seasonNum);
    if (!episode?.link) {
      return res.status(404).json({
        error: 'Hindi episode not found',
        message: `Hindi Dub episode ${episodeNum} was not found for ${anime.title}.`,
        matchedTitle: anime.title,
      });
    }

    const { data: html } = await axios.get(episode.link, {
      ...AXIOS_OPTS,
      headers: {
        ...AXIOS_OPTS.headers,
        'Referer': HINDI_ANIME_BASE + '/',
      },
      responseType: 'text',
    });

    const iframeSrc = extractHindiIframe(html);
    if (!iframeSrc) {
      return res.status(404).json({
        error: 'Hindi player not found',
        message: 'The Hindi episode page loaded, but no playable iframe was found.',
        matchedTitle: anime.title,
        episodeUrl: episode.link,
      });
    }

    const directStream = await resolveHindiDirectStream(iframeSrc, episode.link, req);
    if (directStream?.streamUrl) {
      console.log(`[HINDI] Ready: ${anime.title} E${episodeNum} -> direct HLS`);
      return res.json({
        provider: 'hindidubanime',
        type: 'hls',
        streamUrl: directStream.streamUrl,
        headers: directStream.headers,
        poster: directStream.image,
        language: 'Hindi Dub',
        audioMode: 'hindi',
        matchedTitle: anime.title,
        episodeTitle: episode.title,
        episodeUrl: episode.link,
        iframeSrc,
      });
    }

    console.log(`[HINDI] Ready: ${anime.title} E${episodeNum} -> iframe fallback`);
    res.json({
      provider: 'hindidubanime',
      type: 'iframe',
      iframeSrc,
      iframeSandbox: 'allow-scripts allow-same-origin allow-forms allow-presentation',
      language: 'Hindi Dub',
      audioMode: 'hindi',
      matchedTitle: anime.title,
      episodeTitle: episode.title,
      episodeUrl: episode.link,
    });
  } catch (err) {
    console.error('[HINDI] Error:', err.message);
    res.status(502).json({ error: 'Hindi provider failed', message: err.message });
  }
});

app.get('/api/hianime/watch', async (req, res) => {
  const { anilistId, episode, dub } = req.query;
  const episodeNum = parseInt(episode) || 1;
  if (dub === 'hindi') {
    return res.status(404).json({
      error: 'Hindi dub not available',
      message: 'HiAnime/Consumet only exposes sub and English dub streams here. Hindi requests must use a Hindi-capable provider.',
      audioMode: 'hindi'
    });
  }
  // Consumet accepts 'sub' or 'dub' — Hindi not available on HiAnime so map to sub
  const subOrDub = dub === 'eng' ? 'dub' : 'sub';

  if (!anilistId) {
    return res.status(400).json({ error: 'Missing anilistId parameter' });
  }

  console.log(`\n[HIANIME] Request: AniList ID ${anilistId} → Episode ${episodeNum} [${subOrDub}]`);

  try {
    // Cache keyed by anilistId+subOrDub so sub/dub episode lists stay separate
    const cacheKey = `${anilistId}:${subOrDub}`;
    let epList = null;
    const cached = hiAnimeEpCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < HIANIME_TTL) {
      epList = cached.episodes;
      console.log(`[HIANIME] Cache hit: ${epList.length} episodes for AniList ID ${anilistId} (${subOrDub})`);
    } else {
      console.log(`[HIANIME] Fetching anime info for AniList ID ${anilistId} (${subOrDub})...`);
      const fetchWithTimeout = Promise.race([
        anilistHianime.fetchAnimeInfo(anilistId, true),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('HiAnime timeout (3s) — falling back to AnimeKai')), 3000)
        )
      ]);
      const info = await fetchWithTimeout;
      if (!info || !info.episodes || info.episodes.length === 0) {
        console.warn(`[HIANIME] No episodes found for AniList ID ${anilistId}`);
        return res.status(404).json({ error: `No episodes found on HiAnime for AniList ID ${anilistId}` });
      }
      epList = info.episodes;
      hiAnimeEpCache.set(cacheKey, { episodes: epList, timestamp: Date.now() });
      console.log(`[HIANIME] Fetched ${epList.length} episodes (${subOrDub}) (cached for 30min)`);
    }

    const ep = epList.find(e => e.number === episodeNum);
    if (!ep) {
      console.warn(`[HIANIME] Episode ${episodeNum} not found. Available: ${epList.map(e => e.number).join(', ')}`);
      return res.status(404).json({ error: `Episode ${episodeNum} not found on HiAnime` });
    }

    console.log(`[HIANIME] Found episode: ID=${ep.id} Title=${ep.title || '?'}`);

    // Pass subOrDub to Consumet so HiAnime serves the correct audio track
    const sources = await hianime.fetchEpisodeSources(ep.id, undefined, subOrDub);
    if (!sources || !sources.sources || sources.sources.length === 0) {
      console.warn(`[HIANIME] No sources for episode ID ${ep.id} (${subOrDub})`);
      return res.status(404).json({ error: `No stream sources found for this episode` });
    }

    console.log(`[HIANIME] ✅ Episode ${episodeNum} (${subOrDub}) — ${sources.sources.length} source(s) found`);
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
    console.error(`[HIANIME] Error for AniList ID ${anilistId}:`, err.message);
    return res.status(500).json({ error: 'HiAnime lookup failed', message: err.message });
  }
});

async function probeProvider(name, url, options = {}) {
  const started = Date.now();
  try {
    const response = await axios.get(url, {
      timeout: options.timeout || 8000,
      headers: options.headers || AXIOS_OPTS.headers,
      validateStatus: status => status < 500,
    });
    return {
      name,
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
      ms: Date.now() - started,
    };
  } catch (err) {
    return {
      name,
      ok: false,
      error: err.code || err.message,
      ms: Date.now() - started,
    };
  }
}

app.get('/api/status', async (req, res) => {
  const deep = req.query.deep === '1' || req.query.deep === 'true';
  const probes = [
    probeProvider('jikan', 'https://api.jikan.moe/v4/anime/1/episodes?page=1', {
      headers: { 'Accept': 'application/json', 'User-Agent': 'EetNet/1.0' },
    }),
    probeProvider('anime-provider', `${ANIMEKAI_BASE}/browser?keyword=naruto`),
    probeProvider('manhwa-provider', `${HIVETOONS_BASE}/`, { headers: HT_HEADERS }),
    probeProvider('drama-key-provider', `${ENCDEC_BASE}/api/enc-kisskh?text=1&type=vid`, {
      headers: { 'Accept': 'application/json' },
    }),
  ];

  if (deep) {
    probes.push(probeProvider('drama-catalog-provider', `${KISSKH_BASE}/api/DramaList/Show`, {
      headers: {
        'User-Agent': AXIOS_OPTS.headers['User-Agent'],
        'Accept': 'application/json, text/plain, */*',
      },
    }));
  }

  const results = await Promise.all(probes);
  const ok = results.every(item => item.ok);

  res.status(ok ? 200 : 207).json({
    status: ok ? 'ok' : 'degraded',
    checkedAt: new Date().toISOString(),
    publicBase: publicHost(req),
    deep,
    results,
  });
});

// ─────────────────────────────────────────────────────
// ANIME INFO + EPISODE LIST
// Uses META.Anilist + AnimeUnity for episode metadata
// ─────────────────────────────────────────────────────
app.get('/api/info/:anilistId', async (req, res) => {
  const { anilistId } = req.params;
  console.log(`\n[INFO] Fetching info for AniList ID: ${anilistId}`);

  try {
    const info = await anilistMeta.fetchAnimeInfo(anilistId);
    console.log(`[INFO] "${info.title?.english || info.title?.romaji}" — ${info.episodes?.length || 0} episodes`);

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
    console.error(`[INFO] Failed for ID ${anilistId}:`, err.message);
    res.status(502).json({ error: 'Could not fetch episode data', message: err.message });
  }
});

// ─────────────────────────────────────────────────────
// PRIMARY: AnimeKai stream (fast HTTP scraper, English subs)
// Returns embed URLs from third-party players (no domain whitelisting)
// ─────────────────────────────────────────────────────
app.get('/api/gogoanime/watch', async (req, res) => {
  const { title, episode, season, dub } = req.query;
  const episodeNum = parseInt(episode) || 1;
  const seasonNum = season ? parseInt(season) : null;
  const host = publicHost(req);
  // dub param: 'eng' | 'hindi' | undefined (default = sub)
  const wantDub = dub === 'eng';
  const wantHindi = dub === 'hindi';

  if (!title) {
    return res.status(400).json({ error: 'Missing title parameter' });
  }

  // Hindi dub note: AnimeKai only has sub/dub/hsub (English)
  // Hindi dubs are not available on AnimeKai — return early with a clear message
  if (wantHindi) {
    console.log(`[ANIMEKAI] Hindi dub requested for "${title}" — not available on this provider`);
    return res.status(404).json({
      error: 'Hindi dub not available',
      message: 'Hindi dubbed streams are not available through the current provider (AnimeKai). Hindi dubs will be sourced from a dedicated Hindi anime provider in a future update.',
      audioMode: 'hindi'
    });
  }

  // Cache key always includes season (defaults to 1 if unspecified)
  const effectiveSeason = seasonNum || 1;
  const cacheKey = `${title.toUpperCase().trim()}::s${effectiveSeason}`;

  try {
    // Check cache
    let cached = animeCache.get(cacheKey);
    const now = Date.now();

    if (!cached || now - cached.timestamp > CACHE_TTL) {
      const slug = await animeKaiSearch(title, seasonNum);
      if (!slug) {
        console.warn(`[ANIMEKAI] No results for "${title}" (season ${seasonNum})`);
        return res.status(404).json({ error: `Anime "${title}" not found on AnimeKai` });
      }
      cached = { slug, timestamp: now };
      animeCache.set(cacheKey, cached);
      console.log(`[ANIMEKAI] Cached [${cacheKey}] → ${slug}`);
    } else {
      console.log(`[ANIMEKAI] Cache hit [${cacheKey}] → ${cached.slug}`);
    }

    const servers = await animeKaiGetEpisodeEmbeds(cached.slug, episodeNum);

    // Build preference-ordered list of embed URLs to try
    // Priority changes based on requested dub mode:
    // - Default/sub: sub > hsub > dub
    // - ENG Dub: dub > sub > hsub
    const candidates = [];
    if (wantDub) {
      // English Dub mode: prefer dub servers first
      if (servers.dub?.length > 0) {
        servers.dub.forEach(x =>
          candidates.push({ embedUrl: x.embedUrl, language: 'English Dub', server: x.serverName })
        );
      }
      if (servers.sub?.length > 0) {
        servers.sub.forEach(x =>
          candidates.push({ embedUrl: x.embedUrl, language: 'English Sub', server: x.serverName })
        );
      }
      if (servers.hsub?.length > 0) {
        servers.hsub.forEach(x =>
          candidates.push({ embedUrl: x.embedUrl, language: 'English Sub (Hardsub)', server: x.serverName })
        );
      }
    } else {
      // Default: sub first (Japanese audio + English subtitles)
      if (servers.sub?.length > 0) {
        const s = servers.sub.find(x => x.isDefault) || servers.sub[0];
        candidates.push({ embedUrl: s.embedUrl, language: 'English Sub', server: s.serverName });
        servers.sub.filter(x => !x.isDefault).forEach(x =>
          candidates.push({ embedUrl: x.embedUrl, language: 'English Sub', server: x.serverName })
        );
      }
      if (servers.hsub?.length > 0) {
        servers.hsub.forEach(x =>
          candidates.push({ embedUrl: x.embedUrl, language: 'English Sub (Hardsub)', server: x.serverName })
        );
      }
      if (servers.dub?.length > 0) {
        servers.dub.forEach(x =>
          candidates.push({ embedUrl: x.embedUrl, language: 'English Dub', server: x.serverName })
        );
      }
    }

    if (candidates.length === 0) {
      return res.status(404).json({ error: `No streams found for episode ${episodeNum}` });
    }

    // Check stream cache first — avoid re-extracting the HLS URL on repeat clicks
    const streamCacheKey = `${cached.slug}::ep${episodeNum}::${dub || 'sub'}`;
    const cachedStream = streamCache.get(streamCacheKey);
    if (cachedStream && Date.now() - cachedStream.timestamp < STREAM_CACHE_TTL) {
      console.log(`[ANIMEKAI] ⚡ Stream cache hit for ${streamCacheKey}`);
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

    // Try top-3 sub servers in PARALLEL — take whichever resolves first
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
      console.log(`[ANIMEKAI] ⚡ Parallel winner: ${chosenServer}`);
    } catch {
      // All top-3 parallel attempts failed — try remaining candidates sequentially
      console.warn(`[ANIMEKAI] Parallel top-3 failed, trying remaining candidates...`);
      for (const candidate of candidates.slice(3)) {
        console.log(`[ANIMEKAI] Trying fallback server: ${candidate.server}`);
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
      // All extractions failed — return the iframe as last resort (might still work in some browsers)
      const fallback = candidates[0];
      console.warn(`[ANIMEKAI] Direct extraction failed for all servers. Using iframe fallback.`);
      return res.json({
        provider: 'animekai',
        type: 'iframe',
        iframeSrc: fallback.embedUrl,
        episode: episodeNum,
        language: fallback.language,
        allServers: servers
      });
    }

    console.log(`[ANIMEKAI] ✅ Episode ${episodeNum} direct HLS stream ready — ${chosenLanguage} via ${chosenServer}`);

    // Cache the stream URL for 20 minutes so repeat clicks are instant
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
    console.error(`[ANIMEKAI] Error:`, err.message);
    res.status(500).json({ error: 'AnimeKai scraper error', message: err.message });
  }
});

// ─────────────────────────────────────────────────────
// FALLBACK: AnimeUnity stream via Consumet (Italian subs — last resort)
// ─────────────────────────────────────────────────────
app.get('/api/watch/:episodeId', async (req, res) => {
  const episodeId = req.params.episodeId;
  console.log(`\n[WATCH] Fetching AnimeUnity sources for: ${episodeId}`);

  try {
    const sources = await anilistMeta.fetchEpisodeSources(episodeId);
    if (sources.sources?.length > 0) {
      console.log(`[WATCH] Got ${sources.sources.length} sources via META.Anilist`);
      return res.json({
        provider: 'animeunity',
        type: 'hls',
        sources: sources.sources,
        subtitles: sources.subtitles || [],
        headers: sources.headers || {}
      });
    }
  } catch (err) {
    console.warn(`[WATCH] META.Anilist failed:`, err.message);
  }

  try {
    const sources = await animeUnity.fetchEpisodeSources(episodeId);
    if (sources.sources?.length > 0) {
      console.log(`[WATCH] Got ${sources.sources.length} sources (direct AnimeUnity)`);
      return res.json({
        provider: 'animeunity-direct',
        type: 'hls',
        sources: sources.sources,
        subtitles: sources.subtitles || [],
        headers: sources.headers || {}
      });
    }
  } catch (err) {
    console.warn(`[WATCH] Direct AnimeUnity failed:`, err.message);
  }

  res.status(404).json({ error: 'Could not find streaming sources for this episode' });
});

// ─────────────────────────────────────────────────────
// SEARCH (via AnimeKai directly)
// ─────────────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing q parameter' });

  try {
    const slug = await animeKaiSearch(query);
    res.json({ slug, results: slug ? [{ slug }] : [] });
  } catch (error) {
    console.error('[SEARCH] Error:', error.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ─────────────────────────────────────────────────────
// KISSKH DRAMA — Config, Headers & Caches
// ─────────────────────────────────────────────────────
// KISSKH (and enc-dec) reject requests from cloud/datacenter IPs (e.g. Vercel's servers)
// due to Cloudflare. Locally we hit kisskh.co directly; on hosted deployments
// set KISSKH_BASE (and optionally ENCDEC_BASE) to a relay on a trusted IP
// — e.g. a 24/7 phone (Termux) Cloudflare tunnel — so the calls originate
// from an IP KissKH doesn't block.
const KISSKH_BASE = process.env.KISSKH_BASE || 'https://kisskh.co';
const ENCDEC_BASE = process.env.ENCDEC_BASE || 'https://enc-dec.app';

const DRAMA_LIST_TTL  = 30 * 60 * 1000; // 30 min  — drama catalog changes rarely
const STREAM_TTL      =  2 * 60 * 60 * 1000; // 2 hours — kkey tokens last hours

const dramaListCache   = new Map(); // key: "type:page"  → { data, timestamp }
const dramaInfoCache   = new Map(); // key: dramaId      → { data, timestamp }
const dramaStreamCache = new Map(); // key: episodeId    → { data, timestamp }

// Helper: GET a KissKH URL
async function kissKhGet(url) {
  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 15000,
  });

  // If we got HTML back, log it
  const ct = res.headers['content-type'] || '';
  if (ct.includes('text/html') || typeof res.data === 'string') {
    console.warn('[KISSKH] Received HTML response instead of JSON. Reverse proxy might be failing.');
  }
  return res;
}

// ─────────────────────────────────────────────────────
// DRAMA: Home Feed — GET /api/drama/home
//   Returns the full home page data:
//   { show: [...], korean: [...], chinese: [...], topRating: [...] }
// ─────────────────────────────────────────────────────
const dramaHomeCache = new Map();
app.get('/api/drama/home', async (req, res) => {
  const cacheKey = 'home';
  const cached = dramaHomeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < DRAMA_LIST_TTL) {
    console.log('[DRAMA HOME] Cache hit');
    return res.json(cached.data);
  }

  try {
    console.log('\n[DRAMA HOME] Fetching home data...');
    const [showRes, koreanRes, chineseRes, topRatingRes, lastUpdateRes] = await Promise.all([
      kissKhGet(`${KISSKH_BASE}/api/DramaList/Show`),
      kissKhGet(`${KISSKH_BASE}/api/DramaList/MostView?ispc=false&c=2`),    // Korean
      kissKhGet(`${KISSKH_BASE}/api/DramaList/MostView?ispc=false&c=1`),    // Chinese
      kissKhGet(`${KISSKH_BASE}/api/DramaList/TopRating?ispc=false`),
      kissKhGet(`${KISSKH_BASE}/api/DramaList/LastUpdate?ispc=false`),
    ]);
    const data = {
      show:      Array.isArray(showRes.data)      ? showRes.data      : [],
      korean:    Array.isArray(koreanRes.data)    ? koreanRes.data    : [],
      chinese:   Array.isArray(chineseRes.data)   ? chineseRes.data   : [],
      topRating: Array.isArray(topRatingRes.data) ? topRatingRes.data : [],
      lastUpdate:Array.isArray(lastUpdateRes.data)? lastUpdateRes.data: [],
    };
    dramaHomeCache.set(cacheKey, { data, timestamp: Date.now() });
    console.log(`[DRAMA HOME] ✅ show=${data.show.length} korean=${data.korean.length} chinese=${data.chinese.length}`);
    res.json(data);
  } catch (err) {
    console.error('[DRAMA HOME] Error:', err.message);
    res.status(502).json({ error: 'KissKH home fetch failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────
// DRAMA: Browse — GET /api/drama/list?type=1&page=1
//   type: 0=All 1=Korean 2=Chinese 3=Thai 4=Japanese (KissKH Search types)
// ─────────────────────────────────────────────────────
app.get('/api/drama/list', async (req, res) => {
  const type = req.query.type || 0;
  const q    = req.query.q    || '';
  const cacheKey = `list:${type}:${q}`;

  const cached = dramaListCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < DRAMA_LIST_TTL) {
    console.log(`[DRAMA LIST] Cache hit: type=${type}`);
    return res.json(cached.data);
  }

  try {
    const url = `${KISSKH_BASE}/api/DramaList/Search?q=${encodeURIComponent(q)}&type=${type}`;
    console.log(`\n[DRAMA LIST] Fetching type=${type} q="${q}"`);
    const { data } = await kissKhGet(url);
    dramaListCache.set(cacheKey, { data, timestamp: Date.now() });
    console.log(`[DRAMA LIST] Got ${Array.isArray(data) ? data.length : 0} dramas`);
    res.json(data);
  } catch (err) {
    console.error('[DRAMA LIST] Error:', err.message);
    res.status(502).json({ error: 'KissKH drama list failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────
// DRAMA: Search — GET /api/drama/search?q=<query>
// ─────────────────────────────────────────────────────
app.get('/api/drama/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Missing q parameter' });

  try {
    const url = `${KISSKH_BASE}/api/DramaList/Search?q=${encodeURIComponent(q)}&type=0`;
    console.log(`\n[DRAMA SEARCH] Searching: "${q}"`);
    const { data } = await kissKhGet(url);
    console.log(`[DRAMA SEARCH] Got ${Array.isArray(data) ? data.length : 0} results`);
    res.json(data);
  } catch (err) {
    console.error('[DRAMA SEARCH] Error:', err.message);
    res.status(502).json({ error: 'KissKH search failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────
// DRAMA: Episode List — GET /api/drama/info/:dramaId
//   Returns the list of episodes for a drama.
//   Each episode object has { id, number, title, sub, ... }
//   The episode `id` is used later to fetch the stream.
// ─────────────────────────────────────────────────────
app.get('/api/drama/info/:dramaId', async (req, res) => {
  const { dramaId } = req.params;

  const cached = dramaInfoCache.get(dramaId);
  if (cached && Date.now() - cached.timestamp < DRAMA_LIST_TTL) {
    console.log(`[DRAMA INFO] Cache hit: ${dramaId}`);
    return res.json(cached.data);
  }

  try {
    // Fetch both drama metadata and episode list in parallel
    const url = `${KISSKH_BASE}/api/DramaList/Drama/${dramaId}?isq=false`;
    console.log(`\n[DRAMA INFO] Fetching drama detail for ID: ${dramaId}`);
    const { data } = await kissKhGet(url);
    const episodeCount = Array.isArray(data.episodes) ? data.episodes.length : '?';
    console.log(`[DRAMA INFO] Got ${episodeCount} episodes`);
    dramaInfoCache.set(dramaId, { data, timestamp: Date.now() });
    res.json(data);
  } catch (err) {
    console.error('[DRAMA INFO] Error:', err.message);
    res.status(502).json({ error: 'KissKH episode list failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────
// DRAMA: Stream — GET /api/drama/stream/:episodeId
//   Full flow:
//   1. enc-dec.app/enc-kisskh?type=vid  → video kkey token
//   2. kisskh.co/api/DramaList/Episode/<id>?kkey=<token> → Video URL
//   3. enc-dec.app/enc-kisskh?type=sub  → subtitle kkey
//   4. kisskh.co/api/Sub/<id>?kkey=<sub_kkey>           → subtitle list
//   Returns: { streamUrl (proxied), subtitles: [{ label, file }] }
// ─────────────────────────────────────────────────────
app.get('/api/drama/stream/:episodeId', async (req, res) => {
  const { episodeId } = req.params;
  const host = publicHost(req);

  const cached = dramaStreamCache.get(episodeId);
  if (cached && Date.now() - cached.timestamp < STREAM_TTL) {
    console.log(`[DRAMA STREAM] Cache hit: episode ${episodeId}`);
    return res.json(cached.data);
  }

  try {
    console.log(`\n[DRAMA STREAM] Fetching stream for episode ID: ${episodeId}`);

    // ── Step 1: Get video kkey from enc-dec.app ──
    console.log('[DRAMA STREAM] Step 1: Getting video kkey...');
    const vidKeyRes = await axios.get(
      `${ENCDEC_BASE}/api/enc-kisskh?text=${episodeId}&type=vid`,
      { timeout: 10000 }
    );
    const vidKkey = vidKeyRes.data?.result;
    if (!vidKkey) {
      console.error('[DRAMA STREAM] No video kkey returned from enc-dec.app');
      return res.status(502).json({ error: 'enc-dec.app returned no video kkey' });
    }
    console.log('[DRAMA STREAM] Video kkey obtained ✅');

    // ── Step 2: Get the video stream URL from KissKH ──
    console.log('[DRAMA STREAM] Step 2: Fetching video URL from KissKH...');
    const streamRes = await kissKhGet(
      `${KISSKH_BASE}/api/DramaList/Episode/${episodeId}.png?err=false&ts=&time=&kkey=${vidKkey}`
    );
    const videoUrl = streamRes.data?.Video;
    if (!videoUrl) {
      console.error('[DRAMA STREAM] No Video URL in KissKH response:', JSON.stringify(streamRes.data));
      return res.status(404).json({ error: 'No stream URL found for this episode' });
    }
    if (videoUrl.includes('tickcounter.com') || videoUrl.includes('countdown')) {
      console.warn('[DRAMA STREAM] Episode not yet released (countdown active):', videoUrl);
      return res.status(403).json({ error: 'This episode has not aired yet (countdown timer is active).' });
    }
    console.log(`[DRAMA STREAM] Stream URL obtained: ${videoUrl.substring(0, 60)}...`);

    // ── Step 3: Get subtitle kkey ──
    console.log('[DRAMA STREAM] Step 3: Getting subtitle kkey...');
    let subtitles = [];
    try {
      const subKeyRes = await axios.get(
        `${ENCDEC_BASE}/api/enc-kisskh?text=${episodeId}&type=sub`,
        { timeout: 8000 }
      );
      const subKkey = subKeyRes.data?.result;

      // ── Step 4: Get subtitle list ──
      if (subKkey) {
        console.log('[DRAMA STREAM] Step 4: Fetching subtitle list from KissKH...');
        const subListRes = await kissKhGet(
          `${KISSKH_BASE}/api/Sub/${episodeId}?kkey=${subKkey}`
        );
        const rawSubs = subListRes.data;

        // KissKH returns an array of subtitle objects: { label, file, ... }
        if (Array.isArray(rawSubs)) {
          subtitles = rawSubs.map(s => ({
            label: s.label || s.language || 'English',
            file: `${host}/api/drama/subtitle?url=${encodeURIComponent(s.src)}`,
            rawFile: s.src,
            default: (s.label || s.language || '').toLowerCase().includes('en'),
          }));
          console.log(`[DRAMA STREAM] Got ${subtitles.length} subtitle tracks`);
        }
      }
    } catch (subErr) {
      // Subtitle failure is non-fatal — stream still works
      console.warn('[DRAMA STREAM] Subtitle fetch failed (non-fatal):', subErr.message);
    }

    // ── Build the proxied stream URL ──
    const isM3U8 = videoUrl.includes('.m3u8');
    const proxiedStream = isM3U8
      // Referer sent to the video CDN must be the real KissKH origin (not the
      // relay URL) so the CDN accepts the request.
      ? `${host}/api/m3u8-proxy?url=${encodeURIComponent(videoUrl)}&referer=${encodeURIComponent('https://kisskh.co/')}`
      : videoUrl; // MP4: browser can play directly if CORS allows, or proxy if needed

    const result = {
      episodeId,
      type: isM3U8 ? 'hls' : 'mp4',
      streamUrl: proxiedStream,
      subtitles,
    };

    dramaStreamCache.set(episodeId, { data: result, timestamp: Date.now() });
    console.log(`[DRAMA STREAM] ✅ Episode ${episodeId} ready — ${result.type}, ${subtitles.length} sub tracks`);
    res.json(result);

  } catch (err) {
    console.error('[DRAMA STREAM] Fatal error:', err.message);
    res.status(502).json({ error: 'Drama stream fetch failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────
// DRAMA: Subtitle Decode & Proxy — GET /api/drama/subtitle?url=<url>
//   Fetches plain text SRT from KissKH subtitle server, converts it
//   to WebVTT format on the fly, and serves it to the browser.
// ─────────────────────────────────────────────────────
app.get('/api/drama/subtitle', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    console.log(`[DRAMA SUB] Fetching subtitle: ${url.substring(0, 60)}...`);
    const subRes = await axios.get(url, { timeout: 10000, responseType: 'text' });
    let content = subRes.data;

    if (typeof content !== 'string') {
      content = String(content);
    }

    // If it's not already VTT, convert SRT to VTT
    if (!content.trimStart().startsWith('WEBVTT')) {
      // Convert SRT style timestamps (00:00:00,000) to VTT style (00:00:00.000)
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



// ═════════════════════════════════════════════════════
// HIVETOONS MANHWA — Scraper
// Source: https://hivetoons.org
// No Cloudflare, no tokens, images are open CDN links
// ═════════════════════════════════════════════════════
const HIVETOONS_BASE = 'https://hivetoons.org';
const HT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const htHomeCache    = new Map();
const htSeriesCache  = new Map();
const htChapterCache = new Map();
const htSearchCache  = new Map();
const HT_CACHE_TTL   = 30 * 60 * 1000; // 30 min
// Helper: fetch Hivetoons page HTML
async function htGet(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { headers: HT_HEADERS, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const text = await res.text();
    return cheerio.load(text);
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// Helper: extract series cards from a cheerio-loaded page
function extractSeriesCards($) {
  const cards = [];
  // Series cards have an <a href="/series/slug"> with an img inside
  $('a[href^="/series/"]').each((_, el) => {
    const href = $(el).attr('href');
    const slug = href.replace('/series/', '').replace(/\/$/, '');
    if (!slug || slug.includes('/') || slug.includes('?')) return;
    const img = $(el).find('img').first();
    const title = img.attr('alt') || $(el).find('[class*="title"]').text().trim() || '';
    const cover = img.attr('src') || '';
    if (title && cover && cover.startsWith('http')) {
      cards.push({ slug, title, cover });
    }
  });
  // Dedupe by slug
  const seen = new Set();
  return cards.filter(c => { if (seen.has(c.slug)) return false; seen.add(c.slug); return true; });
}

// ─────────────────────────────────────────────────────
// MANHWA: Home Feed — GET /api/manhwa/home
// ─────────────────────────────────────────────────────
app.get('/api/manhwa/home', async (req, res) => {
  const cached = htHomeCache.get('home');
  if (cached && Date.now() - cached.timestamp < HT_CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
    console.log('\n[MANHWA HOME] Fetching...');
    const [home$, latest$] = await Promise.all([
      htGet(`${HIVETOONS_BASE}/`),
      htGet(`${HIVETOONS_BASE}/latest-updates/`),
    ]);

    const popular  = extractSeriesCards(home$).slice(0, 20);
    const latest   = extractSeriesCards(latest$).slice(0, 20);

    // Merge unique slugs for a combined "all" list
    const seen = new Set(popular.map(c => c.slug));
    const combined = [...popular, ...latest.filter(c => !seen.has(c.slug))];

    const data = { popular, latest, combined };
    htHomeCache.set('home', { data, timestamp: Date.now() });
    console.log(`[MANHWA HOME] ✅ popular=${popular.length} latest=${latest.length}`);
    res.json(data);
  } catch (err) {
    console.error('[MANHWA HOME] Error:', err.message);
    res.status(502).json({ error: 'Hivetoons home fetch failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────
// MANHWA: Search — GET /api/manhwa/search?q=<query>
// ─────────────────────────────────────────────────────
app.get('/api/manhwa/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Missing q parameter' });

  const cacheKey = `search:${q.toLowerCase()}`;
  const cached = htSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < HT_CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
    console.log(`\n[MANHWA SEARCH] Searching: "${q}"`);
    const $ = await htGet(`${HIVETOONS_BASE}/series/?searchTerm=${encodeURIComponent(q)}`);
    const results = extractSeriesCards($);
    htSearchCache.set(cacheKey, { data: results, timestamp: Date.now() });
    console.log(`[MANHWA SEARCH] Got ${results.length} results`);
    res.json(results);
  } catch (err) {
    console.error('[MANHWA SEARCH] Error:', err.message);
    res.status(502).json({ error: 'Hivetoons search failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────
// MANHWA: Series Detail — GET /api/manhwa/series/:slug
// Returns: { slug, title, cover, description, genres, status, chapters[] }
// ─────────────────────────────────────────────────────
app.get('/api/manhwa/series/:slug', async (req, res) => {
  const { slug } = req.params;
  const cached = htSeriesCache.get(slug);
  if (cached && Date.now() - cached.timestamp < HT_CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
    console.log(`\n[MANHWA SERIES] Fetching: ${slug}`);
    const $ = await htGet(`${HIVETOONS_BASE}/series/${slug}`);

    const title       = $('meta[property="og:title"]').attr('content') || slug;
    const cover       = $('meta[property="og:image"]').attr('content') || '';
    const description = $('meta[property="og:description"]').attr('content') || '';

    // Genres from links
    const genres = [];
    $('a[href*="genre="]').each((_, el) => {
      const g = $(el).text().trim();
      if (g) genres.push(g);
    });

    const chapSet = new Set();
    const chapters = [];
    $(`a[href^="/series/${slug}/chapter-"]`).each((_, el) => {
      const href = $(el).attr('href');
      const match = href.match(/chapter-([0-9.]+)$/);
      if (match && !chapSet.has(match[1])) {
        chapSet.add(match[1]);

        // Thumbnail image URL inside the chapter link image
        const thumbnail = $(el).find('img').attr('src') || '';

        // Subtitle or description of chapter
        const title = $(el).find('.text-xs.text-gray-600, .dark\\:text-gray-400').first().text().trim() || '';

        // Relative release date
        const dateText = $(el).find('time').text().trim() || '';
        const date = dateText ? (dateText.includes('ago') ? dateText : `${dateText} ago`) : '';

        chapters.push({
          number: parseFloat(match[1]),
          slug: `chapter-${match[1]}`,
          url: href,
          thumbnail,
          title,
          date
        });
      }
    });

    // Sort chapters ascending
    chapters.sort((a, b) => a.number - b.number);

    const data = { slug, title, cover, description, genres, chapters };
    htSeriesCache.set(slug, { data, timestamp: Date.now() });
    console.log(`[MANHWA SERIES] ✅ ${title} — ${chapters.length} chapters`);
    res.json(data);
  } catch (err) {
    console.error('[MANHWA SERIES] Error:', err.message);
    res.status(502).json({ error: 'Hivetoons series fetch failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────
// MANHWA: Chapter Images — GET /api/manhwa/chapter/:slug/:chapter
// Returns: { slug, chapter, images: [url, ...] }
// ─────────────────────────────────────────────────────
app.get('/api/manhwa/chapter/:slug/:chapter', async (req, res) => {
  const { slug, chapter } = req.params;
  const cacheKey = `${slug}:${chapter}`;
  const cached = htChapterCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < HT_CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
    console.log(`\n[MANHWA CHAPTER] Fetching: ${slug}/${chapter}`);
    const $ = await htGet(`${HIVETOONS_BASE}/series/${slug}/${chapter}`);

    // Images are at storage.hivetoon.com/public/upload/series/{slug}/...
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
    console.log(`[MANHWA CHAPTER] ✅ ${slug}/${chapter} — ${images.length} pages`);
    res.json(data);
  } catch (err) {
    console.error('[MANHWA CHAPTER] Error:', err.message);
    res.status(502).json({ error: 'Hivetoons chapter fetch failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────
// MOVIES SECTION (TMDB API + Embed providers)
// ─────────────────────────────────────────────────────
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
  const urlParams = new URLSearchParams({
    api_key: TMDB_API_KEY,
    ...params
  });
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

function mapTmdbMovieDetail(m) {
  if (!m) return null;
  return {
    id: m.id,
    title: m.title || m.original_title,
    imdbId: m.imdb_id,
    coverImage: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
    bannerImage: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : (m.poster_path ? `https://image.tmdb.org/t/p/w1280${m.poster_path}` : null),
    rating: typeof m.vote_average === 'number' ? m.vote_average.toFixed(1) : 'N/A',
    type: 'movie',
    releaseDate: m.release_date,
    description: m.overview || '',
    runtime: m.runtime || 0,
    genres: (m.genres || []).map(g => g.name),
    status: m.status || 'Released'
  };
}

// GET /api/movies/home
app.get('/api/movies/home', async (req, res) => {
  try {
    // 1. Fetch Bollywood Hits (Hindi language)
    const bollywoodRes = await fetch(getTmdbUrl('/discover/movie', {
      with_original_language: 'hi',
      sort_by: 'popularity.desc',
      page: 1
    })).then(r => r.json());

    // 2. Fetch Hollywood Hits (English language popular movies)
    const hollywoodRes = await fetch(getTmdbUrl('/discover/movie', {
      with_original_language: 'en',
      sort_by: 'popularity.desc',
      'vote_count.gte': 100,
      page: 1
    })).then(r => r.json());

    // 3. Fetch Bollywood Classics (Hindi language movies released before 2010)
    const classicsRes = await fetch(getTmdbUrl('/discover/movie', {
      with_original_language: 'hi',
      sort_by: 'popularity.desc',
      'primary_release_date.lte': '2010-01-01',
      'vote_count.gte': 30,
      page: 1
    })).then(r => r.json());

    const bollywood = (bollywoodRes?.results || []).map(mapTmdbMovie).filter(Boolean);
    const hollywood = (hollywoodRes?.results || []).map(mapTmdbMovie).filter(Boolean);
    const classics = (classicsRes?.results || []).map(mapTmdbMovie).filter(Boolean);

    // Construct featured movie (top trending or most popular Bollywood movie)
    const featured = bollywood[0] || hollywood[0];

    res.json({
      featured,
      bollywood,
      hollywood,
      classics
    });
  } catch (err) {
    console.error('[MOVIES HOME] Error:', err.message);
    res.status(502).json({ error: 'TMDB fetch failed', message: err.message });
  }
});

// GET /api/movies/search?q=<query>
app.get('/api/movies/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query param q' });

  try {
    const data = await fetch(getTmdbUrl('/search/movie', {
      query: q,
      page: 1
    })).then(r => r.json());
    const mapped = (data?.results || []).map(mapTmdbMovie).filter(Boolean);
    res.json(mapped);
  } catch (err) {
    console.error('[MOVIES SEARCH] Error:', err.message);
    res.status(502).json({ error: 'TMDB search failed', message: err.message });
  }
});

// GET /api/movies/info/:id
app.get('/api/movies/info/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const data = await fetch(getTmdbUrl(`/movie/${id}`)).then(r => r.json());
    res.json(mapTmdbMovieDetail(data));
  } catch (err) {
    console.error('[MOVIES INFO] Error:', err.message);
    res.status(502).json({ error: 'TMDB movie info failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────
// MANGA API ENDPOINTS (MangaDex Primary + Consumet & AniList Fallbacks)
// ─────────────────────────────────────────────────────

const mangaDexConsumet = new MANGA.MangaDex();
const comicKConsumet = new MANGA.ComicK();

// Helper: Fetch AniList Manga Catalog
async function fetchAniListMangaSection(sort, limit = 18) {
  const query = `
    query ($sort: [MediaSort], $perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: MANGA, sort: $sort, countryOfOrigin: "JP") {
          id
          title { romaji english native }
          coverImage { extraLarge large medium color }
          bannerImage
          description
          status
          chapters
          volumes
          averageScore
          genres
          format
          startDate { year }
        }
      }
    }
  `;
  try {
    const res = await axios.post('https://graphql.anilist.co', {
      query,
      variables: { sort: [sort], perPage: limit }
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 8000 });
    return (res.data?.data?.Page?.media || []).map(m => ({
      id: m.id,
      anilistId: m.id,
      title: m.title.english || m.title.romaji || m.title.native,
      cover: m.coverImage?.extraLarge || m.coverImage?.large,
      banner: m.bannerImage || m.coverImage?.extraLarge,
      description: m.description ? m.description.replace(/<[^>]*>?/gm, '') : '',
      status: m.status,
      chapters: m.chapters || '?',
      volumes: m.volumes || '?',
      rating: m.averageScore ? (m.averageScore / 10).toFixed(1) : '8.5',
      genres: m.genres || ['Action', 'Fantasy'],
      year: m.startDate?.year || '2024',
      type: 'manga'
    }));
  } catch (e) {
    console.error(`[MANGA ANILIST] Error fetching ${sort}:`, e.message);
    return [];
  }
}

// GET /api/manga/home
app.get('/api/manga/home', async (req, res) => {
  try {
    const [trending, popular, topRated] = await Promise.all([
      fetchAniListMangaSection('TRENDING_DESC', 18),
      fetchAniListMangaSection('POPULARITY_DESC', 18),
      fetchAniListMangaSection('SCORE_DESC', 18)
    ]);
    res.json({
      trending,
      popular,
      topRated,
      featured: trending[0] || popular[0] || null
    });
  } catch (err) {
    console.error('[MANGA HOME] Error:', err.message);
    res.status(500).json({ error: 'Failed to load manga home', message: err.message });
  }
});

// GET /api/manga/search?q=<query>
app.get('/api/manga/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.json([]);

  // Try MangaDex REST API
  try {
    const mdRes = await axios.get(`https://api.mangadex.org/manga`, {
      params: {
        title: q,
        limit: 20,
        'includes[]': ['cover_art', 'author', 'artist']
      },
      timeout: 8000
    });
    
    if (mdRes.data?.data?.length) {
      const results = mdRes.data.data.map(m => {
        const titleObj = m.attributes.title || {};
        const title = titleObj.en || Object.values(titleObj)[0] || 'Unknown Title';
        const relCover = m.relationships?.find(r => r.type === 'cover_art');
        const coverFile = relCover?.attributes?.fileName;
        const cover = coverFile ? `https://uploads.mangadex.org/covers/${m.id}/${coverFile}.256.jpg` : null;

        return {
          id: m.id,
          mangadexId: m.id,
          title,
          cover,
          description: m.attributes.description?.en || '',
          status: m.attributes.status,
          rating: '8.5',
          genres: (m.attributes.tags || []).slice(0, 4).map(t => t.attributes?.name?.en).filter(Boolean),
          type: 'manga'
        };
      });
      return res.json(results);
    }
  } catch (e) {
    console.warn('[MANGA SEARCH] MangaDex search failed, attempting Consumet fallback:', e.message);
  }

  // Fallback 1: Consumet MangaDex
  try {
    const consumetRes = await mangaDexConsumet.search(q);
    if (consumetRes?.results?.length) {
      const results = consumetRes.results.map(m => ({
        id: m.id,
        mangadexId: m.id,
        title: typeof m.title === 'string' ? m.title : (m.title?.userPreferred || m.title?.english || 'Manga'),
        cover: m.image,
        description: m.description || '',
        status: m.status,
        rating: m.rating ? (m.rating / 10).toFixed(1) : '8.0',
        genres: m.genres || [],
        type: 'manga'
      }));
      return res.json(results);
    }
  } catch (e) {
    console.warn('[MANGA SEARCH] Consumet MangaDex search failed:', e.message);
  }

  // Fallback 2: AniList search
  try {
    const query = `
      query ($search: String) {
        Page(page: 1, perPage: 20) {
          media(type: MANGA, search: $search) {
            id
            title { romaji english native }
            coverImage { extraLarge large }
            description
            status
            averageScore
            genres
          }
        }
      }
    `;
    const aniRes = await axios.post('https://graphql.anilist.co', { query, variables: { search: q } });
    const results = (aniRes.data?.data?.Page?.media || []).map(m => ({
      id: m.id,
      anilistId: m.id,
      title: m.title.english || m.title.romaji || m.title.native,
      cover: m.coverImage?.extraLarge || m.coverImage?.large,
      description: m.description ? m.description.replace(/<[^>]*>?/gm, '') : '',
      status: m.status,
      rating: m.averageScore ? (m.averageScore / 10).toFixed(1) : '8.5',
      genres: m.genres || [],
      type: 'manga'
    }));
    return res.json(results);
  } catch (e) {
    console.error('[MANGA SEARCH] All search providers failed:', e.message);
    res.json([]);
  }
});

// GET /api/manga/info/:id
app.get('/api/manga/info/:id', async (req, res) => {
  const { id } = req.params;
  
  let mangadexId = id;

  // If numeric ID (AniList ID), resolve to MangaDex UUID
  if (/^\d+$/.test(id)) {
    try {
      // Get title from AniList first
      const aniQuery = `
        query ($id: Int) {
          Media(id: $id, type: MANGA) {
            id
            title { romaji english native }
            coverImage { extraLarge large }
            bannerImage
            description
            status
            chapters
            volumes
            averageScore
            genres
          }
        }
      `;
      const aniRes = await axios.post('https://graphql.anilist.co', { query: aniQuery, variables: { id: parseInt(id) } });
      const media = aniRes.data?.data?.Media;
      const searchTitle = media?.title?.english || media?.title?.romaji || media?.title?.native;

      if (searchTitle) {
        const mdSearch = await axios.get(`https://api.mangadex.org/manga`, {
          params: { title: searchTitle, limit: 5 },
          timeout: 6000
        });
        if (mdSearch.data?.data?.[0]?.id) {
          mangadexId = mdSearch.data.data[0].id;
        }
      }
    } catch (e) {
      console.warn('[MANGA INFO] AniList to MangaDex resolution failed:', e.message);
    }
  }

  // Fetch from MangaDex REST API
  try {
    const mdRes = await axios.get(`https://api.mangadex.org/manga/${mangadexId}`, {
      params: { 'includes[]': ['cover_art', 'author', 'artist'] },
      timeout: 8000
    });

    const mangaData = mdRes.data?.data;
    if (mangaData) {
      const titleObj = mangaData.attributes.title || {};
      const title = titleObj.en || Object.values(titleObj)[0] || 'Unknown Title';
      const relCover = mangaData.relationships?.find(r => r.type === 'cover_art');
      const coverFile = relCover?.attributes?.fileName;
      const cover = coverFile ? `https://uploads.mangadex.org/covers/${mangadexId}/${coverFile}.512.jpg` : null;

      // Fetch chapter feed — filter out external chapters (Manga Plus, Bilibili, etc.)
      // External chapters have externalUrl set and pages=0, no CDN data available
      let chapters = [];
      try {
        const feedRes = await axios.get(`https://api.mangadex.org/manga/${mangadexId}/feed`, {
          params: {
            'translatedLanguage[]': ['en'],
            limit: 500,
            'order[chapter]': 'asc',
            'contentRating[]': ['safe', 'suggestive', 'erotica'],
            'includes[]': ['scanlation_group']
          },
          timeout: 10000
        });

        const rawChs = feedRes.data?.data || [];
        const seenChapters = new Set();

        chapters = rawChs
          // Skip external chapters (Manga Plus, Bilibili etc.) — have no CDN pages
          .filter(c => !c.attributes.externalUrl && c.attributes.pages > 0)
          .map(c => {
            const chNum = c.attributes.chapter || '1';
            const title = c.attributes.title || `Chapter ${chNum}`;
            const volume = c.attributes.volume || null;
            return {
              id: c.id,
              chapter: chNum,
              title: title,
              volume: volume,
              pages: c.attributes.pages || 0,
              publishAt: c.attributes.publishAt
            };
          }).filter(c => {
            if (seenChapters.has(c.chapter)) return false;
            seenChapters.add(c.chapter);
            return true;
          }).sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));

        console.log(`[MANGA INFO] ${chapters.length} readable chapters (${rawChs.length - chapters.length} external/empty skipped)`);
      } catch (e) {
        console.warn('[MANGA INFO] Chapter feed fetch error:', e.message);
      }

      return res.json({
        id: mangadexId,
        mangadexId,
        title,
        cover,
        banner: cover,
        description: mangaData.attributes.description?.en || 'No description available.',
        status: mangaData.attributes.status,
        rating: '8.8',
        genres: (mangaData.attributes.tags || []).map(t => t.attributes?.name?.en).filter(Boolean),
        chapters
      });
    }
  } catch (e) {
    console.warn('[MANGA INFO] Direct MangaDex API failed, trying Consumet:', e.message);
  }

  // Fallback to Consumet
  try {
    const info = await mangaDexConsumet.fetchMangaInfo(mangadexId);
    if (info) {
      return res.json({
        id: info.id,
        mangadexId: info.id,
        title: typeof info.title === 'string' ? info.title : (info.title?.userPreferred || info.title?.english || 'Manga'),
        cover: info.image,
        banner: info.headerForImage || info.image,
        description: info.description || '',
        status: info.status,
        rating: info.rating ? (info.rating / 10).toFixed(1) : '8.5',
        genres: info.genres || [],
        chapters: (info.chapters || []).map(c => ({
          id: c.id,
          chapter: c.chapterNumber || c.title || '1',
          title: c.title || `Chapter ${c.chapterNumber || 1}`,
          pages: 0
        }))
      });
    }
  } catch (e) {
    console.error('[MANGA INFO] All info providers failed:', e.message);
    res.status(502).json({ error: 'Failed to fetch manga info', message: e.message });
  }
});

// GET /api/manga/read/:chapterId
app.get('/api/manga/read/:chapterId', async (req, res) => {
  const { chapterId } = req.params;
  console.log(`[MANGA READ] Fetching pages for: ${chapterId}`);

  // Hard 12s global timeout
  const routeTimeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error(`[MANGA READ] TIMEOUT — ${chapterId}`);
      res.json({ chapterId, pageCount: 0, pages: [] });
    }
  }, 12000);

  try {
    const atHomeRes = await axios.get(
      `https://api.mangadex.org/at-home/server/${chapterId}`,
      { timeout: 8000 }
    );
    const { baseUrl, chapter } = atHomeRes.data || {};
    console.log(`[MANGA READ] at-home baseUrl=${baseUrl}, data=${chapter?.data?.length ?? 'none'}, dataSaver=${chapter?.dataSaver?.length ?? 'none'}`);

    // Try full-quality pages first, then dataSaver (compressed) as fallback
    const files    = chapter?.data?.length    ? chapter.data    : null;
    const quality  = files ? 'data' : (chapter?.dataSaver?.length ? 'data-saver' : null);
    const pageList = files || chapter?.dataSaver || [];

    if (baseUrl && quality && pageList.length) {
      clearTimeout(routeTimeout);
      const pages = pageList.map((fileName, index) => ({
        page: index + 1,
        url: `${baseUrl}/${quality}/${chapter.hash}/${fileName}`,
      }));
      console.log(`[MANGA READ] OK — ${pages.length} pages (${quality}) for ${chapterId}`);
      return res.json({ chapterId, pageCount: pages.length, pages });
    }

    // No pages at all from at-home (chapter may be external/restricted)
    clearTimeout(routeTimeout);
    console.error(`[MANGA READ] No pages available for ${chapterId} — baseUrl=${baseUrl}, data=${chapter?.data?.length}, dataSaver=${chapter?.dataSaver?.length}`);
    if (!res.headersSent) res.json({ chapterId, pageCount: 0, pages: [] });

  } catch (e) {
    clearTimeout(routeTimeout);
    console.error(`[MANGA READ] at-home request failed: ${e.message}`);
    if (!res.headersSent) res.json({ chapterId, pageCount: 0, pages: [] });
  }
});



// GET /api/manga/image-proxy?url=<url>
app.get('/api/manga/image-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url parameter');

  try {
    const targetUrl = decodeURIComponent(url);
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://mangadex.org/'
      },
      timeout: 10000
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(response.data));
  } catch (err) {
    console.error('[MANGA IMAGE PROXY] Error:', err.message);
    res.status(500).send('Image proxy error');
  }
});




// Helper: AniList manga query
async function anilistManga(query, variables = {}) {
  const r = await axios.post(ANILIST_API, { query, variables }, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    timeout: 8000
  });
  return r.data?.data;
}

const MANGA_AL_FRAGMENT = `
  id title { romaji english native } coverImage { extraLarge large } bannerImage
  description(asHtml: false) genres averageScore status
`;

function mapALManga(m) {
  return {
    id: String(m.id),
    title: m.title?.english || m.title?.romaji || m.title?.native || 'Unknown',
    cover: m.coverImage?.extraLarge || m.coverImage?.large || null,
    banner: m.bannerImage || null,
    description: m.description || '',
    genres: m.genres || [],
    rating: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
    status: (m.status || '').toLowerCase(),
  };
}

// GET /api/manga/home — trending, popular, topRated, featured
app.get('/api/manga/home', async (req, res) => {
  try {
    const data = await anilistManga(`
      query {
        trending: Page(page:1,perPage:18){ media(type:MANGA,sort:TRENDING_DESC,countryOfOrigin:"JP"){ ${MANGA_AL_FRAGMENT} } }
        popular:  Page(page:1,perPage:18){ media(type:MANGA,sort:POPULARITY_DESC,countryOfOrigin:"JP"){ ${MANGA_AL_FRAGMENT} } }
        topRated: Page(page:1,perPage:18){ media(type:MANGA,sort:SCORE_DESC,countryOfOrigin:"JP"){ ${MANGA_AL_FRAGMENT} } }
      }
    `);
    const trending = (data?.trending?.media || []).map(mapALManga);
    const popular  = (data?.popular?.media  || []).map(mapALManga);
    const topRated = (data?.topRated?.media || []).map(mapALManga);
    return res.json({ trending, popular, topRated, featured: trending[0] || popular[0] || null });
  } catch (e) {
    console.error('[manga/home] AniList failed:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/manga/search?q=query
app.get('/api/manga/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  // 1) Try MangaDex search
  try {
    const r = await axios.get(`${MANGADEX_API}/manga`, {
      params: { title: q, limit: 24, 'contentRating[]': ['safe','suggestive'], 'includes[]': ['cover_art'] },
      timeout: 8000
    });
    const results = (r.data?.data || []).map(m => {
      const covRel = m.relationships?.find(r => r.type === 'cover_art');
      const cover  = covRel ? `https://uploads.mangadex.org/covers/${m.id}/${covRel.attributes?.fileName}.256.jpg` : null;
      const title  = m.attributes?.title?.en || Object.values(m.attributes?.title || {})[0] || 'Unknown';
      return { id: m.id, mangadexId: m.id, title, cover, status: m.attributes?.status, rating: null };
    });
    if (results.length) return res.json(results);
  } catch (e) {
    console.warn('[manga/search] MangaDex failed, trying AniList:', e.message);
  }

  // 2) AniList fallback
  try {
    const data = await anilistManga(
      `query($s:String){ Page(page:1,perPage:20){ media(type:MANGA,search:$s){ ${MANGA_AL_FRAGMENT} } } }`,
      { s: q }
    );
    return res.json((data?.Page?.media || []).map(mapALManga));
  } catch (e) {
    console.error('[manga/search] AniList also failed:', e.message);
    return res.json([]);
  }
});

// GET /api/manga/info/:id — chapter list via MangaDex (id can be AniList int or MangaDex UUID)
app.get('/api/manga/info/:id', async (req, res) => {
  const rawId = req.params.id;
  let mangadexId = rawId;
  let baseInfo   = null;

  // If it looks like an AniList numeric ID, resolve to MangaDex UUID via AniList → MangaDex link
  if (/^\d+$/.test(rawId)) {
    try {
      const alData = await anilistManga(
        `query($id:Int){ Media(id:$id,type:MANGA){ ${MANGA_AL_FRAGMENT} externalLinks{ url site } } }`,
        { id: parseInt(rawId) }
      );
      const media = alData?.Media;
      if (media) {
        baseInfo = mapALManga(media);
        // Try to find MangaDex link
        const mdLink = (media.externalLinks || []).find(l =>
          l.site?.toLowerCase().includes('mangadex') || l.url?.includes('mangadex.org')
        );
        if (mdLink) {
          const match = mdLink.url.match(/title\/([\w-]+)/);
          if (match) mangadexId = match[1];
        } else {
          // Search MangaDex by title
          const title = baseInfo.title;
          const sr = await axios.get(`${MANGADEX_API}/manga`, {
            params: { title, limit: 5, 'contentRating[]': ['safe','suggestive'] },
            timeout: 8000
          });
          const first = sr.data?.data?.[0];
          if (first) mangadexId = first.id;
        }
      }
    } catch (e) {
      console.warn('[manga/info] AniList ID resolution failed:', e.message);
    }
  }

  // Fetch chapters from MangaDex (paginate up to 500 chapters)
  let chapters = [];
  try {
    const params = {
      manga: mangadexId,
      'translatedLanguage[]': ['en'],
      limit: 100,
      offset: 0,
      order: { chapter: 'asc' },
      'contentRating[]': ['safe', 'suggestive'],
    };
    let total = Infinity;
    while (chapters.length < Math.min(total, 500)) {
      const r = await axios.get(`${MANGADEX_API}/chapter`, { params: { ...params, offset: chapters.length }, timeout: 10000 });
      total = r.data?.total || 0;
      const batch = r.data?.data || [];
      if (!batch.length) break;
      chapters.push(...batch.map(c => ({
        id: c.id,
        chapter: c.attributes?.chapter || '?',
        title: c.attributes?.title || '',
        pages: c.attributes?.pages || 0,
        publishAt: c.attributes?.publishAt,
      })));
    }
    // Deduplicate by chapter number (keep first/highest page count)
    const seen = new Map();
    chapters = chapters.filter(c => {
      if (seen.has(c.chapter)) return false;
      seen.set(c.chapter, true);
      return true;
    });
  } catch (e) {
    console.warn('[manga/info] MangaDex chapter fetch failed:', e.message);
  }

  // Fetch cover if not already resolved
  if (!baseInfo) {
    try {
      const r = await axios.get(`${MANGADEX_API}/manga/${mangadexId}`, {
        params: { 'includes[]': ['cover_art'] }, timeout: 8000
      });
      const m = r.data?.data;
      const covRel = m?.relationships?.find(r => r.type === 'cover_art');
      const cover = covRel ? `https://uploads.mangadex.org/covers/${mangadexId}/${covRel.attributes?.fileName}.512.jpg` : null;
      const title = m?.attributes?.title?.en || Object.values(m?.attributes?.title || {})[0] || 'Unknown';
      baseInfo = { id: mangadexId, title, cover, status: m?.attributes?.status, chapters: [] };
    } catch (e) {
      baseInfo = { id: rawId, title: 'Unknown Manga', cover: null };
    }
  }

  return res.json({ ...baseInfo, mangadexId, chapters });
});

// GET /api/manga/read/:chapterId — direct page image URLs (no proxy = full CDN speed)
app.get('/api/manga/read/:chapterId', async (req, res) => {
  const { chapterId } = req.params;

  // 1) Try MangaDex@Home
  try {
    const r = await axios.get(`${MANGADEX_API}/at-home/server/${chapterId}`, { timeout: 10000 });
    const { baseUrl, chapter: ch } = r.data;
    if (!ch?.data?.length) throw new Error('Empty chapter data from MangaDex@Home');
    // Return DIRECT CDN URLs — browser fetches images directly, no Termux proxy bottleneck
    const pages = ch.data.map((f, i) => ({
      page: i + 1,
      url: `${baseUrl}/data/${ch.hash}/${f}`,
    }));
    console.log(`[manga/read] OK ${chapterId} — ${pages.length} pages via MangaDex@Home`);
    return res.json({ chapterId, pageCount: pages.length, pages });
  } catch (e) {
    console.warn('[manga/read] MangaDex@Home failed, trying Consumet:', e.message);
  }

  // 2) Consumet MANGA.MangaDex fallback — also direct URLs
  try {
    const data = await mangaDex.fetchChapterPages(chapterId);
    const pages = (data || []).map((p, i) => ({
      page: i + 1,
      url: p.img || p.url,
    }));
    console.log(`[manga/read] OK ${chapterId} — ${pages.length} pages via Consumet`);
    return res.json({ chapterId, pageCount: pages.length, pages });
  } catch (e) {
    console.error('[manga/read] Consumet also failed:', e.message);
    return res.status(500).json({ error: 'Chapter pages unavailable', pages: [] });
  }
});

// GET /api/manga/image-proxy?url=...&ref=...  — proxy manga page images with correct Referer
app.get('/api/manga/image-proxy', async (req, res) => {
  const { url, ref } = req.query;
  if (!url) return res.status(400).send('Missing url');
  try {
    const r = await axios.get(decodeURIComponent(url), {
      responseType: 'stream',
      timeout: 15000,
      headers: {
        Referer:    ref ? decodeURIComponent(ref) : 'https://mangadex.org',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    res.set('Content-Type', r.headers['content-type'] || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    r.data.pipe(res);
  } catch (e) {
    console.error('[manga/image-proxy] failed:', e.message);
    res.status(502).send('Image proxy error');
  }
});

// ─────────────────────────────────────────────────────
// Start server

// ─────────────────────────────────────────────────────
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🚀 EetNet backend running on http://localhost:${PORT}`);
    console.log(`   PRIMARY:  AnimeKai (HTTP scraper — English subs) ⚡`);
    console.log(`   FALLBACK: AnimeUnity (Consumet — Italian subs)`);
    console.log(`   DRAMA:    KissKH via enc-dec.app (English subs) 🎬`);
    console.log(`   Endpoints:`);
    console.log(`     GET /api/info/:anilistId                     — anime details + episode list`);
    console.log(`     GET /api/gogoanime/watch?title=X&episode=N   — AnimeKai English sub stream ⚡`);
    console.log(`     GET /api/watch/:episodeId                    — AnimeUnity fallback stream`);
    console.log(`     GET /api/search?q=<query>                    — AnimeKai search`);
    console.log(`     GET /api/drama/list?type=1&page=1            — KissKH drama catalog 🎬`);
    console.log(`     GET /api/drama/search?q=<query>              — KissKH drama search`);
    console.log(`     GET /api/drama/info/:dramaId                 — episode list for a drama`);
    console.log(`     GET /api/drama/stream/:episodeId             — stream URL + subtitles`);
    console.log(`     GET /api/drama/subtitle?url=<url>            — decode KissKH subtitle`);
    console.log(`     GET /api/m3u8-proxy?url=<url>                — HLS manifest proxy`);
    console.log(`     GET /api/ts-proxy?url=<url>                  — HLS segment proxy\n`);
  });
}

export default app;
