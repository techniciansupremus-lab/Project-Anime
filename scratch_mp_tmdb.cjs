const axios = require('axios');
const MOVIEPLEX_BASE = 'https://movieplex.co.in';
const MOVIEPLEX_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const TMDB_API_KEY = '4e44d9029b1270a757cddc766a1bcb63';

function cleanTitle(raw) {
  return (raw || '')
    .replace(/\(\d{4}\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/E\d+[-T]\d+/gi, '')
    .replace(/E\d+/gi, '')
    .replace(/S\d+/gi, '')
    .replace(/Hindi Dubbed|Hindi|Bengali|Malayalam|Tamil|Telugu|Kannada|Marathi|Punjabi|Guajarati/gi, '')
    .replace(/Complete|Web Series|HDRip|Movie|Short Film|App Video|Sigmaseries|Sigma|Cukkuboo|Hulchul|Hoichoi|Moodx|Kooku|Ullu|ALTBalaji|PrimeShots|Rabbit|RabbitMovies|Voovi|Chikooflix|Uncut/gi, '')
    .replace(/[-_:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function run() {
  const postsRes = await axios.get(`${MOVIEPLEX_BASE}/wp-json/wp/v2/posts?per_page=25&_fields=id,title,slug`, {
    headers: { 'User-Agent': MOVIEPLEX_UA }
  });

  const posts = postsRes.data;
  console.log(`Fetched ${posts.length} posts from MoviePlex API. Resolving posters via TMDB...\n`);

  let matched = 0;
  for (const p of posts) {
    const rawTitle = p.title.rendered;
    const clean = cleanTitle(rawTitle);

    let poster = null;
    let rating = null;

    try {
      const mUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(clean)}`;
      const mRes = await axios.get(mUrl);
      if (mRes.data.results && mRes.data.results[0] && mRes.data.results[0].poster_path) {
        poster = `https://image.tmdb.org/t/p/w500${mRes.data.results[0].poster_path}`;
        rating = mRes.data.results[0].vote_average;
      } else {
        const tUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(clean)}`;
        const tRes = await axios.get(tUrl);
        if (tRes.data.results && tRes.data.results[0] && tRes.data.results[0].poster_path) {
          poster = `https://image.tmdb.org/t/p/w500${tRes.data.results[0].poster_path}`;
          rating = tRes.data.results[0].vote_average;
        }
      }
    } catch (e) {}

    if (poster) matched++;
    console.log(`🎬 Title: ${rawTitle}`);
    console.log(`   Clean: ${clean}`);
    console.log(`   Poster: ${poster || '❌ NO POSTER'}\n`);
  }
  console.log(`Summary: ${matched}/${posts.length} matched TMDB posters!`);
}

run();
