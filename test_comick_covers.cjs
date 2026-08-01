const axios = require('axios');

async function testMultipleComicKUrls() {
  const urls = [
    'https://cdn1.comicknew.pictures/from-child-actor-to-global-star/covers/6c847afd.nl',
    'https://cdn1.comicknew.pictures/a-child-star-to-a-global-superstar/covers/6c847afd.nl',
    'https://cdn2.comicknew.pictures/the-low-ranking-employee-is-too-competent/covers/6c847afd.nl'
  ];

  for (const url of urls) {
    try {
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': 'https://comickz.co.uk/'
        },
        timeout: 5000
      });
      console.log(`✅ SUCCESS [${res.status}]: ${url.split('/').pop()} -> ${res.data.length} bytes`);
    } catch (err) {
      console.log(`❌ FAIL [${err.response?.status || err.code}]: ${url}`);
    }
  }
}

testMultipleComicKUrls();
