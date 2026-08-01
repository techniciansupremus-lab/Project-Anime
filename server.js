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

// Old Hindi stream responses may contain a proxy URL that was wrapped again by
// a previous server process. Resolve it back to the provider URL before making
// a new proxy URL so a cached response cannot create localhost -> localhost loops.
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

// StreamIndia's generated master playlists point at proxy.streamindia.co.in.
// That relay currently returns 502 despite valid headers, while its embedded
// as-cdn URL is reachable with the same protected HLS flow. Skip only that
// failed relay; the CDN remains behind our manifest and segment proxies.
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

function streamProxyHeaders(targetUrl, referer, extraHeaders = {}) {
  const isProtectedHls = targetUrl.includes('streamindia.co.in') || /https:\/\/as-cdn\d+\.top\//i.test(targetUrl);
  return {
    ...AXIOS_OPTS.headers,
    ...extraHeaders,
    // StreamIndia rejects the HTML-navigation Accept header used by AnimeKai.
    ...(isProtectedHls ? {
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
    } : {}),
    'Referer': referer,
    'Origin': new URL(referer).origin,
  };
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
        ...AXIOS_OPTS,
        ...axiosOptions,
        headers: streamProxyHeaders(targetUrl, referer, extraHeaders),
      });
      if (referer !== primaryReferer) {
        console.log(`[M3U8-PROXY] Recovered ${new URL(targetUrl).hostname} with ${new URL(referer).hostname}`);
      }
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

app.use(express.json());

// Image Proxy Routes (Bypasses CORS & hotlink 403 for AniList / ComicK / TMDB images)
const handleImageProxy = async (req, res) => {
  const rawUrl = req.query.url;
  if (!rawUrl) return res.status(400).send('Missing url');

  let targetUrl = decodeURIComponent(rawUrl);
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    if (targetUrl.startsWith('//')) {
      targetUrl = 'https:' + targetUrl;
    } else {
      targetUrl = 'https://meo.comick.pictures/' + targetUrl.replace(/^\/+/, '');
    }
  }

  try {
    const isComicK = targetUrl.includes('comick') || targetUrl.includes('comickz') || targetUrl.includes('comicknew');
    const referer = isComicK ? 'https://comickz.co.uk/' : (safeOrigin(targetUrl) + '/');

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': referer
      },
      timeout: 12000
    });

    let contentType = response.headers['content-type'] || 'image/jpeg';
    if (contentType === 'application/octet-stream' || contentType.includes('html')) {
      contentType = 'image/jpeg';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(response.data);
  } catch (err) {
    console.warn(`[IMAGE PROXY WARNING] Failed to fetch "${targetUrl}":`, err.message);
    if (targetUrl.startsWith('http')) {
      return res.redirect(targetUrl);
    }
    return res.status(404).send('Image not found');
  }
};

app.get('/api/img-proxy', handleImageProxy);
app.get('/api/manga/image-proxy', handleImageProxy);

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
// Subtitle VTT Proxy — GET /api/subtitle-proxy?url=<url>
// Proxies VTT subtitle files from external CDNs (cdn.anizara.store, etc.)
// so that browser <track> elements can load them without CORS block.
// ─────────────────────────────────────────────────────
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
    console.error('[SUBTITLE-PROXY] Error:', err.message);
    res.status(502).send(err.message);
  }
});

