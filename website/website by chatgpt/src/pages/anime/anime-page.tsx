import { ArrowLeft, Loader2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { DiscoveryCard } from "../home/components/discovery-card";
import { Button } from "../../shared/components/button";
import {
  fetchAnimeByGenre,
  fetchTrendingAnime,
  searchAnime,
  type AnimeMedia,
} from "../../shared/api/anime";

const animeGenres = [
  "All",
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
];

type AnimePageProps = {
  onBack: () => void;
  onOpen: (anime: AnimeMedia) => void;
};

export function AnimePage({ onBack, onOpen }: AnimePageProps) {
  const [query, setQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [animeList, setAnimeList] = useState<AnimeMedia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    async function loadData() {
      try {
        let results: AnimeMedia[] = [];
        if (query.trim()) {
          results = await searchAnime(query.trim());
        } else if (selectedGenre === "All") {
          results = await fetchTrendingAnime(1, 24);
        } else {
          results = await fetchAnimeByGenre(selectedGenre, 1, 24);
        }
        if (active) {
          setAnimeList(results);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load anime:", err);
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [selectedGenre, query]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <section className="bg-ink-950 py-10 sm:py-16 min-h-screen">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12">
        <button
          className="inline-flex items-center gap-2 font-body text-sm text-fog-500 transition-[transform,opacity,color] duration-200 hover:-translate-y-0.5 hover:text-paper-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          onClick={onBack}
        >
          <ArrowLeft size={17} strokeWidth={1.7} />
          Home
        </button>

        <header className="streaming-hero-reveal mt-16">
          <h1 className="max-w-4xl font-body text-[49px] font-medium leading-[51px] tracking-[-0.055em] text-paper-100 sm:text-[61px] sm:leading-[63px]">
            The greatest worlds{" "}
            <span className="bg-gradient-to-r from-paper-100 via-gold-500 to-fog-500 bg-clip-text text-transparent">
              beyond imagination
            </span>
          </h1>
          <p className="mt-2 max-w-4xl font-body text-[25px] font-medium leading-[30px] tracking-[-0.045em] text-fog-500 sm:text-[31px] sm:leading-[37px]">
            Action, romance, and fantasy streaming right to your screen
          </p>
          <form
            className="mt-8 flex w-full max-w-md items-center gap-2 rounded-full bg-ink-800 p-1.5"
            onSubmit={submitSearch}
          >
            <input
              className="min-w-0 flex-1 bg-transparent px-4 font-body text-sm text-paper-100 outline-none placeholder:text-fog-500"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Anime (e.g. Solo Leveling, Demon Slayer)..."
              aria-label="Search Anime"
            />
            <Button
              className="mb-1 h-10 rounded-full border border-paper-100 bg-paper-100 px-5 text-ink-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_4px_0_#56616A,0_8px_14px_rgba(0,0,0,0.34)] transition-[transform,box-shadow,opacity] hover:translate-y-px hover:bg-paper-100 hover:opacity-90 active:translate-y-[3px]"
              type="submit"
            >
              Search
            </Button>
          </form>
          <p className="mt-3 font-body text-sm text-fog-500">
            Over 10,000+ Anime Series &amp; Movies streaming in HD
          </p>
        </header>

        <header className="mt-20 border-b border-ink-700 pb-8">
          <p className="font-body text-xs font-medium uppercase tracking-[0.16em] text-gold-500">
            Live Anime Catalogue
          </p>
          <p className="mt-2 font-body text-sm text-fog-500">
            Japanese animation with English Sub/Dub &amp; Hindi Dub
          </p>
          <div className="mt-6 flex flex-wrap gap-2" aria-label="Anime genres">
            {animeGenres.map((genre) => {
              const active = selectedGenre === genre;
              return (
                <button
                  key={genre}
                  className={`mb-1 rounded-full border px-4 py-2 font-body text-sm transition-[transform,box-shadow,background-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 ${
                    active
                      ? "border-paper-100 bg-paper-100 text-ink-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_4px_0_#56616A,0_8px_14px_rgba(0,0,0,0.34)] hover:translate-y-px"
                      : "border-[#35414A] bg-ink-800 text-fog-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_3px_0_#0A0C0E,0_6px_10px_rgba(0,0,0,0.26)] hover:-translate-y-px hover:border-fog-500 hover:text-paper-100"
                  }`}
                  onClick={() => {
                    setSelectedGenre(genre);
                    setQuery("");
                  }}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </header>

        {loading ? (
          <div className="grid place-items-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-gold-500" />
            <p className="mt-4 font-body text-sm text-fog-500">Connecting to Anime catalogue...</p>
          </div>
        ) : animeList.length === 0 ? (
          <div className="py-20 text-center text-fog-500">
            <p>No anime found matching your query.</p>
          </div>
        ) : (
          <div className="anime-gallery streaming-grid-reveal mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 lg:gap-x-6 xl:grid-cols-4 xl:gap-x-8">
            {animeList.map((anime) => {
              const title = anime.title.english || anime.title.romaji || "Anime";
              const cover = anime.coverImage?.extraLarge || anime.coverImage?.large || "";
              const details = [
                anime.seasonYear,
                anime.format,
                anime.episodes ? `${anime.episodes} eps` : null,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <DiscoveryCard
                  key={anime.id}
                  className="w-full sm:w-full"
                  visualStyle="gallery"
                  title={title}
                  detail={details || "Japanese Animation"}
                  image={cover}
                  imagePosition="center"
                  onOpen={() => onOpen(anime)}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
