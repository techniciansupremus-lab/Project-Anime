type TmdbResponse = {
  results: Array<{
    id: number;
    title?: string;
    name?: string;
    overview?: string;
    release_date?: string;
    first_air_date?: string;
    backdrop_path?: string | null;
    poster_path?: string | null;
    genre_ids?: number[];
    vote_average?: number;
  }>;
};

export type TmdbMovie = {
  id: number | string;
  slug?: string;
  title: string;
  year: string;
  genre: string;
  synopsis: string;
  backdrop: string;
  poster: string;
  rating: number;
};

const genreNames: Record<number, string> = {
  12: "Adventure",
  14: "Fantasy",
  16: "Animation",
  18: "Drama",
  27: "Horror",
  28: "Action",
  35: "Comedy",
  36: "History",
  53: "Thriller",
  80: "Crime",
  878: "Science Fiction",
  9648: "Mystery",
  10749: "Romance",
};

const imageBase = "https://image.tmdb.org/t/p";

function asMovie(movie: TmdbResponse["results"][number]): TmdbMovie | null {
  const imagePath = movie.backdrop_path ?? movie.poster_path;
  if (!imagePath) return null;
  const genres =
    (movie.genre_ids ?? [])
      .map((id) => genreNames[id])
      .filter(Boolean)
      .slice(0, 2)
      .join(" · ") || "Movie";
  return {
    id: movie.id,
    title: movie.title ?? movie.name ?? "Untitled",
    year: (movie.release_date ?? movie.first_air_date ?? "").slice(0, 4) || "—",
    genre: genres,
    synopsis: movie.overview || "No synopsis is available for this title.",
    backdrop: `${imageBase}/w1280${imagePath}`,
    poster: `${imageBase}/w500${movie.poster_path ?? imagePath}`,
    rating: movie.vote_average ?? 0,
  };
}

async function requestTmdb<T>(path: string): Promise<T> {
  const apiKey = import.meta.env.VITE_TMDB_API_KEY || "ecb37597e45cfeed0586f3cd57233d0b";
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(
    `https://api.themoviedb.org/3${path}${separator}api_key=${encodeURIComponent(
      apiKey
    )}&language=en-US`
  );
  if (!response.ok) throw new Error("TMDB could not load movies.");
  return response.json() as Promise<T>;
}

export async function fetchTmdbMovies(path: string): Promise<TmdbMovie[]> {
  const data = await requestTmdb<TmdbResponse>(path);
  return data.results.map(asMovie).filter((movie): movie is TmdbMovie => movie !== null);
}

export async function searchTmdbMovies(query: string): Promise<TmdbMovie[]> {
  return fetchTmdbMovies(
    `/search/movie?query=${encodeURIComponent(query)}&include_adult=false`
  );
}

export async function fetchSimilarMovies(id: number): Promise<TmdbMovie[]> {
  return fetchTmdbMovies(`/movie/${id}/recommendations`);
}

export async function fetchTrailerKey(id: number): Promise<string | null> {
  const data = await requestTmdb<{
    results: Array<{ key?: string; site?: string; type?: string }>;
  }>(`/movie/${id}/videos`);
  const trailer = data.results.find(
    (video) =>
      video.site === "YouTube" &&
      (video.type === "Trailer" || video.type === "Teaser")
  );
  return trailer?.key ?? null;
}

const tmdbCache = new Map<
  string,
  { poster: string; backdrop: string; rating: number; synopsis?: string }
>();

/**
 * Cleans a movie title and queries the official TMDB API for HD poster art, backdrop, and rating.
 */
export async function enrichMovieWithTmdb(movie: any): Promise<TmdbMovie> {
  if (!movie) {
    return {
      id: "unknown",
      title: "Movie",
      year: "2026",
      genre: "Cinema",
      synopsis: "Full HD streaming available.",
      backdrop: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1280&q=80",
      poster: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80",
      rating: 7.8,
    };
  }

  const rawTitle = movie.title || "Untitled";
  const cleanTitle = rawTitle
    .replace(/\b(Watch\s+Online|Full\s+Movie|Full\s+Web\s+Series|Download\s+Now)\b/gi, "")
    .replace(/\b(Hindi\s+Dubbed|Hindi\s+Dub|Hindi|Bengali|Malayalam|Tamil|Telugu|Kannada|Marathi|Punjabi|Gujarati|English)\b/gi, "")
    .replace(/\b(HDRip|BluRay|WEB-DL|WEBRip|UNCUT|HDTS|HDTC|HDCam|CAMRip|DVDScr|HD|4K|1080p|720p|480p|360p)\b/gi, "")
    .replace(/\b(Bollywood|Hollywood|South\s+Indian|Low\s+Quality)\b/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\[\s*\]/g, "")
    .replace(/[-_:]/g, " ")
    .replace(/\s+/g, " ")
    .trim() || rawTitle;

  // Check cache first
  if (tmdbCache.has(cleanTitle)) {
    const cached = tmdbCache.get(cleanTitle)!;
    return {
      ...movie,
      title: cleanTitle,
      poster: cached.poster || movie.poster,
      backdrop: cached.backdrop || movie.backdrop,
      rating: cached.rating || movie.rating || 7.8,
      synopsis: cached.synopsis || movie.synopsis,
    };
  }

  // Ensure default poster has high-res TMDB link if available
  let bestPoster = movie.poster || movie.thumbnail || "";
  if (bestPoster.includes("image.tmdb.org/t/p/")) {
    bestPoster = bestPoster.replace(/\/t\/p\/(w\d+|original)\//, "/t/p/w500/");
  }

  let bestBackdrop = movie.backdrop || movie.bannerImage || bestPoster;
  if (bestBackdrop.includes("image.tmdb.org/t/p/")) {
    bestBackdrop = bestBackdrop.replace(/\/t\/p\/(w\d+|original)\//, "/t/p/w1280/");
  }

  try {
    const data = await requestTmdb<TmdbResponse>(
      `/search/multi?query=${encodeURIComponent(cleanTitle)}&include_adult=false`
    );
    const match = data.results?.[0];
    if (match) {
      if (match.poster_path) {
        bestPoster = `${imageBase}/w500${match.poster_path}`;
      }
      if (match.backdrop_path) {
        bestBackdrop = `${imageBase}/w1280${match.backdrop_path}`;
      }
      const rawVote = match.vote_average && match.vote_average > 0 ? match.vote_average : (movie.rating || 7.8);
      const rating = Number(Number(rawVote).toFixed(1));
      const synopsis = match.overview || movie.synopsis;

      const enriched = {
        poster: bestPoster,
        backdrop: bestBackdrop,
        rating,
        synopsis,
      };

      tmdbCache.set(cleanTitle, enriched);

      return {
        ...movie,
        title: cleanTitle,
        poster: bestPoster,
        backdrop: bestBackdrop,
        rating,
        synopsis: synopsis || movie.synopsis,
      };
    }
  } catch (err) {
    // Graceful fallback to existing properties
  }

  return {
    ...movie,
    title: cleanTitle,
    poster: bestPoster || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80",
    backdrop: bestBackdrop || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1280&q=80",
    rating: movie.rating ? Number(Number(movie.rating).toFixed(1)) : 7.8,
  };
}

/**
 * Enriches an entire array of movies with official TMDB posters in parallel.
 */
export async function enrichMoviesList(movies: any[]): Promise<TmdbMovie[]> {
  if (!Array.isArray(movies) || movies.length === 0) return [];
  return Promise.all(movies.map(enrichMovieWithTmdb));
}