// ─────────────────────────────────────────────────────
// HLS/M3U8 Referrer Bypass Proxy
// Rewrites both sub-playlists AND .ts segment URLs so
// the browser only ever talks to the backend's public URL.
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
    // A provider playlist can contain another protected relay (for example,
    // extract.streamindia.co.in -> proxy.streamindia.co.in -> CDN). Each hop
    // expects the playlist that referred to it, not the page referer used for
    // the first manifest request.
    const childReferer = new URL(decodedUrl).origin + '/';
    const resolveManifestUrl = (value) =>
      unwrapStreamIndiaRelayUrl(new URL(value, decodedUrl).toString());
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
    const reqHeaders = streamProxyHeaders(decodedUrl, decodedRef);
    if (req.headers['range']) {
      reqHeaders['Range'] = req.headers['range'];
    }

    const upstream = await fetchStreamProxyTarget(decodedUrl, decodedRef, {
      headers: reqHeaders,
      responseType: 'stream',
      timeout: 30000,
      validateStatus: s => s < 400, // allow 206 Partial Content, retry protected failures
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
// ─────────────────────────────────────────────────────
// AnimeRulz — Hindi/Indian language anime stream provider
// Uses AniList IDs + fallback.streamindia.co.in API + animelok for Indian dubs.
// GET /api/animerulz/watch?anilistId=N&episode=N[&lang=hin|tam|tel|eng|jpn]
// ─────────────────────────────────────────────────────
const ANIMERULZ_FALLBACK = process.env.ANIMERULZ_FALLBACK || 'https://fallback.streamindia.co.in';
const ANIMERULZ_DATA    = process.env.ANIMERULZ_DATA    || 'https://data.streamindia.co.in';
const ANIMERULZ_ANIMELOK = process.env.ANIMERULZ_ANIMELOK || 'https://animelok.streamindia.co.in';
const ANIMERULZ_EXTRACT = process.env.ANIMERULZ_EXTRACT || 'https://extract.streamindia.co.in';
const ANIMERULZ_HIANIME = process.env.ANIMERULZ_HIANIME || 'https://hianime.streamindia.co.in';
const ANIMERULZ_CACHE_TTL = 30 * 60 * 1000; // 30 min

// AnimeRulz APIs require a browser-like Referer/Origin or they return 403.
const ANIMERULZ_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://animerulzapp.buzz/',
  'Origin': 'https://animerulzapp.buzz',
};

const animerulzStreamCache = new Map();
const animerulzDataCache    = new Map();

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

/**
 * Fetch anime metadata from HiAnime detail API.
 * Returns { title, description, coverImage, bannerImage, genres, episodes, ... }
 */
async function fetchAnimerulzAnime(anilistId) {
  const cacheKey = `detail:${anilistId}`;
  const cached = animerulzDataCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ANIMERULZ_CACHE_TTL) return cached.data;

  try {
    const url = `${ANIMERULZ_HIANIME}/api/v2/hianime/anilist/anime/${anilistId}`;
    const { data } = await axios.get(url, {
      timeout: 10000,
      headers: ANIMERULZ_HEADERS,
    });
    if (data?.data) {
      animerulzDataCache.set(cacheKey, { data: data.data, ts: Date.now() });
      return data.data;
    }
  } catch (err) {
    console.warn(`[ANIMERULZ] Detail fetch failed for ${anilistId}:`, err.message);
  }
  return null;
}

/**
 * Fetch episode list from fallback API.
 * Returns [ { number, title, description, img, hasDub, hasSub }, ... ]
 */
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
  } catch (err) {
    console.warn(`[ANIMERULZ] Episodes fetch failed for ${anilistId}:`, err.message);
  }
  return [];
}

/**
 * Check if an anime has Indian language streams available on AnimeRulz.
 * Returns { animerulz_id, animelok_id, languages: ['hindi','tamil',...] } or null.
 */
async function checkAnimerulzAvailability(anilistId) {
  const cacheKey = `avail:${anilistId}`;
  const cached = animerulzDataCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ANIMERULZ_CACHE_TTL) return cached.data;

  // The catalogue is the authoritative source. It covers every AnimeRulz dub
  // and avoids false negatives from the individual metadata endpoint.
  try {
    const catalog = await fetchAnimerulzCatalog();
    const catalogItem = catalog.find(item => item.animerulz_id === `anime-${anilistId}`);
    if (catalogItem) {
      animerulzDataCache.set(cacheKey, { data: catalogItem, ts: Date.now() });
      return catalogItem;
    }
  } catch (err) {
    console.warn('[ANIMERULZ] Catalog fetch failed, trying individual lookup:', err.message);
  }

  try {
    const { data } = await axios.get(`${ANIMERULZ_DATA}/api/animerulz-id=anime-${anilistId}`, {
      timeout: 8000,
      headers: ANIMERULZ_HEADERS,
    });
    if (data?.languages) {
      animerulzDataCache.set(cacheKey, { data, ts: Date.now() });
      return data;
    }
  } catch (err) {
    // 404 = anime not on AnimeRulz, not an error
  }
  return null;
}

/**
 * Resolve a stream for a specific episode via AnimeRulz.
 * Strategy:
 *  1. Check if anime has Indian languages → use animelok + extract for the requested language
 *  2. Fallback to fallback.streamindia.co.in sources (sub/dub) via kiwi provider
 *
 * Returns { type, streamUrl, sources, subtitles, headers, provider, language, audioMode }
 */
