const axios = require('axios');
const cheerio = require('cheerio');
const vm = require('node:vm');

async function testCatalogAndStreams() {
  console.log('[TEST] Fetching movies catalog page...');
  const catRes = await axios.get('https://desicinemas.pk/bmovies1/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://desicinemas.pk/'
    },
    timeout: 10000
  });

  const $ = cheerio.load(catRes.data);
  const movies = [];

  $('.MovieList > li').each((_, el) => {
    const postEl = $(el);
    const idAttr = postEl.attr('id') || '';
    const postId = idAttr.replace('post-', '');
    const title = postEl.find('.Title').first().text().trim();
    const link = postEl.find('a').first().attr('href') || '';
    const img = postEl.find('img').attr('data-src') || postEl.find('img').attr('src') || '';
    const quality = postEl.find('.Qlty').first().text().trim();
    const year = postEl.find('.Yr').text().trim();
    const lang = postEl.find('.Lng').text().trim();

    if (link && postId) {
      movies.push({ postId, title, link, img, quality, year, lang });
    }
  });

  console.log(`[TEST] Found ${movies.length} movies on page 1:`);
  console.log(JSON.stringify(movies.slice(0, 5), null, 2));

  // Now test extracting streams for the first 3 movies
  for (const mov of movies.slice(0, 3)) {
    console.log(`\n========================================`);
    console.log(`[TEST] Processing: ${mov.title} (ID: ${mov.postId})`);
    console.log(`[TEST] URL: ${mov.link}`);

    // Fetch movie page
    try {
      const pageRes = await axios.get(mov.link, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://desicinemas.pk/'
        },
        timeout: 10000
      });

      const $page = cheerio.load(pageRes.data);
      const options = [];

      $page('.ListOptions li').each((_, optEl) => {
        const $opt = $page(optEl);
        options.push({
          typ: $opt.attr('data-typ') || 'movie',
          key: $opt.attr('data-key') || '0',
          id: $opt.attr('data-id') || mov.postId,
          server: $opt.find('.AAIco-dns').text().trim(),
          quality: $opt.find('.AAIco-equalizer').text().trim(),
          lang: $opt.find('.AAIco-language').text().trim()
        });
      });

      console.log(`[TEST] Options found (${options.length}):`, options);

      // Now fetch embed for each option
      for (const opt of options) {
        const embedIframeUrl = `https://desicinemas.pk/?trembed=${opt.key}&trid=${opt.id}&trtype=1`;
        console.log(`[TEST] Fetching embed iframe: ${embedIframeUrl}`);

        const embedRes = await axios.get(embedIframeUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': mov.link
          },
          timeout: 10000
        });

        const $embed = cheerio.load(embedRes.data);
        const iframeSrc = $embed('iframe').attr('src') || $embed('IFRAME').attr('SRC');
        console.log(`[TEST] Embed resolved iframe SRC: ${iframeSrc}`);

        if (iframeSrc && iframeSrc.includes('morencius.com')) {
          // Unpack Morencius stream
          const streamUrl = await unpackMorencius(iframeSrc);
          console.log(`[TEST] -> Resolved Direct HLS Stream: ${streamUrl}`);
        }
      }

    } catch (e) {
      console.error(`[TEST] Error processing ${mov.title}:`, e.message);
    }
  }
}

async function unpackMorencius(embedUrl) {
  try {
    const res = await axios.get(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://desicinemas.pk/'
      },
      timeout: 10000
    });

    const html = res.data;
    const evalMatch = html.match(/eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\)[\s\S]*?\.split\('\|'\)\)\s*\)/i);
    if (!evalMatch) return null;

    let capturedSources = [];
    const mockElement = () => ({
      style: {},
      setAttribute: () => {},
      getAttribute: () => '',
      appendChild: () => {},
      removeChild: () => {},
      parentNode: { removeChild: () => {} },
      classList: { add: () => {}, remove: () => {} }
    });

    const mock$ = () => ({
      insertAfter: () => {},
      detach: () => {},
      remove: () => {},
      hide: () => {},
      show: () => {},
      on: () => {},
      ready: () => {},
      addClass: () => {},
      removeClass: () => {},
      toggleClass: () => {},
      attr: () => '',
      html: () => '',
      text: () => ''
    });
    mock$.ajaxSetup = () => {};
    mock$.cookie = () => {};
    mock$.post = () => {};
    mock$.get = () => {};

    const sandbox = {
      window: {
        location: { protocol: 'https:', host: 'morencius.com', hostname: 'morencius.com', href: embedUrl },
        innerHeight: 1080,
        innerWidth: 1920
      },
      document: {
        getElementById: mockElement,
        createElement: mockElement,
        querySelector: mockElement,
        body: { appendChild: () => {} }
      },
      $: mock$,
      jQuery: mock$,
      localStorage: { getItem: () => null, setItem: () => {} },
      jwplayer: () => ({
        setup: (cfg) => {
          capturedSources = cfg.sources || [];
          return { on: () => {}, addButton: () => {}, getAudioTracks: () => [], getPosition: () => 0, seek: () => {}, play: () => {}, pause: () => {}, stop: () => {}, load: () => {}, once: () => {} };
        },
        key: '',
        on: () => {},
        addButton: () => {}
      }),
      console: { log: () => {} }
    };

    vm.createContext(sandbox);
    vm.runInContext(evalMatch[0], sandbox);

    if (capturedSources.length > 0) {
      let file = capturedSources[0].file;
      if (file && file.startsWith('/')) {
        file = 'https://morencius.com' + file;
      }
      return file;
    }
    return null;
  } catch (e) {
    console.error('[UNPACK] Error:', e.message);
    return null;
  }
}

testCatalogAndStreams();
