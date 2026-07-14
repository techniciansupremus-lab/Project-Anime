import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { ANIME, META } from '@consumet/extensions';

const app = express();
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
// ─────────────────────────────────────────────────────
app.get('/api/m3u8-proxy', async (req, res) => {
  const { url, referer } = req.query;
  if (!url) return res.status(400).send('Missing url');

  try {
    const { data } = await axios.get(url, {
      ...AXIOS_OPTS,
      headers: {
        ...AXIOS_OPTS.headers,
        'Referer': referer || new URL(url).origin + '/'
      }
    });

    const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
    const lines = data.split('\n');
    const rewrittenLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const absoluteUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
        if (absoluteUrl.includes('.m3u8')) {
          return `http://localhost:5000/api/m3u8-proxy?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(referer || new URL(url).origin + '/')}`;
        }
        return absoluteUrl;
      }
      return line;
    });

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(rewrittenLines.join('\n'));
  } catch (err) {
    console.error('[PROXY] Error:', err.message);
    res.status(500).send(err.message);
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

/**
 * Search AnimeKai by title → returns the best-matching slug (e.g. "one-piece")
 */
async function animeKaiSearch(title) {
  console.log(`[ANIMEKAI] Searching: "${title}"`);
  const url = `${ANIMEKAI_BASE}/browser?keyword=${encodeURIComponent(title)}`;
  const { data } = await axios.get(url, AXIOS_OPTS);
  const $ = cheerio.load(data);

  const results = [];
  // AnimeKai search result cards
  $('.aitem').each((_, el) => {
    const poster = $(el).find('a.poster');
    const href = poster.attr('href') || '';
    const slug = href.replace('/watch/', '').trim();
    const name = $(el).find('a.title').text().trim();
    if (slug && name) results.push({ slug, name });
  });

  if (results.length > 0) {
    console.log(`[ANIMEKAI] Best match: "${results[0].name}" → /${results[0].slug}`);
    return results[0].slug;
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
// Start server
// ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 AniStream backend running on http://localhost:${PORT}`);
  console.log(`   PRIMARY:  AnimeKai (HTTP scraper — English subs) ⚡`);
  console.log(`   FALLBACK: AnimeUnity (Consumet — Italian subs)`);
  console.log(`   Endpoints:`);
  console.log(`     GET /api/info/:anilistId                     — anime details + episode list`);
  console.log(`     GET /api/gogoanime/watch?title=X&episode=N   — AnimeKai English sub stream ⚡`);
  console.log(`     GET /api/watch/:episodeId                    — AnimeUnity fallback stream`);
  console.log(`     GET /api/search?q=<query>                    — AnimeKai search\n`);
});
