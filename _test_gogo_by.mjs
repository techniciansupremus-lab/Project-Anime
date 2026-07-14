import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const agent = new https.Agent({ rejectUnauthorized: false });

const GOGO_BASE = 'https://gogoanime.by';
const OPTS = {
  timeout: 10000,
  httpsAgent: agent,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://gogoanime.by/'
  }
};

try {
  console.log(`Checking reachability of ${GOGO_BASE}...`);
  const { data, status } = await axios.get(`${GOGO_BASE}/one-piece-episode-1`, OPTS);
  console.log('Status:', status);
  
  const $ = cheerio.load(data);
  console.log('Title:', $('title').text());
  
  console.log('\n--- Streaming Servers listed on gogoanime.by ---');
  $('.anime_muti_link ul li').each((_, el) => {
    const a = $(el).find('a');
    const name = $(el).attr('class') || '';
    const href = a.attr('data-video') || a.attr('href') || '';
    console.log(`Server: ${name.trim()} | Link: ${href}`);
  });
} catch(e) {
  console.error('Error:', e.message);
  if (e.response) {
    console.log('Error status:', e.response.status);
  }
}
