import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { ANIME, META } from '@consumet/extensions';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Disable SSL verification for scraping (needed for anikai.cc)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// ─────────────────────────────────────────────────────
// Providers:
//   PRIMARY:  AnimeKai (anikai.cc) — English subs, multiple embed servers
//   FALLBACK: AnimeUnity (via Consumet) — Italian subs (last resort)
// ─────────────────────────────────────────────────────
const animeUnity = new ANIME.AnimeUnity();
const anilistMeta = new META.Anilist(animeUnity);

// ─────────────────────────────────────────────────────
// HLS/M3U8 Referrer Bypass Proxy
// Rewrites both sub-playlists AND .ts segment URLs so
// the browser only ever talks to localhost:5000.
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

    const baseUrl = decodedUrl.substring(0, decodedUrl.lastIndexOf('/') + 1);

    const host = `${req.protocol}://${req.get('host')}`;
    const rewritten = data.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;

      // Resolve relative URL
      const abs = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;

      // Sub-playlists (.m3u8) → recurse through this same proxy
      if (abs.includes('.m3u8')) {
        return `${host}/api/m3u8-proxy?url=${encodeURIComponent(abs)}&referer=${encodeURIComponent(decodedRef)}`;
      }

      // Video segments (.ts / .aac / etc.) → pipe through ts-proxy
      return `${host}/api/ts-proxy?url=${encodeURIComponent(abs)}&referer=${encodeURIComponent(decodedRef)}`;
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

// Cache: title -> { slug, timestamp }
const animeCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

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

