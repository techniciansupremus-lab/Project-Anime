// Exact count research: How many Hindi dubbed movies/series on MoviePlex?
// Uses WP REST API X-WP-Total header for exact counts without downloading all posts
const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'application/json',
      }
    }, (res) => {
      let data = '';
      const total = res.headers['x-wp-total'];
      const totalPages = res.headers['x-wp-totalpages'];
      res.on('data', d => { data += d; });
      res.on('end', () => {
        try {
          resolve({ body: JSON.parse(data), total: parseInt(total) || 0, totalPages: parseInt(totalPages) || 0 });
        } catch(e) {
          resolve({ body: data, total: parseInt(total) || 0, totalPages: parseInt(totalPages) || 0, raw: true });
        }
      });
    }).on('error', reject);
  });
}

async function getAllPosts(params, label) {
  const base = 'https://movieplex.co.in/wp-json/wp/v2/posts';
  const firstUrl = `${base}?per_page=1&${params}&_fields=id`;
  const first = await fetchJson(firstUrl);
  console.log(`\n[${label}] Total posts: ${first.total} (across ${first.totalPages} pages)`);
  return first.total;
}

async function main() {
  console.log('=== MOVIEPLEX HINDI DUB COUNT RESEARCH ===\n');

  // 1. Category 17 = "Hindi Dubbed" — official category
  const cat17 = await getAllPosts('categories=17', 'Category: Hindi Dubbed (ID=17)');

  // 2. Tag 187 = "hindi-dubbed-movie" tag seen on posts
  const tag187 = await getAllPosts('tags=187', 'Tag: hindi-dubbed-movie (ID=187)');

  // 3. Search "hindi dubbed" in title
  const searchHD = await getAllPosts('search=hindi+dubbed', 'Search: "hindi dubbed"');

  // 4. Search "hindi dub" broader
  const searchHDub = await getAllPosts('search=hindi+dub', 'Search: "hindi dub"');

  // 5. All categories for reference
  console.log('\n=== ALL CATEGORIES (for reference) ===');
  const cats = await fetchJson('https://movieplex.co.in/wp-json/wp/v2/categories?per_page=100&orderby=count&order=desc&_fields=id,name,slug,count');
  if (Array.isArray(cats.body)) {
    cats.body.forEach(c => {
      console.log(`  [${c.id}] ${c.name.padEnd(25)} → ${c.count} posts`);
    });
  }

  // 6. All tags — find the hindi-related ones
  console.log('\n=== TAGS CONTAINING "hindi" ===');
  const tags = await fetchJson('https://movieplex.co.in/wp-json/wp/v2/tags?per_page=100&search=hindi&_fields=id,name,slug,count');
  if (Array.isArray(tags.body)) {
    tags.body.forEach(t => {
      console.log(`  [${t.id}] "${t.name}" (slug: ${t.slug}) → ${t.count} posts`);
    });
  }

  // 7. Now fetch ALL posts from category 17, paginate, and analyze titles
  console.log('\n=== FETCHING ALL CATEGORY-17 POSTS (paginated) ===');
  const allHindiDubbedPosts = [];
  const perPage = 100;
  const totalPages17 = Math.ceil(cat17 / perPage);
  
  for (let page = 1; page <= totalPages17; page++) {
    const r = await fetchJson(
      `https://movieplex.co.in/wp-json/wp/v2/posts?categories=17&per_page=${perPage}&page=${page}&_fields=id,title,date,categories`
    );
    if (Array.isArray(r.body)) {
      allHindiDubbedPosts.push(...r.body);
    }
  }

  console.log(`Total fetched: ${allHindiDubbedPosts.length}`);
  
  // Classify by type
  const movies = allHindiDubbedPosts.filter(p => {
    const t = p.title.rendered.toLowerCase();
    return !t.includes('web series') && !t.includes('s01') && !t.includes('s02') && !t.includes('episode') && !t.includes('short film');
  });
  const webSeries = allHindiDubbedPosts.filter(p => {
    const t = p.title.rendered.toLowerCase();
    return t.includes('web series') || t.includes('s01') || t.includes('s02');
  });
  const shortFilms = allHindiDubbedPosts.filter(p => p.title.rendered.toLowerCase().includes('short film'));

  console.log(`  → Movies only: ${movies.length}`);
  console.log(`  → Web Series: ${webSeries.length}`);
  console.log(`  → Short Films: ${shortFilms.length}`);

  // Show breakdown by year
  console.log('\n=== YEAR BREAKDOWN (Hindi Dubbed cat-17) ===');
  const byYear = {};
  allHindiDubbedPosts.forEach(p => {
    const year = p.date.substring(0,4);
    byYear[year] = (byYear[year] || 0) + 1;
  });
  Object.keys(byYear).sort().forEach(yr => {
    console.log(`  ${yr}: ${byYear[yr]} posts`);
  });

  // Show some sample titles
  console.log('\n=== SAMPLE TITLES (first 20, cat-17) ===');
  allHindiDubbedPosts.slice(0, 20).forEach(p => {
    console.log(`  [${p.date.substring(0,10)}] ${p.title.rendered}`);
  });

  // 8. Find posts with "hindi dubbed" in title but NOT in category 17
  console.log('\n=== POSTS WITH "hindi dubbed" TITLE BUT NOT IN CAT-17 (checking overlap) ===');
  const searchResult = await fetchJson(
    'https://movieplex.co.in/wp-json/wp/v2/posts?search=hindi+dubbed&per_page=100&_fields=id,title,categories&page=1'
  );
  if (Array.isArray(searchResult.body)) {
    const notInCat17 = searchResult.body.filter(p => !p.categories.includes(17));
    console.log(`Search returns ${searchResult.total} total, ${searchResult.body.length} in this page`);
    console.log(`Posts in search results NOT tagged cat-17: ${notInCat17.length}`);
    notInCat17.slice(0,10).forEach(p => {
      console.log(`  [cats: ${p.categories.join(',')}] ${p.title.rendered}`);
    });
  }

  // FINAL SUMMARY
  console.log('\n\n========== FINAL COUNT SUMMARY ==========');
  console.log(`Category "Hindi Dubbed" (ID 17):      ${cat17}`);
  console.log(`Tag "hindi-dubbed-movie" (ID 187):     ${tag187}`);
  console.log(`Search results "hindi dubbed":         ${searchHD}`);
  console.log(`Search results "hindi dub":            ${searchHDub}`);
  console.log(`\nOf the ${allHindiDubbedPosts.length} cat-17 posts:`);
  console.log(`  Pure movies: ${movies.length}`);
  console.log(`  Web series:  ${webSeries.length}`);
  console.log(`  Short films: ${shortFilms.length}`);
}

main().catch(console.error);
