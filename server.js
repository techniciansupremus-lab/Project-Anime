import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { ANIME, META } from '@consumet/extensions';

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

    const baseUrl = decodedUrl.substring(0, decodedUrl.lastIndexOf('/') + 1);

    const host = publicHost(req);
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
app.get('/api/hianime/watch', async (req, res) => {
  const { anilistId, episode, dub } = req.query;
  const episodeNum = parseInt(episode) || 1;
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