async function resolveAnimerulzStream(anilistId, episodeNum, lang = 'hin') {
  const cacheKey = `${anilistId}:e${episodeNum}:${lang}`;
  const cached = animerulzStreamCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ANIMERULZ_CACHE_TTL) return cached.data;

  let result = null;

  // Strategy 1: Indian language streams via animelok + extract
  const avail = await checkAnimerulzAvailability(anilistId);
  const languageNames = { hin: 'hindi', tam: 'tamil', tel: 'telugu', mal: 'malayalam', kan: 'kannada', ben: 'bengali' };
  const langCode = lang.toLowerCase();
  const requestedLanguage = languageNames[langCode];

  // Never relabel a Japanese/English fallback as Hindi. If AnimeRulz does not
  // have the requested Indian-language track, return a clear not-found result.
  if (requestedLanguage && !avail?.languages?.includes(requestedLanguage)) {
    console.warn(`[ANIMERULZ] ${anilistId} has no ${requestedLanguage} track in the catalogue.`);
    return null;
  }

  if (avail?.animelok_id && avail.languages) {

    // Parse animelok_id: can be string ("one-piece-1x1") or array (["naruto-1x1","naruto-2x58",...])
    // Format: "showSlug-<season>x<absoluteStartEp>" — episodes are RELATIVE per season
    const rawIds = Array.isArray(avail.animelok_id) ? avail.animelok_id : [avail.animelok_id];

    // Pick the season slug whose absolute range covers this episode.
    // Sort by startEp descending to find the latest season that starts at or before our ep.
    const seasons = rawIds.map(id => {
      const raw = String(id || '').trim();
      if (!raw) return null;
      const m = raw.match(/^(.+)-(\d+)x(\d+)$/);
      // Movies and specials use a plain slug without a season marker.
      return m
        ? { slug: m[1], season: parseInt(m[2]), startEp: parseInt(m[3]), raw }
        : { slug: raw, season: 1, startEp: 1, raw };
    }).filter(Boolean).sort((a, b) => b.startEp - a.startEp);

    // For single-season anime (startEp=1), just use it directly
    // For multi-season: find the season where startEp <= episodeNum
    let targetSeason = seasons.find(s => s.startEp <= episodeNum) || seasons[seasons.length - 1];
    let relativeEp = targetSeason ? episodeNum - targetSeason.startEp + 1 : episodeNum;

    if (targetSeason && relativeEp >= 1) {
      try {
        // Step 1: Get multi-URL from animelok (relative episode number)
        const alUrl = `${ANIMERULZ_ANIMELOK}/api/anime?id=${encodeURIComponent(targetSeason.raw)}&ep=${relativeEp}`;
        const alRes = await axios.get(alUrl, {
          timeout: 10000,
          headers: ANIMERULZ_HEADERS,
        });

        if (alRes.data?.multi) {
          // Step 2: Extract language tracks
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
            console.log(`[ANIMERULZ] ✅ ${anilistId} E${episodeNum} ${langCode} -> ${m3u8Url.slice(0, 80)}...`);
          }
        }
      } catch (err) {
        console.warn(`[ANIMERULZ] Animelok/extract failed for ${anilistId}:`, err.message);
      }
    }
  }

  // fallback.streamindia only offers sub/English-dub sources. It is valid for
  // those modes, but must never be used to satisfy an Indian dub mode.
  if (!result && !requestedLanguage) {
    try {
      // Get servers to get provider IDs
      const srvRes = await axios.get(`${ANIMERULZ_FALLBACK}/servers?id=${anilistId}&ep=${episodeNum}`, {
        timeout: 10000,
        headers: ANIMERULZ_HEADERS,
      });

      const ids = srvRes.data?.data?.categories?.ids || {};
      // Try providers in order of reliability
      const providers = ['kiwi', 'bonk', 'pewe', 'vidstream'];
      const category = (lang === 'hin' || lang === 'tam' || lang === 'tel') ? 'sub' : (lang === 'eng' ? 'dub' : 'sub');

      for (const provider of providers) {
        const pid = ids[provider];
        if (!pid) continue;

        try {
          const srcUrl = `${ANIMERULZ_FALLBACK}/sources?anilistid=${anilistId}&providerid=${encodeURIComponent(pid)}&ep=${episodeNum}&provider=${provider}&category=${category}`;
          const srcRes = await axios.get(srcUrl, {
            timeout: 12000,
            headers: ANIMERULZ_HEADERS,
          });

          const sources = srcRes.data?.data?.sources || [];
          const headers = srcRes.data?.data?.headers || {};
          const subs = srcRes.data?.data?.subtitles || [];

          if (sources.length > 0) {
            result = {
              type: 'hls',
              sources: sources.map(s => ({
                url: s.url,
                isM3U8: s.url?.includes('.m3u8'),
                quality: s.quality || 'auto',
                language: category === 'dub' ? 'English Dub' : 'Japanese Sub',
                audioMode: 'hindi',
              })),
              subtitles: subs,
              headers,
              provider: 'animerulz',
              language: lang,
              audioMode: 'hindi',
            };
            console.log(`[ANIMERULZ] ✅ Fallback ${anilistId} E${episodeNum} ${provider}/${category} -> ${sources[0].url?.slice(0, 80)}...`);
            break;
          }
        } catch (e) {
          console.warn(`[ANIMERULZ] Source fetch failed for ${provider}:`, e.message);
        }
      }
    } catch (err) {
      console.warn(`[ANIMERULZ] Fallback servers fetch failed for ${anilistId}:`, err.message);
    }
  }

  if (result) {
    animerulzStreamCache.set(cacheKey, { data: result, ts: Date.now() });
  }
  return result;
}

