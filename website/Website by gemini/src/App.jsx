import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Compass, 
  Tv, 
  BookOpen, 
  Film, 
  TrendingUp, 
  Clock, 
  Star, 
  Flame, 
  Layers,
  Play
} from 'lucide-react';
import Navbar from './components/Navbar';
import HeroBanner from './components/HeroBanner';
import MediaRow from './components/MediaRow';
import VideoPlayer from './components/VideoPlayer';
import DetailModal from './components/DetailModal';
import MangaReader from './components/MangaReader';
import SearchModal from './components/SearchModal';
import LibraryModal from './components/LibraryModal';
import SettingsModal from './components/SettingsModal';

import { animeApi, dramaApi, comicsApi, moviesApi, initApiConfig } from './config/api';
import { useWatchProgressStore } from './store/useStore';

export default function App() {
  // Navigation & View States
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'anime' | 'drama' | 'comics' | 'movies'
  const [activeView, setActiveView] = useState('browse'); // 'browse' | 'watch' | 'read'

  // Modals
  const [detailModalItem, setDetailModalItem] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Active Playback State
  const [currentMedia, setCurrentMedia] = useState(null);
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [currentAudioMode, setCurrentAudioMode] = useState('sub'); // 'sub' | 'eng' | 'hin'
  const [streamData, setStreamData] = useState(null);
  const [playerLoading, setPlayerLoading] = useState(false);

  // Active Manga Reader State
  const [currentManga, setCurrentManga] = useState(null);
  const [currentChapterId, setCurrentChapterId] = useState('1');

  // Loaded Catalog Rows
  const [heroItems, setHeroItems] = useState([]);
  const [trendingAnime, setTrendingAnime] = useState([]);
  const [hindiAnime, setHindiAnime] = useState([]);
  const [dramas, setDramas] = useState([]);
  const [comics, setComics] = useState([]);
  const [movies, setMovies] = useState([]);
  const [loadingFeeds, setLoadingFeeds] = useState(true);

  const continueWatching = useWatchProgressStore((state) => state.getContinueWatchingList)();

  // ─────────────────────────────────────────────────────────────────────────
  // 1. INITIALIZE & FETCH CATALOG DATA
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadFeeds() {
      await initApiConfig();
      setLoadingFeeds(true);

      // Fetch Trending Anime via AniList GraphQL Proxy
      try {
        const anilistRes = await animeApi.postAniList(`
          query {
            Page(page: 1, perPage: 12) {
              media(type: ANIME, sort: TRENDING_DESC) {
                id
                idMal
                title { english romaji userPreferred }
                coverImage { large }
                bannerImage
                description
                averageScore
                genres
                status
                episodes
              }
            }
          }
        `);
        if (anilistRes?.Page?.media) {
          const formatted = anilistRes.Page.media.map(m => ({ ...m, mediaType: 'anime' }));
          setTrendingAnime(formatted);
          setHeroItems(formatted.slice(0, 5));
        }
      } catch (e) {
        console.warn('AniList feed error:', e);
      }

      // Fetch Hindi Dubbed Catalog
      try {
        const hindiRes = await animeApi.getHindiCatalog(1, 12);
        if (hindiRes?.items) {
          setHindiAnime(hindiRes.items.map(h => ({
            id: h.animerulz_id.replace('anime-', ''),
            title: h.animerulz_id.replace('anime-', 'Anime #'),
            isHindiDubbed: true,
            mediaType: 'anime',
          })));
        }
      } catch (e) {}

      // Fetch Dramas
      try {
        const dramaRes = await dramaApi.getHome();
        if (dramaRes) {
          const combinedDramas = [
            ...(dramaRes.featured || []),
            ...(dramaRes.korean || []),
            ...(dramaRes.topRated || [])
          ];
          setDramas(combinedDramas.map(d => ({
            id: d.dramaId || d.id,
            dramaId: d.dramaId || d.id,
            title: d.title,
            cover: d.thumbnail || d.poster,
            mediaType: 'drama',
          })));
        }
      } catch (e) {}

      // Fetch Comics
      try {
        const comicsRes = await comicsApi.getHome();
        if (comicsRes) {
          const combinedComics = [
            ...(comicsRes.trending || []),
            ...(comicsRes.manga || []),
            ...(comicsRes.manhwa || [])
          ];
          setComics(combinedComics.map(c => ({
            id: c.slug || c.id,
            slug: c.slug || c.id,
            title: c.title,
            cover: c.cover || c.thumbnail,
            mediaType: 'manga',
          })));
        }
      } catch (e) {}

      // Fetch Movies
      try {
        const movieRes = await moviesApi.getHome();
        if (movieRes) {
          const combinedMovies = [
            ...(movieRes.trending || []),
            ...(movieRes.bollywood || []),
            ...(movieRes.southHindi || [])
          ];
          setMovies(combinedMovies.map(m => ({
            id: m.slug || m.title,
            slug: m.slug,
            title: m.title,
            cover: m.poster || m.thumbnail,
            backdrop: m.backdrop || m.poster,
            mediaType: 'movie',
          })));
        }
      } catch (e) {}

      setLoadingFeeds(false);
    }

    loadFeeds();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. STREAM RESOLVER & PLAYBACK TRIGGER
  // ─────────────────────────────────────────────────────────────────────────
  const handlePlayMedia = async (item, ep = 1, audio = currentAudioMode) => {
    if (!item) return;
    const mediaType = item.mediaType || item.type || 'anime';

    if (mediaType === 'manga' || mediaType === 'manhwa' || mediaType === 'webtoon') {
      handleReadManga(item, '1');
      return;
    }

    setCurrentMedia(item);
    setCurrentEpisode(ep);
    setCurrentAudioMode(audio);
    setActiveView('watch');
    setPlayerLoading(true);
    setDetailModalItem(null);

    try {
      if (mediaType === 'anime') {
        const anilistId = item.id;
        const title = item.title?.english || item.title?.romaji || item.title || 'Anime';

        if (audio === 'hin') {
          // AnimeRulz Hindi Dub Stream
          const data = await animeApi.getHindiStream(anilistId, ep, 'hin');
          setStreamData(data);
        } else {
          // Primary: HiAnime / Fallback: AnimeKai
          try {
            const data = await animeApi.getHiAnimeStream(anilistId, ep, audio);
            if (data?.sources?.length) {
              setStreamData({
                streamUrl: data.sources[0].url,
                subtitles: data.subtitles || [],
              });
            } else {
              throw new Error('No HiAnime sources');
            }
          } catch (e) {
            const data = await animeApi.getAnimeKaiStream(title, ep, 1, audio);
            setStreamData(data);
          }
        }
      } else if (mediaType === 'drama') {
        const dramaId = item.dramaId || item.id;
        const info = await dramaApi.getInfo(dramaId);
        const epObj = info?.episodes?.[ep - 1] || info?.episodes?.[0];
        if (epObj?.id) {
          const data = await dramaApi.getStream(epObj.id);
          setStreamData(data);
        }
      } else if (mediaType === 'movie') {
        const slug = item.slug;
        const data = await moviesApi.getStream(slug);
        setStreamData({
          streamUrl: data?.streamUrl,
          fallbackIframe: data?.iframeSrc,
        });
      }
    } catch (err) {
      console.warn('Playback resolution failed:', err);
    } finally {
      setPlayerLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 3. MANGA & WEBTOON READER TRIGGER
  // ─────────────────────────────────────────────────────────────────────────
  const handleReadManga = (item, chapterId = '1') => {
    setCurrentManga(item);
    setCurrentChapterId(chapterId);
    setActiveView('read');
    setDetailModalItem(null);
  };

  return (
    <div className="min-h-screen bg-[#08090C] text-white flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setActiveView('browse');
        }}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenLibrary={() => setLibraryOpen(true)}
      />

      {/* Main Viewport Router Switch */}
      <main className="flex-1 pb-16">
        {activeView === 'browse' && (
          <div>
            {/* Cinematic Hero Spotlight */}
            <HeroBanner
              items={heroItems}
              onPlay={(item) => handlePlayMedia(item, 1)}
              onOpenDetail={(item) => setDetailModalItem(item)}
            />

            <div className="space-y-4 -mt-8 sm:-mt-12 relative z-20">
              {/* Shelf 1: Continue Watching Row (if active history exists) */}
              {continueWatching.length > 0 && (
                <MediaRow
                  title="Continue Watching"
                  subtitle="Jump straight back into your episodes"
                  badge="History"
                  items={continueWatching}
                  onPlay={(item) => handlePlayMedia(item, item.episode || 1)}
                  onOpenDetail={(item) => setDetailModalItem(item)}
                  aspectRatio="poster"
                />
              )}

              {/* Shelf 2: Trending Anime */}
              {(activeTab === 'home' || activeTab === 'anime') && (
                <MediaRow
                  title="Trending Anime"
                  subtitle="Most watched series this season"
                  badge="Top Rated"
                  items={trendingAnime}
                  onPlay={(item) => handlePlayMedia(item, 1)}
                  onOpenDetail={(item) => setDetailModalItem(item)}
                />
              )}

              {/* Shelf 3: Hindi Dubbed Anime */}
              {(activeTab === 'home' || activeTab === 'anime') && hindiAnime.length > 0 && (
                <MediaRow
                  title="Hindi Dubbed Anime"
                  subtitle="Stream in your local Indian languages"
                  badge="Hindi Dub"
                  items={hindiAnime}
                  onPlay={(item) => handlePlayMedia(item, 1, 'hin')}
                  onOpenDetail={(item) => setDetailModalItem(item)}
                />
              )}

              {/* Shelf 4: Asian Dramas (KissKH) */}
              {(activeTab === 'home' || activeTab === 'drama') && (
                <MediaRow
                  title="Asian Dramas"
                  subtitle="Korean, Chinese & Thai romantic hits"
                  badge="Asian"
                  items={dramas}
                  onPlay={(item) => handlePlayMedia(item, 1)}
                  onOpenDetail={(item) => setDetailModalItem(item)}
                />
              )}

              {/* Shelf 5: Comics & Webtoons */}
              {(activeTab === 'home' || activeTab === 'comics') && (
                <MediaRow
                  title="Comics & Webtoons"
                  subtitle="Top Korean manhwa & Japanese manga"
                  badge="Comics"
                  items={comics}
                  onPlay={(item) => handleReadManga(item, '1')}
                  onOpenDetail={(item) => setDetailModalItem(item)}
                />
              )}

              {/* Shelf 6: Movies & OTT */}
              {(activeTab === 'home' || activeTab === 'movies') && (
                <MediaRow
                  title="Blockbuster Movies & OTT"
                  subtitle="Bollywood, Hollywood & South Indian Cinema"
                  badge="Cinema"
                  items={movies}
                  onPlay={(item) => handlePlayMedia(item, 1)}
                  onOpenDetail={(item) => setDetailModalItem(item)}
                  aspectRatio="backdrop"
                />
              )}
            </div>
          </div>
        )}

        {/* Pro Custom Video Player View */}
        {activeView === 'watch' && (
          <div className="pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            {playerLoading ? (
              <div className="w-full h-[65vh] flex flex-col items-center justify-center bg-black/50 rounded-2xl border border-white/10 space-y-3">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-semibold text-slate-300 font-display">
                  Resolving High-Definition Stream...
                </p>
              </div>
            ) : (
              <VideoPlayer
                mediaItem={currentMedia}
                episode={currentEpisode}
                streamUrl={streamData?.streamUrl}
                subtitles={streamData?.subtitles || []}
                fallbackIframe={streamData?.fallbackIframe || streamData?.iframeSrc}
                audioMode={currentAudioMode}
                onAudioModeChange={(newAudio) => handlePlayMedia(currentMedia, currentEpisode, newAudio)}
                onNextEpisode={() => handlePlayMedia(currentMedia, currentEpisode + 1)}
                onClose={() => setActiveView('browse')}
              />
            )}
          </div>
        )}

        {/* Continuous Manga Reader View */}
        {activeView === 'read' && (
          <MangaReader
            mangaItem={currentManga}
            chapterId={currentChapterId}
            onClose={() => setActiveView('browse')}
            onNavigateChapter={(dir) => {
              const num = parseInt(currentChapterId) || 1;
              const next = dir === 'next' ? num + 1 : Math.max(1, num - 1);
              handleReadManga(currentManga, String(next));
            }}
          />
        )}
      </main>

      {/* Global Modals */}
      {detailModalItem && (
        <DetailModal
          item={detailModalItem}
          onClose={() => setDetailModalItem(null)}
          onPlayEpisode={(it, ep) => handlePlayMedia(it, ep)}
          onReadChapter={(it, ch) => handleReadManga(it, ch)}
        />
      )}

      {searchOpen && (
        <SearchModal
          onClose={() => setSearchOpen(false)}
          onPlay={(item) => handlePlayMedia(item, 1)}
          onOpenDetail={(item) => setDetailModalItem(item)}
        />
      )}

      {libraryOpen && (
        <LibraryModal
          onClose={() => setLibraryOpen(false)}
          onPlay={(item) => handlePlayMedia(item, item.episode || 1)}
          onOpenDetail={(item) => setDetailModalItem(item)}
          onReadChapter={(item, ch) => handleReadManga(item, ch)}
        />
      )}

      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} />
      )}

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-[#050608] py-8 text-center text-xs text-slate-500 space-y-2">
        <p className="font-display font-semibold text-slate-400">
          EetNet Media Streamer — Powered by High-Speed Microservices
        </p>
        <p>Decoupled Architecture • Anime • Asian Dramas • Comics • Movies</p>
      </footer>
    </div>
  );
}
