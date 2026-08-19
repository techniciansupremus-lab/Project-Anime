import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Search,
  Star,
  ThumbsUp,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  fetchDramaHome,
  fetchDramaInfo,
  fetchDramaStream,
  searchDramas,
  type DramaDetail,
  type DramaEpisode,
  type DramaHomeData,
  type DramaStreamResult,
  type DramaSummary,
} from "../../shared/api/drama";
import { VideoPlayer } from "../../shared/components/video-player";

// Curated Asian Drama demo data so the Netflix UI is never empty even if backend is starting
const FALLBACK_DRAMAS: Record<string, DramaSummary[]> = {
  trending: [
    {
      id: "queen-of-tears",
      title: "Queen of Tears",
      thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80",
      episodesCount: 16,
      rating: "9.8",
      description: "The queen of department stores and her small-town husband weather a marital crisis — until love miraculously begins to bloom again.",
    },
    {
      id: "crash-landing-on-you",
      title: "Crash Landing on You",
      thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80",
      episodesCount: 16,
      rating: "9.9",
      description: "A paragliding mishap drops a South Korean heiress in North Korea — and into the life of an army officer, who decides he will help her hide.",
    },
    {
      id: "the-glory",
      title: "The Glory",
      thumbnail: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80",
      episodesCount: 16,
      rating: "9.7",
      description: "Years after surviving horrific abuse in high school, a woman puts an elaborate revenge scheme in motion to make the perpetrators pay for their crimes.",
    },
    {
      id: "all-of-us-are-dead",
      title: "All of Us Are Dead",
      thumbnail: "https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80",
      episodesCount: 12,
      rating: "9.5",
      description: "A high school becomes ground zero for a zombie virus outbreak. Trapped students must fight their way out — or turn into one of the rabid infected.",
    },
    {
      id: "alchemy-of-souls",
      title: "Alchemy of Souls",
      thumbnail: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80",
      episodesCount: 30,
      rating: "9.6",
      description: "A powerful sorceress in a blind woman's body encounters a man from a prestigious family, who wants her help to change his destiny.",
    },
    {
      id: "hidden-love",
      title: "Hidden Love",
      thumbnail: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=80",
      episodesCount: 25,
      rating: "9.8",
      description: "Sang Zhi falls in love with Duan Jiaxu, the boy who often comes to her house to play games with her older brother.",
    },
  ],
  korean: [
    {
      id: "squid-game",
      title: "Squid Game",
      thumbnail: "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=800&auto=format&fit=crop&q=80",
      episodesCount: 9,
      rating: "9.9",
      description: "Hundreds of cash-strapped players accept a strange invitation to compete in children's games. Inside, a tempting prize awaits with deadly high stakes.",
    },
    {
      id: "goblin",
      title: "Guardian: The Lonely and Great God",
      thumbnail: "https://images.unsplash.com/photo-1569701813229-33284b643e3c?w=800&auto=format&fit=crop&q=80",
      episodesCount: 16,
      rating: "9.8",
      description: "An immortal goblin must find his human bride to finally end his cursed eternal life.",
    },
    {
      id: "vincenzo",
      title: "Vincenzo",
      thumbnail: "https://images.unsplash.com/photo-1608889825205-eebdb9fc5806?w=800&auto=format&fit=crop&q=80",
      episodesCount: 20,
      rating: "9.7",
      description: "During a visit to his motherland, a Korean-Italian mafia lawyer gives an unrivaled conglomerate a taste of its own medicine with side of justice.",
    },
    {
      id: "itaewon-class",
      title: "Itaewon Class",
      thumbnail: "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=800&auto=format&fit=crop&q=80",
      episodesCount: 16,
      rating: "9.6",
      description: "In a colorful Seoul neighborhood, an ex-con and his friends fight against a mighty competitor to make their ambitious dreams for their street bar a reality.",
    },
  ],
  chinese: [
    {
      id: "love-between-fairy-and-devil",
      title: "Love Between Fairy and Devil",
      thumbnail: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=80",
      episodesCount: 36,
      rating: "9.8",
      description: "A low-ranking fairy accidentally resurrects a fierce demon lord, inadvertently linking their souls together.",
    },
    {
      id: "till-the-end-of-the-moon",
      title: "Till the End of the Moon",
      thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80",
      episodesCount: 40,
      rating: "9.7",
      description: "To save the mortal realm from destruction, a cultivator travels back in time 500 years to prevent the devil lord's ascension.",
    },
  ],
};

