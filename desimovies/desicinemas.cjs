/**
 * DesiCinemas.pk — Scraper and Stream Extractor Module
 * Complete implementation for catalog browsing, searching, detail extraction,
 * and direct master HLS (.m3u8) stream resolution for Morencius and Vidmoly.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const vm = require('node:vm');

const BASE_URL = 'https://desicinemas.pk';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': `${BASE_URL}/`,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

const CATEGORIES = {
  movies: 'bmovies1',
  hindi_dubbed: 'hindidubbed',
  hollywood: 'hollywoodmovies',
  desi_cinema: '1desicinema',
  series: 'series',
  action: 'all-action-movie',
  comedy: 'com-edyy',
  drama: 'dr-ama',
  romance: 'romance3',
  thriller: 'thriller-moviez',
  horror: 'hor-ror',
  crime: 'all-crime',
  punjabi: 'bmovies1/1punjabi',
  tamil: 'bmovies1/tamil-cinemaa',
  telugu: 'bmovies1/telu-gu',
  bengali: 'bengali',
  gujarati: 'bmovies1/gujarati',
  marathi: 'bmovies1/marathi2',
  malayalam: 'bmovies1/malayalam',
  kannada: 'bmovies1/kannada'
};

/**
 * Normalizes movie item from HTML card
 */
function parseMovieCard($, el) {
  const $el = $(el);
  const idAttr = $el.attr('id') || '';
  const postId = idAttr.replace('post-', '');
  const linkEl = $el.find('a').first();
  const rawHref = linkEl.attr('href') || '';
  const title = $el.find('.Title').first().text().trim() || linkEl.text().trim();
  
  // Extract slug and type
  let slug = '';
  let type = 'movie';
  if (rawHref.includes('/movies/')) {
    slug = rawHref.split('/movies/')[1].replace(/\/$/, '');
    type = 'movie';
  } else if (rawHref.includes('/series/')) {
    slug = rawHref.split('/series/')[1].replace(/\/$/, '');
    type = 'series';
  } else if (rawHref.includes('/episode/')) {
    slug = rawHref.split('/episode/')[1].replace(/\/$/, '');
    type = 'episode';
  }

  const imgEl = $el.find('img');
  let poster = imgEl.attr('data-src') || imgEl.attr('src') || '';
  if (poster.startsWith('//')) poster = 'https:' + poster;

  const quality = $el.find('.Qlty').first().text().trim() || 'HD';
  const year = $el.find('.Yr').first().text().trim() || $el.find('.Date').first().text().trim();
  const language = $el.find('.Lng').first().text().trim();
  const duration = $el.find('.Time').first().text().trim();
  const rating = $el.find('.post-ratings span').text().trim();

  return {
    id: `dc-${postId || slug}`,
    postId,
    slug,
    title,
    type,
    url: rawHref,
    poster,
    quality,
    year,
    language,
    duration,
    rating,
    source: 'desicinemas'
  };
}

/**
 * Fetch catalog items with pagination
 */
async function getCatalog(categoryKey = 'movies', page = 1) {
  const catPath = CATEGORIES[categoryKey] || categoryKey || 'bmovies1';
  const pageUrl = page > 1 
    ? `${BASE_URL}/${catPath}/page/${page}/` 
    : `${BASE_URL}/${catPath}/`;

  const res = await axios.get(pageUrl, { headers: DEFAULT_HEADERS, timeout: 10000 });
  const $ = cheerio.load(res.data);
  const items = [];

  $('.MovieList > li').each((_, el) => {
    const item = parseMovieCard($, el);
    if (item.slug) items.push(item);
  });

  const hasNextPage = $('.wp-pagenavi .nextpostslink, .nav-links .next').length > 0;

  return {
    category: categoryKey,
    page,
    hasNextPage,
    totalResults: items.length,
    results: items
  };
}

/**
 * Search DesiCinemas
 */
async function search(query, page = 1) {
  const pageUrl = page > 1 
    ? `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query)}` 
    : `${BASE_URL}/?s=${encodeURIComponent(query)}`;

  const res = await axios.get(pageUrl, { headers: DEFAULT_HEADERS, timeout: 10000 });
  const $ = cheerio.load(res.data);
  const items = [];

  $('.MovieList > li').each((_, el) => {
    const item = parseMovieCard($, el);
    if (item.slug) items.push(item);
  });

  return {
    query,
    page,
    totalResults: items.length,
    results: items
  };
}

/**
 * Fetch detailed info for a Movie
 */
