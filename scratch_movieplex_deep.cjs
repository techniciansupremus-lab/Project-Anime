// Research: Can we extract direct video URLs from bfmovies/tpead/chuckle-tube?
const https = require('https');
const http = require('http');

function fetchUrl(url, referer) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': referer || 'https://movieplex.co.in/',
        'Origin': 'https://movieplex.co.in'
      }
    }, (res) => {
      console.log(`[${url.substring(0, 60)}] Status: ${res.statusCode}`);
      console.log(`  X-Frame-Options: ${res.headers['x-frame-options'] || 'NOT SET'}`);
      console.log(`  Content-Security-Policy: ${(res.headers['content-security-policy'] || 'NOT SET').substring(0, 100)}`);
      console.log(`  Access-Control-Allow-Origin: ${res.headers['access-control-allow-origin'] || 'NOT SET'}`);
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function main() {
  // Test 1: Check bfmovies.online embed page
  console.log('\n========== TEST 1: bfmovies.online (lulustream) ==========');
  try {
    const r = await fetchUrl('https://bfmovies.online/e/pptsy8r05zso', 'https://movieplex.co.in/');
    const body = r.body;
    // Look for video source URLs
    const m3u8 = body.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)/g);
    const mp4 = body.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)/g);
    const sources = body.match(/sources?\s*[:=]\s*\[?\s*\{[^}]{0,300}/g);
    const fileUrl = body.match(/["\']file["\']\s*:\s*["']([^"']+)['"]/g);
    console.log('  M3U8 links:', m3u8 ? m3u8.slice(0,3) : 'NONE');
    console.log('  MP4 links:', mp4 ? mp4.slice(0,3) : 'NONE');
    console.log('  File sources:', fileUrl ? fileUrl.slice(0,5) : 'NONE');
    console.log('  Sources obj:', sources ? sources.slice(0,2) : 'NONE');
    // Look for jwplayer or video.js setup
    const jwp = body.indexOf('jwplayer');
    const vidjs = body.indexOf('videojs');
    const plyr = body.indexOf('Plyr');
    console.log('  JWPlayer:', jwp !== -1 ? 'YES at ' + jwp : 'NO');
    console.log('  VideoJS:', vidjs !== -1 ? 'YES at ' + vidjs : 'NO');
    console.log('  Plyr:', plyr !== -1 ? 'YES at ' + plyr : 'NO');
    if (body.length < 5000) console.log('  FULL BODY:', body.substring(0, 2000));
    else console.log('  BODY SNIPPET (1000):', body.substring(0, 1000));
  } catch(e) { console.log('  ERROR:', e.message); }

  // Test 2: Check tpead.net (streamtape mirror)
  console.log('\n========== TEST 2: tpead.net (streamtape) ==========');
  try {
    const r = await fetchUrl('https://tpead.net/e/kWVMMMYj7qtO2VD', 'https://movieplex.co.in/');
    const body = r.body;
    const m3u8 = body.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)/g);
    const mp4 = body.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)/g);
    const fileUrl = body.match(/["\']file["\']\s*:\s*["']([^"']+)['"]/g);
    console.log('  M3U8 links:', m3u8 ? m3u8.slice(0,3) : 'NONE');
    console.log('  MP4 links:', mp4 ? mp4.slice(0,3) : 'NONE');
    console.log('  File sources:', fileUrl ? fileUrl.slice(0,5) : 'NONE');
    const hasToken = body.indexOf('token') !== -1;
    const hasGetVideo = body.indexOf('getVideo') !== -1 || body.indexOf('get_video') !== -1;
    console.log('  Has token:', hasToken, '| Has getVideo:', hasGetVideo);
    if (body.length < 5000) console.log('  FULL BODY:', body.substring(0, 2000));
    else console.log('  BODY SNIPPET:', body.substring(0, 1500));
  } catch(e) { console.log('  ERROR:', e.message); }

  // Test 3: Check chuckle-tube.com (voe.sx)
  console.log('\n========== TEST 3: chuckle-tube.com (voe.sx) ==========');
  try {
    const r = await fetchUrl('https://chuckle-tube.com/e/u9vujj6h39oi', 'https://movieplex.co.in/');
    const body = r.body;
    const m3u8 = body.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)/g);
    const mp4 = body.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)/g);
    const fileUrl = body.match(/["\']file["\']\s*:\s*["']([^"']+)['"]/g);
    console.log('  M3U8 links:', m3u8 ? m3u8.slice(0,3) : 'NONE');
    console.log('  MP4 links:', mp4 ? mp4.slice(0,3) : 'NONE');
    console.log('  File sources:', fileUrl ? fileUrl.slice(0,5) : 'NONE');
    if (body.length < 5000) console.log('  FULL BODY:', body.substring(0, 2000));
    else console.log('  BODY SNIPPET:', body.substring(0, 1500));
  } catch(e) { console.log('  ERROR:', e.message); }

  // Test 4: Test the MoviePlex WP API for thumbnail images
  console.log('\n========== TEST 4: WP API — Get featured_media for a post ==========');
  try {
    const r = await fetchUrl('https://movieplex.co.in/wp-json/wp/v2/posts/38866?_fields=id,title,featured_media,jetpack_featured_media_url', 'https://movieplex.co.in/');
    console.log('  Response:', r.body.substring(0, 500));
  } catch(e) { console.log('  ERROR:', e.message); }

  // Test 5: Check if admin-ajax.php exposes video data
  console.log('\n========== TEST 5: MoviePlex admin-ajax.php probe ==========');
  try {
    const r = await fetchUrl('https://movieplex.co.in/wp-admin/admin-ajax.php?action=get_movie_data&post_id=38866', 'https://movieplex.co.in/');
    console.log('  Response:', r.body.substring(0, 300));
  } catch(e) { console.log('  ERROR:', e.message); }

  // Test 6: Test CORS on the embed pages — can we fetch them from browser?
  console.log('\n========== TEST 6: Check if LuluStream download link is in HTML ==========');
  try {
    const r = await fetchUrl('https://bfmovies.online/d/pptsy8r05zso', 'https://movieplex.co.in/');
    console.log('  Status:', r.status, '| Size:', r.body.length);
    const m3u8 = r.body.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)/g);
    const mp4 = r.body.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)/g);
    console.log('  M3U8:', m3u8 ? m3u8.slice(0,5) : 'NONE');
    console.log('  MP4:', mp4 ? mp4.slice(0,5) : 'NONE');
    console.log('  Body snippet:', r.body.substring(0, 800));
  } catch(e) { console.log('  ERROR:', e.message); }
}

main().catch(console.error);
