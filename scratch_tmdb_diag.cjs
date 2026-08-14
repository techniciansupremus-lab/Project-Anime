const axios = require('axios');
const TMDB_KEY = '4e44d9029b1270a757cddc766a1bcb63';

function mpCleanTitle(raw) {
  return (raw || '')
    .replace(/&#\d+;/g, function(m) { try { return String.fromCharCode(parseInt(m.slice(2))); } catch(e) { return ''; } })
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\(\d{4}\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/E\d+[-T]\d+/gi, '').replace(/E\d+/gi, '').replace(/S\d+/gi, '')
    .replace(/Part\s*\d+/gi, '').replace(/Volume\s*\d+/gi, '').replace(/Vol\.?\s*\d+/gi, '')
    .replace(/\b(Hindi Dubbed|Hindi|Bengali|Malayalam|Tamil|Telugu|Kannada|Marathi|Punjabi|Gujarati|English|Bangladeshi)\b/gi, '')
    .replace(/\b(HDRip|BluRay|WEB-DL|WEBRip|UNCUT|HD|4K|1080p|720p|480p|Complete|Extended)\b/gi, '')
    .replace(/\b(Movie|Short Film|Web Series|App Video|Webseries|Series|Film|OTT|Originals|Exclusive)\b/gi, '')
    .replace(/\b(Sigmaseries|Sigma|Cukkuboo|Hulchul|HulChul|Hoichoi|Moodx|Kooku|Ullu|ALTBalaji|PrimeShots|Rabbit|RabbitMovies|Voovi|Chikooflix|Atrangii|NewSensations|LookEnt|Nuefliks|GupChup|Hotshots|Flizmovies|Mastram|DigiMoviePlex|Balloons|Besharams|Cinemadosti)\b/gi, '')
    .replace(/[-_:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function testTitles() {
  const titles = [
    'A Serbian Film (2010)',
    'Moana (2026) Hindi',
    'Dhamaal 4 (2026) Hindi',
    'Salaar (2023) Hindi Dubbed',
    'Animal (2023) Hindi Dubbed',
    'Sam Bahadur (2023) Hindi',
    'Fighter (2024) Hindi Dubbed',
    'Supergirl (2026) Hindi Dubbed',
    'Indian Police Force (2024)',
    'Guntur Kaaram Hindi Dubbed',
    'Welcome to the Jungle (2026)',
    'Cocktail 2 (2026) Hindi'
  ];

  for (const t of titles) {
    const clean = mpCleanTitle(t);
    console.log(`\nTesting title: "${t}" -> clean: "${clean}"`);
    try {
      const mUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(clean)}`;
      const mRes = await axios.get(mUrl);
      console.log(`  Movie Search results: ${mRes.data.results ? mRes.data.results.length : 0}`);
      if (mRes.data.results && mRes.data.results.length > 0) {
        const top = mRes.data.results[0];
        console.log(`  Top Result: "${top.title}" (poster_path: ${top.poster_path})`);
      } else {
        const tUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(clean)}`;
        const tRes = await axios.get(tUrl);
        console.log(`  TV Search results: ${tRes.data.results ? tRes.data.results.length : 0}`);
        if (tRes.data.results && tRes.data.results.length > 0) {
          console.log(`  Top TV Result: "${tRes.data.results[0].name}" (poster_path: ${tRes.data.results[0].poster_path})`);
        }
      }
    } catch (err) {
      console.error(`  ERROR:`, err.message);
    }
  }
}

testTitles();
