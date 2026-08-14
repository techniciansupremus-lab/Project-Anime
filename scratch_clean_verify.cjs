// Quick verify: test the new cleaner against the 30 known-missing titles
function mpCleanTitle(raw) {
  return (raw || '')
    .replace(/&#\d+;/g, m => { try { return String.fromCharCode(parseInt(m.slice(2))); } catch(e) { return ''; } })
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\bWatch\s+Online\b/gi, '')
    .replace(/\bFull\s+Movie\b/gi, '')
    .replace(/\bFull\s+Web\s+Series\b/gi, '')
    .replace(/\bDownload\s+Now\b/gi, '')
    .replace(/\(\d{4}\)/g, '').replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/E\d+[-T]\d+/gi, '').replace(/\bE\d+\b/gi, '').replace(/\bS\d+\b/gi, '')
    .replace(/\bPart\s*\d+\b/gi, '').replace(/\bVolume\s*\d+\b/gi, '').replace(/\bVol\.?\s*\d+\b/gi, '')
    .replace(/\bEpisode\s*\d+\b/gi, '').replace(/\bSeason\s*\d+\b/gi, '').replace(/\bComplete\b/gi, '')
    .replace(/\b(Hindi Dubbed|Hindi Dub|Hindi|Bengali|Malayalam|Tamil|Telugu|Kannada|Marathi|Punjabi|Gujarati|English|Bangladeshi|South Indian|Korean|Japanese|Chinese|Thai)\b/gi, '')
    .replace(/\b(HDRip|BluRay|WEB-DL|WEBRip|UNCUT|HDTS|HDTC|HDCam|HDCAM|CAMRip|CAM|DVDSCR|DVDScr|SCR|TS|DVDRIP|DVDRip|HD|4K|1080p|720p|480p|360p|Extended|Directors.?Cut)\b/gi, '')
    .replace(/\b(Hollywood|Bollywood|Tollywood|Mollywood|Kollywood|Pollywood)\b/gi, '')
    .replace(/\b(Short Film|App Video|Webseries|Web Series|OTT|Originals|Exclusive)\b/gi, '')
    .replace(/\b(Sigmaseries|Sigma|Cukkuboo|Hulchul|HulChul|Hoichoi|Moodx|Kooku|Ullu|ALTBalaji|PrimeShots|Rabbit|RabbitMovies|Voovi|Chikooflix|Atrangii|NewSensations|LookEnt|Nuefliks|GupChup|Hotshots|Flizmovies|Mastram|DigiMoviePlex|Balloons|Besharams|Cinemadosti|Netflix|Amazon|Hotstar|SonyLiv|ZEE5|Voot|MXPlayer|JioCinema|Aha|Lionsgate|Disney)\b/gi, '')
    .replace(/\bMovie\b/gi, '').replace(/\bSeries\b/gi, '').replace(/\bFilm\b/gi, '')
    .replace(/[-_:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const titles = [
  'Hoichoi Unlimited (2018) Bengali Full Movie Watch Online',
  'A Serbian Film (2010) Hollywood HDRip Movie',
  'Moana (2026) Hindi Dubbed HDTC Movie',
  'Dhamaal 4 (2026) Hindi HDTC Movie',
  'Peddi (2026) Hindi Dubbed Movie Watch Online',
  'Crisscross (2018) Bengali Movie Watch Online',
  'Drishyam 3 (2026) Hindi Dubbed Movie Watch Online',
  'Satluj (2026) Hindi Movie Watch Online',
  'Alpha (2026) Hindi HDTS Movie Watch Online',
  'Supergirl (2026) Hindi Dubbed HDTC Movie',
  'Cocktail 2 (2026) Hindi HDCam Movie',
  'Salaar (2023) Hindi Dubbed Movie Watch Online',
  'Animal (2023) Hindi Movie Watch Online',
  'Sam Bahadur (2023) Hindi Movie Watch Online',
  'Fighter (2024) Hindi Movie Watch Online',
  'Guntur Kaaram Hindi Dubbed Movie Watch Online',
  'Dunki (2023) Hindi Movie Watch Online',
  'Bhagavanth Kesari (2023) Hindi Dubbed Movie Watch Online',
  'Ghost (2023) Hindi Dubbed Movie Watch Online',
  'Tiger 3 (2023) Hindi Movie Watch Online',
  'Jawan (2023) Hindi Movie Watch Online',
  'Raktabeej (2023) Bengali Movie Watch Online',
  'Wingwomen (2023) Netflix Hindi Dubbed Movie Watch Online',
  'Dawshom Awbotaar Bengali Movie Watch Online',
  'Eken Babu (2023) Hoichoi S07 Complete Bengali Web Series Watch Online',
  'Aarya (2023) Hindi S03 Complete Web Series Watch Online',
];

console.log('=== CLEAN TITLE TEST ===\n');
titles.forEach(t => {
  const clean = mpCleanTitle(t);
  const ok = clean.length > 1 && !clean.toLowerCase().includes('watch') && !clean.toLowerCase().includes('online') && !clean.toLowerCase().includes('hdtc') && !clean.toLowerCase().includes('hdts');
  console.log((ok ? '✅' : '❌') + ' ' + JSON.stringify(t));
  console.log('   → "' + clean + '"');
});