async function getMovieDetail(slug) {
  const movieUrl = `${BASE_URL}/movies/${slug}/`;
  const res = await axios.get(movieUrl, { headers: DEFAULT_HEADERS, timeout: 10000 });
  const $ = cheerio.load(res.data);

  const title = $('article.TPost .Title').first().text().trim();
  const description = $('article.TPost .Description p').first().text().trim();
  
  let backdrop = $('article.TPost .TPostBg').attr('data-src') || $('article.TPost .TPostBg').attr('src') || '';
  if (backdrop.startsWith('//')) backdrop = 'https:' + backdrop;

  const year = $('article.TPost .Date').first().text().trim();
  const duration = $('article.TPost .Time').first().text().trim();
  const quality = $('article.TPost .Qlty').first().text().trim();
  const rating = $('.post-ratings span').first().text().trim();

  // Genres, Director, Cast
  const genres = [];
  $('.Description .Genre a').each((_, a) => genres.push($(a).text().trim()));

  const directors = [];
  $('.Description .Director a').each((_, a) => directors.push($(a).text().trim()));

  const cast = [];
  $('.Description .Cast a').each((_, a) => cast.push($(a).text().trim()));

  // Video Options
  const options = [];
  $('.ListOptions li').each((_, optEl) => {
    const $opt = $(optEl);
    options.push({
      key: $opt.attr('data-key') || '0',
      id: $opt.attr('data-id') || '',
      typ: $opt.attr('data-typ') || 'movie',
      server: $opt.find('.AAIco-dns').text().trim() || 'Server',
      quality: $opt.find('.AAIco-equalizer').text().trim() || 'HD',
      lang: $opt.find('.AAIco-language').text().trim() || ''
    });
  });

  return {
    id: `dc-${slug}`,
    slug,
    title,
    description,
    banner: backdrop,
    backdrop,
    year,
    duration,
    quality,
    rating,
    genres,
    directors,
    cast,
    options,
    type: 'movie',
    source: 'desicinemas'
  };
}

/**
 * Fetch detailed info for a Series including Seasons and Episodes
 */
async function getSeriesDetail(slug) {
  const seriesUrl = `${BASE_URL}/series/${slug}/`;
  const res = await axios.get(seriesUrl, { headers: DEFAULT_HEADERS, timeout: 10000 });
  const $ = cheerio.load(res.data);

  const title = $('article.TPost .Title').first().text().trim();
  const description = $('article.TPost .Description p').first().text().trim();
  
  let backdrop = $('article.TPost .TPostBg').attr('data-src') || $('article.TPost .TPostBg').attr('src') || '';
  if (backdrop.startsWith('//')) backdrop = 'https:' + backdrop;

  const year = $('article.TPost .Date').first().text().trim();
  const rating = $('.post-ratings span').first().text().trim();

  const genres = [];
  $('.Description .Genre a').each((_, a) => genres.push($(a).text().trim()));

  // Seasons
  const seasons = [];
  const seasonLinks = [];
  $('section.SeasonBx .Title a').each((_, a) => {
    const href = $(a).attr('href');
    const name = $(a).text().trim();
    if (href) seasonLinks.push({ name, href });
  });

  // Fetch episodes for each season
  for (const sLink of seasonLinks) {
    try {
      const sRes = await axios.get(sLink.href, { headers: DEFAULT_HEADERS, timeout: 10000 });
      const $s = cheerio.load(sRes.data);
      const episodes = [];

      $s('.TPTblCn table tr').each((_, tr) => {
        const $tr = $s(tr);
        const epNum = $tr.find('.Num').text().trim();
        const epLink = $tr.find('.MvTbTtl a').attr('href') || '';
        const epTitle = $tr.find('.MvTbTtl a').text().trim();
        const epDate = $tr.find('.MvTbTtl span').text().trim();
        let epImg = $tr.find('img').attr('data-src') || $tr.find('img').attr('src') || '';
        if (epImg.startsWith('//')) epImg = 'https:' + epImg;

        let epSlug = '';
        if (epLink.includes('/episode/')) {
          epSlug = epLink.split('/episode/')[1].replace(/\/$/, '');
        }

        if (epSlug) {
          episodes.push({
            episode: epNum,
            title: epTitle,
            slug: epSlug,
            url: epLink,
            date: epDate,
            thumbnail: epImg
          });
        }
      });

      seasons.push({
        seasonName: sLink.name,
        seasonUrl: sLink.href,
        episodes
      });
    } catch (e) {
      console.warn(`[DESICINEMAS] Failed to load season ${sLink.name}:`, e.message);
    }
  }

  return {
    id: `dc-${slug}`,
    slug,
    title,
    description,
    banner: backdrop,
    backdrop,
    year,
    rating,
    genres,
    seasons,
    type: 'series',
    source: 'desicinemas'
  };
}

/**
 * Extract Morencius packed JS to master HLS URL
 */
