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
} from "../../shared/api/movies";
import {
  enrichMoviesList,
  enrichMovieWithTmdb,
  type TmdbMovie,
} from "./api/tmdb";

const GENRES = [
  "All",
  "Bollywood",
  "Hindi Dubbed",
  "Hollywood",
  "Web Series",
  "Action",
  "Drama",
  "Romance",
  "Thriller",
  "Comedy",
  "Horror",
  "Punjabi",
  "Tamil",
  "Telugu",
];

const categoryKeyMap: Record<string, string | undefined> = {
  All: undefined,
  Bollywood: "desi_cinema",
  "Hindi Dubbed": "hindi_dubbed",
  Hollywood: "hollywood",
  "Web Series": "series",
  Action: "action",
  Drama: "drama",
  Romance: "romance",
  Thriller: "thriller",
  Comedy: "comedy",
  Horror: "horror",
  Punjabi: "punjabi",
  Tamil: "tamil",
  Telugu: "telugu",
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
      .then(async (data) => {
        if (!active) return;
        const [trending, bollywood, hindiDubbed, webSeries] = await Promise.all([
          enrichMoviesList(data.trending || []),
          enrichMoviesList(data.bollywood || []),
          enrichMoviesList(data.hindiDubbed || []),
          enrichMoviesList(data.webSeries || []),
        ]);

        if (!active) return;
        const featured = data.featured
          ? await enrichMovieWithTmdb(data.featured)
          : trending[0] || null;

        setTrendingMovies(trending);
        setTopRatedMovies(bollywood);
        setActionMovies(hindiDubbed);
        setSciFiMovies(webSeries);
        setCatalogMovies(trending);
        setHeroMovie(featured);
      })
      .catch((err) => {
        console.error("Failed to load DesiCinemas movies:", err);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleGenreChange = async (genre: string) => {
    setActiveGenre(genre);
    setSearchQuery("");
    const catKey = categoryKeyMap[genre];
    try {
      if (!catKey) {
        const homeData = await fetchMoviesHome();
        const enriched = await enrichMoviesList(homeData.trending || []);
        setCatalogMovies(enriched);
      } else {
        const movies = await fetchMovieCatalog({ category: catKey, limit: 36 });
        const enriched = await enrichMoviesList(movies);
        setCatalogMovies(enriched);
      }
    } catch (err) {
      console.error("DesiCinemas genre fetch error:", err);
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
      const enriched = await enrichMoviesList(results);
      setCatalogMovies(enriched);
    } catch (err) {
      console.error("DesiCinemas search error:", err);
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
      prev.some((m) => String(m.id) === String(movie.id))
        ? prev.filter((m) => String(m.id) !== String(movie.id))
        : [movie, ...prev]
    );
  };

  const handleToggleLiked = (movie: TmdbMovie) => {
    setLikedList((prev) =>
      prev.some((m) => String(m.id) === String(movie.id))
        ? prev.filter((m) => String(m.id) !== String(movie.id))
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
              EetNet Cinema · Powered by DesiCinemas & TMDB
            </p>
            <p>
              High-definition streaming engine for Bollywood, Hollywood, and regional blockbusters.
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
        isListed={selectedMovie ? myList.some((m) => String(m.id) === String(selectedMovie.id)) : false}
        isLiked={selectedMovie ? likedList.some((m) => String(m.id) === String(selectedMovie.id)) : false}
        onSelectSimilar={(m) => setSelectedMovie(m)}
      />
    </div>
  );
}
