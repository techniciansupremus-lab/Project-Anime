// Deep dive: Extract the actual video stream from LuluStream and StreamTape
const https = require('https');

function fetchUrl(url, referer, extraHeaders) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': referer || 'https://movieplex.co.in/',
        ...(extraHeaders || {})
      }
    }, (res) => {
      let data = '';
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location;
        console.log('  -> Redirect to:', loc);
        resolve(fetchUrl(loc.startsWith('http') ? loc : new URL(loc, url).href, referer, extraHeaders));
        return;
      }
      res.on('data', d => { data += d; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function main() {
  // ======= TEST 1: LuluStream embed - look for JWPlayer setup data =======
  console.log('\n===== LuluStream Embed Page — Looking for video setup =====');
  try {
    const r = await fetchUrl('https://bfmovies.online/e/pptsy8r05zso', 'https://movieplex.co.in/');
    const body = r.body;
    
    // Find JWPlayer setup call
    const jwSetup = body.match(/jwplayer\([^)]*\)\.setup\(\s*\{([\s\S]{0,2000})\}/);
    if (jwSetup) {
      console.log('JWPlayer setup found:', jwSetup[0].substring(0, 500));
    }
    
    // Look for JSON sources array
    const sourcesMatch = body.match(/"sources"\s*:\s*\[([\s\S]{0,500})\]/);
    if (sourcesMatch) console.log('Sources:', sourcesMatch[0].substring(0, 300));
    
    // Look for any JS variable with file or src
    const fileMatches = body.match(/['"](file|src|url|stream|hls|m3u8)['"]\s*:\s*['"]([^'"]+)['"]/gi);
    if (fileMatches) {
      console.log('File/src matches:');
      fileMatches.forEach(m => console.log(' ', m));
    }
    
    // Look for any encoded/obfuscated links (base64 or hex)
    const b64 = body.match(/atob\(['"]([^'"]+)['"]\)/g);
    if (b64) { console.log('Base64 atob:', b64.slice(0,5)); }
    
    // Look for lulucdn CDN URLs
    const lulucdn = body.match(/lulucdn[^'"<\s]+/g);
    if (lulucdn) console.log('LuluCDN URLs:', lulucdn.slice(0,10));
    
    // What script files does it load?
    const scripts = body.match(/src="([^"]+)"/g);
    if (scripts) console.log('Scripts loaded:', scripts.slice(0,10));
    
    // Look for API call patterns
    const apiCalls = body.match(/fetch\(['"]([^'"]+)['"]/g);
    if (apiCalls) console.log('Fetch calls:', apiCalls.slice(0,5));
    const ajaxCalls = body.match(/\$\.(?:get|post|ajax)\(['"]([^'"]+)['"]/g);
    if (ajaxCalls) console.log('AJAX calls:', ajaxCalls.slice(0,5));
    
    // Print the JWPlayer section of the page
    const jwIdx = body.indexOf('jwplayer');
    if (jwIdx !== -1) {
      console.log('\nJWPlayer section (1500 chars):');
      console.log(body.substring(jwIdx, jwIdx + 1500));
    }
  } catch(e) { console.log('ERROR:', e.message); }

  // ======= TEST 2: StreamTape (tpead.net) - getVideo endpoint =======
  console.log('\n\n===== StreamTape / tpead.net — getVideo probe =====');
  try {
    const r = await fetchUrl('https://tpead.net/e/kWVMMMYj7qtO2VD', 'https://movieplex.co.in/');
    const body = r.body;
    
    // StreamTape is famous for its getVideo obfuscation — look for it
    const getVideo = body.match(/document\.getElementById[^;]+;/g);
    if (getVideo) { console.log('getVideo pattern:', getVideo.slice(0,5)); }
    
    // Look for the token-based URL pattern
    const tokenPattern = body.match(/\/get_video\?id=[^'"]+/g);
    if (tokenPattern) console.log('Token URLs:', tokenPattern.slice(0,5));
    
    // Look for any link concat trick (streamtape's famous obfuscation)
    const concat = body.match(/\+\s*document\.[^;]+/g);
    if (concat) console.log('Concat patterns:', concat.slice(0,5));
    
    // Find the script block with video URL
    const scriptBlocks = body.match(/<script[^>]*>([\s\S]{100,500})<\/script>/g);
    if (scriptBlocks) {
      scriptBlocks.forEach((s, i) => {
        if (s.includes('video') || s.includes('token') || s.includes('url')) {
          console.log(`Script block ${i}:`, s.substring(0, 400));
        }
      });
    }
  } catch(e) { console.log('ERROR:', e.message); }

  // ======= TEST 3: VoeSX / chuckle-tube with redirect follow =======
  console.log('\n\n===== VoeSX chuckle-tube.com — Follow redirect =====');
  try {
    // Try direct voe.sx
    const r = await fetchUrl('https://voe.sx/e/u9vujj6h39oi', 'https://movieplex.co.in/');
    const body = r.body;
    console.log('Status:', r.status, '| Size:', body.length);
    const m3u8 = body.match(/["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*)/g);
    const sources = body.match(/sources?\s*=\s*\[[^\]]{0,300}\]/g);
    if (m3u8) console.log('M3U8:', m3u8.slice(0,5));
    if (sources) console.log('Sources:', sources.slice(0,3));
    
    // Look for HLS setup
    const hls = body.indexOf('hls');
    if (hls !== -1) console.log('HLS section:', body.substring(hls, hls + 300));
    
    if (body.length < 8000) console.log('Full body:', body.substring(0, 3000));
  } catch(e) { console.log('ERROR:', e.message); }

  // ======= TEST 4: Check if MoviePlex WP API has custom endpoint for video data =======
  console.log('\n\n===== MoviePlex Custom WP API routes =====');
  const customRoutes = [
    'https://movieplex.co.in/wp-json/wp/v2/posts/38866?_fields=id,meta,acf,yoast_head_json',
    'https://movieplex.co.in/wp-json/psy/v1/movie',
    'https://movieplex.co.in/wp-json/psyplay/v1/videos',
    'https://movieplex.co.in/wp-json/',
  ];
  for (const route of customRoutes) {
    try {
      const r = await fetchUrl(route, 'https://movieplex.co.in/');
      console.log(`\n[${route.substring(40)}] Status: ${r.status}`);
      console.log('  Body:', r.body.substring(0, 300));
    } catch(e) { console.log(`[${route}] ERROR:`, e.message); }
  }

  // ======= TEST 5: LuluStream THUMBNAIL pattern =======
  console.log('\n\n===== LuluStream thumbnail pattern =====');
  // From the embed page we saw: https://img.lulucdn.com/pptsy8r05zso_xt.jpg
  // This means: https://img.lulucdn.com/{video_id}_xt.jpg
  // and the video_id comes from the embed URL: bfmovies.online/e/{video_id}
  console.log('Thumbnail URL pattern: https://img.lulucdn.com/{video_id}_xt.jpg');
  console.log('Example: https://img.lulucdn.com/pptsy8r05zso_xt.jpg');
  console.log('So if we have the bfmovies embed URL, we can get the thumbnail too!');
}

main().catch(console.error);
