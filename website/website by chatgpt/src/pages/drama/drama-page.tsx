/**
 * DramaPage — Netflix clone look, ported from:
 *   git clone netflix/Netflix-reactjs/src/componets/Banner/Banner.jsx
 *   git clone netflix/Netflix-reactjs/src/componets/RowPost/RowPost.jsx
 *   git clone netflix/Netflix-reactjs/src/componets/Header/Navbar.jsx
 *
 * Data source: Our own KissKH Drama microservice via shared/api/drama.ts
 * Fallback: Built-in curated catalog so the page is never blank.
 */

import { useEffect, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "./NetflixRowPost.css";

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

// ─── Fallback catalog (shown instantly even without backend) ───────────────────
const FALLBACK: DramaHomeData = {
  show: [
    { id: "queen-of-tears", title: "Queen of Tears", thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1280&q=80", episodesCount: 16, rating: "9.8", description: "The queen of department stores and her small-town husband weather a marital crisis — until love miraculously begins to bloom again." },
    { id: "crash-landing-on-you", title: "Crash Landing on You", thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1280&q=80", episodesCount: 16, rating: "9.9", description: "A paragliding mishap drops a South Korean heiress in North Korea — and into the life of an army officer who decides to hide her." },
    { id: "the-glory", title: "The Glory", thumbnail: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1280&q=80", episodesCount: 16, rating: "9.7", description: "Years after surviving horrific abuse in high school, a woman puts an elaborate revenge scheme in motion." },
    { id: "all-of-us-are-dead", title: "All of Us Are Dead", thumbnail: "https://images.unsplash.com/photo-1563089145-599997674d42?w=1280&q=80", episodesCount: 12, rating: "9.5", description: "A high school becomes ground zero for a zombie virus outbreak. Trapped students must fight their way out — or turn." },
    { id: "alchemy-of-souls", title: "Alchemy of Souls", thumbnail: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1280&q=80", episodesCount: 30, rating: "9.6", description: "A powerful sorceress in a blind woman's body encounters a man from a prestigious family who wants her help to change his destiny." },
    { id: "hidden-love", title: "Hidden Love", thumbnail: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1280&q=80", episodesCount: 25, rating: "9.8", description: "Sang Zhi falls in love with Duan Jiaxu, her older brother's college friend." },
    { id: "squid-game", title: "Squid Game", thumbnail: "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=1280&q=80", episodesCount: 9, rating: "9.9", description: "Hundreds of cash-strapped players accept a strange invitation to compete in children's games with deadly high stakes." },
    { id: "goblin", title: "Guardian: The Lonely and Great God", thumbnail: "https://images.unsplash.com/photo-1569701813229-33284b643e3c?w=1280&q=80", episodesCount: 16, rating: "9.8", description: "An immortal goblin must find his human bride to finally end his cursed eternal life." },
  ],
  korean: [
    { id: "vincenzo", title: "Vincenzo", thumbnail: "https://images.unsplash.com/photo-1608889825205-eebdb9fc5806?w=1280&q=80", episodesCount: 20, rating: "9.7", description: "A Korean-Italian mafia lawyer gives a mighty conglomerate a taste of its own medicine." },
    { id: "itaewon-class", title: "Itaewon Class", thumbnail: "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=1280&q=80", episodesCount: 16, rating: "9.6", description: "An ex-con and his friends fight against a mighty competitor to make their dreams for their street bar a reality." },
    { id: "hospital-playlist", title: "Hospital Playlist", thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1280&q=80", episodesCount: 24, rating: "9.8", description: "Five doctors who have been friends since med school share stories of life, love, and loss." },
    { id: "my-mister", title: "My Mister", thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1280&q=80", episodesCount: 16, rating: "9.9", description: "A man in his 40s and a young woman in her late 20s each struggle with their own circumstances, but find strength in each other." },
    { id: "reply-1988", title: "Reply 1988", thumbnail: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1280&q=80", episodesCount: 20, rating: "9.9", description: "Five childhood friends and their families live through hardships and joy in a neighborhood in Seoul." },
  ],
  chinese: [
    { id: "love-between-fairy-devil", title: "Love Between Fairy and Devil", thumbnail: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1280&q=80", episodesCount: 36, rating: "9.8", description: "A low-ranking fairy accidentally resurrects a fierce demon lord, linking their souls." },
    { id: "till-end-moon", title: "Till the End of the Moon", thumbnail: "https://images.unsplash.com/photo-1563089145-599997674d42?w=1280&q=80", episodesCount: 40, rating: "9.7", description: "To save the mortal realm, a cultivator travels back 500 years to prevent the devil lord's ascension." },
    { id: "word-of-honor", title: "Word of Honor", thumbnail: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1280&q=80", episodesCount: 36, rating: "9.6", description: "A powerful sect leader seeks to escape the martial world and meets a carefree ghost valley master." },
  ],
  topRating: [
    { id: "my-liberation-notes", title: "My Liberation Notes", thumbnail: "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=1280&q=80", episodesCount: 16, rating: "9.9", description: "Three siblings in their 30s, tired of their mundane lives in a rural suburb, seek liberation." },
    { id: "move-to-heaven", title: "Move to Heaven", thumbnail: "https://images.unsplash.com/photo-1569701813229-33284b643e3c?w=1280&q=80", episodesCount: 10, rating: "9.8", description: "A man with Asperger's syndrome and his uncle deliver the belongings of the deceased to loved ones." },
    { id: "beyond-evil", title: "Beyond Evil", thumbnail: "https://images.unsplash.com/photo-1608889825205-eebdb9fc5806?w=1280&q=80", episodesCount: 16, rating: "9.9", description: "Two detectives become obsessed with chasing each other as suspects in a serial murder case." },
    { id: "signal", title: "Signal", thumbnail: "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=1280&q=80", episodesCount: 16, rating: "9.8", description: "A profiler in 2015 communicates via walkie-talkie with a detective in 1989 to solve cold cases." },
  ],
  lastUpdate: [
    { id: "doctor-slump", title: "Doctor Slump", thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1280&q=80", episodesCount: 16, rating: "9.7", description: "Two former rivals reunite in their 30s while going through career slumps, and find healing in each other." },
    { id: "lovely-runner", title: "Lovely Runner", thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1280&q=80", episodesCount: 16, rating: "9.9", description: "A K-pop idol fan travels back in time to prevent her idol's death, creating an unexpected romance." },
    { id: "when-stars-gossip", title: "When Stars Gossip", thumbnail: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1280&q=80", episodesCount: 12, rating: "9.6", description: "A top commander and a rookie doctor are stuck together on a space station, sparks inevitable." },
  ],
};

// ─── Star Rating (ported from react-star-ratings look) ───────────────────────
function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  const filled = Math.round((value / 10) * max * 2) / 2; // convert 0-10 to 0-5
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => {
        const full = i < Math.floor(filled);
        const half = !full && i < filled;
        return (
          <svg key={i} viewBox="0 0 24 24" className="w-3.5 h-3.5 netflix-star" fill={full ? "currentColor" : half ? "url(#half)" : "none"} stroke="currentColor" strokeWidth={1.5}>
            {half && (
              <defs>
                <linearGradient id="half">
                  <stop offset="50%" stopColor="currentColor" />
                  <stop offset="50%" stopColor="transparent" />
                </linearGradient>
              </defs>
            )}
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        );
      })}
    </span>
  );
}

// ─── Netflix Navbar (ported from Navbar.jsx — scroll-aware transparent→black) ─
function NetflixNavbar({ onBack, onSearch }: { onBack?: () => void; onSearch: (q: string) => void }) {
  const [solid, setSolid] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");

  useEffect(() => {
    const handler = () => setSolid(window.scrollY > 80);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchVal);
  };

  return (
    <header className={`fixed top-0 z-30 w-full transition duration-500 ease-in-out ${solid ? "bg-black" : ""}`}>
      <nav className="px-4 mx-auto sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo + nav links */}
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-white hover:text-red-600 transition mr-2" title="Back to Home">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            {/* Netflix wordmark image — same src as the clone */}
            <img
              className="h-6 w-auto cursor-pointer"
              src="https://fontmeme.com/permalink/250902/1c1670dd6284f8d01001e1c74b52aae3.png"
              alt="NETFLIX"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <span className="text-red-600 font-black text-xl ml-1 hidden sm:inline">DRAMA</span>
            <div className="hidden md:flex items-center gap-1 ml-6">
              {["Korean", "Chinese", "Thai", "Japanese", "My List"].map((cat) => (
                <span key={cat} className="py-2 px-3 font-medium text-white text-sm cursor-pointer hover:text-red-700 transition delay-150">
                  {cat}
                </span>
              ))}
            </div>
          </div>

          {/* Right: search + hamburger */}
          <div className="flex items-center gap-3">
            {searchOpen ? (
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-1 border-b border-white">
                <input
                  autoFocus
                  className="bg-transparent text-white text-sm px-2 py-1 outline-none w-44 placeholder:text-zinc-400"
                  placeholder="Titles, people..."
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                />
                <button type="submit" className="text-white hover:text-red-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
                <button type="button" onClick={() => { setSearchOpen(false); setSearchVal(""); }} className="text-zinc-400 hover:text-white ml-1">✕</button>
              </form>
            ) : (
              <button onClick={() => setSearchOpen(true)} className="text-white hover:text-red-700 cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}
            {/* Notification */}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white hidden md:block cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {/* Avatar */}
            <img
              className="h-8 w-8 rounded cursor-pointer hidden md:block"
              src="https://www.citypng.com/public/uploads/preview/profile-user-round-red-icon-symbol-download-png-11639594337tco5j3n0ix.png"
              alt="profile"
            />
            {/* Hamburger (mobile) */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 text-gray-400 bg-gray-900 rounded-md hover:text-white hover:bg-gray-800 md:hidden"
            >
              {isMenuOpen ? (
                <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-black">
            {["Korean", "Chinese", "Thai", "Japanese", "My List"].map((cat) => (
              <a key={cat} className="block px-3 py-2 text-base font-medium text-gray-300 rounded-md hover:bg-red-800 hover:text-white cursor-pointer">{cat}</a>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
}

// ─── Netflix Banner (ported from Banner.jsx) ──────────────────────────────────
function NetflixBanner({ movie, onMoreInfo, onPlay }: { movie: DramaSummary | null; onMoreInfo: () => void; onPlay: () => void }) {
  if (!movie) {
    // Skeleton shimmer while loading (same as Banner.jsx animate-pulse pattern)
    return (
      <div className="h-[50rem] md:h-[55rem] bg-neutral-900 grid items-center" style={{ backgroundImage: "linear-gradient(90deg, hsl(0deg 0% 7% / 91%) 0%, hsl(0deg 0% 0% / 0%) 35%)" }}>
        <div className="ml-2 sm:ml-12 mt-52">
          <div className="animate-pulse w-72 sm:w-96 py-5 mb-7 bg-neutral-800 rounded-md" />
          <div className="animate-pulse w-80 py-1 mb-3 bg-neutral-800 rounded-md" />
          <div className="animate-pulse w-80 py-1 mb-3 bg-neutral-800 rounded-md" />
          <div className="animate-pulse w-60 py-1 mb-7 bg-neutral-800 rounded-md" />
          <div className="flex gap-3">
            <div className="animate-pulse bg-neutral-800 px-14 py-6 rounded-md w-36" />
            <div className="animate-pulse bg-neutral-800 px-10 py-6 rounded-md w-36" />
          </div>
        </div>
      </div>
    );
  }

  const rating = typeof movie.rating === "string" ? parseFloat(movie.rating) : (movie.rating ?? 7.0);

  return (
    <>
      <div
        style={{
          backgroundImage: `linear-gradient(90deg, hsl(0deg 0% 7% / 91%) 0%, hsl(0deg 0% 0% / 0%) 35%, hsl(220deg 26% 44% / 0%) 100%), url(${movie.thumbnail})`,
        }}
        className="h-[50rem] md:h-[55rem] 3xl:h-[63rem] bg-cover bg-center object-contain grid items-center"
      >
        <div className="ml-2 mr-2 sm:mr-0 sm:ml-12 mt-[75%] sm:mt-52">
          {/* Title */}
          <h1 className="text-white text-3xl font-semibold text-center mb-5 py-2 sm:text-left sm:text-5xl sm:border-l-8 pl-4 border-red-700 md:text-6xl lg:w-2/3 xl:w-1/2 sm:font-bold drop-shadow-lg">
            {movie.title}
          </h1>

          {/* Stars + date + HD badge */}
          <div className="flex items-center gap-3 mb-3">
            <div className="hidden sm:flex">
              <StarRating value={rating} />
            </div>
            <span className="hidden sm:inline text-white text-base font-bold drop-shadow-lg">2024</span>
            <span className="hidden sm:inline text-white px-2 bg-[#1e1e1e89] border-2 border-stone-600 rounded">HD</span>
          </div>

          {/* Overview */}
          <div className="mt-3 mb-4">
            <h1 className="text-white text-xl drop-shadow-xl text-center line-clamp-2 sm:line-clamp-3 sm:text-left w-full md:w-4/5 lg:w-8/12 lg:text-xl xl:w-5/12 2xl:text-2xl">
              {movie.description || "A captivating Asian drama streaming now. Watch all episodes in Full HD with multi-language subtitles."}
            </h1>
          </div>

          {/* CTA buttons — exact style from Banner.jsx */}
          <div className="flex justify-center sm:justify-start gap-3">
            <button
              onClick={onPlay}
              className="bg-red-800 hover:bg-red-900 transition duration-500 ease-in-out shadow-2xl flex items-center mb-3 mr-3 text-base sm:text-xl font-semibold text-white py-2 sm:py-2 px-10 sm:px-14 rounded-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Play
            </button>
            <button
              onClick={onMoreInfo}
              className="bg-[#33333380] flex items-center shadow-2xl mb-3 text-base sm:text-xl font-semibold text-white hover:bg-white hover:text-black transition duration-500 ease-in-out py-2 px-8 rounded-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 items-center mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              More Info
            </button>
          </div>
        </div>

        {/* Bottom fade gradient — same as Banner.jsx */}
        <div
          style={{ backgroundImage: "linear-gradient(hsl(0deg 0% 0% / 0%), hsl(0deg 0% 0% / 38%), hsl(0deg 0% 7%))" }}
          className="h-80 mt-auto"
        />
      </div>
    </>
  );
}

// ─── Netflix RowPost (ported from RowPost.jsx — Swiper carousel) ──────────────
function NetflixRowPost({
  title,
  items,
  isLarge = false,
  first = false,
  onSelect,
}: {
  title: string;
  items: DramaSummary[];
  isLarge?: boolean;
  first?: boolean;
  onSelect: (item: DramaSummary) => void;
}) {
  const [shouldPop, setShouldPop] = useState(true);

  const breakpoints = {
    1800: { slidesPerView: 6.1, slidesPerGroup: 5 },
    1690: { slidesPerView: 5.5, slidesPerGroup: 5 },
    1536: { slidesPerView: 5, slidesPerGroup: 5 },
    1280: { slidesPerView: 4.3, slidesPerGroup: 4 },
    768: { slidesPerView: 3.3, slidesPerGroup: 3 },
    625: { slidesPerView: 3.1, slidesPerGroup: 3 },
    330: { slidesPerView: 2.1, slidesPerGroup: 2 },
    0: { slidesPerView: 2, slidesPerGroup: 2 },
  };

  if (!items || items.length === 0) {
    return (
      <div className="ml-2 lg:ml-11 mb-11 animate-pulse" style={{ marginTop: first ? "-8rem" : "" }}>
        <div className="w-72 ml-1 py-5 mb-5 bg-neutral-900 rounded-md" />
        <div className="w-full py-24 bg-neutral-900 rounded-md" />
      </div>
    );
  }

  return (
    <div className="ml-2 lg:ml-11 mb-11 RowContainer" style={{ marginTop: first ? "-8rem" : "" }}>
      <h1 className="text-white pb-4 xl:pb-0 font-normal text-base sm:text-2xl md:text-4xl">{title}</h1>

      <Swiper
        breakpoints={breakpoints}
        modules={[Navigation, Pagination]}
        spaceBetween={8}
        slidesPerView={6.1}
        navigation
        pagination={{ clickable: true }}
        className="netflix-swiper SwiperStyle"
      >
        {items.map((item) => {
          const rating = typeof item.rating === "string" ? parseFloat(item.rating) : (item.rating ?? 7.5);

          return (
            <SwiperSlide
              key={item.id}
              className={isLarge ? "large" : "bg-cover"}
              onClick={() => { if (shouldPop) onSelect(item); }}
            >
              {isLarge ? (
                <img className="rounded-sm w-full" src={item.thumbnail} alt={item.title}
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&q=80"; }} />
              ) : (
                <img
                  loading="lazy"
                  className="rounded-sm w-full"
                  src={item.thumbnail}
                  alt={item.title}
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&q=80"; }}
                />
              )}

              {/* Hover content panel — ported from RowPost content div */}
              <div className="netflix-card-content pt-16">
                <div className="flex transition ml-3 ease-in-out delay-150 gap-1">
                  {/* Play button */}
                  <div
                    onClick={(e) => { e.stopPropagation(); onSelect(item); }}
                    onMouseEnter={() => setShouldPop(false)}
                    onMouseLeave={() => setShouldPop(true)}
                    className="text-white w-9 h-9 border-[2px] rounded-full p-2 mr-1 backdrop-blur-[2px] shadow-md ease-linear transition-all duration-150 hover:text-black hover:bg-white cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
                  </div>
                  {/* Add to list */}
                  <div
                    onMouseEnter={() => setShouldPop(false)}
                    onMouseLeave={() => setShouldPop(true)}
                    className="text-white w-9 h-9 border-[2px] rounded-full p-2 mr-1 backdrop-blur-[1px] shadow-md ease-linear transition-all duration-150 hover:text-black hover:bg-white cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  {/* Like */}
                  <div
                    onMouseEnter={() => setShouldPop(false)}
                    onMouseLeave={() => setShouldPop(true)}
                    className="text-white w-9 h-9 border-[2px] rounded-full p-2 mr-1 backdrop-blur-[1px] shadow-md ease-linear transition-all duration-150 hover:text-black hover:bg-white cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" />
                    </svg>
                  </div>
                  {/* More info chevron */}
                  <div
                    onClick={(e) => { e.stopPropagation(); onSelect(item); }}
                    className="text-white w-9 h-9 border-[2px] rounded-full p-2 mr-1 backdrop-blur-[1px] shadow-md ease-linear transition-all duration-150 hover:text-black hover:bg-white cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>

                <h1 className="text-white ml-4 font-medium w-4/5 xl:line-clamp-1 mt-1">{item.title}</h1>
                <h1 className="text-white text-xs font-semibold ml-4 w-11/12">2024</h1>
                <div className="ml-4 mt-1">
                  <StarRating value={rating} />
                </div>
                <span className="hidden text-white ml-4 font-thin text-xs lg:inline">
                  {item.episodesCount ? `${item.episodesCount} Episodes` : "Asian Drama"}
                </span>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}

// ─── Movie Popup (ported from RowPost.jsx inline modal) ─────────────────────
function NetflixPopup({
  drama,
  details,
  detailsLoading,
  streamResult,
  streamLoading,
  streamError,
  activeEpisode,
  onClose,
  onPlayEpisode,
}: {
  drama: DramaSummary;
  details: DramaDetail | null;
  detailsLoading: boolean;
  streamResult: DramaStreamResult | null;
  streamLoading: boolean;
  streamError: string | null;
  activeEpisode: DramaEpisode | null;
  onClose: () => void;
  onPlayEpisode: (ep: DramaEpisode) => void;
}) {
  const rating = typeof drama.rating === "string" ? parseFloat(drama.rating) : (drama.rating ?? 7.5);

  return (
    <>
      <div className="justify-center items-center flex overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none">
        <div className="relative w-auto mt-24 sm:my-6 mx-4 max-w-3xl w-full">
          <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-neutral-800 outline-none focus:outline-none">
            {/* Close button */}
            <button
              className="group p-1 ml-2 mt-2 backdrop-blur-[20px] bg-transparent border-2 border-white hover:bg-white hover:text-black fixed right-4 rounded-full cursor-pointer float-right font-semibold outline-none focus:outline-none ease-linear transition-all duration-150"
              onClick={onClose}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="text-white w-6 h-6 group-hover:text-black ease-linear transition-all duration-150">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Video or image header */}
            <div className="aspect-video w-full bg-black rounded-t-lg overflow-hidden">
              {activeEpisode ? (
                streamLoading ? (
                  <div className="h-full w-full flex items-center justify-center bg-black">
                    <div className="text-center">
                      <svg className="animate-spin h-12 w-12 text-red-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <p className="text-white mt-3 text-sm">Loading Episode {activeEpisode.number}…</p>
                    </div>
                  </div>
                ) : streamError || !streamResult?.streamUrl ? (
                  <div className="h-full w-full flex items-center justify-center bg-neutral-900 text-center p-6">
                    <div>
                      <p className="text-red-400 font-bold mb-2">Stream unavailable</p>
                      <p className="text-zinc-400 text-xs">{streamError || "Could not resolve a playable stream."}</p>
                    </div>
                  </div>
                ) : (
                  <VideoPlayer src={streamResult.streamUrl} title={`${drama.title} — Ep ${activeEpisode.number}`} subtitles={streamResult.subtitles} />
                )
              ) : (
                <img src={drama.thumbnail} alt={drama.title} className="w-full h-full object-cover" />
              )}
            </div>

            {/* Action buttons row below video — same as RowPost modal */}
            <div className="flex ml-4 items-center -mt-14 z-10 relative">
              <button
                onClick={() => details?.episodes?.[0] && onPlayEpisode(details.episodes[0])}
                className="flex items-center justify-center bg-red-800 text-white font-bold text-xs px-4 sm:px-6 md:text-sm py-2 rounded shadow hover:shadow-lg cursor-pointer outline-none focus:outline-none mr-3 mb-1 ease-linear transition-all duration-150"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Play
              </button>
              <div className="text-white w-10 h-10 border-[2px] rounded-full p-2 mr-3 backdrop-blur-[1px] hover:bg-white hover:text-black shadow-md cursor-pointer ease-linear transition-all duration-150 group">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <div className="text-white w-10 h-10 border-[2px] rounded-full p-2 mr-1 backdrop-blur-[1px] hover:bg-white hover:text-black shadow-md cursor-pointer ease-linear transition-all duration-150">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" />
                </svg>
              </div>
            </div>

            {/* Title + release date */}
            <div className="p-5 py-4 sm:py-6 sm:pt-6 rounded-t mt-2">
              <h3 className="text-3xl font-semibold text-white">{drama.title}</h3>
              <h1 className="text-green-700 font-bold mt-2">2024</h1>
            </div>

            {/* Overview body */}
            <div className="relative p-4 sm:p-6 flex-auto">
              <div className="bg-neutral-700 h-[0.15rem]" />
              <p className="my-4 sm:my-7 text-neutral-400 text-xs md:text-lg leading-relaxed line-clamp-4 sm:line-clamp-none">
                {drama.description || details?.description || "Watch all episodes in Full HD with multi-language subtitles."}
              </p>
              <div className="bg-neutral-700 h-[0.15rem]" />
            </div>

            {/* Footer — meta + episodes + buttons */}
            <div className="sm:flex items-start justify-between p-2">
              <div className="relative p-2 py-5 sm:p-6 flex-auto">
                <h1 className="flex -mt-4 text-neutral-400 text-sm leading-relaxed items-center gap-2">
                  Rating:
                  <StarRating value={rating} />
                </h1>
                <h1 className="flex text-neutral-400 text-sm leading-relaxed mt-1">
                  Episodes:&nbsp;
                  <span className="text-white font-medium">{drama.episodesCount || details?.episodes?.length || "?"}</span>
                </h1>
                <h1 className="flex text-neutral-400 text-sm leading-relaxed mt-1">
                  Language:&nbsp;<span className="text-white font-medium">Korean / Chinese / Japanese</span>
                </h1>
                <h1 className="flex text-neutral-400 text-sm leading-relaxed mt-1">
                  Genre:&nbsp;<span className="text-white font-medium">Romance · Thriller · Fantasy</span>
                </h1>
              </div>

              {/* Episode selector */}
              {details?.episodes && details.episodes.length > 0 && (
                <div className="p-4 sm:p-6 max-w-xs">
                  <p className="text-neutral-400 text-xs font-semibold mb-2 uppercase tracking-wider">Select Episode</p>
                  {detailsLoading ? (
                    <div className="text-zinc-500 text-sm">Loading…</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                      {details.episodes.map((ep) => (
                        <button
                          key={ep.id}
                          onClick={() => onPlayEpisode(ep)}
                          className={`text-xs font-bold px-2.5 py-1.5 rounded transition-all ${activeEpisode?.id === ep.id ? "bg-red-700 text-white" : "bg-neutral-700 text-white hover:bg-red-800"}`}
                        >
                          Ep {ep.number}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Close / Add to list footer row */}
            <div className="flex justify-between p-2 pt-0">
              <button
                className="group flex items-center justify-center border-[0.7px] border-white text-white font-bold text-xs px-4 mr-4 sm:px-6 md:text-sm py-3 rounded shadow hover:shadow-lg hover:bg-white hover:text-red-700 outline-none focus:outline-none mb-1 ease-linear transition-all duration-150"
                onClick={onClose}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 group-hover:text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Add to My List
              </button>
              <button
                className="flex items-center text-red-500 background-transparent font-bold uppercase px-2 py-2 text-sm outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150"
                onClick={onClose}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 mr-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="opacity-40 fixed inset-0 z-40 bg-black" onClick={onClose} />
    </>
  );
}

// ─── Main DramaPage ────────────────────────────────────────────────────────────
export function DramaPage({ onBack }: { onBack?: () => void; onOpen?: () => void }) {
  const [data, setData] = useState<DramaHomeData>(FALLBACK);
  const [bannerMovie, setBannerMovie] = useState<DramaSummary | null>(null);

  // Popup / modal state
  const [showModal, setShowModal] = useState(false);
  const [popupDrama, setPopupDrama] = useState<DramaSummary | null>(null);
  const [dramaDetails, setDramaDetails] = useState<DramaDetail | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeEpisode, setActiveEpisode] = useState<DramaEpisode | null>(null);
  const [streamResult, setStreamResult] = useState<DramaStreamResult | null>(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Search state
  const [searchResults, setSearchResults] = useState<DramaSummary[]>([]);

  // On mount: load live data, fall back to FALLBACK silently
  useEffect(() => {
    let active = true;
    fetchDramaHome()
      .then((res) => {
        if (!active) return;
        const hasData = res.show?.length || res.korean?.length || res.chinese?.length;
        if (hasData) {
          setData(res);
          const rand = res.show[Math.floor(Math.random() * res.show.length)];
          setBannerMovie(rand || null);
        } else {
          const rand = FALLBACK.show[Math.floor(Math.random() * FALLBACK.show.length)];
          setBannerMovie(rand);
        }
      })
      .catch(() => {
        if (!active) return;
        const rand = FALLBACK.show[Math.floor(Math.random() * FALLBACK.show.length)];
        setBannerMovie(rand);
      });
    // Show a random fallback banner immediately
    const rand = FALLBACK.show[Math.floor(Math.random() * FALLBACK.show.length)];
    setBannerMovie(rand);
    return () => { active = false; };
  }, []);

  const openPopup = async (drama: DramaSummary) => {
    setPopupDrama(drama);
    setShowModal(true);
    setDramaDetails(null);
    setActiveEpisode(null);
    setStreamResult(null);
    setStreamError(null);
    setDetailsLoading(true);

    try {
      const details = await fetchDramaInfo(drama.id);
      setDramaDetails(details);
    } catch {
      const count = Number(drama.episodesCount) || 16;
      setDramaDetails({
        id: drama.id,
        title: drama.title,
        description: drama.description || "",
        thumbnail: drama.thumbnail,
        status: "Completed",
        episodes: Array.from({ length: count }, (_, i) => ({ id: `${drama.id}-ep-${i + 1}`, number: i + 1 })),
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  const playEpisode = async (ep: DramaEpisode) => {
    setActiveEpisode(ep);
    setStreamLoading(true);
    setStreamError(null);
    setStreamResult(null);
    try {
      const stream = await fetchDramaStream(ep.id);
      setStreamResult(stream);
    } catch (err: any) {
      setStreamError(err.message || "Stream unavailable.");
    } finally {
      setStreamLoading(false);
    }
  };

  const closePopup = () => {
    setShowModal(false);
    setPopupDrama(null);
    setActiveEpisode(null);
    setStreamResult(null);
    setStreamError(null);
  };

  const handleSearch = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    try {
      const res = await searchDramas(q);
      if (res?.length) {
        setSearchResults(res);
      } else {
        const lower = q.toLowerCase();
        const filtered = [...FALLBACK.show, ...FALLBACK.korean, ...FALLBACK.chinese]
          .filter((d) => d.title.toLowerCase().includes(lower));
        setSearchResults(filtered);
      }
    } catch {
      const lower = q.toLowerCase();
      setSearchResults([...FALLBACK.show, ...FALLBACK.korean, ...FALLBACK.chinese].filter((d) => d.title.toLowerCase().includes(lower)));
    }
  };

  const activeRows = data.show.length ? data : FALLBACK;

  return (
    <div className="bg-[#141414] min-h-screen text-white">
      {/* Netflix Navbar */}
      <NetflixNavbar onBack={onBack} onSearch={handleSearch} />

      {/* Banner */}
      <NetflixBanner
        movie={bannerMovie}
        onMoreInfo={() => bannerMovie && openPopup(bannerMovie)}
        onPlay={() => bannerMovie && openPopup(bannerMovie)}
      />

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="ml-2 lg:ml-11 mb-8">
          <h1 className="text-white text-2xl font-bold mb-4">Search Results</h1>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {searchResults.map((item) => (
              <div key={item.id} onClick={() => openPopup(item)} className="cursor-pointer rounded overflow-hidden hover:scale-105 transition-transform">
                <img src={item.thumbnail} alt={item.title} className="w-full aspect-video object-cover rounded-sm"
                  onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&q=80"; }} />
                <p className="text-white text-xs font-semibold mt-1 truncate">{item.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RowPost rows — all 5 categories */}
      <NetflixRowPost title="🔥 Trending Now" items={activeRows.show} first onSelect={openPopup} />
      <NetflixRowPost title="🇰🇷 Korean Dramas" items={activeRows.korean} onSelect={openPopup} />
      <NetflixRowPost title="🇨🇳 Chinese Dramas" items={activeRows.chinese} onSelect={openPopup} />
      <NetflixRowPost title="⭐ Top Rated" items={activeRows.topRating} isLarge onSelect={openPopup} />
      <NetflixRowPost title="🕒 Recently Updated" items={activeRows.lastUpdate} onSelect={openPopup} />

      {/* Popup modal */}
      {showModal && popupDrama && (
        <NetflixPopup
          drama={popupDrama}
          details={dramaDetails}
          detailsLoading={detailsLoading}
          streamResult={streamResult}
          streamLoading={streamLoading}
          streamError={streamError}
          activeEpisode={activeEpisode}
          onClose={closePopup}
          onPlayEpisode={playEpisode}
        />
      )}
    </div>
  );
}
