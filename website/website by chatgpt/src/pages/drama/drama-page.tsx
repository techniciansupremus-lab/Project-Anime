import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Flame,
  Heart,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Search,
  Star,
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

function DramaCard({
  item,
  onClick,
}: {
  item: DramaSummary;
  onClick: () => void;
}) {
  return (
    <button
      className="streaming-card group relative h-[150px] w-[13.5rem] shrink-0 overflow-hidden rounded-lg border border-white/10 bg-ink-800 text-left transition-[transform,opacity,border-color] duration-200 hover:border-white/25 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E86D7B] sm:h-[165px] sm:w-[15rem]"
      onClick={onClick}
      aria-label={`Open ${item.title}`}
    >
      <img
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        src={item.thumbnail}
        alt={item.title}
        onError={(e) => {
          // Fallback image if thumbnail fails
          (e.target as HTMLElement).style.display = "none";
        }}
      />
      <span className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" aria-hidden />
      <span className="absolute inset-x-0 bottom-0 p-3">
        <span className="block truncate font-body text-sm font-semibold text-paper-100 group-hover:text-[#E86D7B] transition-colors">
          {item.title}
        </span>
        <span className="mt-1 flex items-center justify-between font-body text-xs text-fog-500">
          <span>{item.episodesCount ? `${item.episodesCount} episodes` : "Series"}</span>
          {item.rating && (
            <span className="flex items-center gap-0.5 text-gold-500 font-bold">
              ★ {item.rating}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function DramaRail({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: DramaSummary[];
  onSelect: (item: DramaSummary) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateEdges = () => {
    const el = rail.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [items]);

  const move = (direction: -1 | 1) =>
    rail.current?.scrollBy({ left: rail.current.clientWidth * direction * 0.72, behavior: "smooth" });

  if (!items || items.length === 0) return null;

  return (
    <section className="streaming-row-reveal mt-8" aria-label={title}>
      <h3 className="flex items-center gap-2 font-display text-xl font-bold text-paper-100">
        <span>{title}</span>
        <span className="text-xs font-mono font-normal text-fog-500">({items.length})</span>
      </h3>
      <div className="streaming-rail group/rail relative mt-3">
        {canScrollLeft && (
          <button
            className="absolute inset-y-0 left-0 z-30 hidden w-14 items-center justify-start bg-gradient-to-r from-ink-950 via-ink-950/80 to-transparent pl-1 text-paper-100 opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100 sm:flex"
            onClick={() => move(-1)}
            aria-label={`Scroll left ${title}`}
          >
            <span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-ink-800/95 shadow-xl">
              <ChevronLeft size={20} />
            </span>
          </button>
        )}
        <div
          ref={rail}
          onScroll={updateEdges}
          className="flex gap-3 overflow-x-auto scroll-smooth py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => (
            <DramaCard key={item.id} item={item} onClick={() => onSelect(item)} />
          ))}
        </div>
        {canScrollRight && (
          <button
            className="absolute inset-y-0 right-0 z-30 hidden w-14 items-center justify-end bg-gradient-to-l from-ink-950 via-ink-950/80 to-transparent pr-1 text-paper-100 opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100 sm:flex"
            onClick={() => move(1)}
            aria-label={`Scroll right ${title}`}
          >
            <span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-ink-800/95 shadow-xl">
              <ChevronRight size={20} />
            </span>
          </button>
        )}
      </div>
    </section>
  );
}

export function DramaPage({
  onOpen,
  onBack,
}: {
  onOpen?: () => void;
  onBack?: () => void;
}) {
  const [data, setData] = useState<DramaHomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DramaSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Selected drama for details modal
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
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Drama load error:", err);
        if (!active) return;
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
      setSearchResults(results);
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
      console.error("Failed to load drama info:", err);
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

  const heroItem = data?.show?.[0] || data?.korean?.[0] || null;

  return (
    <section className="min-h-screen bg-ink-950 pb-20 font-body text-paper-100">
      {onBack && (
        <div className="mx-auto max-w-[1440px] px-4 pt-6 sm:px-8 lg:px-12">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 font-body text-sm text-fog-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Home</span>
          </button>
        </div>
      )}

      {/* Hero Header */}
      {heroItem && (
        <section className="relative isolate min-h-[420px] overflow-hidden border-b border-ink-800 sm:min-h-[480px]">
          <img
            className="absolute inset-y-0 right-0 -z-20 h-full w-full object-cover object-[65%_30%] opacity-70 sm:w-[75%]"
            src={heroItem.thumbnail}
            alt={heroItem.title}
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-950 via-ink-950/90 to-ink-950/20" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-gradient-to-t from-ink-950 via-ink-950/10 to-transparent" />

          <div className="mx-auto max-w-[1440px] px-4 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:px-12">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.16em] text-[#E86D7B]">
              Asian Dramas &amp; Series (KissKH)
            </p>
            <h1 className="mt-3 max-w-2xl font-display text-[44px] leading-[0.95] tracking-display text-paper-100 sm:text-[58px]">
              {heroItem.title}
            </h1>
            <p className="mt-4 font-body text-sm text-fog-500">
              {heroItem.episodesCount ? `${heroItem.episodesCount} Episodes Available` : "Ongoing Asian Drama"} • Full HD Multi-Language Subtitles
            </p>

            <div className="mt-6 flex items-center gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-md bg-[#E86D7B] px-6 py-3 font-body text-sm font-semibold text-ink-950 shadow-xl transition-all hover:scale-105 active:scale-95"
                onClick={() => handleSelectDrama(heroItem)}
              >
                <Play size={17} fill="currentColor" />
                Watch Series
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12">
        {/* Live Search Bar */}
        <form onSubmit={handleSearch} className="mt-8 flex max-w-md items-center gap-2 rounded-full bg-ink-800 p-1.5 border border-ink-700">
          <input
            className="min-w-0 flex-1 bg-transparent px-4 font-body text-sm text-paper-100 outline-none placeholder:text-fog-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Korean, Chinese &amp; Thai dramas..."
          />
          <button
            type="submit"
            className="rounded-full bg-[#E86D7B] px-5 py-2 text-xs font-bold text-ink-950 hover:bg-[#E86D7B]/90 transition-all"
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : "Search"}
          </button>
        </form>

        {/* Search Results Display */}
        {searchResults.length > 0 && (
          <div className="mt-8">
            <h3 className="font-display text-xl font-bold text-paper-100">
              Search Results ({searchResults.length})
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {searchResults.map((item) => (
                <DramaCard key={item.id} item={item} onClick={() => handleSelectDrama(item)} />
              ))}
            </div>
          </div>
        )}

        {/* Live Drama Rails */}
        {loading ? (
          <div className="grid place-items-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-[#E86D7B]" />
            <p className="mt-4 text-sm text-fog-500">Connecting to Drama server...</p>
          </div>
        ) : (
          <>
            <DramaRail title="🔥 Featured Asian Dramas" items={data?.show || []} onSelect={handleSelectDrama} />
            <DramaRail title="🇰🇷 Popular Korean Dramas" items={data?.korean || []} onSelect={handleSelectDrama} />
            <DramaRail title="🇨🇳 Top Chinese Dramas" items={data?.chinese || []} onSelect={handleSelectDrama} />
            <DramaRail title="⭐ Highest Rated" items={data?.topRating || []} onSelect={handleSelectDrama} />
            <DramaRail title="🕒 Recently Updated" items={data?.lastUpdate || []} onSelect={handleSelectDrama} />
          </>
        )}
      </div>

      {/* Drama Detail & Player Modal */}
      {selectedDrama && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/15 bg-ink-950 p-6 text-white shadow-2xl">
            <button
              onClick={() => {
                setSelectedDrama(null);
                setActiveEpisode(null);
                setStreamResult(null);
              }}
              className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/70 text-white border border-white/20 hover:bg-white hover:text-black transition-colors"
            >
              <X size={18} />
            </button>

            {/* Video Player (if episode selected) */}
            {activeEpisode && (
              <div className="mb-6">
                {streamLoading ? (
                  <div className="relative aspect-video w-full grid place-items-center rounded-xl bg-black border border-white/10">
                    <div className="text-center space-y-2">
                      <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#E86D7B]" />
                      <p className="text-sm">Fetching KissKH stream for Episode {activeEpisode.number}...</p>
                    </div>
                  </div>
                ) : streamError || !streamResult?.streamUrl ? (
                  <div className="relative aspect-video w-full grid place-items-center rounded-xl bg-ink-900 p-6 text-center border border-red-500/30">
                    <div className="space-y-3">
                      <p className="font-bold text-red-400">Stream Error</p>
                      <p className="text-xs text-fog-500">{streamError || "Unable to extract stream."}</p>
                    </div>
                  </div>
                ) : (
                  <VideoPlayer
                    src={streamResult.streamUrl}
                    title={`${selectedDrama.title} — Ep ${activeEpisode.number}`}
                    subtitles={streamResult.subtitles}
                  />
                )}
              </div>
            )}

            {/* Drama Details Header */}
            <div className="flex flex-col gap-6 sm:flex-row">
              <img
                src={selectedDrama.thumbnail}
                alt={selectedDrama.title}
                className="h-48 w-36 rounded-lg object-cover shadow-xl shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#E86D7B]">
                  {dramaDetails?.status || "Asian Drama"}
                </p>
                <h2 className="mt-1 text-2xl font-bold sm:text-3xl">{selectedDrama.title}</h2>
                <p className="mt-3 text-sm text-fog-500 leading-relaxed line-clamp-4">
                  {dramaDetails?.description || "Experience the full drama series with high-definition multi-language subtitles."}
                </p>
              </div>
            </div>

            {/* Episode List */}
            <div className="mt-8 border-t border-ink-800 pt-6">
              <h3 className="font-display text-lg font-bold text-paper-100">
                Episodes {dramaDetails?.episodes?.length ? `(${dramaDetails.episodes.length})` : ""}
              </h3>

              {detailsLoading ? (
                <div className="grid place-items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-[#E86D7B]" />
                  <p className="mt-2 text-xs text-fog-500">Loading episode list...</p>
                </div>
              ) : dramaDetails?.episodes?.length ? (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                  {dramaDetails.episodes.map((ep) => {
                    const isPlayingThis = activeEpisode?.id === ep.id;
                    return (
                      <button
                        key={ep.id}
                        onClick={() => handlePlayEpisode(ep)}
                        className={`flex items-center justify-between rounded-lg p-2.5 text-xs font-semibold transition-all ${
                          isPlayingThis
                            ? "bg-[#E86D7B] text-black font-bold"
                            : "bg-ink-900 border border-ink-800 text-fog-500 hover:border-[#E86D7B] hover:text-white"
                        }`}
                      >
                        <span>Episode {ep.number}</span>
                        <Play size={13} fill="currentColor" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="py-6 text-sm text-fog-500">No episodes found for this series.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
