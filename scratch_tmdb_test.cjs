const axios = require('axios');
const TMDB_API_KEY = '4e44d9029b1270a757cddc766a1bcb63';

function cleanTitle(raw) {
  return raw
    .replace(/\(\d{4}\)/g, '')
    .replace(/Hindi Dubbed|Hindi S01|Complete Web Series|HDRip Movie|Bangladeshi|Movie|Web Series|S0\d+/gi, '')
    .replace(/[-_]/g, ' ')
    .trim();
}

async function searchTMDB(title) {
  const q = cleanTitle(title);
  try {
    // 1. Try movie search
    let url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q)}`;
    let res = await axios.get(url);
    if (res.data.results && res.data.results.length > 0) {
      const item = res.data.results[0];
      return {
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        rating: item.vote_average ? item.vote_average.toFixed(1) : null
      };
    }
    // 2. Try TV search (for web series)
    url = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q)}`;
    res = await axios.get(url);
    if (res.data.results && res.data.results.length > 0) {
      const item = res.data.results[0];
      return {
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        rating: item.vote_average ? item.vote_average.toFixed(1) : null
      };
    }
  } catch (e) {
    console.error('TMDB error for:', q, e.message);
  }
  return null;
}

async function run() {
  const titles = [
    'Malik (2026) Bangladeshi HDRip Movie',
    'Operation Safed Sagar (2026) Hindi S01 Complete Web Series',
    'Advocate Achinta Aich (2025) Season 1',
    'The Devil (2025) Hindi Dubbed',
    'Lady Chatterleys Lover',
    'Son of Sara: Volume 1 (2026) Hindi Dubbed',
    'Gatta Kusthi 2 (2026) Hindi Dubbed'
  ];

  for (const t of titles) {
    const res = await searchTMDB(t);
    console.log(`Title: "${t}" -> Clean: "${cleanTitle(t)}"`);
    console.log('  Result:', res);
  }
}

run();
