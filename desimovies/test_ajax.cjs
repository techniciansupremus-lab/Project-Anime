const axios = require('axios');

async function testAjaxActions() {
  const actions = [
    'trailer',
    'watch_trailer',
    'toroflix_trailer',
    'tr_trailer',
    'action_trailer',
    'get_trailer',
    'tr_player',
    'toroflix_player',
    'player',
    'tr_live_search',
    'live_search',
    'toroflix_live_search'
  ];

  const nonce = '4e24e242e9'; // From toroflixPublic

  for (const action of actions) {
    try {
      const res = await axios.post('https://desicinemas.pk/wp-admin/admin-ajax.php', 
        new URLSearchParams({
          action,
          id: '12420',
          nonce,
          key: '0',
          q: 'jawan'
        }).toString(),
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://desicinemas.pk/movies/awarapan-2-low-qua/',
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 5000
        }
      );
      console.log(`[ACTION] ${action} -> Status: ${res.status} | Data:`, typeof res.data === 'object' ? JSON.stringify(res.data) : res.data.toString().substring(0, 100));
    } catch (e) {
      console.log(`[ACTION] ${action} -> Error:`, e.response ? e.response.status : e.message);
    }
  }
}

testAjaxActions();
