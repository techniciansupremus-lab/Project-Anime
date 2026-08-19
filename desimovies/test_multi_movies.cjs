const axios = require('axios');
const cheerio = require('cheerio');

async function discoverProviders() {
  const pages = [
    'https://desicinemas.pk/bmovies1/',
    'https://desicinemas.pk/bmovies1/page/2/',
    'https://desicinemas.pk/hindidubbed/',
    'https://desicinemas.pk/hollywoodmovies/'
  ];

  const hostsFound = new Set();
  const allMovies = [];

  for (const pageUrl of pages) {
    try {
      console.log(`[DISCOVERY] Fetching ${pageUrl}...`);
      const res = await axios.get(pageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 10000
      });
      const $ = cheerio.load(res.data);
      $('.MovieList > li').each((_, el) => {
        const idAttr = $(el).attr('id') || '';
        const postId = idAttr.replace('post-', '');
        const link = $(el).find('a').first().attr('href');
        const title = $(el).find('.Title').first().text().trim();
        if (postId && link && !allMovies.some(m => m.postId === postId)) {
          allMovies.push({ postId, title, link });
        }
      });
    } catch (e) {
      console.error('[DISCOVERY] Failed page:', pageUrl, e.message);
    }
  }

  console.log(`[DISCOVERY] Total unique titles found: ${allMovies.length}`);

  // Test first 12 titles for embed hosts
  for (const mov of allMovies.slice(0, 12)) {
    try {
      const pageRes = await axios.get(mov.link, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 8000
      });
      const $p = cheerio.load(pageRes.data);
      const optKeys = [];
      $p('.ListOptions li').each((_, el) => {
        optKeys.push({
          key: $p(el).attr('data-key') || '0',
          id: $p(el).attr('data-id') || mov.postId,
          serverName: $p(el).find('.AAIco-dns').text().trim(),
          typ: $p(el).attr('data-typ') || 'movie'
        });
      });

      for (const opt of optKeys) {
        const trtype = opt.typ === 'episode' ? '2' : '1';
        const embedUrl = `https://desicinemas.pk/?trembed=${opt.key}&trid=${opt.id}&trtype=${trtype}`;
        const embRes = await axios.get(embedUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': mov.link },
          timeout: 8000
        });
        const $emb = cheerio.load(embRes.data);
        const iframeSrc = $emb('iframe').attr('src') || $emb('IFRAME').attr('SRC') || '';
        if (iframeSrc) {
          try {
            const parsedHost = new URL(iframeSrc).hostname;
            hostsFound.add(parsedHost);
            console.log(`[STREAM] ${mov.title} [${opt.serverName}] -> ${parsedHost} (${iframeSrc.substring(0, 60)}...)`);
          } catch (_) {
            hostsFound.add(iframeSrc);
          }
        }
      }
    } catch (err) {
      console.log(`[STREAM] Failed ${mov.title}:`, err.message);
    }
  }

  console.log(`\n========================================`);
  console.log('[DISCOVERY] Unique Stream Hosts Found:');
  console.log([...hostsFound]);
}

discoverProviders();
