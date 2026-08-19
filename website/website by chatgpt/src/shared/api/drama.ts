import { getApiConfig } from "./config";

export type DramaSummary = {
  id: number | string;
  title: string;
  thumbnail: string;
  episodesCount?: number;
  rating?: number | string;
  status?: string;
  description?: string;
};

export type DramaHomeData = {
  show: DramaSummary[];
  korean: DramaSummary[];
  chinese: DramaSummary[];
  topRating: DramaSummary[];
  lastUpdate: DramaSummary[];
};

export type DramaEpisode = {
  id: number | string;
  number: number;
  sub?: number;
};

export type DramaDetail = {
  id: number | string;
  title: string;
  description?: string;
  thumbnail: string;
  status?: string;
  episodes: DramaEpisode[];
};

export type DramaSubtitle = {
  label: string;
  file: string;
  rawFile?: string;
  default?: boolean;
};

export type DramaStreamResult = {
  episodeId: string | number;
  type: string;
  streamUrl: string;
  subtitles: DramaSubtitle[];
};

export async function fetchDramaHome(): Promise<DramaHomeData> {
  const config = await getApiConfig();
  try {
    const res = await fetch(`${config.DRAMA_API}/api/drama/home`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Drama home fetch failed:", err);
  }
  return {
    show: [],
    korean: [],
    chinese: [],
    topRating: [],
    lastUpdate: [],
  };
}

export async function searchDramas(query: string): Promise<DramaSummary[]> {
  if (!query.trim()) return [];
  const config = await getApiConfig();
  try {
    const res = await fetch(`${config.DRAMA_API}/api/drama/search?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  } catch (err) {
    console.warn("Drama search failed:", err);
  }
  return [];
}

export async function fetchDramaInfo(dramaId: number | string): Promise<DramaDetail> {
  const config = await getApiConfig();
  const res = await fetch(`${config.DRAMA_API}/api/drama/info/${dramaId}`);
  if (!res.ok) {
    throw new Error(`Failed to load drama details for ID ${dramaId}`);
  }
  return await res.json();
}

export async function fetchDramaStream(
  episodeId: number | string,
  title?: string,
  episodeNum?: number
): Promise<DramaStreamResult> {
  const config = await getApiConfig();
  const isNumeric = /^\d+$/.test(String(episodeId));

  // 1. Direct KissKH ID lookup
  if (isNumeric) {
    try {
      const res = await fetch(`${config.DRAMA_API}/api/drama/stream/${episodeId}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("Direct drama stream fetch failed:", e);
    }
  }

  // 2. Title search fallback (for TMDB items or named queries)
  if (title) {
    try {
      const searchResults = await searchDramas(title);
      if (searchResults.length > 0) {
        const bestMatch = searchResults[0];
        const info = await fetchDramaInfo(bestMatch.id);
        if (info.episodes && info.episodes.length > 0) {
          const targetEpNum = episodeNum || 1;
          const matchedEp =
            info.episodes.find((e) => Number(e.number) === Number(targetEpNum)) ||
            info.episodes[0];
          if (matchedEp && matchedEp.id) {
            const streamRes = await fetch(`${config.DRAMA_API}/api/drama/stream/${matchedEp.id}`);
            if (streamRes.ok) {
              return await streamRes.json();
            }
          }
        }
      }
    } catch (searchErr) {
      console.warn("Drama title resolution failed:", searchErr);
    }
  }

  throw new Error(`Failed to load drama stream for episode ${episodeId}`);
}
