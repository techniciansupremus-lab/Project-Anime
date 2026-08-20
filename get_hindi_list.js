const axios = require('axios');
const fs = require('fs');

async function getList() {
  try {
    const dubRes = await axios.get('https://data.streamindia.co.in/api/dub.json', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://animerulzapp.buzz/',
        'Origin': 'https://animerulzapp.buzz'
      }
    });

    const items = Array.isArray(dubRes.data) ? dubRes.data : (dubRes.data?.data || []);
    const hindiItems = items.filter(x => (x.languages || []).some(l => String(l).toLowerCase().includes('hindi')));

    const idMap = new Map();
    hindiItems.forEach(x => {
      const id = parseInt(String(x.animerulz_id).replace(/\D/g, ''));
      if (id) idMap.set(id, x);
    });

    const anilistIds = Array.from(idMap.keys());
    console.log(`Total unique Hindi AniList IDs on AnimeRulz: ${anilistIds.length}`);

    const chunks = [];
    for (let i = 0; i < anilistIds.length; i += 50) {
      chunks.push(anilistIds.slice(i, i + 50));
    }

    const allMedia = [];
    const query = `
      query MediaList($ids: [Int]) {
        Page(page: 1, perPage: 50) {
          media(id_in: $ids, type: ANIME) {
            id
            title {
              english
              romaji
              userPreferred
            }
            format
            episodes
            seasonYear
            genres
            popularity
          }
        }
      }
    `;

    for (const chunk of chunks) {
      try {
        const res = await axios.post('https://graphql.anilist.co', { query, variables: { ids: chunk } });
        const media = res.data?.data?.Page?.media || [];
        allMedia.push(...media);
      } catch (err) {
        console.warn('Chunk fetch error:', err.message);
      }
      await new Promise(r => setTimeout(r, 400));
    }

    // Sort by popularity descending
    allMedia.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    console.log(`Successfully fetched metadata for ${allMedia.length} anime.`);

    const formatted = allMedia.map((m, idx) => {
      const title = m.title.english || m.title.romaji || m.title.userPreferred;
      const itemData = idMap.get(m.id);
      const otherLangs = (itemData?.languages || [])
        .map(l => l.charAt(0).toUpperCase() + l.slice(1))
        .join(', ');
      return {
        rank: idx + 1,
        title,
        year: m.seasonYear || '—',
        episodes: m.episodes || '—',
        genres: (m.genres || []).slice(0, 3).join(', '),
        languages: otherLangs || 'Hindi',
        anilistId: m.id
      };
    });

    fs.writeFileSync('scratch_hindi_anime_list.json', JSON.stringify(formatted, null, 2));
    console.log('Saved to scratch_hindi_anime_list.json');

    // Print summary groups
    console.log('\n=== TOP 60 POPULAR HINDI DUBBED ANIME ON ANIMERULZ ===');
    formatted.slice(0, 60).forEach(a => {
      console.log(`${a.rank}. ${a.title} (${a.year}) — ${a.episodes} eps | Languages: ${a.languages}`);
    });

  } catch (err) {
    console.error('Error fetching list:', err);
  }
}

getList();
