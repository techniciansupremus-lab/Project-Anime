const axios = require('axios');

async function testVidmoly() {
  const embedUrl = 'https://vidmoly.org/embed-whss9knqr8tv.html';
  console.log('[TEST] Fetching Vidmoly embed:', embedUrl);

  try {
    const res = await axios.get(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://desicinemas.pk/'
      },
      timeout: 10000
    });

    const html = res.data;
    const fileMatch = html.match(/file\s*:\s*['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/i) ||
                      html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*['"](https?:\/\/[^'"]+)['"]/i);

    if (fileMatch) {
      const m3u8Url = fileMatch[1];
      console.log('[TEST] Extracted Vidmoly m3u8 URL:', m3u8Url);

      const hlsRes = await axios.get(m3u8Url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': embedUrl,
          'Origin': 'https://vidmoly.org'
        },
        timeout: 10000
      });

      console.log('[TEST] Vidmoly HLS Status:', hlsRes.status);
      console.log('[TEST] Vidmoly HLS Content-Type:', hlsRes.headers['content-type']);
      console.log('[TEST] Vidmoly HLS Playlist preview:\n' + hlsRes.data.substring(0, 500));
    } else {
      console.log('[TEST] No m3u8 matched in Vidmoly HTML');
    }

  } catch (err) {
    console.error('[TEST] Error:', err.message);
  }
}

testVidmoly();
