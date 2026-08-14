// Poster audit — fetches 100 titles from the live catalog and tests each one
const axios = require('axios');

async function main() {
  // 1. Get catalog sample
  const res = await axios.get('http://localhost:8080/api/movieplex/catalog?page=1&limit=100');
  const movies = res.data.movies || [];
  console.log('Fetched', movies.length, 'movies from catalog\n');

  let withPoster = 0, withoutPoster = 0;
  const missing = [];

  for (const m of movies) {
    if (m.thumbnail) {
      withPoster++;
    } else {
      withoutPoster++;
      missing.push(m.title);
    }
  }

  console.log(`=== POSTER COVERAGE ===`);
  console.log(`With poster   : ${withPoster}/${movies.length} (${Math.round(withPoster/movies.length*100)}%)`);
  console.log(`Without poster: ${withoutPoster}/${movies.length} (${Math.round(withoutPoster/movies.length*100)}%)`);
  console.log(`\n=== SAMPLE MISSING TITLES (first 30) ===`);
  missing.slice(0, 30).forEach(t => console.log(' -', t));

  // 2. Categorise WHY they're missing
  const reasons = {
    tooObscure: 0,       // regional/unknown
    adultContent: 0,     // ullu/kooku etc
    tooRecent: 0,        // 2025-2026 release
    badTitle: 0,         // mangled/junk title
    episodic: 0,         // S01E01 type
  };

  const adultKeywords = /\b(ullu|hotshots|moodx|kooku|uncut|primeshots|rabbit|voovi|chikooflix|balloons|besharams|cinemadosti)\b/i;
  const episodicPattern = /\bS\d+\s*E\d+\b|\bEpisode\s*\d+\b/i;
  const bengaliRegional = /\b(bengali|odia|marathi|punjabi|gujarati|bhojpuri|oriya)\b/i;

  for (const t of missing) {
    if (adultKeywords.test(t)) reasons.adultContent++;
    else if (episodicPattern.test(t)) reasons.episodic++;
    else if (bengaliRegional.test(t)) reasons.tooObscure++;
    else if (/\b202[5-9]\b/.test(t)) reasons.tooRecent++;
    else reasons.badTitle++;
  }

  console.log('\n=== WHY THEY\'RE MISSING ===');
  console.log(' Adult content (Ullu etc)  :', reasons.adultContent);
  console.log(' Regional/obscure           :', reasons.tooObscure);
  console.log(' Too recent (2025+)         :', reasons.tooRecent);
  console.log(' Episodic (S01E01)          :', reasons.episodic);
  console.log(' Unknown/mangled title      :', reasons.badTitle);
}

main().catch(console.error);
