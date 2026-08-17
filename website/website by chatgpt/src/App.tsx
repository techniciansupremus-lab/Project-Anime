import { useEffect, useState } from "react";
import { SiteNav, type NavigationPage } from "./shared/components/site-nav";
import { HomePage } from "./pages/home/home-page";
import { AnimePage } from "./pages/anime/anime-page";
import { AnimeDetail } from "./pages/anime/detail/anime-detail";
import { PlayerScreen } from "./pages/anime/player/player-screen";
import { MoviesPage } from "./pages/movies/movies-page";
import { DramaPage } from "./pages/drama/drama-page";
import { ComicsPage } from "./pages/comics/comics-page";
import {
  ComicReaderPage,
  ComicSeriesPage,
} from "./pages/comics/comic-reading-flow";
import type { AnimeEpisode, AnimeMedia } from "./shared/api/anime";
import type { ComicChapter, ComicSummary } from "./shared/api/comics";

type View =
  | NavigationPage
  | "detail"
  | "player"
  | "comic-series"
  | "comic-reader";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [returnView, setReturnView] = useState<
    "home" | "anime" | "drama" | "movies"
  >("home");

  // Anime state
  const [selectedAnime, setSelectedAnime] = useState<AnimeMedia | null>(null);
  const [animeEpisodes, setAnimeEpisodes] = useState<AnimeEpisode[]>([]);
  const [episode, setEpisode] = useState(1);
  const [dub, setDub] = useState<"sub" | "eng" | "hin">("sub");

  // Comic state
  const [comic, setComic] = useState<ComicSummary | null>(null);
  const [comicChapters, setComicChapters] = useState<ComicChapter[]>([]);
  const [chapterId, setChapterId] = useState<string>("");
  const [chapterNumber, setChapterNumber] = useState(1);

  const activePage: NavigationPage =
    view === "detail" || view === "player"
      ? returnView
      : view === "comic-series" || view === "comic-reader"
      ? "comics"
      : view;

  const openAnimeDetail = (anime: AnimeMedia, from: "home" | "anime" = "anime") => {
    setSelectedAnime(anime);
    setReturnView(from);
    setView("detail");
  };

  const openPlayer = (
    selectedEpisode: number,
    selectedDub: "sub" | "eng" | "hin" = "sub",
    anime?: AnimeMedia,
    episodes?: AnimeEpisode[]
  ) => {
    setEpisode(selectedEpisode);
    setDub(selectedDub);
    if (anime) setSelectedAnime(anime);
    if (episodes) setAnimeEpisodes(episodes);
    setView("player");
  };

  const openComic = (selectedComic: ComicSummary) => {
    setComic(selectedComic);
    setView("comic-series");
  };

  const openComicReader = (
    selectedChapterId: string,
    selectedChapterNumber: number,
    chapters: ComicChapter[]
  ) => {
    setChapterId(selectedChapterId);
    setChapterNumber(selectedChapterNumber);
    setComicChapters(chapters);
    setView("comic-reader");
  };

  const navigate = (page: NavigationPage) => {
    setView(page);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  return (
    <main id="top" className="min-h-screen bg-ink-950 text-paper-100">
      {/* SiteNav is hidden on full immersion pages */}
      {view !== "movies" &&
        view !== "comics" &&
        view !== "comic-series" &&
        view !== "comic-reader" && (
          <SiteNav activePage={activePage} onNavigate={navigate} />
        )}

      {view === "home" && (
        <HomePage
          onOpen={() => setView("anime")}
          onOpenAnime={(anime) => openAnimeDetail(anime, "home")}
        />
      )}

      {view === "anime" && (
        <AnimePage
          onBack={() => setView("home")}
          onOpen={(anime) => openAnimeDetail(anime, "anime")}
        />
      )}

      {view === "movies" && <MoviesPage onExit={() => setView("home")} />}

      {view === "drama" && (
        <DramaPage
          onBack={() => setView("home")}
          onOpen={() => setView("drama")}
        />
      )}

      {view === "comics" && (
        <ComicsPage onExit={() => setView("home")} onOpen={openComic} />
      )}

      {view === "comic-series" && comic && (
        <ComicSeriesPage
          comic={comic}
          onBack={() => setView("comics")}
          onRead={openComicReader}
        />
      )}

      {view === "comic-reader" && comic && (
        <ComicReaderPage
          comic={comic}
          chapterId={chapterId}
          chapterNumber={chapterNumber}
          chapters={comicChapters}
          onBack={() => setView("comic-series")}
          onChangeChapter={(nextId, nextNum) => {
            setChapterId(nextId);
            setChapterNumber(nextNum);
          }}
        />
      )}

      {view === "detail" && (
        <AnimeDetail
          anime={selectedAnime}
          onBack={() => setView(returnView)}
          onPlayEpisode={openPlayer}
        />
      )}

      {view === "player" && (
        <PlayerScreen
          anime={selectedAnime}
          episode={episode}
          dub={dub}
          episodes={animeEpisodes}
          onBack={() => setView("detail")}
          onSelectEpisode={(ep) => setEpisode(ep)}
        />
      )}
    </main>
  );
}
