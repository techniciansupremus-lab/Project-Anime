import { useEffect, useRef, useState } from "react";
import { Header } from "./components/header";
import { Hero } from "./components/hero";
import { Usps } from "./components/usps";
import { VideoCarousel } from "./components/video-carousel";
import { MovieCatalog } from "./components/movie-catalog";
import { MovieModal } from "./components/movie-modal";
import {
  fetchTmdbMovies,
  searchTmdbMovies,
  type TmdbMovie,
} from "./api/tmdb";

const GENRES = [
  "All",
  "Trending",
  "Action",
  "Sci-Fi",
  "Animation",
  "Drama",
  "Comedy",
  "Thriller",
  "Horror",
  "Adventure",
];

const genrePaths: Record<string, string> = {
  All: "/trending/movie/week",
  Trending: "/trending/movie/week",
  Action: "/discover/movie?with_genres=28&sort_by=popularity.desc",
  "Sci-Fi": "/discover/movie?with_genres=878&sort_by=popularity.desc",
  Animation: "/discover/movie?with_genres=16&sort_by=popularity.desc",
  Drama: "/discover/movie?with_genres=18&sort_by=popularity.desc",
  Comedy: "/discover/movie?with_genres=35&sort_by=popularity.desc",
  Thriller: "/discover/movie?with_genres=53&sort_by=popularity.desc",
  Horror: "/discover/movie?with_genres=27&sort_by=popularity.desc",
  Adventure: "/discover/movie?with_genres=12&sort_by=popularity.desc",
};

const STORAGE_MY_LIST = "eetnet-movies-my-list";
const STORAGE_LIKED = "eetnet-movies-liked";

function loadStorage<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    return val ? (JSON.parse(val) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function MoviesPage({ onExit }: { onExit: () => void }) {
  const [trendingMovies, setTrendingMovies] = useState<TmdbMovie[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<TmdbMovie[]>([]);
  const [actionMovies, setActionMovies] = useState<TmdbMovie[]>([]);
  const [sciFiMovies, setSciFiMovies] = useState<TmdbMovie[]>([]);
  const [catalogMovies, setCatalogMovies] = useState<TmdbMovie[]>([]);

  const [activeGenre, setActiveGenre] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMovie, setSelectedMovie] = useState<TmdbMovie | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [myList, setMyList] = useState<TmdbMovie[]>(() =>
    loadStorage(STORAGE_MY_LIST, [])
  );
  const [likedList, setLikedList] = useState<TmdbMovie[]>(() =>
    loadStorage(STORAGE_LIKED, [])
  );

  const catalogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MY_LIST, JSON.stringify(myList));
    } catch {}
  }, [myList]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_LIKED, JSON.stringify(likedList));
    } catch {}
  }, [likedList]);

  useEffect(() => {
    let active = true;

    Promise.all([
      fetchTmdbMovies("/trending/movie/week"),
      fetchTmdbMovies("/movie/top_rated"),
      fetchTmdbMovies("/discover/movie?with_genres=28&sort_by=popularity.desc"),
      fetchTmdbMovies("/discover/movie?with_genres=878&sort_by=popularity.desc"),
    ])
      .then(([trending, topRated, action, sciFi]) => {
        if (!active) return;
        setTrendingMovies(trending);
        setTopRatedMovies(topRated);
        setActionMovies(action);
        setSciFiMovies(sciFi);
        setCatalogMovies(trending);
      })
      .catch((err) => {
        console.error("Failed to load TMDB movies:", err);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleGenreChange = async (genre: string) => {
    setActiveGenre(genre);
    setSearchQuery("");
    const path = genrePaths[genre] || "/trending/movie/week";
    try {
      const movies = await fetchTmdbMovies(path);
      setCatalogMovies(movies);
    } catch (err) {
      console.error("Genre fetch error:", err);
    }
  };

  const handleSearchChange = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      handleGenreChange(activeGenre);
      return;
    }
    try {
      const results = await searchTmdbMovies(query.trim());
      setCatalogMovies(results);
    } catch (err) {
      console.error("Search error:", err);
    }
  };

  const scrollToCatalog = () => {
    catalogRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSelectMovie = (movie: TmdbMovie) => {
    setSelectedMovie(movie);
    setIsModalOpen(true);
  };

  const handlePlayMovie = (movie: TmdbMovie) => {
    setSelectedMovie(movie);
    setIsModalOpen(true);
  };

  const handleToggleMyList = (movie: TmdbMovie) => {
    setMyList((prev) =>
      prev.some((m) => m.id === movie.id)
        ? prev.filter((m) => m.id !== movie.id)
        : [movie, ...prev]
    );
  };

  const handleToggleLiked = (movie: TmdbMovie) => {
    setLikedList((prev) =>
      prev.some((m) => m.id === movie.id)
        ? prev.filter((m) => m.id !== movie.id)
        : [movie, ...prev]
    );
  };

  const heroMovie = trendingMovies[0] || null;

  return (
    <div className="min-h-screen bg-background text-white selection:bg-white selection:text-black">
      <Header
        onExit={onExit}
        onStreamNow={scrollToCatalog}
        onSearchClick={scrollToCatalog}
        onMyListClick={scrollToCatalog}
        myListCount={myList.length}
      />

      <main>
        <div className="relative z-10 bg-background">
          <Hero
            heroMovie={heroMovie}
            onStreamNow={scrollToCatalog}
            onPlayMovie={handlePlayMovie}
          />
          <Usps />
        </div>

        <VideoCarousel
          tmdbMovies={trendingMovies}
          onSelectMovie={handleSelectMovie}
          onPlayMovie={handlePlayMovie}
        />

        <MovieCatalog
          catalogRef={catalogRef}
          trendingMovies={trendingMovies}
          topRatedMovies={topRatedMovies}
          actionMovies={actionMovies}
          sciFiMovies={sciFiMovies}
          catalogMovies={catalogMovies}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onSelectMovie={handleSelectMovie}
          onPlayMovie={handlePlayMovie}
          onToggleMyList={handleToggleMyList}
          onToggleLiked={handleToggleLiked}
          myList={myList}
          likedList={likedList}
          activeGenre={activeGenre}
          onGenreChange={handleGenreChange}
          genreList={GENRES}
        />

        <footer className="border-t border-white/10 bg-backgroundContrast px-6 py-12 text-center text-xs text-fog-500">
          <div className="mx-auto max-w-[980px] space-y-4">
            <p className="text-sm font-semibold text-white">
              EetNet Movies · Cinematic Entertainment Engine
            </p>
            <p>
              This product uses the TMDB API but is not endorsed or certified by TMDB.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-white/60">
              <span>Privacy Policy</span>
              <span>Terms of Use</span>
              <span>Support</span>
              <span>Feedback</span>
            </div>
            <p className="text-[11px] text-white/40">
              © {new Date().getFullYear()} EetNet. All rights reserved.
            </p>
          </div>
        </footer>
      </main>

      <MovieModal
        movie={selectedMovie}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPlayMovie={handlePlayMovie}
        onToggleMyList={handleToggleMyList}
        onToggleLiked={handleToggleLiked}
        isListed={selectedMovie ? myList.some((m) => m.id === selectedMovie.id) : false}
        isLiked={selectedMovie ? likedList.some((m) => m.id === selectedMovie.id) : false}
        onSelectSimilar={(m) => setSelectedMovie(m)}
      />
    </div>
  );
}