function NetflixRow({
  title,
  items,
  isTop10 = false,
  onSelect,
}: {
  title: string;
  items: DramaSummary[];
  isTop10?: boolean;
  onSelect: (item: DramaSummary) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = rowRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [items]);

  const slide = (dir: -1 | 1) => {
    rowRef.current?.scrollBy({
      left: rowRef.current.clientWidth * 0.75 * dir,
      behavior: "smooth",
    });
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="relative my-6 px-4 sm:px-12 group/row">
      <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide mb-3 flex items-center gap-3">
        <span>{title}</span>
        <span className="text-xs font-semibold text-red-600 uppercase tracking-widest hidden sm:inline">
          Explore All &gt;
        </span>
      </h2>

      <div className="relative">
        {/* Left Slider Arrow */}
        {canScrollLeft && (
          <button
            onClick={() => slide(-1)}
            className="absolute left-0 inset-y-0 z-30 w-12 bg-black/70 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all rounded-r"
            aria-label="Scroll left"
          >
            <ChevronLeft size={30} />
          </button>
        )}

        {/* Slider Track */}
        <div
          ref={rowRef}
          onScroll={checkScroll}
          className="flex gap-2 sm:gap-3 overflow-x-auto scroll-smooth py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item, index) => (
            <div
              key={item.id}
              onClick={() => onSelect(item)}
              className="relative shrink-0 cursor-pointer group/card transition-all duration-300 hover:scale-105 hover:z-20 rounded-md overflow-hidden bg-zinc-900 shadow-lg"
              style={{
                width: isTop10 ? "15rem" : "16.5rem",
                height: isTop10 ? "10rem" : "9.5rem",
              }}
            >
              {isTop10 && (
                <span className="absolute -left-2 -bottom-4 text-[100px] font-black leading-none text-zinc-800 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] select-none z-10 stroke-zinc-600 pointer-events-none">
                  {index + 1}
                </span>
              )}

              <img
                src={item.thumbnail}
                alt={item.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80";
                }}
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-80 group-hover/card:opacity-95 transition-opacity" />

              {/* Card Meta on hover */}
              <div className="absolute inset-x-0 bottom-0 p-3 z-20">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="bg-red-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded-sm uppercase tracking-tighter">
                    N SERIES
                  </span>
                  {item.rating && (
                    <span className="text-green-400 text-xs font-bold">
                      {item.rating} Match
                    </span>
                  )}
                  <span className="border border-zinc-500 text-zinc-300 text-[9px] px-1 rounded-sm">
                    HD
                  </span>
                </div>
                <p className="text-white font-bold text-sm truncate">{item.title}</p>
                <p className="text-zinc-400 text-xs mt-0.5">
                  {item.episodesCount ? `${item.episodesCount} Episodes` : "Asian Drama"}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Right Slider Arrow */}
        {canScrollRight && (
          <button
            onClick={() => slide(1)}
            className="absolute right-0 inset-y-0 z-30 w-12 bg-black/70 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all rounded-l"
            aria-label="Scroll right"
          >
            <ChevronRight size={30} />
          </button>
        )}
      </div>
    </div>
  );
}

