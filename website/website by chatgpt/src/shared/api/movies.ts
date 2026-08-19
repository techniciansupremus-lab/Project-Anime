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

export function normalizeMoviePlexItem(item: any): MovieSummary {
  if (!item) {
    return {
      id: "unknown",
      title: "Movie",
      poster: "/img/apple-tv-rebuild/posters/napoleon.webp",
      backdrop: "/img/apple-tv-rebuild/posters/napoleon.webp",
      genre: "Movie",
      rating: 7.5,
      year: "2026",
      synopsis: "Full HD stream available on EetNet Movies.",
    };
  }

  const poster =
    item.thumbnail ||
    item.coverImage ||
    item.poster ||
    item.bannerImage ||
    "/img/apple-tv-rebuild/posters/napoleon.webp";

  const backdrop =
    item.bannerImage ||
    item.backdrop ||
    item.thumbnail ||
    item.coverImage ||
    poster;

  const rawRating = item.rating ? parseFloat(String(item.rating)) : 7.8;
  const rating = isNaN(rawRating) || rawRating <= 0 ? 7.8 : rawRating;

  let genre = "Movie";
  if (Array.isArray(item.categories) && item.categories.length > 0) {
    genre = item.categories.slice(0, 2).join(" · ");
  } else if (item.genre) {
    genre = item.genre;
  }

  return {
    id: item.id || item.movieplexId || item.slug || Math.random().toString(),
    slug: item.slug || item.movieplexSlug || (typeof item.id === "string" ? item.id.replace(/^mp-/, "") : undefined),
    title: item.title || "Untitled Movie",
    poster,
    backdrop,
    year: item.year || (item.date ? String(item.date).substring(0, 4) : "2026"),
    rating,
    genre,
    category: item.category || (Array.isArray(item.categories) ? item.categories[0] : undefined),
    synopsis: item.synopsis || item.description || "Stream in Full HD with high-speed playback.",
  };
}

export async function fetchMoviesHome(): Promise<{
  featured?: MovieSummary;
  trending: MovieSummary[];
  bollywood: MovieSummary[];
  hollywood: MovieSummary[];
  hindiDubbed: MovieSummary[];
  action: MovieSummary[];
  webSeries: MovieSummary[];
  romance: MovieSummary[];
  thriller: MovieSummary[];
}> {
  const config = await getApiConfig();
  try {
    const res = await fetch(`${config.MOVIES_API}/api/movies/home`);
    if (res.ok) {
      const data = await res.json();
      const mp = data.movieplex || {};
      return {
        featured: data.featured ? normalizeMoviePlexItem(data.featured) : undefined,
        trending: (data.trending || mp.trending || []).map(normalizeMoviePlexItem),
        bollywood: (data.bollywood || mp.bollywood || []).map(normalizeMoviePlexItem),
        hollywood: (data.hollywood || mp.hollywood || []).map(normalizeMoviePlexItem),
        hindiDubbed: (data.hindiDubbed || mp.hindiDubbed || []).map(normalizeMoviePlexItem),
        action: (data.action || mp.action || []).map(normalizeMoviePlexItem),
        webSeries: (data.webSeries || mp.webSeries || []).map(normalizeMoviePlexItem),
        romance: (data.romance || mp.romance || []).map(normalizeMoviePlexItem),
        thriller: (data.thriller || mp.thriller || []).map(normalizeMoviePlexItem),
      };
    }
  } catch (err) {
    console.warn("Movies home fetch failed:", err);
  }
  return {
    trending: [],
    bollywood: [],
    hollywood: [],
    hindiDubbed: [],
    action: [],
    webSeries: [],
    romance: [],
    thriller: [],
  };
}

export async function fetchMovieCatalog(params: {
  category?: number | string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<MovieSummary[]> {
  const config = await getApiConfig();
  const query = new URLSearchParams();
  if (params.category !== undefined && params.category !== null && params.category !== "") {
    query.set("category", String(params.category));
  }
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  try {
    const res = await fetch(`${config.MOVIES_API}/api/movieplex/catalog?${query.toString()}`);
    if (res.ok) {
      const data = await res.json();
      const rawMovies = Array.isArray(data) ? data : data.movies || data.items || [];
      return rawMovies.map(normalizeMoviePlexItem);
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