async function extractMorenciusStream(embedUrl) {
  try {
    const res = await axios.get(embedUrl, {
      headers: {
        'User-Agent': DEFAULT_HEADERS['User-Agent'],
        'Referer': `${BASE_URL}/`
      },
      timeout: 10000
    });

    const html = res.data;
    const evalMatch = html.match(/eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\)[\s\S]*?\.split\('\|'\)\)\s*\)/i);
    if (!evalMatch) return null;

    let capturedSources = [];
    const mockEl = () => ({
      style: {},
      setAttribute: () => {},
      getAttribute: () => '',
      appendChild: () => {},
      removeChild: () => {},
      parentNode: { removeChild: () => {} },
      classList: { add: () => {}, remove: () => {} }
    });

    const mock$ = () => ({
      insertAfter: () => {}, detach: () => {}, remove: () => {},
      hide: () => {}, show: () => {}, on: () => {}, ready: () => {},
      addClass: () => {}, removeClass: () => {}, toggleClass: () => {},
      attr: () => '', html: () => '', text: () => ''
    });
    mock$.ajaxSetup = () => {};
    mock$.cookie = () => {};
    mock$.post = () => {};
    mock$.get = () => {};

    const sandbox = {
      window: { location: { protocol: 'https:', host: 'morencius.com', href: embedUrl } },
      document: { getElementById: mockEl, createElement: mockEl, querySelector: mockEl, body: { appendChild: () => {} } },
      $: mock$,
      jQuery: mock$,
      localStorage: { getItem: () => null, setItem: () => {} },
      jwplayer: () => ({
        setup: (cfg) => {
          capturedSources = cfg.sources || [];
          return { on: () => {}, addButton: () => {}, getAudioTracks: () => [], getPosition: () => 0, seek: () => {}, play: () => {}, pause: () => {}, stop: () => {}, load: () => {}, once: () => {} };
        },
        key: '', on: () => {}, addButton: () => {}
      }),
      console: { log: () => {} }
    };

    vm.createContext(sandbox);
    vm.runInContext(evalMatch[0], sandbox);

    if (capturedSources.length > 0 && capturedSources[0].file) {
      let file = capturedSources[0].file;
      if (file.startsWith('/')) file = 'https://morencius.com' + file;
      return file;
    }
    return null;
  } catch (e) {
    console.error('[EXTRACTOR] Morencius unpack error:', e.message);
    return null;
  }
}

/**
 * Extract Vidmoly direct master HLS URL
 */
async function extractVidmolyStream(embedUrl) {
  try {
    const res = await axios.get(embedUrl, {
      headers: {
        'User-Agent': DEFAULT_HEADERS['User-Agent'],
        'Referer': `${BASE_URL}/`
      },
      timeout: 10000
    });

    const html = res.data;
    const fileMatch = html.match(/file\s*:\s*['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/i) ||
                      html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*['"](https?:\/\/[^'"]+)['"]/i);

    if (fileMatch) {
      return fileMatch[1];
    }
    return null;
  } catch (e) {
    console.error('[EXTRACTOR] Vidmoly extraction error:', e.message);
    return null;
  }
}

/**
 * Universal Stream Resolver for DesiCinemas
 * Resolves by Post ID or Slug, fetches embed iframe, and extracts direct master HLS playlist.
 */
async function resolveStream({ postId, optionKey = '0', type = '1', slug = null }) {
  let targetId = postId;
  let targetType = type;

  // If slug is provided without ID, fetch the detail page first
  if (!targetId && slug) {
    const pageUrl = type === '2' ? `${BASE_URL}/episode/${slug}/` : `${BASE_URL}/movies/${slug}/`;
    const pageRes = await axios.get(pageUrl, { headers: DEFAULT_HEADERS, timeout: 10000 });
    const $ = cheerio.load(pageRes.data);
    const optEl = $('.ListOptions li').first();
    targetId = optEl.attr('data-id') || ($('body').attr('class') || '').match(/postid-(\d+)/)?.[1];
    if (!targetId) {
      targetId = ($('body').attr('class') || '').match(/term-(\d+)/)?.[1];
    }
  }

  if (!targetId) {
    throw new Error('Unable to resolve WordPress post ID for stream');
  }

  const embedRouterUrl = `${BASE_URL}/?trembed=${optionKey}&trid=${targetId}&trtype=${targetType}`;
  const embedRes = await axios.get(embedRouterUrl, { headers: DEFAULT_HEADERS, timeout: 10000 });
  const $emb = cheerio.load(embedRes.data);
  const iframeSrc = $emb('iframe').attr('src') || $emb('IFRAME').attr('SRC') || '';

  if (!iframeSrc) {
    throw new Error('No iframe found in embed response');
  }

  let streamUrl = null;
  let host = 'iframe';

  if (iframeSrc.includes('morencius.com')) {
    host = 'morencius';
    streamUrl = await extractMorenciusStream(iframeSrc);
  } else if (iframeSrc.includes('vidmoly.org') || iframeSrc.includes('vidmoly.me')) {
    host = 'vidmoly';
    streamUrl = await extractVidmolyStream(iframeSrc);
  }

  return {
    targetId,
    optionKey,
    type: targetType,
    embedRouterUrl,
    iframeUrl: iframeSrc,
    streamUrl: streamUrl || iframeSrc,
    isHls: !!streamUrl,
    host
  };
}

module.exports = {
  CATEGORIES,
  getCatalog,
  search,
  getMovieDetail,
  getSeriesDetail,
  resolveStream,
  extractMorenciusStream,
  extractVidmolyStream
};
