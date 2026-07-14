import axios from 'axios';
import https from 'https';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const agent = new https.Agent({ rejectUnauthorized: false });

const playerUrl = 'https://gogoanime.me.uk/newplayer.php?id=one-piece-100?ep=2142&type=hd-1&category=sub';
console.log('Testing proxy for:', playerUrl);

try {
  const { data, headers } = await axios.get(playerUrl, {
    httpsAgent: agent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://gogoanimes.fi/',
    }
  });

  console.log('Status: 200 OK');
  console.log('Original content length:', data.length);

  // Rewrite relative links to absolute
  const targetOrigin = new URL(playerUrl).origin; // https://gogoanime.me.uk
  let html = data;
  
  // Replace src="/... or href="/... with src="origin/... or href="origin/...
  html = html.replace(/(src|href)=["']\/([^"']+)["']/g, `$1="${targetOrigin}/$2"`);
  
  console.log('\n=== Proxied HTML (first 2000 chars) ===');
  console.log(html.substring(0, 2000));

} catch (e) {
  console.error('Proxy Test Failed:', e.message);
}
