import axios from 'axios';
import { ANIME, META } from '@consumet/extensions';

// Replicate server.js environment
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const animeUnity = new ANIME.AnimeUnity();
const anilistMeta = new META.Anilist(animeUnity);

const TMDB_API_KEY = '4e44d9029b1270a757cddc766a1bcb63';
const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=hi&sort_by=popularity.desc&page=1`;

console.log('=== Test 1: axios.get (global) ===');
try {
  const r1 = await axios.get(url);
  console.log('SUCCESS:', r1.data.results.length, 'movies');
} catch (e) {
  console.log('FAIL:', e.message);
  console.log('Response status:', e.response?.status);
  console.log('Response data:', JSON.stringify(e.response?.data));
  console.log('Request headers:', JSON.stringify(e.config?.headers));
  console.log('Request URL:', e.config?.url);
}

console.log('\n=== Test 2: axios.create() isolated ===');
try {
  const tmdbAxios = axios.create({ headers: { 'User-Agent': 'Mozilla/5.0' } });
  const r2 = await tmdbAxios.get(url);
  console.log('SUCCESS:', r2.data.results.length, 'movies');
} catch (e) {
  console.log('FAIL:', e.message);
  console.log('Response status:', e.response?.status);
  console.log('Response data:', JSON.stringify(e.response?.data));
  console.log('Request headers:', JSON.stringify(e.config?.headers));
}

console.log('\n=== Test 3: native fetch() ===');
try {
  const r3 = await fetch(url);
  const data = await r3.json();
  console.log('SUCCESS:', data.results?.length, 'movies');
} catch (e) {
  console.log('FAIL:', e.message);
}

console.log('\n=== Checking axios defaults ===');
console.log('axios.defaults.headers:', JSON.stringify(axios.defaults.headers));

process.exit(0);