// ─────────────────────────────────────────────────────
// GET /api/animerulz/watch
// Params: anilistId (required), episode (required), lang (hin|tam|tel|eng|jpn, default=hin)
// Returns: { type, streamUrl, sources, subtitles, headers, provider, audioMode }
// ─────────────────────────────────────────────────────
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

    // Wrap all m3u8 URLs through the m3u8-proxy so the browser can load them
    // (extract.streamindia.co.in / fallback.streamindia.co.in have no CORS headers)
    const host = publicHost(req);
    const referer = result.headers?.Referer || 'https://animerulzapp.buzz/';
    const proxyHlsUrl = (value) => {
      const rawUrl = unwrapM3u8ProxyUrl(value);
      if (!rawUrl || !rawUrl.includes('.m3u8')) return value;
      return `${host}/api/m3u8-proxy?url=${encodeURIComponent(rawUrl)}&referer=${encodeURIComponent(referer)}`;
    };

    // Do not mutate result: it is cached by resolveAnimerulzStream and must retain
    // the raw provider URLs. Mutating it here caused repeat requests to nest proxy URLs.
    res.json({
      ...result,
      streamUrl: proxyHlsUrl(result.streamUrl),
      sources: (result.sources || []).map(source => ({
        ...source,
        url: proxyHlsUrl(source.url),
      })),
    });
  } catch (err) {
    console.error('[ANIMERULZ] Watch error:', err.message);
    res.status(502).json({ error: 'Stream resolution failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────
// GET /api/animerulz/episodes
// Params: anilistId (required)
// Returns: { total, episodes: [ { number, title, description, img, hasDub, hasSub }, ... ] }
// ─────────────────────────────────────────────────────
app.get('/api/animerulz/episodes', async (req, res) => {
  const { anilistId } = req.query;
  if (!anilistId) return res.status(400).json({ error: 'Missing anilistId parameter' });

  try {
    const episodes = await fetchAnimerulzEpisodes(anilistId);
    res.json({ total: episodes.length, episodes });
  } catch (err) {
    console.error('[ANIMERULZ] Episodes error:', err.message);
    res.status(502).json({ error: 'Episode fetch failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────
// GET /api/animerulz/availability
// Params: anilistId (required)
// Returns: { available, languages, animerulz_id } or { available: false }
// ─────────────────────────────────────────────────────
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

// GET /api/animerulz/catalog?language=hindi&page=1&limit=500
// Returns the live AnimeRulz language catalogue. AniList IDs are encoded in
// animerulz_id (for example, anime-2657) and can be used for exact matches.
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
    console.error('[ANIMERULZ] Catalog error:', err.message);
    res.status(502).json({ error: 'Hindi catalogue fetch failed', message: err.message });
  }
});

app.get('/api/hianime/watch', async (req, res) => {
  const { anilistId, episode, dub } = req.query;
  const episodeNum = parseInt(episode) || 1;
  // Consumet accepts 'sub' or 'dub'
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
  const wantDub = dub === 'eng';

  if (!title) {
    return res.status(400).json({ error: 'Missing title parameter' });
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
// MANGA API ENDPOINTS (ComicKz / comickz.co.uk Engine)
// ─────────────────────────────────────────────────────

const COMICKZ_BASE = 'https://comickz.co.uk';

// Helper: Wrap cover URLs with backend image-proxy to bypass hotlink 403
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

const MANGA_GENRE_CACHE_TTL_MS = 15 * 60 * 1000;
const MANGA_GENRE_CACHE_MAX_ITEMS = 240;
const mangaGenreCatalogCache = new Map();

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

// GET /api/manga/home — Main Manga Landing Data (Bento Top 10 + Category Previews)
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

    // Ensure 10 items for Bento grid
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

// GET /api/manga/category/:type?genre=<genre>
// :type can be 'manga' (jp), 'manhwa' (kr), 'manhua' (cn)
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

    // Split into curated sections for the hub page
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

// ─────────────────────────────────────────────────────
// HYBRID WEBTOON MIDDLEWARE ENGINE
// AniList Curated Metadata + ComicK Chapter Engine
// ─────────────────────────────────────────────────────
const comickSlugMap = new Map();

async function resolveComicKSlug(title, host) {
  if (!title) return null;
  const cleanTitle = title.trim();
  if (comickSlugMap.has(cleanTitle)) {
    return comickSlugMap.get(cleanTitle);
  }

  try {
    const url = `${COMICKZ_BASE}/api/search?q=${encodeURIComponent(cleanTitle)}&limit=5`;
    const r = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://comickz.co.uk/'
      },
      timeout: 6000
    });
    const items = r.data?.data || (Array.isArray(r.data) ? r.data : []);
    if (items.length > 0) {
      const match = items[0];
      const rawCover = match.default_thumbnail || (match.cover ? `${match.cover}` : null);
      const resObj = {
        id: match.slug || String(match.id),
        slug: match.slug,
        hid: match.hid,
        cover: proxyCoverUrl(host, rawCover),
        banner: proxyCoverUrl(host, rawCover)
      };
      comickSlugMap.set(cleanTitle, resObj);
      return resObj;
    }
  } catch (e) {}
  return null;
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

// GET /api/webtoon/home — Curated Webtoon Landing Data
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

// GET /api/manga/info/:id (id is comic slug e.g. "maxed-out-leveling" or numeric AniList ID)
app.get('/api/manga/info/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[MANGA INFO] Request for: ${id}`);
  const host = publicHost(req);
  let slug = id;

  // If numeric ID (AniList ID), attempt AniList title lookup first
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
    // 1. Fetch ALL pages of chapters with full pagination
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
      if (page > 30) break; // safety ceiling
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

    // Sort chapters numerically ascending
    chapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));

    // 2. Fetch HTML page to get cover and title details
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
    console.log(`[MANGA INFO] OK — ${chapters.length} unique chapters found across ${page} page(s) for ${slug}`);

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
// chapterId format: "slug___hid-chapter-200.5-en"
app.get('/api/manga/read/:chapterId', async (req, res) => {
  const { chapterId } = req.params;
  console.log(`[MANGA READ] Fetching pages for ComicKz chapter: ${chapterId}`);
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

    // ⚠️ CRITICAL: Do NOT encodeURIComponent slug/chPath — ComicKz uses plain dashes in URLs
    const chUrl = `${COMICKZ_BASE}/comic/${slug}/${chPath}`;
    console.log(`[MANGA READ] Scraping chapter page: ${chUrl}`);

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
    // Use a non-greedy but robust match for sv-data
    const svMatch = html.match(/<script\s+id="sv-data"\s+type="application\/json">([\s\S]*?)<\/script>/i);

    if (svMatch) {
      let svData;
      try {
        svData = JSON.parse(svMatch[1].trim());
      } catch (parseErr) {
        console.error(`[MANGA READ] JSON parse error for sv-data:`, parseErr.message);
      }

      if (svData) {
        const rawImages = svData.chapter?.images || [];

        if (rawImages.length) {
          const pages = rawImages.map((imgObj, idx) => {
            // Ensure full URL (some may be relative starting with /)
            let rawUrl = imgObj.url || '';
            if (rawUrl.startsWith('/')) rawUrl = 'https://cdn2.comicknew.pictures' + rawUrl;
            return {
              page: idx + 1,
              url: `${host}/api/manga/image-proxy?url=${encodeURIComponent(rawUrl)}`,
              rawUrl
            };
          });

          console.log(`[MANGA READ] ✅ ComicKz OK — ${pages.length} pages for ${chapterId}`);
          return res.json({ chapterId, pageCount: pages.length, pages });
        }
      }
    }

    console.error(`[MANGA READ] sv-data or images missing for ${chapterId} — HTML length: ${html.length}`);
    return res.json({ chapterId, pageCount: 0, pages: [] });

  } catch (err) {
    console.error(`[MANGA READ] Error fetching chapter ${chapterId}:`, err.message);
    return res.json({ chapterId, pageCount: 0, pages: [] });
  }
});

// GET /api/manga/image-proxy?url=<url> — proxy with Referer + exponential backoff retry on 429
app.get('/api/manga/image-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url parameter');

  const targetUrl = decodeURIComponent(url);
  const maxRetries = 5;

  // Determine correct Referer based on CDN domain
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
        // 403 = wrong/missing referer — retry once just in case
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
