import { useEffect, useRef, useState } from "react";
import { Header } from "./components/header";
import { Hero } from "./components/hero";
import { Usps } from "./components/usps";
import { VideoCarousel } from "./components/video-carousel";
import { MovieCatalog } from "./components/movie-catalog";
import { MovieModal } from "./components/movie-modal";
import {
  fetchMoviesHome,
  fetchMovieCatalog,
  type MovieSummary,
} from "../../shared/api/movies";
import type { TmdbMovie } from "./api/tmdb";

const GENRES = [
  "All",
  "Bollywood",
  "Hollywood",
  "Hindi Dubbed",
  "Action",
  "Web Series",
  "Romance",
  "Thriller",
  "Comedy",
  "Horror",
];

const categoryIdMap: Record<string, number | undefined> = {
  All: undefined,
  Bollywood: 10,
  Hollywood: 19,
  "Hindi Dubbed": 17,
  Action: 6,
  "Web Series": 33,
  Romance: 24,
  Thriller: 28,
  Comedy: 11,
  Horror: 20,
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
  const [heroMovie, setHeroMovie] = useState<TmdbMovie | null>(null);

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

    fetchMoviesHome()
      .then((data: any) => {
        if (!active) return;
        const trending = (data.trending || []) as unknown as TmdbMovie[];
        const bollywood = (data.bollywood || []) as unknown as TmdbMovie[];
        const hindiDubbed = (data.hindiDubbed || []) as unknown as TmdbMovie[];
        const hollywood = (data.hollywood || []) as unknown as TmdbMovie[];
        const featured = (data.featured || trending[0] || null) as unknown as TmdbMovie | null;

        setTrendingMovies(trending);
        setTopRatedMovies(bollywood);
        setActionMovies(hindiDubbed);
        setSciFiMovies(hollywood);
        setCatalogMovies(trending);
        setHeroMovie(featured);
      })
      .catch((err: any) => {
        console.error("Failed to load MoviePlex movies:", err);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleGenreChange = async (genre: string) => {
    setActiveGenre(genre);
    setSearchQuery("");
    const catId = categoryIdMap[genre];
    try {
      const movies = await fetchMovieCatalog({ category: catId, limit: 36 });
      setCatalogMovies(movies as unknown as TmdbMovie[]);
    } catch (err) {
      console.error("MoviePlex genre fetch error:", err);
    }
  };

  const handleSearchChange = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      handleGenreChange(activeGenre);
      return;
    }
    try {
      const results = await fetchMovieCatalog({ search: query.trim(), limit: 40 });
      setCatalogMovies(results as unknown as TmdbMovie[]);
    } catch (err) {
      console.error("MoviePlex search error:", err);
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

  const currentHero = heroMovie || trendingMovies[0] || null;

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
            heroMovie={currentHero}
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
