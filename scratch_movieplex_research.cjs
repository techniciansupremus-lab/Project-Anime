const https = require('https');

const url = 'https://movieplex.co.in/lady-chatterleys-lover-2022-hindi-dubbed-hdrip-movie/';
const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://movieplex.co.in/'
  }
};

https.get(url, options, (res) => {
  console.log('Status:', res.statusCode, res.headers['content-type']);
  let data = '';
  res.on('data', d => { data += d; });
  res.on('end', () => {
    // Extract iframe sources
    const iframeRe = /iframe[^>]+src=["']([^"']+)["']/gi;
    let m;
    console.log('\n=== IFRAMES ===');
    while ((m = iframeRe.exec(data)) !== null) {
      console.log(m[1]);
    }

    // Look for data-embed or embed URLs
    const embedRe = /["'](https?:\/\/[^"'\s<>]*(streamtape|lulustream|voe\.sx|vidmoly|doodstream|filemoon|vidsrc|embed|player|watch)[^"'\s<>]*)/gi;
    console.log('\n=== EMBED / STREAM LINKS ===');
    while ((m = embedRe.exec(data)) !== null) {
      console.log(m[1]);
    }

    // WordPress shortcode tabs
    const tabIdx = data.indexOf('tab-content');
    if (tabIdx !== -1) {
      console.log('\n=== TAB CONTENT (2000 chars) ===');
      console.log(data.substring(tabIdx, tabIdx + 2000));
    }

    // PsyPlay theme JS variables
    const psyRe = /var\s+\w*(?:[Ss]rc|[Vv]ideo|[Uu]rl|[Ll]ink)\s*=\s*["'][^"']+["']/g;
    console.log('\n=== JS VIDEO VARS ===');
    while ((m = psyRe.exec(data)) !== null) {
      console.log(m[0]);
    }

    // data-* attributes with URLs
    const dataRe = /data-[a-z]+\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
    console.log('\n=== DATA ATTRIBUTES WITH URLS ===');
    while ((m = dataRe.exec(data)) !== null) {
      console.log(m[0].substring(0, 200));
    }

    // Look for psyplay custom post meta / inline video data
    const videoDataIdx = data.indexOf('content-embed');
    if (videoDataIdx !== -1) {
      console.log('\n=== CONTENT-EMBED (3000 chars) ===');
      console.log(data.substring(videoDataIdx, videoDataIdx + 3000));
    }
    
    // Look for tab1, tab2, tab3 content
    ['tab1', 'tab2', 'tab3'].forEach(function(tab) {
      const idx = data.indexOf('"' + tab + '"');
      if (idx !== -1) {
        console.log('\n=== ' + tab.toUpperCase() + ' ===');
        console.log(data.substring(idx, idx + 500));
      }
    });
  });
}).on('error', function(e) {
  console.error('Error:', e.message);
});