export function DramaPage({
  onBack,
  onOpen,
}: {
  onBack?: () => void;
  onOpen?: () => void;
}) {
  const [data, setData] = useState<DramaHomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DramaSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Selected drama for Netflix detail modal
  const [selectedDrama, setSelectedDrama] = useState<DramaSummary | null>(null);
  const [dramaDetails, setDramaDetails] = useState<DramaDetail | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Active streaming episode
  const [activeEpisode, setActiveEpisode] = useState<DramaEpisode | null>(null);
  const [streamResult, setStreamResult] = useState<DramaStreamResult | null>(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    fetchDramaHome()
      .then((res) => {
        if (!active) return;
        if (res && (res.show?.length || res.korean?.length || res.chinese?.length)) {
          setData(res);
        } else {
          // Use fallback demo catalog if backend is not yet active
          setData({
            show: FALLBACK_DRAMAS.trending,
            korean: FALLBACK_DRAMAS.korean,
            chinese: FALLBACK_DRAMAS.chinese,
            topRating: FALLBACK_DRAMAS.trending,
            lastUpdate: FALLBACK_DRAMAS.korean,
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.warn("Drama fetch error, using fallback catalog:", err);
        if (!active) return;
        setData({
          show: FALLBACK_DRAMAS.trending,
          korean: FALLBACK_DRAMAS.korean,
          chinese: FALLBACK_DRAMAS.chinese,
          topRating: FALLBACK_DRAMAS.trending,
          lastUpdate: FALLBACK_DRAMAS.korean,
        });
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchDramas(searchQuery.trim());
      if (results && results.length > 0) {
        setSearchResults(results);
      } else {
        // Fallback filter
        const q = searchQuery.toLowerCase();
        const filtered = [
          ...FALLBACK_DRAMAS.trending,
          ...FALLBACK_DRAMAS.korean,
          ...FALLBACK_DRAMAS.chinese,
        ].filter((d) => d.title.toLowerCase().includes(q));
        setSearchResults(filtered);
      }
    } catch (err) {
      console.error("Drama search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectDrama = async (drama: DramaSummary) => {
    setSelectedDrama(drama);
    setDetailsLoading(true);
    setDramaDetails(null);
    setActiveEpisode(null);
    setStreamResult(null);

    try {
      const details = await fetchDramaInfo(drama.id);
      setDramaDetails(details);
    } catch (err) {
      console.warn("Could not fetch drama info from API, generating episode list:", err);
      // Fallback episodes
      const count = Number(drama.episodesCount) || 16;
      setDramaDetails({
        id: drama.id,
        title: drama.title,
        description: drama.description || "Stream all episodes in full HD with multi-language subtitles.",
        thumbnail: drama.thumbnail,
        status: "Completed",
        episodes: Array.from({ length: count }, (_, i) => ({
          id: `${drama.id}-ep-${i + 1}`,
          number: i + 1,
        })),
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  const handlePlayEpisode = async (episode: DramaEpisode) => {
    setActiveEpisode(episode);
    setStreamLoading(true);
    setStreamError(null);

    try {
      const stream = await fetchDramaStream(episode.id);
      setStreamResult(stream);
    } catch (err: any) {
      console.error("Drama stream error:", err);
      setStreamError(err.message || "Failed to load episode stream.");
    } finally {
      setStreamLoading(false);
    }
  };

  const heroItem =
    data?.show?.[0] ||
    FALLBACK_DRAMAS.trending[0];

  return (
    <section className="min-h-screen bg-[#141414] text-white font-sans pb-24 select-none">
      {/* Netflix Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-gradient-to-b from-black/90 via-black/60 to-transparent px-4 sm:px-12 py-4 flex items-center justify-between backdrop-blur-sm">
        <div className="flex items-center gap-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            <span>Home</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-red-600 font-black text-2xl tracking-tighter">
              NETFLIX
            </span>
            <span className="bg-red-600 text-black text-[10px] font-black px-1.5 py-0.5 rounded">
              DRAMA
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-zinc-300">
            <span className="text-white font-bold cursor-pointer">Korean Dramas</span>
            <span className="hover:text-white cursor-pointer">Chinese Dramas</span>
            <span className="hover:text-white cursor-pointer">Romantic Shows</span>
            <span className="hover:text-white cursor-pointer">Top 10 Today</span>
          </nav>
        </div>

        {/* Search Bar */}
        <form
          onSubmit={handleSearch}
          className="flex items-center gap-2 bg-black/60 border border-zinc-700 rounded-full px-3 py-1.5 focus-within:border-white transition-colors"
        >
          <Search size={16} className="text-zinc-400" />
          <input
            className="bg-transparent text-xs text-white outline-none w-36 sm:w-56 placeholder:text-zinc-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Titles, people, genres..."
          />
          {isSearching && <Loader2 size={14} className="animate-spin text-red-600" />}
        </form>
      </header>

      {/* Netflix Billboard Hero Banner */}
      {heroItem && (
        <div className="relative h-[65vh] sm:h-[80vh] w-full overflow-hidden -mt-16">
          <img
            src={heroItem.thumbnail}
            alt={heroItem.title}
            className="w-full h-full object-cover object-[center_30%]"
          />
          {/* Netflix Vignette Gradients */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/70 to-transparent w-full sm:w-[65%]" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#141414] via-[#141414]/80 to-transparent" />

          {/* Hero Content */}
          <div className="absolute inset-x-0 bottom-16 sm:bottom-24 px-4 sm:px-12 max-w-2xl z-20">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-red-600 text-white font-black text-xs px-2 py-0.5 rounded-sm uppercase tracking-wider">
                N SERIES
              </span>
              <span className="text-zinc-400 text-xs uppercase font-bold tracking-widest">
                Top 10 Asian Drama
              </span>
            </div>

            <h1 className="text-3xl sm:text-6xl font-black tracking-tight text-white drop-shadow-2xl">
              {heroItem.title}
            </h1>

            <p className="mt-3 text-sm sm:text-base text-zinc-300 line-clamp-3 leading-relaxed drop-shadow">
              {heroItem.description ||
                "A captivating story of passion, ambition, and fate. Watch all full episodes with crystal clear multi-language subtitles."}
            </p>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => handleSelectDrama(heroItem)}
                className="flex items-center gap-2 bg-white text-black font-bold text-sm sm:text-base px-6 py-2.5 rounded hover:bg-white/90 transition-all shadow-xl active:scale-95"
              >
                <Play size={20} fill="currentColor" />
                <span>Play</span>
              </button>

              <button
                onClick={() => handleSelectDrama(heroItem)}
                className="flex items-center gap-2 bg-zinc-600/80 text-white font-bold text-sm sm:text-base px-6 py-2.5 rounded hover:bg-zinc-600 transition-all shadow-xl backdrop-blur"
              >
                <Info size={20} />
                <span>More Info</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Results if any */}
      {searchResults.length > 0 && (
        <div className="px-4 sm:px-12 my-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            Search Results ({searchResults.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {searchResults.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectDrama(item)}
                className="cursor-pointer group relative aspect-[16/10] rounded overflow-hidden bg-zinc-900 hover:scale-105 transition-transform"
              >
                <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                <p className="absolute bottom-2 left-2 right-2 text-xs font-bold text-white truncate">
                  {item.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Netflix Horizontal Drama Rows */}
      <div className="-mt-12 relative z-20 space-y-4">
        <NetflixRow
          title="🏆 Top 10 in Drama Today"
          items={data?.show || FALLBACK_DRAMAS.trending}
          isTop10
          onSelect={handleSelectDrama}
        />
        <NetflixRow
          title="🇰🇷 Popular Korean Dramas"
          items={data?.korean || FALLBACK_DRAMAS.korean}
          onSelect={handleSelectDrama}
        />
        <NetflixRow
          title="🇨🇳 Trending Chinese Dramas"
          items={data?.chinese || FALLBACK_DRAMAS.chinese}
          onSelect={handleSelectDrama}
        />
        <NetflixRow
          title="⭐ Highest Rated Series"
          items={data?.topRating || FALLBACK_DRAMAS.trending}
          onSelect={handleSelectDrama}
        />
        <NetflixRow
          title="🕒 Recently Updated Episodes"
          items={data?.lastUpdate || FALLBACK_DRAMAS.korean}
          onSelect={handleSelectDrama}
        />
      </div>

      {/* Netflix Modal: Detail & Video Player */}
      {selectedDrama && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-xl bg-[#181818] text-white shadow-2xl overflow-hidden my-auto border border-zinc-800 max-h-[92vh] overflow-y-auto custom-scrollbar">
            {/* Close Button */}
            <button
              onClick={() => {
                setSelectedDrama(null);
                setActiveEpisode(null);
                setStreamResult(null);
              }}
              className="absolute right-4 top-4 z-30 grid h-9 w-9 place-items-center rounded-full bg-[#181818]/80 text-white border border-zinc-700 hover:bg-white hover:text-black transition-colors"
            >
              <X size={18} />
            </button>

            {/* Video Player or Backdrop Banner */}
            <div className="relative aspect-video w-full bg-black">
              {activeEpisode ? (
                streamLoading ? (
                  <div className="h-full w-full grid place-items-center bg-black">
                    <div className="text-center space-y-2">
                      <Loader2 className="mx-auto h-12 w-12 animate-spin text-red-600" />
                      <p className="text-sm font-semibold">Streaming Episode {activeEpisode.number}...</p>
                    </div>
                  </div>
                ) : streamError || !streamResult?.streamUrl ? (
                  <div className="h-full w-full grid place-items-center bg-zinc-900 p-6 text-center">
                    <div className="space-y-3">
                      <p className="font-bold text-red-400">Stream Not Available</p>
                      <p className="text-xs text-zinc-400">{streamError || "Unable to extract stream."}</p>
                    </div>
                  </div>
                ) : (
                  <VideoPlayer
                    src={streamResult.streamUrl}
                    title={`${selectedDrama.title} — Ep ${activeEpisode.number}`}
                    subtitles={streamResult.subtitles}
                  />
                )
              ) : (
                <>
                  <img
                    src={selectedDrama.thumbnail}
                    alt={selectedDrama.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
                    <div>
                      <h2 className="text-2xl sm:text-4xl font-black text-white drop-shadow">
                        {selectedDrama.title}
                      </h2>
                      <div className="mt-3 flex items-center gap-3">
                        {dramaDetails?.episodes?.[0] && (
                          <button
                            onClick={() => handlePlayEpisode(dramaDetails.episodes[0])}
                            className="flex items-center gap-2 bg-white text-black font-bold text-sm px-6 py-2.5 rounded hover:bg-white/90 shadow-xl"
                          >
                            <Play size={18} fill="currentColor" />
                            <span>Play Ep 1</span>
                          </button>
                        )}
                        <button className="grid h-10 w-10 place-items-center rounded-full border border-zinc-500 bg-zinc-900/80 hover:border-white">
                          <Plus size={18} />
                        </button>
                        <button className="grid h-10 w-10 place-items-center rounded-full border border-zinc-500 bg-zinc-900/80 hover:border-white">
                          <ThumbsUp size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-zinc-400">
                <span className="text-green-400 font-bold">98% Match</span>
                <span>2024</span>
                <span className="border border-zinc-600 px-1.5 py-0.5 rounded text-white text-xs">
                  HD
                </span>
                <span className="border border-zinc-600 px-1.5 py-0.5 rounded text-white text-xs">
                  5.1 Audio
                </span>
                <span>{dramaDetails?.episodes?.length || selectedDrama.episodesCount || 16} Episodes</span>
              </div>

              <p className="text-sm sm:text-base leading-relaxed text-zinc-300">
                {dramaDetails?.description || selectedDrama.description}
              </p>

              {/* Episodes Grid */}
              <div className="border-t border-zinc-800 pt-6">
                <h3 className="text-xl font-bold text-white mb-4">
                  Episodes ({dramaDetails?.episodes?.length || 0})
                </h3>

                {detailsLoading ? (
                  <div className="grid place-items-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-red-600" />
                    <p className="mt-2 text-xs text-zinc-400">Loading episodes...</p>
                  </div>
                ) : dramaDetails?.episodes?.length ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                    {dramaDetails.episodes.map((ep) => {
                      const isSelected = activeEpisode?.id === ep.id;
                      return (
                        <button
                          key={ep.id}
                          onClick={() => handlePlayEpisode(ep)}
                          className={`flex items-center justify-between p-3 rounded text-xs font-bold transition-all text-left ${
                            isSelected
                              ? "bg-red-600 text-white font-extrabold shadow"
                              : "bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                          }`}
                        >
                          <span>Episode {ep.number}</span>
                          <Play size={13} fill="currentColor" />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-sm">No episodes available.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
