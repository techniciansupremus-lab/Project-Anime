import { getApiConfig } from "./config";

export type MovieSummary = {
  id: string | number;
  slug?: string;
  title: string;
  poster?: string;
  backdrop?: string;
  year?: string | number;
  rating?: number | string;
  genre?: string;
  category?: string;
  synopsis?: string;
};

export type MoviesHomeData = {
  featured?: MovieSummary;
  movieplex?: {
    trending?: MovieSummary[];
    hindiDubbed?: MovieSummary[];
    bollywood?: MovieSummary[];
    hollywood?: MovieSummary[];
    webSeries?: MovieSummary[];
    action?: MovieSummary[];
    romance?: MovieSummary[];
  };
};

export type MovieStreamResult = {
  streamUrl?: string | null;
  thumbnail?: string;
  title?: string;
  source?: string;
  fallbackIframe?: string | null;
  error?: string;
};

export async function fetchMoviesHome(): Promise<MoviesHomeData> {
  const config = await getApiConfig();
  try {
    const res = await fetch(`${config.MOVIES_API}/api/movies/home`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Movies home fetch failed:", err);
  }
  return {};
}

export async function fetchMovieCatalog(params: {
  category?: number | string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<MovieSummary[]> {
  const config = await getApiConfig();
  const query = new URLSearchParams();
  if (params.category) query.set("category", String(params.category));
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  try {
    const res = await fetch(`${config.MOVIES_API}/api/movieplex/catalog?${query.toString()}`);
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : data.items || [];
    }
  } catch (err) {
    console.warn("Movie catalog fetch failed:", err);
  }
  return [];
}

export async function resolveMovieStream(params: {
  slug?: string;
  title?: string;
  year?: string | number;
}): Promise<MovieStreamResult> {
  const config = await getApiConfig();

  // 1. Try MoviePlex stream resolver if slug exists
  if (params.slug) {
    try {
      const res = await fetch(`${config.MOVIES_API}/api/movieplex/stream?slug=${encodeURIComponent(params.slug)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.streamUrl || data.fallbackIframe) {
          return data;
        }
      }
    } catch (e) {
      console.warn("MoviePlex stream resolve failed:", e);
    }
  }

  // 2. Try NetMirror stream resolve if title exists
  if (params.title) {
    try {
      const q = new URLSearchParams({ title: params.title });
      if (params.year) q.set("year", String(params.year));
      const res = await fetch(`${config.MOVIES_API}/api/netmirror/stream-resolve?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.streamUrl) {
          return {
            streamUrl: data.streamUrl,
            title: params.title,
            source: "NetMirror",
          };
        }
      }
    } catch (e) {
      console.warn("NetMirror stream resolve failed:", e);
    }
  }

  throw new Error("Could not resolve movie stream");
}