async function animeKaiSearch(title) {
  console.log(`[ANIMEKAI] Searching: "${title}"`);

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

  // Try 1: Original title
  let results = await performSearch(title);
  if (results.length > 0) {
    console.log(`[ANIMEKAI] Best match (original): "${results[0].name}" → /${results[0].slug}`);
    return results[0].slug;
  }

  // Try 2: Clean trailing dots, hyphens, colons, and parentheses (e.g., "Your Name." -> "Your Name")
  const sanitized = title.replace(/[.\-–—:,\s]+$/, '').replace(/\([^)]*\)/g, '').trim();
  if (sanitized && sanitized !== title) {
    console.log(`[ANIMEKAI] No match for original. Trying sanitized query: "${sanitized}"`);
    results = await performSearch(sanitized);
    if (results.length > 0) {
      console.log(`[ANIMEKAI] Best match (sanitized): "${results[0].name}" → /${results[0].slug}`);
      return results[0].slug;
    }
  }

  // Try 3: Split on colon/hyphen and search for the main title prefix (e.g., "Frieren: Beyond..." -> "Frieren")
  const parts = sanitized.split(/[:\-–—]/);
  if (parts.length > 1) {
    const base = parts[0].trim();
    if (base && base !== sanitized) {
      console.log(`[ANIMEKAI] No match for sanitized. Trying base title: "${base}"`);
      results = await performSearch(base);
      if (results.length > 0) {
        console.log(`[ANIMEKAI] Best match (base): "${results[0].name}" → /${results[0].slug}`);
        return results[0].slug;
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
      headers: { 'Accept': 'application/json', 'User-Agent': 'AniStream/1.0' }
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
    providers: ['animekai-scraper (English sub/dub)', 'animeunity-consumet (fallback)']
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
  const { title, episode } = req.query;
  const episodeNum = parseInt(episode) || 1;

  if (!title) {
    return res.status(400).json({ error: 'Missing title parameter' });
  }

  console.log(`\n[ANIMEKAI] Request: "${title}" Episode ${episodeNum}`);

  try {
    // Check cache
    let cached = animeCache.get(title);
    const now = Date.now();

    if (!cached || now - cached.timestamp > CACHE_TTL) {
      const slug = await animeKaiSearch(title);
      if (!slug) {
        console.warn(`[ANIMEKAI] No results for "${title}"`);
        return res.status(404).json({ error: `Anime "${title}" not found on AnimeKai` });
      }
      cached = { slug, timestamp: now };
      animeCache.set(title, cached);
      console.log(`[ANIMEKAI] Cached: "${title}" → ${slug}`);
    } else {
      console.log(`[ANIMEKAI] Cache hit: "${title}" → ${cached.slug}`);
    }

    const servers = await animeKaiGetEpisodeEmbeds(cached.slug, episodeNum);

    // Build preference-ordered list of embed URLs to try
    // Priority: sub (external English subs) > hsub (hard-subbed) > dub
    const candidates = [];
    if (servers.sub?.length > 0) {
      const s = servers.sub.find(x => x.isDefault) || servers.sub[0];
      candidates.push({ embedUrl: s.embedUrl, language: 'English Sub', server: s.serverName });
      // Also add non-default sub servers as fallbacks
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

    if (candidates.length === 0) {
      return res.status(404).json({ error: `No streams found for episode ${episodeNum}` });
    }

    // Try each candidate embed URL — extract direct HLS stream
    let directStream = null;
    let chosenLanguage = 'English Sub';
    let chosenServer = 'unknown';

    for (const candidate of candidates) {
      console.log(`[ANIMEKAI] Trying server: ${candidate.server} (${candidate.language})`);
      const extracted = await extractDirectStream(candidate.embedUrl);
      if (extracted) {
        directStream = extracted;
        chosenLanguage = candidate.language;
        chosenServer = candidate.server;
        break;
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
    res.json({
      provider: 'animekai',
      type: 'hls',
      streamUrl: `http://localhost:5000/api/m3u8-proxy?url=${encodeURIComponent(directStream.streamUrl)}&referer=${encodeURIComponent(directStream.headers.Referer)}`,
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
const KISSKH_BASE = 'https://kisskh.co'; // kisskh.co is the active domain
const ENCDEC_BASE = 'https://enc-dec.app';

const DRAMA_LIST_TTL  = 30 * 60 * 1000; // 30 min  — drama catalog changes rarely
const STREAM_TTL      =  2 * 60 * 60 * 1000; // 2 hours — kkey tokens last hours

const dramaListCache   = new Map(); // key: "type:page"  → { data, timestamp }
const dramaInfoCache   = new Map(); // key: dramaId      → { data, timestamp }
const dramaStreamCache = new Map(); // key: episodeId    → { data, timestamp }

// ─────────────────────────────────────────────────────
// CLOUDFLARE SESSION MANAGER
// KissKH is Cloudflare-protected. Bare HTTP requests get the SPA HTML.
// We use puppeteer once to get the cf_clearance cookie, then reuse it.
// ─────────────────────────────────────────────────────
let cfCookieString  = null;  // raw cookie header string
let cfCookieExpiry  = 0;     // when to refresh
const CF_COOKIE_TTL = 90 * 60 * 1000; // 90 min — Cloudflare cookies last ~hours
let cfInitializing  = false; // prevent parallel launches
let cfInitQueue     = [];    // waiters during init

async function initCFSession(force = false) {
  // Return cached cookies if still fresh
  if (!force && cfCookieString && Date.now() < cfCookieExpiry) {
    return cfCookieString;
  }
  // If already initializing, queue up and wait
  if (cfInitializing) {
    return new Promise((resolve, reject) => cfInitQueue.push({ resolve, reject }));
  }

  cfInitializing = true;
  console.log('\n[CF SESSION] Launching headless Chrome to get Cloudflare cookies...');
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    // Visit the homepage — Cloudflare challenge runs and clears automatically
    await page.goto(KISSKH_BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 });
    // Extra wait for JS challenge to resolve
    await new Promise(r => setTimeout(r, 3000));

    const cookies = await page.cookies();
    cfCookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    cfCookieExpiry = Date.now() + CF_COOKIE_TTL;
    console.log(`[CF SESSION] ✅ Got ${cookies.length} cookies. Session valid for 90 min.`);

    // Resolve all waiting callers
    cfInitQueue.forEach(q => q.resolve(cfCookieString));
    return cfCookieString;
  } catch (err) {
    console.error('[CF SESSION] ❌ Failed to get Cloudflare cookies:', err.message);
    cfInitQueue.forEach(q => q.reject(err));
    throw err;
  } finally {
    cfInitializing = false;
    cfInitQueue = [];
    if (browser) await browser.close();
  }
}

// Helper: GET a KissKH URL with Cloudflare cookies
async function kissKhGet(url, retried = false) {
  const cookies = await initCFSession();
  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': KISSKH_BASE + '/',
      'Origin': KISSKH_BASE,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cookie': cookies,
    },
    timeout: 15000,
  });

  // If we got HTML back (Cloudflare rejected our cookies), refresh once and retry
  const ct = res.headers['content-type'] || '';
  if (!retried && (ct.includes('text/html') || typeof res.data === 'string')) {
    console.warn('[CF SESSION] Got HTML response — cookies expired, refreshing...');
    await initCFSession(true); // force refresh
    return kissKhGet(url, true); // retry once
  }
  return res;
}

// Start warming the CF session in background at server startup
initCFSession().catch(err => console.warn('[CF SESSION] Background init failed:', err.message));

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
  const host = `${req.protocol}://${req.get('host')}`;

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
      ? `${host}/api/m3u8-proxy?url=${encodeURIComponent(videoUrl)}&referer=${encodeURIComponent(KISSKH_BASE + '/')}`
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

// Serve static assets from Vite's build directory (dist) in production
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback all SPA routing requests to index.html
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  }
  next();
});

// ─────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 AniStream backend running on http://localhost:${PORT}`);
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
  console.log(`     GET /api/drama/stream/:episodeId             — stream URL + subtitles`);
  console.log(`     GET /api/drama/subtitle?url=<url>            — decode KissKH subtitle`);
  console.log(`     GET /api/m3u8-proxy?url=<url>                — HLS manifest proxy`);
  console.log(`     GET /api/ts-proxy?url=<url>                  — HLS segment proxy\n`);
});

