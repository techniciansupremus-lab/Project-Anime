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
  id: number;
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
  const apiKey = import.meta.env.VITE_TMDB_API_KEY;
  if (!apiKey) throw new Error("TMDB is not configured.");
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
