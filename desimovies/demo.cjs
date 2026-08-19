const desicinemas = require('./desicinemas.cjs');

async function runDemo() {
  console.log('====================================================');
  console.log('        DESICINEMAS.PK FULL PIPELINE DEMO           ');
  console.log('====================================================\n');

  try {
    // 1. Catalog Browsing
    console.log('[1] Fetching Movies Catalog (Page 1)...');
    const catalog = await desicinemas.getCatalog('movies', 1);
    console.log(`✅ Success! Fetched ${catalog.results.length} movies (Has Next: ${catalog.hasNextPage})`);
    console.log('Sample movie:', catalog.results[0]);

    // 2. Search
    console.log('\n[2] Testing Search ("jawan")...');
    const searchRes = await desicinemas.search('jawan', 1);
    console.log(`✅ Success! Found ${searchRes.results.length} results.`);
    searchRes.results.slice(0, 3).forEach(r => console.log(`  - [${r.year}] ${r.title} (${r.slug})`));

    // 3. Movie Detail
    console.log('\n[3] Testing Movie Detail ("nibba-nibbi")...');
    const movieDetail = await desicinemas.getMovieDetail('nibba-nibbi');
    console.log(`✅ Movie: ${movieDetail.title}`);
    console.log(`   Quality: ${movieDetail.quality} | Rating: ${movieDetail.rating} | Duration: ${movieDetail.duration}`);
    console.log(`   Genres: ${movieDetail.genres.join(', ')}`);
    console.log(`   Options (${movieDetail.options.length}):`, movieDetail.options);

    // 4. Series Detail (with seasons & episodes)
    console.log('\n[4] Testing Series Detail ("mtv-hustle")...');
    const seriesDetail = await desicinemas.getSeriesDetail('mtv-hustle');
    console.log(`✅ Series: ${seriesDetail.title} | Seasons: ${seriesDetail.seasons.length}`);
    seriesDetail.seasons.forEach(s => {
      console.log(`   - ${s.seasonName}: ${s.episodes.length} episodes`);
      if (s.episodes.length > 0) {
        console.log(`     Sample Episode: Ep ${s.episodes[0].episode} - ${s.episodes[0].title} (${s.episodes[0].slug})`);
      }
    });

    // 5. Stream Extraction (Morencius Movie)
    console.log('\n[5] Testing Stream Extraction for Movie (Morencius)...');
    const movieStream = await desicinemas.resolveStream({ slug: 'nibba-nibbi', optionKey: '0', type: '1' });
    console.log(`✅ Movie Stream Resolved:`);
    console.log(`   Host: ${movieStream.host}`);
    console.log(`   Is HLS: ${movieStream.isHls}`);
    console.log(`   Stream URL: ${movieStream.streamUrl}`);

    // 6. Stream Extraction (Vidmoly Movie)
    console.log('\n[6] Testing Stream Extraction for Movie (Vidmoly)...');
    const vidmolyStream = await desicinemas.resolveStream({ slug: 'toy-story-5-low-qualit', optionKey: '0', type: '1' });
    console.log(`✅ Vidmoly Stream Resolved:`);
    console.log(`   Host: ${vidmolyStream.host}`);
    console.log(`   Is HLS: ${vidmolyStream.isHls}`);
    console.log(`   Stream URL: ${vidmolyStream.streamUrl}`);

    // 7. Stream Extraction for TV Episode
    console.log('\n[7] Testing Stream Extraction for TV Episode...');
    const epStream = await desicinemas.resolveStream({ postId: '39041', optionKey: '0', type: '2' });
    console.log(`✅ Episode Stream Resolved:`);
    console.log(`   Host: ${epStream.host}`);
    console.log(`   Is HLS: ${epStream.isHls}`);
    console.log(`   Stream URL: ${epStream.streamUrl}`);

    console.log('\n====================================================');
    console.log('  🎉 ALL TESTS PASSED SUCCESSFULLY!                 ');
    console.log('====================================================');

  } catch (err) {
    console.error('❌ Demo encountered an error:', err.message);
  }
}

runDemo();
