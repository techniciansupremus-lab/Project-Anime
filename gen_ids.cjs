const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scratch_hindi_anime_list.json', 'utf8'));
const ids = data.map(x => x.anilistId);

const tsContent = `/**
 * Complete list of AniList IDs with official Hindi / Indian language dubs on AnimeRulz.
 */
export const HINDI_DUBBED_ANILIST_IDS: number[] = ${JSON.stringify(ids, null, 2)};

const HINDI_SET = new Set<number>(HINDI_DUBBED_ANILIST_IDS);

/**
 * Returns true if the given AniList anime ID has an official Hindi dub on AnimeRulz.
 */
export function isHindiDubbed(anilistId?: number | string | null): boolean {
  if (!anilistId) return false;
  const numId = typeof anilistId === "number" ? anilistId : parseInt(String(anilistId).replace(/\\D/g, ""), 10);
  return HINDI_SET.has(numId);
}
`;

fs.mkdirSync('website/website by chatgpt/src/shared/data', { recursive: true });
fs.mkdirSync('src/shared/data', { recursive: true });

fs.writeFileSync('website/website by chatgpt/src/shared/data/hindi-dubbed-ids.ts', tsContent);
fs.writeFileSync('src/shared/data/hindi-dubbed-ids.ts', tsContent);

console.log('Successfully generated hindi-dubbed-ids.ts with', ids.length, 'IDs');
