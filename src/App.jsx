import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Info, Play, Star, X, ArrowLeft, Flame, Trophy, Sparkles, Compass, History, Tv, Globe, ChevronLeft, ChevronRight, BookOpen, ThumbsUp, ThumbsDown, Share2, Bookmark, MoreHorizontal, ChevronDown, PlayCircle, CheckCircle, Bell, Zap } from 'lucide-react';
import Navbar, { MobileBottomNav } from './components/Navbar';
import Sidebar from './components/Sidebar';
import SectionSlider from './components/SectionSlider';
import AnimeCard from './components/AnimeCard';
import VideoPlayer from './components/VideoPlayer';
import AuthModal from './components/AuthModal';
import { api, animeCategories, recentReleases, checkHindiDub, formatViews, formatRelativeTime, resolveEpisodeThumbnail } from './mockData';
import { apiUrl, getBackendConfigError } from './runtimeConfig';
import { supabase } from './supabaseClient';
import { getRecommendations } from './utils/cbf';
import { useDeviceType } from './utils/useDeviceType';
import WebtoonComicView from './components/WebtoonComicView';
import WebtoonDetailView from './components/WebtoonDetailView';
import {
  SaveToPlaylistModal,
  CreatePlaylistModal,
  YTHistoryView,
  YTPlaylistsView,
  YTPlaylistDetailView
} from './components/YTPlaylistsComponents';

function App() {
  const { isMobile, isTablet } = useDeviceType();
  const [view, setRawView] = useState('home');
  // Wrapper to allow setView call compatibility
  const setView = (v) => setRawView(v);
  // Sidebar: false = full 240px, true = mini 72px icons-only
  const [sidebarMini, setSidebarMini] = useState(false);

  // activeSection tracks which major section the user is browsing
  const [activeSection, setActiveSection] = useState('anime');
  const [featured, setFeatured] = useState([]);
  const [trending, setTrending] = useState([]);
  const [top10Famous, setTop10Famous] = useState([]);
  const [searchResults, setSearchResults] = useState({ anime: [], dramas: [], movies: [], manga: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [loadingSources, setLoadingSources] = useState(false);
  const [audioMode, setAudioMode] = useState('sub'); // 'sub' | 'dub' | 'hindi'
  const [pageLoading, setPageLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [franchiseList, setFranchiseList] = useState([]);

  // Category specific data sets (Netflix style rows structure)
  const [tvShowsData, setTvShowsData] = useState({ featured: null, genres: {} });
  const [moviesData, setMoviesData] = useState({ featured: null, genres: {} });
  const [newPopularData, setNewPopularData] = useState({ featured: null, rows: {} });
  const [hindiData, setHindiData] = useState({ featured: null, list: [] });
  const [hindiLoading, setHindiLoading] = useState(false);
  const [myList, setMyList] = useState([]);

  //  Playlists & History states 
  const [likedVideos, setLikedVideos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('anistream_liked_videos')) || []; } catch (e) { return []; }
  });
  const [watchLater, setWatchLater] = useState(() => {
    try { return JSON.parse(localStorage.getItem('anistream_watch_later')) || []; } catch (e) { return []; }
  });
  const [customPlaylists, setCustomPlaylists] = useState(() => {
    try { return JSON.parse(localStorage.getItem('anistream_playlists')) || []; } catch (e) { return []; }
  });
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);

  // Modal states for Save & Create Playlist
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [saveTargetItem, setSaveTargetItem] = useState(null);

  //  Subscriptions & Notifications System 
  const [subscriptions, setSubscriptions] = useState(() => {
    try {
      const saved = localStorage.getItem('anistream_subscriptions');
      return saved ? JSON.parse(saved) : [
        {
          id: 'chainsmoker-cat',
          media_id: 'chainsmoker-cat',
          title: 'Chainsmoker Cat',
          coverImage: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=400',
          hasNew: true
        },
        {
          id: 'frieren-s1',
          media_id: 'frieren-s1',
          title: 'Frieren: Beyond Journey\'s End',
          coverImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400',
          hasNew: true
        }
      ];
    } catch (e) {
      return [];
    }
  });

  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('anistream_notifications');
      return saved ? JSON.parse(saved) : [
        {
          id: 'notif-season-1',
          type: 'season',
          animeTitle: 'Frieren: Beyond Journey\'s End',
          animeId: 'frieren-s1',
          season: 2,
          episode: 1,
          message: 'Season 2 has been released and its premiering its Episode 1 now!',
          avatar: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400',
          thumb: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400',
          timeAgo: '5 hours ago',
          read: false
        },
        {
          id: 'notif-ep-1',
          type: 'episode',
          animeTitle: 'Chainsmoker Cat',
          animeId: 'chainsmoker-cat',
          season: 1,
          episode: 2,
          message: 'Season 1 Episode 2 has been released. Click here to watch.',
          avatar: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=400',
          thumb: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=400',
          timeAgo: '15 hours ago',
          read: false
        }
      ];
    } catch (e) {
      return [];
    }
  });



  //  Drama state 
  const [dramaHomeData, setDramaHomeData] = useState(null);
  const [dramaHomeLoading, setDramaHomeLoading] = useState(false);
  const [dramaHomeError, setDramaHomeError] = useState('');
  const [selectedDrama, setSelectedDrama] = useState(null);
  const [dramaEpisode, setDramaEpisode] = useState(null);
  const [dramaStream, setDramaStream] = useState(null);
  const [dramaStreamLoading, setDramaStreamLoading] = useState(false);
  const [dramaSearchQuery, setDramaSearchQuery] = useState('');
  const [dramaSearchResults, setDramaSearchResults] = useState([]);
  const [dramaSearchLoading, setDramaSearchLoading] = useState(false);

  //  Manhwa state 
  const [manhwaHomeData, setManhwaHomeData] = useState(null);
  const [manhwaHomeLoading, setManhwaHomeLoading] = useState(false);
  const [manhwaHomeError, setManhwaHomeError] = useState('');
  const [selectedManhwa, setSelectedManhwa] = useState(null);
  const [manhwaDetailLoading, setManhwaDetailLoading] = useState(false);
  const [currentManhwaChapter, setCurrentManhwaChapter] = useState(null);
  const [manhwaChapterImages, setManhwaChapterImages] = useState([]);
  const [manhwaChapterLoading, setManhwaChapterLoading] = useState(false);
  const [manhwaSearchQuery, setManhwaSearchQuery] = useState('');
  const [manhwaSearchResults, setManhwaSearchResults] = useState([]);
  const [manhwaSearchLoading, setManhwaSearchLoading] = useState(false);

  //  Movies state 
  const [moviesHomeData, setMoviesHomeData] = useState(null);
  const [moviesHomeLoading, setMoviesHomeLoading] = useState(false);
  const [moviesHomeError, setMoviesHomeError] = useState('');
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [selectedMovieLoading, setSelectedMovieLoading] = useState(false);
  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [movieSearchResults, setMovieSearchResults] = useState([]);
  const [movieSearchLoading, setMovieSearchLoading] = useState(false);
  const [movieActiveCategory, setMovieActiveCategory] = useState('All');

  //  Manga state 
  const [mangaHomeData, setMangaHomeData] = useState(null);
  const [mangaHomeLoading, setMangaHomeLoading] = useState(false);
  const [mangaHomeError, setMangaHomeError] = useState('');
  const [selectedManga, setSelectedManga] = useState(null);
  const [mangaDetailLoading, setMangaDetailLoading] = useState(false);
  const [currentMangaChapter, setCurrentMangaChapter] = useState(null);
  const [mangaPages, setMangaPages] = useState([]);
  const [mangaPageLoading, setMangaPageLoading] = useState(false);
  const [mangaSearchQuery, setMangaSearchQuery] = useState('');
  const [mangaSearchResults, setMangaSearchResults] = useState([]);
  const [mangaSearchLoading, setMangaSearchLoading] = useState(false);
  const [comicCategory, setComicCategory] = useState(null);

  //  Scroll Intro Overlay state 
  const [showIntroOverlay, setShowIntroOverlay] = useState(() => {
    try {
      return !sessionStorage.getItem('anistream_intro_seen');
    } catch (e) {
      return true;
    }
  });

  //  Auth & Sync states 
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [watchHistory, setWatchHistory] = useState([]);

  //  Welcome & Toast Notification states 
  const [showWelcome, setShowWelcome] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const toastTimeoutRef = useRef(null);

  const isPopStateRef = useRef(false);
  const [isInitialRouteReady, setInitialRouteReady] = useState(false);

  // Hook to handle Browser Back / Forward buttons (popstate)
  useEffect(() => {
    if (!window.history.state) {
      window.history.replaceState({
        view: 'home',
        selectedAnime: null,
        currentEpisode: null,
        selectedDrama: null,
        dramaEpisode: null,
        dramaStream: null,
        selectedManhwa: null,
        currentManhwaChapter: null,
        comicCategory: null,
        activeSection: 'anime'
      }, '');
    }

    const handlePopState = (event) => {
      if (event.state) {
        const state = event.state;
        isPopStateRef.current = true;

        setRawView(state.view || 'home');
        setSelectedAnime(state.selectedAnime || null);
        setCurrentEpisode(state.currentEpisode || null);
        setSelectedDrama(state.selectedDrama || null);
        setDramaEpisode(state.dramaEpisode || null);
        setSelectedManhwa(state.selectedManhwa || null);
        setCurrentManhwaChapter(state.currentManhwaChapter || null);
        setComicCategory(state.comicCategory || null);
        if (state.activeSection) setActiveSection(state.activeSection);
        
        // Clear search queries when navigating back to generic pages
        setSearchQuery('');
        setSearchResults({ anime: [], dramas: [], manga: [] });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Hook to push views to browser history stack
  useEffect(() => {
    if (!isInitialRouteReady) return;

    if (isPopStateRef.current) {
      isPopStateRef.current = false;
      return;
    }

    // Clean serializable state object
    const stateObj = {
      view,
      activeSection,
      selectedAnime: (view === 'detail' || view === 'watch') && selectedAnime ? {
        id: selectedAnime.id,
        title: selectedAnime.title,
        japaneseTitle: selectedAnime.japaneseTitle,
        coverImage: selectedAnime.coverImage,
        bannerImage: selectedAnime.bannerImage,
        description: selectedAnime.description,
        rating: selectedAnime.rating,
        type: selectedAnime.type,
        status: selectedAnime.status,
        genres: selectedAnime.genres,
        totalEpisodes: selectedAnime.totalEpisodes,
        episodes: selectedAnime.episodes,
        episodePagination: selectedAnime.episodePagination,
        malId: selectedAnime.malId,
        relations: selectedAnime.relations
      } : null,
      currentEpisode: view === 'watch' && currentEpisode ? {
        number: currentEpisode.number,
        title: currentEpisode.title,
        sources: currentEpisode.sources,
        subtitles: currentEpisode.subtitles,
        iframeSrc: currentEpisode.iframeSrc,
        provider: currentEpisode.provider,
        error: currentEpisode.error
      } : null,
      selectedDrama: (view === 'drama-detail' || view === 'drama-watch') && selectedDrama ? selectedDrama : null,
      dramaEpisode: view === 'drama-watch' && dramaEpisode ? dramaEpisode : null,
      selectedManhwa: (view === 'manhwa-detail' || view === 'manhwa-read') && selectedManhwa ? selectedManhwa : null,
      currentManhwaChapter: view === 'manhwa-read' && currentManhwaChapter ? currentManhwaChapter : null,
      comicCategory: view === 'comic-category' ? comicCategory : null,
    };

    const currentState = window.history.state;
    
    // Check if we are updating state for the same page view
    const isSameView = currentState && currentState.view === view;
    const isSameAnime = currentState && currentState.selectedAnime && selectedAnime && currentState.selectedAnime.id === selectedAnime.id;
    const isSameEpisode = currentState && currentState.currentEpisode && currentEpisode && currentState.currentEpisode.number === currentEpisode.number;
    const isSameDrama = currentState && currentState.selectedDrama && selectedDrama && currentState.selectedDrama.id === selectedDrama.id;
    const isSameManhwa = currentState && currentState.selectedManhwa && selectedManhwa && currentState.selectedManhwa.slug === selectedManhwa.slug;

    const shouldReplace = isSameView && (
      isSameAnime || isSameEpisode || isSameDrama || isSameManhwa || 
      ['home', 'dramas', 'manhwa', 'tv-shows', 'movies', 'new-popular', 'my-list', 'hindi'].includes(view)
    );

    // Compute clean URL path (only when data is ready)
    let targetUrl = null;
    if (view === 'detail') {
      if (selectedAnime?.id) targetUrl = `/anime/${selectedAnime.id}`;
    } else if (view === 'watch') {
      if (selectedAnime?.id) {
        const epNum = currentEpisode?.number || 1;
        targetUrl = `/watch/anime/${selectedAnime.id}?ep=${epNum}`;
      }
    } else if (view === 'drama-detail') {
      if (selectedDrama?.id) targetUrl = `/drama/${encodeURIComponent(selectedDrama.id)}`;
    } else if (view === 'drama-watch') {
      if (selectedDrama?.id) {
        const epNum = dramaEpisode?.number || dramaEpisode?.id || 1;
        targetUrl = `/watch/drama/${encodeURIComponent(selectedDrama.id)}?ep=${epNum}`;
      }
    } else if (view === 'manhwa-detail') {
      if (selectedManhwa?.slug) targetUrl = `/manhwa/${encodeURIComponent(selectedManhwa.slug)}`;
    } else if (view === 'manhwa-read') {
      if (selectedManhwa?.slug) {
        const chSlug = currentManhwaChapter?.slug || 1;
        targetUrl = `/read/manhwa/${encodeURIComponent(selectedManhwa.slug)}?ch=${encodeURIComponent(chSlug)}`;
      }
    } else if (view === 'movie-detail') {
      if (selectedMovie?.id) targetUrl = `/movie/${encodeURIComponent(selectedMovie.id)}`;
    } else if (view === 'hindi') {
      targetUrl = '/hindi';
    } else if (view === 'tv-shows') {
      targetUrl = '/tv-shows';
    } else if (view === 'movies') {
      targetUrl = '/movies';
    } else if (view === 'dramas') {
      targetUrl = '/dramas';
    } else if (view === 'manhwa') {
      targetUrl = '/manhwa';
    } else if (view === 'manga-detail') {
      if (selectedManga?.id) targetUrl = `/comic/title/${encodeURIComponent(selectedManga.id)}`;
    } else if (view === 'manga-reader') {
      if (selectedManga?.id) targetUrl = `/read/comic/${encodeURIComponent(selectedManga.id)}?ch=${encodeURIComponent(currentMangaChapter?.id || 1)}`;
    } else if (view === 'comic-category' && comicCategory) {
      targetUrl = `/comic/${comicCategory}`;
    } else if (view === 'manga') {
      targetUrl = '/comic';
    } else if (view === 'new-popular') {
      targetUrl = '/new-popular';
    } else if (view === 'my-list') {
      targetUrl = '/my-list';
    } else if (view === 'anime') {
      targetUrl = '/anime';
    } else if (view === 'home') {
      targetUrl = '/';
    }

    if (targetUrl) {
      const currentUrl = window.location.pathname + window.location.search;
      if (shouldReplace || currentUrl === targetUrl) {
        window.history.replaceState(stateObj, '', targetUrl);
      } else {
        window.history.pushState(stateObj, '', targetUrl);
      }
    }
  }, [isInitialRouteReady, view, comicCategory, selectedAnime?.id, currentEpisode?.number, selectedDrama?.id, dramaEpisode?.id, selectedManhwa?.slug, currentManhwaChapter?.slug, selectedMovie?.id, selectedManga?.id, currentMangaChapter?.id]);

  const showToast = (message, type = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ visible: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 4000);
  };

  // Welcome banner for first time visitors
  useEffect(() => {
    // Check if user is logged in already. If not logged in and first time:
    const isFirstTime = !localStorage.getItem('eetnet_welcomed');
    if (isFirstTime && !user) {
      // Small delay to let page load look smooth
      const timer = setTimeout(() => {
        setShowWelcome(true);
        // Hide after 8 seconds
        setTimeout(() => {
          setShowWelcome(false);
          localStorage.setItem('eetnet_welcomed', 'true');
        }, 8000);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [user]);

  const detailRequestRef = useRef(0);
  const watchRequestRef = useRef(0);
  const searchRequestRef = useRef(0);
  const searchDebounceRef = useRef(null);
  const hindiFetchInitiatedRef = useRef(false);

  //  Watch History & Watchlist Sync Engine 

  // Fetch watch history from DB/local on mount
  useEffect(() => {
    // 1. Initial local load
    try {
      const storedHistory = localStorage.getItem('anistream_watch_history');
      if (storedHistory) {
        setWatchHistory(JSON.parse(storedHistory));
      }
    } catch (e) {
      console.warn('Failed to load watch history from localStorage', e);
    }

    try {
      const storedWatchlist = localStorage.getItem('anistream_watchlist');
      if (storedWatchlist) {
        setMyList(JSON.parse(storedWatchlist));
      }
    } catch (e) {
      console.warn('Failed to load watchlist from localStorage', e);
    }

    // 1.5 Initial Route Parser for Clean URLs on Page Load / Direct Link
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    const params = new URLSearchParams(window.location.search);

    if (path === '/hindi') {
      setView('hindi');
    } else if (path === '/anime') {
      setView('anime');
      setActiveSection('anime');
    } else if (path === '/tv-shows') {
      setView('tv-shows');
      setActiveSection('anime');
    } else if (path === '/movies') {
      setView('movies');
      setActiveSection('movies');
    } else if (path === '/dramas') {
      setView('dramas');
      setActiveSection('drama');
    } else if (path === '/manhwa') {
      setView('manhwa');
      setActiveSection('comic');
    } else if (path === '/comic' || path === '/manga') {
      setView('manga');
      setComicCategory(null);
      setActiveSection('manga');
    } else if (path === '/new-popular') {
      setView('new-popular');
    } else if (path === '/my-list') {
      setView('my-list');
    } else if (path.startsWith('/watch/anime/')) {
      const id = path.replace('/watch/anime/', '');
      const epNum = parseInt(params.get('ep'), 10) || 1;
      if (id) {
        setPageLoading(true);
        api.getAnimeDetails(id).then((details) => {
          if (details) {
            startWatching(details, epNum);
          }
        }).catch((err) => {
          console.error('[Router] Direct anime watch link load error:', err);
        }).finally(() => setPageLoading(false));
      }
    } else if (path.startsWith('/anime/')) {
      const sub = path.replace('/anime/', '').toLowerCase();
      if (sub === 'topanime') {
        setView('new-popular');
        setAnimeCategory('topanime');
      } else if (sub === 'hindi') {
        setView('hindi');
        setAnimeCategory('hindi');
      } else if (['action', 'adventure', 'horror', 'thriller', 'romance', 'comedy'].includes(sub)) {
        const capitalized = sub.charAt(0).toUpperCase() + sub.slice(1);
        setGenreViewName(capitalized);
        setAnimeCategory(sub);
        setView('genre');
      } else if (sub) {
        handleAnimeClick(sub);
      }
    } else if (path.startsWith('/drama/')) {
      const id = decodeURIComponent(path.replace('/drama/', ''));
      if (id) {
        handleDramaClick({ id, title: id });
      }
    } else if (path.startsWith('/comic/title/')) {
      const id = decodeURIComponent(path.replace('/comic/title/', ''));
      if (id) {
        handleMangaClick({ id, title: id });
      }
    } else if (path.startsWith('/comic/')) {
      const category = path.replace('/comic/', '').toLowerCase();
      if (['manga', 'manhwa', 'manhua'].includes(category)) {
        setComicCategory(category);
        setView('comic-category');
        setActiveSection('manga');
      }
    } else if (path.startsWith('/manhwa/')) {
      const slug = decodeURIComponent(path.replace('/manhwa/', ''));
      if (slug) {
        handleManhwaClick({ slug, title: slug });
      }
    } else if (path.startsWith('/manga/')) {
      const id = decodeURIComponent(path.replace('/manga/', ''));
      if (id) {
        handleMangaClick({ id, title: id });
      }
    }

    setInitialRouteReady(true);

    // 2. Auth State Change Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      const currentUser = newSession?.user || null;
      setUser(currentUser);

      if (currentUser) {
        // User logged in: Sync & merge database records
        setIsSyncing(true);
        try {
          await syncCloudData(currentUser.id);
        } catch (err) {
          console.error('[Sync Error] Failed to sync data with Supabase:', err);
        } finally {
          setIsSyncing(false);
        }
      } else {
        // User logged out: clear state to local only
        try {
          const storedH = localStorage.getItem('anistream_watch_history');
          const storedW = localStorage.getItem('anistream_watchlist');
          setWatchHistory(storedH ? JSON.parse(storedH) : []);
          setMyList(storedW ? JSON.parse(storedW) : []);
        } catch (e) {}
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sync / Merge cloud data with local data
  const syncCloudData = async (userId) => {
    if (supabase.isMock) return;

    // A. Sync Watchlist
    const { data: cloudList, error: listErr } = await supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', userId);

    if (!listErr && cloudList) {
      // Merge local watchlist with cloud watchlist
      const localWatchlist = JSON.parse(localStorage.getItem('anistream_watchlist') || '[]');
      const mergedWatchlist = [...cloudList];
      
      // Upload any local items not on cloud
      for (const localItem of localWatchlist) {
        const idStr = String(localItem.id || localItem.media_id);
        const exists = cloudList.some(item => String(item.media_id) === idStr);
        if (!exists) {
          const newItem = {
            user_id: userId,
            media_id: idStr,
            type: localItem.type || 'anime',
            title: localItem.title,
            cover: localItem.coverImage || localItem.cover || localItem.thumbnail,
          };
          await supabase.from('watchlist').insert(newItem);
          mergedWatchlist.push({ ...newItem, id: idStr });
        }
      }

      // Convert back to format expected by UI
      const formattedList = mergedWatchlist.map(item => ({
        id: item.media_id,
        title: item.title,
        type: item.type,
        coverImage: item.cover,
        bannerImage: item.cover,
        rating: 'N/A',
      }));

      setMyList(formattedList);
      localStorage.setItem('anistream_watchlist', JSON.stringify(formattedList));
    }

    // B. Sync Watch History
    const { data: cloudHistory, error: histErr } = await supabase
      .from('watch_history')
      .select('*')
      .eq('user_id', userId);

    if (!histErr && cloudHistory) {
      const localHistory = JSON.parse(localStorage.getItem('anistream_watch_history') || '[]');
      const mergedHistory = [...cloudHistory];

      // Upload local history not in cloud, or newer local history
      for (const localItem of localHistory) {
        const cloudItem = cloudHistory.find(item => String(item.media_id) === String(localItem.media_id));
        
        if (!cloudItem) {
          const newItem = {
            user_id: userId,
            media_id: String(localItem.media_id),
            type: localItem.type,
            title: localItem.title,
            cover: localItem.cover,
            episode_number: String(localItem.episode_number || ''),
            chapter_number: String(localItem.chapter_number || ''),
            progress_seconds: parseInt(localItem.progress_seconds || 0, 10),
            duration_seconds: parseInt(localItem.duration_seconds || 0, 10),
            updated_at: new Date().toISOString()
          };
          await supabase.from('watch_history').insert(newItem);
          mergedHistory.push(newItem);
        } else {
          // Compare dates if we have them, or just skip if cloud is present.
          // For simplicity, we assume cloud is source of truth unless local has progress
        }
      }

      // Sort by updated_at descending
      mergedHistory.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));

      const formattedHistory = mergedHistory.map(item => ({
        media_id: item.media_id,
        id: item.media_id, // convenience duplicate
        type: item.type,
        title: item.title,
        cover: item.cover,
        coverImage: item.cover, // convenience duplicate
        episode_number: item.episode_number,
        chapter_number: item.chapter_number,
        progress_seconds: item.progress_seconds,
        duration_seconds: item.duration_seconds,
        updated_at: item.updated_at
      }));

      setWatchHistory(formattedHistory);
      localStorage.setItem('anistream_watch_history', JSON.stringify(formattedHistory));
    }
  };

  //  Playlists & Save Handlers 
  const handleToggleLiked = (item) => {
    if (!item) return;
    const idStr = String(item.id || item.media_id);
    setLikedVideos(prev => {
      const exists = prev.some(i => String(i.id || i.media_id) === idStr);
      let updated;
      if (exists) {
        updated = prev.filter(i => String(i.id || i.media_id) !== idStr);
        showToast('Removed from Liked videos');
      } else {
        const newItem = {
          id: idStr,
          media_id: idStr,
          title: item.title,
          cover: item.cover || item.coverImage || item.bannerImage,
          type: item.type || 'Anime',
          episode_number: item.episode_number || item.episode?.number || 1,
          added_at: new Date().toISOString()
        };
        updated = [newItem, ...prev];
        showToast('Added to Liked videos');
      }
      localStorage.setItem('anistream_liked_videos', JSON.stringify(updated));
      return updated;
    });
  };

  const handleToggleWatchLater = (item) => {
    if (!item) return;
    const idStr = String(item.id || item.media_id);
    setWatchLater(prev => {
      const exists = prev.some(i => String(i.id || i.media_id) === idStr);
      let updated;
      if (exists) {
        updated = prev.filter(i => String(i.id || i.media_id) !== idStr);
        showToast('Removed from Watch later');
      } else {
        const newItem = {
          id: idStr,
          media_id: idStr,
          title: item.title,
          cover: item.cover || item.coverImage || item.bannerImage,
          type: item.type || 'Anime',
          episode_number: item.episode_number || item.episode?.number || 1,
          added_at: new Date().toISOString()
        };
        updated = [newItem, ...prev];
        showToast('Added to Watch later');
      }
      localStorage.setItem('anistream_watch_later', JSON.stringify(updated));
      return updated;
    });
  };

  const handleToggleCustomPlaylist = (playlistId, item) => {
    if (!item) return;
    const idStr = String(item.id || item.media_id);
    setCustomPlaylists(prev => {
      const updated = prev.map(pl => {
        if (pl.id === playlistId) {
          const exists = pl.items?.some(i => String(i.id || i.media_id) === idStr);
          const newItems = exists
            ? pl.items.filter(i => String(i.id || i.media_id) !== idStr)
            : [{
                id: idStr,
                media_id: idStr,
                title: item.title,
                cover: item.cover || item.coverImage || item.bannerImage,
                type: item.type || 'Anime',
                episode_number: item.episode_number || item.episode?.number || 1
              }, ...(pl.items || [])];
          showToast(exists ? `Removed from ${pl.title}` : `Saved to ${pl.title}`);
          return { ...pl, items: newItems };
        }
        return pl;
      });
      localStorage.setItem('anistream_playlists', JSON.stringify(updated));
      return updated;
    });
  };

  const handleCreateNewPlaylist = (title) => {
    const formattedTarget = saveTargetItem ? {
      id: String(saveTargetItem.id || saveTargetItem.media_id),
      media_id: String(saveTargetItem.id || saveTargetItem.media_id),
      title: saveTargetItem.title,
      cover: saveTargetItem.cover || saveTargetItem.coverImage || saveTargetItem.bannerImage,
      type: saveTargetItem.type || 'Anime',
      episode_number: saveTargetItem.episode_number || saveTargetItem.episode?.number || 1
    } : null;

    const newPl = {
      id: 'pl-' + Date.now(),
      title,
      created_at: new Date().toISOString(),
      items: formattedTarget ? [formattedTarget] : []
    };

    setCustomPlaylists(prev => {
      const updated = [newPl, ...prev];
      localStorage.setItem('anistream_playlists', JSON.stringify(updated));
      return updated;
    });
    showToast(`Playlist "${title}" created`);
    setShowCreatePlaylistModal(false);
    setShowSaveModal(false);
  };

  const handleDeletePlaylist = (playlistId) => {
    setCustomPlaylists(prev => {
      const updated = prev.filter(pl => pl.id !== playlistId);
      localStorage.setItem('anistream_playlists', JSON.stringify(updated));
      return updated;
    });
    showToast('Playlist deleted');
  };

  const handleRemoveFromHistory = (item) => {
    const idStr = String(item.id || item.media_id);
    setWatchHistory(prev => {
      const updated = prev.filter(i => String(i.id || i.media_id) !== idStr);
      localStorage.setItem('anistream_watch_history', JSON.stringify(updated));
      return updated;
    });
    showToast('Removed from watch history');
  };

  const handleClearHistory = () => {
    setWatchHistory([]);
    localStorage.removeItem('anistream_watch_history');
    showToast('Watch history cleared');
  };

  const handleRemoveFromPlaylist = (playlistObj, item) => {
    if (playlistObj.type === 'liked') {
      handleToggleLiked(item);
    } else if (playlistObj.type === 'watch-later') {
      handleToggleWatchLater(item);
    } else if (playlistObj.id) {
      handleToggleCustomPlaylist(playlistObj.id, item);
    }
  };

  const handleToggleSubscribe = (anime) => {
    if (!anime) return;
    const idStr = String(anime.id || anime.media_id);
    setSubscriptions(prev => {
      const isSubbed = prev.some(s => String(s.id || s.media_id) === idStr);
      let updated;
      if (isSubbed) {
        updated = prev.filter(s => String(s.id || s.media_id) !== idStr);
        showToast(`Unsubscribed from ${anime.title}`);
      } else {
        const newSub = {
          id: idStr,
          media_id: idStr,
          title: anime.title,
          coverImage: anime.cover || anime.coverImage || anime.bannerImage,
          hasNew: true
        };
        updated = [newSub, ...prev];
        showToast(`Subscribed to ${anime.title}!`);

        // Create Season Release (Important) & Episode Release (More notifications)
        const newSeasonNotif = {
          id: 'notif-' + Date.now() + '-season',
          type: 'season', // Important section
          animeTitle: anime.title,
          animeId: idStr,
          season: 2,
          episode: 1,
          message: `Season 2 has been released and its premiering its Episode 1 now!`,
          avatar: anime.cover || anime.coverImage || anime.bannerImage,
          thumb: anime.bannerImage || anime.coverImage,
          timeAgo: 'Just now',
          read: false
        };

        const newEpNotif = {
          id: 'notif-' + Date.now() + '-ep',
          type: 'episode', // More notifications section
          animeTitle: anime.title,
          animeId: idStr,
          season: 1,
          episode: anime.totalEpisodes || 1,
          message: `Season 1 Episode ${anime.totalEpisodes || 1} has been released. Click here to watch.`,
          avatar: anime.cover || anime.coverImage || anime.bannerImage,
          thumb: anime.bannerImage || anime.coverImage,
          timeAgo: 'Just now',
          read: false
        };

        setNotifications(nPrev => {
          const nextNotifs = [newSeasonNotif, newEpNotif, ...nPrev];
          localStorage.setItem('anistream_notifications', JSON.stringify(nextNotifs));
          return nextNotifs;
        });
      }
      localStorage.setItem('anistream_subscriptions', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSelectNotification = (notif) => {
    // Mark notification as read
    setNotifications(prev => {
      const updated = prev.map(n => n.id === notif.id ? { ...n, read: true } : n);
      localStorage.setItem('anistream_notifications', JSON.stringify(updated));
      return updated;
    });

    // Clear blue dot on subscription
    if (notif.animeId) {
      setSubscriptions(prev => {
        const updated = prev.map(s => String(s.id || s.media_id) === String(notif.animeId) ? { ...s, hasNew: false } : s);
        localStorage.setItem('anistream_subscriptions', JSON.stringify(updated));
        return updated;
      });

      // Navigate to Watch page for anime & episode
      setPageLoading(true);
      api.getAnimeDetails(notif.animeId).then(details => {
        if (details) {
          startWatching(details, notif.episode || 1);
        } else {
          setView('anime');
        }
      }).catch(() => setView('anime')).finally(() => setPageLoading(false));
    }
  };

  const handleSelectSubscription = (subAnime) => {
    // Clear blue dot indicator
    setSubscriptions(prev => {
      const updated = prev.map(s => String(s.id || s.media_id) === String(subAnime.id || subAnime.media_id) ? { ...s, hasNew: false } : s);
      localStorage.setItem('anistream_subscriptions', JSON.stringify(updated));
      return updated;
    });

    handleAnimeClick(subAnime.id || subAnime.media_id);
  };



  useEffect(() => {
    let mounted = true;

    const defaultFeatured = [
      {
        id: 'backrooms-movie',
        title: 'Backrooms',
        description: 'A young filmmaker enters a terrifying, liminal maze of endless empty rooms, realizing he is not alone in the yellow-hued nightmare.',
        coverImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1920',
        bannerImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1920',
        type: 'MOVIE',
        rating: '9.4',
        genres: ['Horror', 'Mystery', 'Thriller', 'Sci-Fi'],
        status: 'POPULAR'
      }
    ];

    api.getFeatured().then((items) => {
      if (mounted) setFeatured(items && items.length > 0 ? items : defaultFeatured);
    });
    api.getAnimeList().then((items) => {
      if (mounted) {
        setTrending(items);
        // Cache for CBF recommendations engine in WatchView
        if (items && items.length > 0) {
          window.__eetnet_trending_pool__ = items;
        }
      }
    });
    api.getTop10Famous().then((items) => {
      if (mounted) setTop10Famous(items);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (featured.length === 0 || (view !== 'home' && view !== 'anime')) return undefined;

    const timer = window.setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % featured.length);
    }, 15000);

    return () => window.clearInterval(timer);
  }, [featured.length, view]);

  // Lazy-load view category content
  useEffect(() => {
    let mounted = true;
    const CATEGORY_GENRES = ['Action', 'Adventure', 'Fantasy', 'Sci-Fi', 'Drama', 'Romance'];

    if (view === 'tv-shows' && !tvShowsData.featured) {
      setPageLoading(true);
      api.getTVShows().then(async (featuredTV) => {
        if (!mounted) return;
        if (featuredTV.length === 0) {
          setPageLoading(false);
          return;
        }
        
        const genres = {};
        await Promise.all(
          CATEGORY_GENRES.map(async (genre) => {
            try {
              const list = await api.getGenreList('TV', genre);
              if (mounted) genres[genre] = list;
            } catch (e) {
              console.warn(`Failed to fetch TV genre ${genre}`, e);
            }
          })
        );
        
        if (mounted) {
          setTvShowsData({
            featured: featuredTV[0],
            genres
          });
          setPageLoading(false);
        }
      }).catch(() => {
        if (mounted) setPageLoading(false);
      });
    } else if (view === 'movies' && !moviesData.featured) {
      setPageLoading(true);
      api.getMovies().then(async (featuredMovies) => {
        if (!mounted) return;
        if (featuredMovies.length === 0) {
          setPageLoading(false);
          return;
        }

        const genres = {};
        await Promise.all(
          CATEGORY_GENRES.map(async (genre) => {
            try {
              const list = await api.getGenreList('MOVIE', genre);
              if (mounted) genres[genre] = list;
            } catch (e) {
              console.warn(`Failed to fetch Movie genre ${genre}`, e);
            }
          })
        );

        if (mounted) {
          setMoviesData({
            featured: featuredMovies[0],
            genres
          });
          setPageLoading(false);
        }
      }).catch(() => {
        if (mounted) setPageLoading(false);
      });
    } else if (view === 'new-popular' && !newPopularData.featured) {
      setPageLoading(true);
      Promise.all([
        api.getAnimeList(),      // Trending
        api.getNewAndPopular(),  // Airing now
        api.getFeatured()        // All-Time Popular
      ]).then(([trendingNow, airing, popular]) => {
        if (mounted) {
          setNewPopularData({
            featured: airing[0] || trendingNow[0] || popular[0],
            rows: {
              'Trending Now': trendingNow,
              'Currently Airing': airing,
              'All-Time Popular': popular
            }
          });
          setPageLoading(false);
        }
      }).catch(() => {
        if (mounted) setPageLoading(false);
      });
    }
    return () => {
      mounted = false;
    };
  }, [view, tvShowsData.featured, moviesData.featured, newPopularData.featured]);

  //  Hindi Dub catalog: isolated effect so its own mounted/loading never
  //    collides with the shared pageLoading used by other sections.
  useEffect(() => {
    if (view !== 'hindi' && activeCategory !== 'Hindi') return;
    if (hindiFetchInitiatedRef.current && hindiData.list.length > 0) return; // already fetching or done with results
    hindiFetchInitiatedRef.current = true;
    let alive = true;
    setHindiLoading(true);
    const accumulated = [];
    api.getHindiAnimeList((batch) => {
      if (!alive) return;
      accumulated.push(...batch);
      const sorted = [...accumulated].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      setHindiData({ featured: sorted[0] || null, list: sorted });
      setHindiLoading(false); // first batch â†’ stop spinner immediately
    }).then((list) => {
      if (!alive) return;
      const sorted = [...list].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      setHindiData({ featured: sorted[0] || null, list: sorted });
      setHindiLoading(false);
    }).catch((err) => {
      console.warn('[Hindi] Catalog fetch failed:', err);
      if (alive) setHindiLoading(false);
    });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, activeCategory]);

  // Load drama home when switching to dramas view
  useEffect(() => {
    if (view !== 'dramas') return;
    const hasValidData = dramaHomeData && dramaHomeData.korean && Array.isArray(dramaHomeData.korean);
    if (hasValidData) return;
    const configError = getBackendConfigError();
    if (configError) {
      setDramaHomeError(configError);
      setDramaHomeData(null);
      return;
    }
    setDramaHomeLoading(true);
    setDramaHomeError('');
    fetch(apiUrl('/api/drama/home'))
      .then(async r => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.message || data?.error || `Backend returned ${r.status}`);
        return data;
      })
      .then(data => {
        if (data && Array.isArray(data.korean)) {
          setDramaHomeData(data);
        } else {
          setDramaHomeData(null);
          setDramaHomeError('Drama backend returned an unexpected response.');
          console.warn('[Drama Home] API returned error:', data);
        }
        setDramaHomeLoading(false);
      })
      .catch(err => {
        console.warn('[Drama Home] Fetch failed:', err);
        setDramaHomeLoading(false);
        setDramaHomeData(null);
        setDramaHomeError(err.message || 'Could not reach the backend.');
      });
  }, [view]);

  // Load manhwa home when switching to manhwa view
  useEffect(() => {
    if (view !== 'manhwa') return;
    if (manhwaHomeData) return;
    const configError = getBackendConfigError();
    if (configError) {
      setManhwaHomeError(configError);
      setManhwaHomeData(null);
      return;
    }
    setManhwaHomeLoading(true);
    setManhwaHomeError('');
    fetch(apiUrl('/api/manhwa/home'))
      .then(async r => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.message || data?.error || `Backend returned ${r.status}`);
        return data;
      })
      .then(data => {
        if (data && Array.isArray(data.popular)) {
          setManhwaHomeData(data);
        } else {
          setManhwaHomeData(null);
          setManhwaHomeError('Manhwa backend returned an unexpected response.');
        }
        setManhwaHomeLoading(false);
      })
      .catch(err => {
        console.warn('[Manhwa Home] Fetch failed:', err);
        setManhwaHomeLoading(false);
        setManhwaHomeError(err.message || 'Could not reach the backend.');
      });
  }, [view]);

  // Load movies home when switching to movies view
  // NOTE: Movies use Vercel serverless directly (TMDB), NOT the phone tunnel
  useEffect(() => {
    if (view !== 'movies') return;
    if (moviesHomeData) return;
    setMoviesHomeLoading(true);
    setMoviesHomeError('');
    fetch(apiUrl('/api/movies/home'))
      .then(async r => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.message || data?.error || `Backend returned ${r.status}`);
        return data;
      })
      .then(data => {
        if (data && Array.isArray(data.bollywood)) {
          setMoviesHomeData(data);
        } else {
          setMoviesHomeData(null);
          setMoviesHomeError('Movies backend returned an unexpected response.');
        }
        setMoviesHomeLoading(false);
      })
      .catch(err => {
        console.warn('[Movies Home] Fetch failed:', err);
        setMoviesHomeLoading(false);
        setMoviesHomeError(err.message || 'Could not reach the backend.');
      });
  }, [view]);

  // Load manga home when switching to manga view
  useEffect(() => {
    if (view !== 'manga') return;
    if (mangaHomeData) return;
    let mounted = true;
    setMangaHomeLoading(true);
    setMangaHomeError('');
    api.getMangaHomeData().then(data => {
      if (!mounted) return;
      if (data && (data.trending?.length || data.popular?.length)) {
        setMangaHomeData(data);
      } else {
        setMangaHomeData(null);
        setMangaHomeError('Could not load manga catalog.');
      }
      setMangaHomeLoading(false);
    }).catch(err => {
      if (!mounted) return;
      console.warn('[Manga Home] Fetch failed:', err);
      setMangaHomeLoading(false);
      setMangaHomeData(null);
      setMangaHomeError(err.message || 'Could not load manga home.');
    });
    return () => { mounted = false; };
  }, [view]);

  const toggleWatchlist = async (animeItem) => {
    // Require login to use watchlist
    if (!user) {
      setShowAuthModal(true);
      showToast('Sign in to save titles to your watchlist!', 'info');
      return;
    }

    let exists = myList.some((item) => item.id === animeItem.id);
    let updated;

    if (exists) {
      updated = myList.filter((item) => item.id !== animeItem.id);
    } else {
      const item = {
        id: animeItem.id,
        title: animeItem.title,
        coverImage: animeItem.coverImage || animeItem.cover || animeItem.thumbnail,
        bannerImage: animeItem.bannerImage || animeItem.cover || animeItem.thumbnail,
        rating: animeItem.rating || 'N/A',
        type: animeItem.type || animeItem.format || 'anime',
        genres: animeItem.genres || []
      };
      updated = [item, ...myList];
    }

    setMyList(updated);

    try {
      localStorage.setItem('anistream_watchlist', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save watchlist to localStorage', e);
    }

    // Sync to Supabase in the background if logged in
    if (user && !supabase.isMock) {
      const idStr = String(animeItem.id);
      if (exists) {
        await supabase
          .from('watchlist')
          .delete()
          .eq('user_id', user.id)
          .eq('media_id', idStr);
      } else {
        await supabase
          .from('watchlist')
          .insert({
            user_id: user.id,
            media_id: idStr,
            type: animeItem.type || animeItem.format || 'anime',
            title: animeItem.title,
            cover: animeItem.coverImage || animeItem.cover || animeItem.thumbnail,
          });
      }
    }
  };

  const handleWatchProgress = async (mediaItem, itemDetail, type, progDetail) => {
    const mediaId = String(mediaItem.id || mediaItem.slug || mediaItem.idMal || mediaItem.id);
    const cover = mediaItem.coverImage || mediaItem.bannerImage || mediaItem.cover || mediaItem.thumbnail || '';
    const title = mediaItem.title || '';

    const episodeNum = type === 'manhwa' ? '' : String(itemDetail?.number || itemDetail || '');
    const chapterNum = type === 'manhwa' ? String(itemDetail?.number || itemDetail?.slug || itemDetail || '') : '';

    const newHistoryItem = {
      media_id: mediaId,
      id: mediaId,
      type,
      title,
      cover,
      coverImage: cover,
      episode_number: episodeNum,
      chapter_number: chapterNum,
      progress_seconds: progDetail.progressSeconds,
      duration_seconds: progDetail.durationSeconds,
      updated_at: new Date().toISOString()
    };

    setWatchHistory(prev => {
      const filtered = prev.filter(item => String(item.media_id) !== mediaId);
      const updated = [newHistoryItem, ...filtered];
      try {
        localStorage.setItem('anistream_watch_history', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    if (user && !supabase.isMock) {
      await supabase
        .from('watch_history')
        .upsert({
          user_id: user.id,
          media_id: mediaId,
          type,
          title,
          cover,
          episode_number: episodeNum,
          chapter_number: chapterNum,
          progress_seconds: parseInt(progDetail.progressSeconds || 0, 10),
          duration_seconds: parseInt(progDetail.durationSeconds || 0, 10),
          updated_at: new Date().toISOString()
        });
    }
  };

  const resetSearch = () => {
    searchRequestRef.current += 1;
    setSearchQuery('');
    setSearchResults({ anime: [], dramas: [], manga: [] });
    setSearchLoading(false);
  };

  const goHome = () => {
    resetSearch();
    detailRequestRef.current += 1;
    watchRequestRef.current += 1;
    setView('home');
    setActiveSection('anime');
    setSelectedAnime(null);
    setCurrentEpisode(null);
    setLoadingSources(false);
    window.scrollTo(0, 0);
  };

  const goDramas = () => {
    resetSearch();
    setView('dramas');
    setActiveSection('drama');
    setSelectedDrama(null);
    setDramaEpisode(null);
    setDramaStream(null);
    window.scrollTo(0, 0);
  };

  const goMovies = () => {
    resetSearch();
    setView('movies');
    setActiveSection('movies');
    setSelectedMovie(null);
    setMovieSearchQuery('');
    setMovieSearchResults([]);
    window.scrollTo(0, 0);
  };

  const goManhwa = () => {
    resetSearch();
    setView('manhwa');
    setActiveSection('comic');
    setSelectedManhwa(null);
    setCurrentManhwaChapter(null);
    setManhwaChapterImages([]);
    setManhwaSearchQuery('');
    setManhwaSearchResults([]);
    window.scrollTo(0, 0);
  };

  const goManga = () => {
    resetSearch();
    setView('manga');
    setActiveSection('manga');
    setSelectedManga(null);
    setCurrentMangaChapter(null);
    setMangaPages([]);
    setMangaSearchQuery('');
    setMangaSearchResults([]);
    setComicCategory(null);
    window.scrollTo(0, 0);
  };

  const handleAnimeClick = async (idOrTitle, fromFranchise = false) => {
    if (!idOrTitle) return;
    resetSearch();
    if (!fromFranchise) {
      detailRequestRef.current += 1;
      watchRequestRef.current += 1;
    }
    const requestId = detailRequestRef.current;

    setSelectedAnime(null);
    setCurrentEpisode(null);
    setFranchiseList([]);
    setPageLoading(true);
    setView('detail');
    setActiveSection('anime');
    window.scrollTo(0, 0);

    try {
      const details = await api.getAnimeDetails(idOrTitle);
      if (!details || requestId !== detailRequestRef.current) return;
      setSelectedAnime(details);

      // Load franchise list in background
      if (details.id) {
        api.getFranchise(details.id, details.title, details.relations).then(list => {
          if (requestId === detailRequestRef.current) setFranchiseList(list || []);
        }).catch(() => {});
      }

      //  Async: check AnimeRulz Hindi dub availability 
      if (details.id) {
        checkHindiDub(details.id).then(langs => {
          if (requestId === detailRequestRef.current) {
            const hindiOk = langs.includes('hindi');
            setSelectedAnime(prev => prev ? { ...prev, hindiAvailable: hindiOk, hindiLanguages: langs } : prev);
          }
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[handleAnimeClick] Failed to load details:', err);
    } finally {
      if (requestId === detailRequestRef.current) setPageLoading(false);
    }
  };

  const startWatching = async (animeNode, epNumberOrObj = 1, keepFranchise = false, targetAudio = audioMode) => {
    if (!animeNode) return;
    resetSearch();
    const requestId = watchRequestRef.current + 1;
    watchRequestRef.current = requestId;

    const epNum = typeof epNumberOrObj === 'object' ? (epNumberOrObj?.number ?? 1) : (epNumberOrObj ?? 1);

    setSelectedAnime(prev => ({ ...(prev || {}), ...animeNode }));
    setCurrentEpisode(null);
    setLoadingSources(true);
    setCurrentSourceIndex(0);
    setView('watch');
    setActiveSection('anime');
    window.scrollTo(0, 0);

    try {
      // Need full details if we don't have episodes
      let details = animeNode;
      if (!details.episodes || details.episodes.length === 0) {
        details = await api.getAnimeDetails(animeNode.id);
        if (!details || requestId !== watchRequestRef.current) return;
        setSelectedAnime(details);
      }

      // Load franchise in background (only if not keeping current franchise)
      if (!keepFranchise && details.id) {
        api.getFranchise(details.id, details.title, details.relations).then(list => {
          if (requestId === watchRequestRef.current) setFranchiseList(list || []);
        }).catch(() => {});
      }

      //  Async: check AnimeRulz Hindi dub availability 
      if (details.id && requestId === watchRequestRef.current) {
        checkHindiDub(details.id).then(langs => {
          if (requestId === watchRequestRef.current) {
            const hindiOk = langs.includes('hindi');
            setSelectedAnime(prev => prev ? { ...prev, hindiAvailable: hindiOk, hindiLanguages: langs } : prev);
          }
        }).catch(() => {});
      }

      //  FIXED: Pass ALL required params to getEpisodeSources 
      // Signature: (episodeId, animeTitle, japaneseTitle, episodeNumber, anilistId, seasonNum, audioMode)
      const animeTitle = details.title || details.nativeTitle || '';
      const japaneseTitle = details.nativeTitle || details.japaneseTitle || details.synonyms?.[0] || '';
      const anilistId = details.id || null;
      const seasonNum = details.seasonNum || details.season || null;

      const episodeData = await api.getEpisodeSources(
        null,           // episodeId  (not needed for AnimeKai/HiAnime path)
        animeTitle,     // animeTitle 
        japaneseTitle,  // japaneseTitle 
        epNum,          // episodeNumber 
        anilistId,      // anilistId 
        seasonNum,      // seasonNum 
        targetAudio     // audioMode 
      );

      if (!episodeData || requestId !== watchRequestRef.current) return;

      // Attach episode number so VideoPlayer / progress tracker can use it
      setCurrentEpisode({ ...episodeData, number: epNum });
      setCurrentSourceIndex(0);

      // Track progress
      handleWatchProgress(details, { ...episodeData, number: epNum }, 'anime', { progressSeconds: 0, durationSeconds: 0 });
    } catch (err) {
      console.error('[startWatching] Failed:', err);
      setCurrentEpisode({ number: epNum, error: 'Could not load this episode.' });
    } finally {
      if (requestId === watchRequestRef.current) setLoadingSources(false);
    }
  };

  const handleMangaClick = async (manga) => {

    resetSearch();
    setSelectedManga({ ...manga, chapters: [] });
    setView('manga-detail');
    setMangaDetailLoading(true);
    window.scrollTo(0, 0);
    try {
      const data = await api.getMangaInfo(manga.mangadexId || manga.id);
      if (data) setSelectedManga(prev => ({ ...prev, ...data }));
    } catch (e) {
      console.error('Manga info load failed', e);
    } finally {
      setMangaDetailLoading(false);
    }
  };

  const handleMangaRead = async (manga, chapter) => {
    setView('manga-reader');
    setMangaPageLoading(true);
    setMangaPages([]);
    window.scrollTo(0, 0);

    let targetManga = manga;
    let targetChapter = chapter;

    try {
      // 1. If chapter carries full chapters array from detail view, attach it
      if (chapter.chapters && Array.isArray(chapter.chapters) && chapter.chapters.length > 0) {
        targetManga = { ...targetManga, chapters: chapter.chapters };
      }

      // 2. If targetManga is still missing chapters array, fetch full info
      if (!targetManga.chapters || targetManga.chapters.length === 0 || !targetChapter?.id || !targetChapter.id.includes('___')) {
        const info = await api.getMangaInfo(targetManga.comickSlug || targetManga.anilistId || targetManga.id || targetManga.title);
        if (info && info.chapters && info.chapters.length > 0) {
          targetManga = { ...targetManga, ...info };

          const targetNum = String(chapter.chapter || chapter.number || '1');
          const matched = info.chapters.find(c => String(c.chapter) === targetNum || String(c.number) === targetNum);
          if (matched && !targetChapter.id.includes('___')) {
            targetChapter = matched;
          }
        }
      }

      setCurrentMangaChapter(targetChapter);
      if (targetManga) {
        setSelectedManga(prev => ({ ...prev, ...targetManga }));
        setSelectedManhwa(prev => ({ ...prev, ...targetManga }));
      }

      console.log('[handleMangaRead] Fetching chapter pages for:', targetChapter.id);
      const data = await api.getMangaChapterPages(targetChapter.id);
      const fetchedPages = data?.pages || [];
      setMangaPages(fetchedPages);

      // Preload first 6 pages in parallel in background before showing reader
      if (fetchedPages.length > 0) {
        const firstBatch = fetchedPages.slice(0, 6);
        await Promise.all(firstBatch.map(p => new Promise(resolve => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = resolve;
          img.src = p.url;
        })));
      }
    } catch (e) {
      console.error('Manga chapter pages load failed', e);
      setMangaPages([]);
    } finally {
      setMangaPageLoading(false);
    }
  };

  const handleMangaSearch = (q) => {
    setMangaSearchQuery(q);
    if (!q.trim()) { setMangaSearchResults([]); return; }
    setMangaSearchLoading(true);
    api.searchManga(q)
      .then(data => {
        setMangaSearchResults(Array.isArray(data) ? data : []);
        setMangaSearchLoading(false);
      })
      .catch(() => { setMangaSearchResults([]); setMangaSearchLoading(false); });
  };

  const goAnime = () => {
    resetSearch();
    detailRequestRef.current += 1;
    watchRequestRef.current += 1;
    setView('anime');
    setActiveSection('anime');
    setSelectedAnime(null);
    setCurrentEpisode(null);
    setLoadingSources(false);
    window.scrollTo(0, 0);
  };

  const [animeCategory, setAnimeCategory] = useState('topanime');
  const [genreViewName, setGenreViewName] = useState('Horror');
  const [genreAnimeList, setGenreAnimeList] = useState([]);
  const [genreLoading, setGenreLoading] = useState(false);
  const [genrePage, setGenrePage] = useState(1);
  const [genreLoadingMore, setGenreLoadingMore] = useState(false);
  const [genreHasMore, setGenreHasMore] = useState(true);

  const handleAnimeCategoryChange = (catId) => {
    const id = (catId || 'topanime').toLowerCase();
    setAnimeCategory(id);
    resetSearch();
    setActiveSection('anime');
    setSelectedAnime(null);
    setCurrentEpisode(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (id === 'hindi') {
      setView('hindi');
      try { window.history.pushState(null, '', '/anime/hindi'); } catch (e) {}
    } else if (id === 'topanime') {
      setView('new-popular');
      try { window.history.pushState(null, '', '/anime/topanime'); } catch (e) {}
    } else if (['action', 'adventure', 'horror', 'thriller', 'romance', 'comedy'].includes(id)) {
      const capitalized = id.charAt(0).toUpperCase() + id.slice(1);
      setGenreViewName(capitalized);
      setView('genre');
      try { window.history.pushState(null, '', `/anime/${id}`); } catch (e) {}
    } else {
      setView('anime');
    }
  };

  // Initial Genre Page Fetch (Page 1)
  useEffect(() => {
    if (view !== 'genre' || !genreViewName) return;
    let mounted = true;
    setGenreLoading(true);
    setGenrePage(1);
    setGenreHasMore(true);

    api.getGenreList('ANIME', genreViewName, 1, 30).then((list) => {
      if (mounted) {
        setGenreAnimeList(list || []);
        setGenreLoading(false);
        if (!list || list.length < 30) setGenreHasMore(false);
      }
    }).catch((err) => {
      console.warn(`[Genre View] Failed to load ${genreViewName} anime:`, err);
      if (mounted) {
        setGenreAnimeList([]);
        setGenreLoading(false);
        setGenreHasMore(false);
      }
    });
    return () => { mounted = false; };
  }, [view, genreViewName]);

  // Infinite Scroll Listener for Genre View (Optimized capped at 200 anime max)
  useEffect(() => {
    if (view !== 'genre' || genreLoading || genreLoadingMore || !genreHasMore) return;

    const handleScroll = () => {
      if (genreAnimeList.length >= 200) {
        setGenreHasMore(false);
        return;
      }

      const scrollBottom = window.innerHeight + window.scrollY;
      const threshold = document.body.offsetHeight - 700;

      if (scrollBottom >= threshold && !genreLoadingMore && genreHasMore) {
        const nextPage = genrePage + 1;
        setGenreLoadingMore(true);

        api.getGenreList('ANIME', genreViewName, nextPage, 30).then((nextList) => {
          if (!nextList || nextList.length === 0) {
            setGenreHasMore(false);
          } else {
            setGenreAnimeList((prev) => {
              const existingIds = new Set(prev.map((item) => item.id));
              const freshItems = nextList.filter((item) => !existingIds.has(item.id));
              const combined = [...prev, ...freshItems];
              if (combined.length >= 200) {
                setGenreHasMore(false);
                return combined.slice(0, 200);
              }
              return combined;
            });
            setGenrePage(nextPage);
          }
        }).catch(() => {
          setGenreHasMore(false);
        }).finally(() => {
          setGenreLoadingMore(false);
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [view, genreViewName, genrePage, genreLoading, genreLoadingMore, genreHasMore, genreAnimeList.length]);

  // Called by SectionSlider when user picks Anime / Drama / Comic / Movies
  const handleSectionChange = (sectionId, catId) => {
    if (catId) {
      handleAnimeCategoryChange(catId);
      return;
    }
    if (sectionId === 'anime') {
      goAnime();
    } else if (sectionId === 'drama') {
      goDramas();
    } else if (sectionId === 'movies') {
      goMovies();
    } else if (sectionId === 'comic') {
      goManhwa();
    }
  };

  const handleManhwaClick = async (series) => {
    resetSearch();
    setSelectedManhwa({ ...series, chapters: [] });
    setManhwaDetailLoading(true);
    setView('manhwa-detail');
    window.scrollTo(0, 0);
    try {
      const r = await fetch(apiUrl(`/api/manhwa/series/${series.slug}`));
      const data = await r.json();
      setSelectedManhwa(data);
    } catch (e) {
      console.error('Manhwa series load failed', e);
    } finally {
      setManhwaDetailLoading(false);
    }
  };

  const handleManhwaRead = async (series, chapter) => {
    resetSearch();
    setCurrentManhwaChapter(chapter);
    setManhwaChapterImages([]);
    setManhwaChapterLoading(true);
    setView('manhwa-read');
    window.scrollTo(0, 0);
    try {
      const r = await fetch(apiUrl(`/api/manhwa/chapter/${series.slug}/${chapter.slug}`));
      const data = await r.json();
      setManhwaChapterImages(data.images || []);
      // Track chapter reading in watch history
      handleWatchProgress(series, chapter, 'manhwa', { progressSeconds: 100, durationSeconds: 100 });
    } catch (e) {
      console.error('Manhwa chapter load failed', e);
    } finally {
      setManhwaChapterLoading(false);
    }
  };

  const handleManhwaSearch = (q) => {
    setManhwaSearchQuery(q);
    if (!q.trim()) { setManhwaSearchResults([]); return; }
    setManhwaSearchLoading(true);
    fetch(apiUrl(`/api/manhwa/search?q=${encodeURIComponent(q)}`))
      .then(r => r.json())
      .then(data => {
        setManhwaSearchResults(Array.isArray(data) ? data : []);
        setManhwaSearchLoading(false);
      })
      .catch(() => { setManhwaSearchResults([]); setManhwaSearchLoading(false); });
  };

  const handleDramaClick = async (drama) => {
    resetSearch();

    // Smart check: If the item clicked in drama search is actually an anime (e.g. Galactic Heroes, My Hero Academia, Dragon Ball), route to handleAnimeClick!
    const titleLower = (drama.title || '').toLowerCase();
    const isAnimeTitle = ['ginga eiyuu', 'galactic heroes', 'hero academia', 'boku no hero', 'dragon ball', 'naruto', 'one piece', 'bleach', 'jujutsu', 'demon slayer'].some(kw => titleLower.includes(kw));

    if (isAnimeTitle) {
      console.log(`[Search] Routing anime title "${drama.title}" from drama results to anime player...`);
      // Search AniList by title and launch anime view
      setPageLoading(true);
      api.searchAnime(drama.title).then((results) => {
        if (results && results.length > 0) {
          handleAnimeClick(results[0].id);
        } else {
          // Fallback to title string lookup
          handleAnimeClick(drama.title);
        }
      }).finally(() => setPageLoading(false));
      return;
    }

    setSelectedDrama({ ...drama, episodes: [] });
    setView('drama-detail');
    setDramaStream(null);
    window.scrollTo(0, 0);
    try {
      const r = await fetch(apiUrl(`/api/drama/info/${drama.id}`));
      const data = await r.json();
      setSelectedDrama({ ...data, thumbnail: data.thumbnail || drama.thumbnail });
    } catch (e) {
      console.error('Drama info load failed', e);
    }
  };

  const startWatchingDrama = async (drama, episode) => {
    resetSearch();
    setDramaEpisode(episode);
    setDramaStream(null);
    setDramaStreamLoading(true);
    setView('drama-watch');
    window.scrollTo(0, 0);
    try {
      const r = await fetch(apiUrl(`/api/drama/stream/${episode.id}`));
      const data = await r.json();
      setDramaStream(data);
    } catch (e) {
      console.error('Drama stream load failed', e);
      setDramaStream({ error: 'Could not load stream for this episode.' });
    } finally {
      setDramaStreamLoading(false);
    }
  };

  const handleDramaSearch = (q) => {
    setDramaSearchQuery(q);
    if (!q.trim()) { setDramaSearchResults([]); return; }
    setDramaSearchLoading(true);
    fetch(apiUrl(`/api/drama/search?q=${encodeURIComponent(q)}`))
      .then(r => r.json())
      .then(data => {
        // KissKH returns { value: [...], Count: N } " extract the array
        const arr = Array.isArray(data) ? data : (Array.isArray(data?.value) ? data.value : []);
        setDramaSearchResults(arr);
        setDramaSearchLoading(false);
      })
      .catch(() => { setDramaSearchResults([]); setDramaSearchLoading(false); });
  };

  const handleMovieClick = async (movie) => {
    resetSearch();
    setSelectedMovie({ ...movie });
    setView('movie-detail');
    setSelectedMovieLoading(true);
    window.scrollTo(0, 0);

    // If it is a NetMirror catalog item, skip TMDB movie info call
    if (movie.netmirrorId) {
      setSelectedMovieLoading(false);
      return;
    }

    // MoviePlex catalog items don't need TMDB info — skip the fetch
    // MoviePlex items: fetch thumbnail via post-info (fast scrape)
    if (movie.movieplexSlug || movie.source === 'movieplex') {
      fetch(apiUrl(`/api/movieplex/post-info?slug=${encodeURIComponent(movie.movieplexSlug || movie.slug)}`))
        .then(r => r.json())
        .then(info => {
          setSelectedMovie(prev => ({
            ...prev,
            thumbnail: info.thumbnail || prev.thumbnail,
            coverImage: info.thumbnail || prev.coverImage,
            bannerImage: info.thumbnail || prev.bannerImage,
            title: info.title || prev.title,
          }));
        })
        .catch(() => {})
        .finally(() => setSelectedMovieLoading(false));
      return;
    }

    try {
      const r = await fetch(apiUrl(`/api/movies/info/${movie.id}`));
      const data = await r.json();
      setSelectedMovie({ ...data, coverImage: data.coverImage || movie.coverImage, bannerImage: data.bannerImage || movie.bannerImage });
    } catch (e) {
      console.error('Movie info load failed', e);
    } finally {
      setSelectedMovieLoading(false);
    }
  };

  const handleMovieSearch = (q) => {
    setMovieSearchQuery(q);
    if (!q.trim()) { setMovieSearchResults([]); return; }
    setMovieSearchLoading(true);
    fetch(apiUrl(`/api/movieplex/catalog?search=${encodeURIComponent(q)}`))
      .then(r => r.json())
      .then(data => {
        setMovieSearchResults(Array.isArray(data.movies) ? data.movies : []);
        setMovieSearchLoading(false);
      })
      .catch(() => { setMovieSearchResults([]); setMovieSearchLoading(false); });
  };

  const handleSearch = (query) => {
    setSearchQuery(query);

    if (query.trim() === '') {
      setSearchResults({ anime: [], dramas: [], movies: [], manga: [] });
      setSearchLoading(false);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      return;
    }

    setSearchLoading(true);

    // Debounce: wait 400ms after user stops typing before querying providers in parallel
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      const requestId = searchRequestRef.current + 1;
      searchRequestRef.current = requestId;

      const animePromise = api.searchAnime(query).catch(() => []);
      const dramaPromise = fetch(apiUrl(`/api/drama/search?q=${encodeURIComponent(query)}`))
        .then(r => r.json())
        .then(data => {
          return Array.isArray(data) ? data : (Array.isArray(data?.value) ? data.value : []);
        })
        .catch(() => []);
      const moviePromise = fetch(`/api/movieplex/catalog?search=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(data => Array.isArray(data.movies) ? data.movies : [])
        .catch(() => []);
      const mangaPromise = api.searchManga(query).catch(() => []);

      Promise.all([animePromise, dramaPromise, moviePromise, mangaPromise]).then(([animeItems, dramaItems, movieItems, mangaItems]) => {
        if (requestId === searchRequestRef.current) {
          const animeList = Array.isArray(animeItems) ? animeItems : [];
          const dramaRaw = Array.isArray(dramaItems) ? dramaItems : [];

          // Remove anime titles mistakenly returned by drama provider
          const animeKeywords = ['ginga eiyuu', 'galactic heroes', 'hero academia', 'boku no hero', 'dragon ball', 'naruto', 'one piece', 'bleach', 'jujutsu', 'demon slayer', 'chainsaw man', 'attack on titan'];
          const cleanDramas = dramaRaw.filter((d) => {
            const titleLower = (d.title || '').toLowerCase();
            return !animeKeywords.some(kw => titleLower.includes(kw)) && !animeList.some(a => (a.title || '').toLowerCase() === titleLower);
          });

          setSearchResults({
            anime: animeList,
            dramas: cleanDramas,
            movies: Array.isArray(movieItems) ? movieItems : [],
            manga: Array.isArray(mangaItems) ? mangaItems : []
          });
          setSearchLoading(false);
        }
      }).catch(() => {
        if (requestId === searchRequestRef.current) {
          setSearchResults({ anime: [], dramas: [], movies: [], manga: [] });
          setSearchLoading(false);
        }
      });
    }, 400);
  };

  const filteredTrending = activeCategory === 'All'
    ? trending
    : activeCategory === 'Hindi'
    ? (hindiData.list.length > 0 ? hindiData.list : trending.filter((anime) => anime.hasHindiDub || anime.hindiAvailable))
    : trending.filter((anime) => anime.genres?.includes(activeCategory));

  const activeFeatured = featured[carouselIndex];
  const playerSource = React.useMemo(() => {
    const selectedSource = currentEpisode?.sources?.[currentSourceIndex] || currentEpisode?.sources?.[0];
    return selectedSource ? { ...currentEpisode, ...selectedSource } : currentEpisode;
  }, [currentEpisode, currentSourceIndex]);

  const isImmersiveView = ['watch', 'drama-watch', 'movie-watch', 'manhwa-read'].includes(view);
  const mainContentClass = ['main-content', isImmersiveView ? 'immersive' : '', !isImmersiveView && sidebarMini ? 'sidebar-mini' : '', isMobile ? 'is-mobile-view' : 'is-desktop-view'].filter(Boolean).join(' ');

  return (
    <div className={`app-container ${isMobile ? 'app-mobile' : 'app-desktop'}`}>
      {(pageLoading || loadingSources) && <GlobalLoader />}
      <Navbar
        onSearch={handleSearch}
        activeView={view}
        setView={setView}
        onHome={goHome}
        activeSection={activeSection}
        user={user}
        onSignIn={() => setShowAuthModal(true)}
        onSignOut={async () => { await supabase.auth.signOut(); }}
        onToggleSidebar={() => setSidebarMini(v => !v)}
        notifications={notifications}
        onSelectNotification={handleSelectNotification}
        setSection={handleSectionChange}
      />

      <div className="yt-body">
        {!isImmersiveView && !isMobile && (
          <Sidebar
            activeView={view}
            setView={setView}
            setSection={(s) => setActiveSection(s)}
            user={user}
            onSignIn={() => setShowAuthModal(true)}
            mini={sidebarMini}
            subscriptions={subscriptions}
            activeCategory={activeCategory}
            onSelectCategory={(cat) => {
              if (cat === 'Hindi') {
                setActiveSection('anime');
                setView('hindi');
              } else {
                setActiveCategory(cat);
                setActiveSection('anime');
                setView('anime');
              }
              window.scrollTo(0, 0);
            }}
            onSelectSubscription={handleSelectSubscription}
          />
        )}

        <main className={mainContentClass}>
          {['detail', 'drama-detail', 'movie-detail', 'manhwa-detail'].includes(view) && (
            <button className="global-back-btn" onClick={() => window.history.back()} title="Go Back">
              <ArrowLeft size={16} /><span>Back</span>
            </button>
          )}

          {/* Page-level loading bar  renders at root so it appears above everything */}

          {searchQuery.trim() !== '' ? (
            <SearchResults
              query={searchQuery}
              animeResults={searchResults.anime}
              movieResults={searchResults.movies}
              dramaResults={searchResults.dramas}
              mangaResults={searchResults.manga}
              loading={searchLoading}
              onAnimeClick={handleAnimeClick}
              onMovieClick={handleMovieClick}
              onDramaClick={handleDramaClick}
              onMangaClick={handleMangaClick}
            />
          ) : (
            <>
              {view === 'home' && (
                <HomeView
                  onAnimeClick={handleAnimeClick}
                  onStartWatching={startWatching}
                  onManhwaClick={(m) => { setSelectedManhwa(m); setView('manhwa-detail'); }}
                />
              )}
              {view === 'anime' && (
                <AnimeView
                  activeFeatured={activeFeatured}
                  featured={featured}
                  activeCategory={activeCategory}
                  filteredTrending={filteredTrending}
                  top10Famous={top10Famous}
                  setActiveCategory={setActiveCategory}
                  onAnimeClick={handleAnimeClick}
                  onStartWatching={startWatching}
                  watchHistory={watchHistory}
                  onDramaClick={handleDramaClick}
                  onManhwaClick={(m) => { setSelectedManhwa(m); setView('manhwa-detail'); }}
                  hindiLoading={hindiLoading}
                />
              )}
              {view === 'tv-shows' && (
                <CategoryGridView title="TV Shows" viewName="tv-shows" featuredItem={tvShowsData.featured} genresData={tvShowsData.genres} onAnimeClick={handleAnimeClick} onStartWatching={startWatching} isLoading={pageLoading} />
              )}
              {view === 'new-popular' && (
                <CategoryGridView title="New & Popular" viewName="new-popular" featuredItem={newPopularData.featured} genresData={newPopularData.rows} onAnimeClick={handleAnimeClick} onStartWatching={startWatching} isLoading={pageLoading} />
              )}
              {view === 'hindi' && (
                <HindiView hindiAnime={hindiData.list} onAnimeClick={handleAnimeClick} onStartWatching={startWatching} isLoading={hindiLoading} />
              )}
              {view === 'genre' && (
                <GenreView genreName={genreViewName} items={genreAnimeList} isLoading={genreLoading} loadingMore={genreLoadingMore} hasMore={genreHasMore} onAnimeClick={handleAnimeClick} onStartWatching={startWatching} />
              )}
              {view === 'my-list' && (
                <WatchlistView items={myList} onAnimeClick={handleAnimeClick} onBackHome={goHome} />
              )}
              {view === 'detail' && selectedAnime && (
                <DetailView
                  anime={selectedAnime}
                  franchiseList={franchiseList}
                  myList={myList}
                  onToggleWatchlist={toggleWatchlist}
                  onAnimeSelect={(id) => handleAnimeClick(id, true)}
                  onBackHome={goHome}
                  onStartWatching={startWatching}
                  subscriptions={subscriptions}
                  onToggleSubscribe={handleToggleSubscribe}
                />
              )}
              {view === 'watch' && selectedAnime && currentEpisode && (
                <WatchView
                  anime={selectedAnime} episode={currentEpisode} source={playerSource} franchiseList={franchiseList}
                  currentSourceIndex={currentSourceIndex} loadingSources={loadingSources} setCurrentSourceIndex={setCurrentSourceIndex}
                  onStartWatching={(animeNode, epNum, keepFranchise = true, targetAudio = audioMode) => startWatching(animeNode, epNum, keepFranchise, targetAudio)}
                  onAnimeSelect={(id) => { setPageLoading(true); api.getAnimeDetails(id).then((d) => { if (d) startWatching(d, 1, true); }).finally(() => setPageLoading(false)); }}
                  onProgress={(prog) => handleWatchProgress(selectedAnime, currentEpisode, 'anime', prog)}
                  audioMode={audioMode} setAudioMode={setAudioMode} showToast={showToast}
                  onOpenSaveModal={(media) => { setSaveTargetItem(media); setShowSaveModal(true); }}
                  onToggleLike={handleToggleLiked}
                  isLiked={likedVideos.some(i => String(i.id || i.media_id) === String(selectedAnime.id))}
                  subscriptions={subscriptions}
                  onToggleSubscribe={handleToggleSubscribe}
                />
              )}
              {view === 'watch-history' && (
                <YTHistoryView
                  history={watchHistory}
                  onAnimeClick={handleAnimeClick}
                  onStartWatching={startWatching}
                  onRemoveItem={handleRemoveFromHistory}
                  onClearHistory={handleClearHistory}
                />
              )}
              {view === 'playlists' && (
                <YTPlaylistsView
                  watchLater={watchLater}
                  likedVideos={likedVideos}
                  customPlaylists={customPlaylists}
                  onSelectPlaylist={(pl) => { setSelectedPlaylist(pl); setView('playlist-detail'); window.scrollTo(0, 0); }}
                  onCreatePlaylistClick={() => setShowCreatePlaylistModal(true)}
                  onDeletePlaylist={handleDeletePlaylist}
                />
              )}
              {view === 'liked' && (
                <YTPlaylistDetailView
                  playlist={{ type: 'liked', title: 'Liked videos', items: likedVideos }}
                  onBack={() => setView('playlists')}
                  onStartWatching={startWatching}
                  onAnimeClick={handleAnimeClick}
                  onRemoveItemFromPlaylist={handleRemoveFromPlaylist}
                />
              )}
              {view === 'watch-later' && (
                <YTPlaylistDetailView
                  playlist={{ type: 'watch-later', title: 'Watch Later', items: watchLater }}
                  onBack={() => setView('playlists')}
                  onStartWatching={startWatching}
                  onAnimeClick={handleAnimeClick}
                  onRemoveItemFromPlaylist={handleRemoveFromPlaylist}
                />
              )}
              {view === 'playlist-detail' && selectedPlaylist && (
                <YTPlaylistDetailView
                  playlist={selectedPlaylist}
                  onBack={() => setView('playlists')}
                  onStartWatching={startWatching}
                  onAnimeClick={handleAnimeClick}
                  onRemoveItemFromPlaylist={handleRemoveFromPlaylist}
                />
              )}
              {view === 'dramas' && (
                <DramaHomeView data={dramaHomeData} error={dramaHomeError} isLoading={dramaHomeLoading} searchQuery={dramaSearchQuery} searchResults={dramaSearchResults} searchLoading={dramaSearchLoading} onSearch={handleDramaSearch} onDramaClick={handleDramaClick} />
              )}
              {view === 'drama-detail' && selectedDrama && (
                <DramaDetailView drama={selectedDrama} onBack={goDramas} onWatchEpisode={startWatchingDrama} />
              )}
              {view === 'drama-watch' && selectedDrama && dramaEpisode && (
                <DramaWatchView drama={selectedDrama} episode={dramaEpisode} stream={dramaStream} loading={dramaStreamLoading} onBack={() => { setView('drama-detail'); window.scrollTo(0,0); }} onEpisodeSelect={(ep) => startWatchingDrama(selectedDrama, ep)} onProgress={(prog) => handleWatchProgress(selectedDrama, dramaEpisode, 'drama', prog)} />
              )}
              {(view === 'manhwa' || view === 'manga' || view === 'comic-category') && (
                <WebtoonComicView
                  onComicClick={(comic) => {
                    setSelectedManga(comic);
                    setSelectedManhwa(comic);
                    setView('webtoon-detail');
                    window.scrollTo(0, 0);
                  }}
                />
              )}
              {(view === 'webtoon-detail' || view === 'manhwa-detail' || view === 'manga-detail') && (selectedManga || selectedManhwa) && (
                <WebtoonDetailView
                  manga={selectedManga || selectedManhwa}
                  onBack={() => setView('manga')}
                  onChapterSelect={(ch) => handleMangaRead(selectedManga || selectedManhwa, ch)}
                />
              )}
              {view === 'manhwa-read' && selectedManhwa && currentManhwaChapter && (
                <ManhwaReadView series={selectedManhwa} chapter={currentManhwaChapter} images={manhwaChapterImages} isLoading={manhwaChapterLoading} onBack={() => { setView('webtoon-detail'); window.scrollTo(0, 0); }} onChapterSelect={(ch) => handleManhwaRead(selectedManhwa, ch)} />
              )}
              {view === 'manga-reader' && selectedManga && currentMangaChapter && (
                <MangaReaderView manga={selectedManga} chapter={currentMangaChapter} pages={mangaPages} isLoading={mangaPageLoading} onBack={() => { setView('webtoon-detail'); window.scrollTo(0, 0); }} onChapterSelect={(ch) => handleMangaRead(selectedManga, ch)} />
              )}
              {view === 'movies' && activeSection === 'movies' && (
                <MovieHomeView data={moviesHomeData} error={moviesHomeError} isLoading={moviesHomeLoading} activeCategory={movieActiveCategory} setActiveCategory={setMovieActiveCategory} searchQuery={movieSearchQuery} searchResults={movieSearchResults} searchLoading={movieSearchLoading} onSearch={handleMovieSearch} onMovieClick={handleMovieClick} user={user} />
              )}
              {view === 'movie-detail' && selectedMovie && (
                <MovieDetailView movie={selectedMovie} isLoading={selectedMovieLoading} onBack={goMovies} onWatch={() => { setView('movie-watch'); window.scrollTo(0, 0); }} />
              )}
              {view === 'movie-watch' && selectedMovie && (
                <MovieWatchView movie={selectedMovie} onBack={() => { setView('movie-detail'); window.scrollTo(0, 0); }} onProgress={(prog) => handleWatchProgress(selectedMovie, { id: 'full', number: 1 }, 'movie', prog)} />
              )}
            </>
          )}
        </main>
      </div>

      {!isImmersiveView && (
        <MobileBottomNav activeView={view} setView={setView} setSection={handleSectionChange} user={user} onSignIn={() => setShowAuthModal(true)} />
      )}

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      <SaveToPlaylistModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        targetMedia={saveTargetItem}
        customPlaylists={customPlaylists}
        watchLater={watchLater}
        likedVideos={likedVideos}
        onToggleWatchLater={handleToggleWatchLater}
        onToggleLiked={handleToggleLiked}
        onToggleCustomPlaylist={handleToggleCustomPlaylist}
        onCreateNewPlaylistClick={() => { setShowSaveModal(false); setShowCreatePlaylistModal(true); }}
      />

      <CreatePlaylistModal
        isOpen={showCreatePlaylistModal}
        onClose={() => setShowCreatePlaylistModal(false)}
        onCreate={handleCreateNewPlaylist}
      />


      <div className={`welcome-banner ${showWelcome ? 'visible' : ''}`}>
        <div className="welcome-banner-content">
          <span> First time here? Sign in to save your watchlist and sync your watch history!</span>
          <button className="welcome-banner-btn" onClick={() => { setShowWelcome(false); setShowAuthModal(true); }}>Sign In</button>
        </div>
        <button className="welcome-banner-close" onClick={() => setShowWelcome(false)} aria-label="Close welcome message">
          <X size={18} />
        </button>
      </div>

      <div className={`toast-notification toast-notification--${toast.type} ${toast.visible ? 'visible' : ''}`}>
        <div className="toast-notification-content">{toast.message}</div>
      </div>
    </div>
  );
}

//  YouTube Search Result Item Component 
function YTSearchResultItem({ item, type, onClick }) {
  const thumb = item.bannerImage || item.coverImage || item.thumbnail || item.cover || '';
  const title = item.title || 'Untitled';
  const displayTitle = type === 'manga'
    ? `${title} | Chapter 1`
    : type === 'movie'
    ? title
    : `${title} | Season 1 | Episode 1`;

  const viewsText = formatViews(item.popularity || item.viewsCount || 500000);
  const timeAgoText = formatRelativeTime(item.startDate || item.date, 1);
  const durationText = type === 'manga' ? 'Ch. 1' : type === 'movie' ? 'Movie' : '23:45';
  const genres = item.genres?.slice(0, 2).join(' • ') || (type === 'manga' ? 'Manga / Comic' : type === 'drama' ? 'Drama' : type === 'movie' ? 'Movie' : 'Anime');
  const desc = item.description || 'Watch high quality episodes, detailed synopses, and recommendations on EetNet.';

  const initial = title.charAt(0).toUpperCase();
  const colorMap = { A:'#FF0000',B:'#3ea6ff',C:'#7B68EE',D:'#FF69B4',F:'#00C853',J:'#FF6D00',K:'#1DE9B6',M:'#AA00FF',N:'#FFD600',O:'#FF5252',S:'#00BCD4',T:'#8D6E63' };
  const avatarColor = colorMap[initial] || '#606060';

  return (
    <div className="yt-search-item" onClick={onClick} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="yt-search-thumb-wrap">
        {thumb ? (
          <img src={thumb} alt={displayTitle} loading="lazy" onError={e => { e.target.style.display='none'; }} />
        ) : (
          <div style={{ width:'100%',height:'100%',background:'#272727',display:'flex',alignItems:'center',justifyContent:'center',color:'#717171',fontSize:'14px' }}>No Image</div>
        )}
        <span className="yt-search-duration">{durationText}</span>
      </div>
      <div className="yt-search-info">
        <div className="yt-search-title">{displayTitle}</div>
        <div className="yt-search-stats">{viewsText} · {timeAgoText}</div>
        <div className="yt-search-channel-row">
          <div className="yt-search-avatar" style={{ background: avatarColor }}>{initial}</div>
          <span className="yt-search-channel-name">{genres}</span>
        </div>
        <div className="yt-search-desc">{desc}</div>
        <div className="yt-search-badges">
          <span className="yt-search-badge">4K</span>
          <span className="yt-search-badge">SUB</span>
          <span className="yt-search-badge">DUB</span>
        </div>
      </div>
    </div>
  );
}

function SearchResults({ query, animeResults = [], movieResults = [], dramaResults = [], mangaResults = [], loading, onAnimeClick, onMovieClick, onDramaClick, onMangaClick }) {
  const [activeChip, setActiveChip] = useState('all');

  const allList = [
    ...animeResults.map(item => ({ ...item, _searchType: 'anime' })),
    ...movieResults.map(item => ({ ...item, _searchType: 'movie' })),
    ...dramaResults.map(item => ({ ...item, _searchType: 'drama' })),
    ...mangaResults.map(item => ({ ...item, _searchType: 'manga' })),
  ];

  const filteredList = activeChip === 'all'
    ? allList
    : allList.filter(item => item._searchType === activeChip);

  const hasResults = filteredList.length > 0;

  return (
    <div className="yt-search-page">
      <div className="yt-search-header-bar">
        <div className="yt-search-chip-group">
          <button className={`yt-search-chip ${activeChip === 'all' ? 'active' : ''}`} onClick={() => setActiveChip('all')}>
            All ({allList.length})
          </button>
          {animeResults.length > 0 && (
            <button className={`yt-search-chip ${activeChip === 'anime' ? 'active' : ''}`} onClick={() => setActiveChip('anime')}>
              Anime ({animeResults.length})
            </button>
          )}
          {movieResults.length > 0 && (
            <button className={`yt-search-chip ${activeChip === 'movie' ? 'active' : ''}`} onClick={() => setActiveChip('movie')}>
              Movies ({movieResults.length})
            </button>
          )}
          {dramaResults.length > 0 && (
            <button className={`yt-search-chip ${activeChip === 'drama' ? 'active' : ''}`} onClick={() => setActiveChip('drama')}>
              Dramas ({dramaResults.length})
            </button>
          )}
          {mangaResults.length > 0 && (
            <button className={`yt-search-chip ${activeChip === 'manga' ? 'active' : ''}`} onClick={() => setActiveChip('manga')}>
              Comics / Manga ({mangaResults.length})
            </button>
          )}
        </div>
        <button className="yt-search-filter-btn">
          <Sparkles size={16} /> Filters
        </button>
      </div>

      {loading ? (
        <div className="yt-search-list">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="yt-search-skeleton-item">
              <div className="yt-search-skeleton-thumb" />
              <div className="yt-search-skeleton-info">
                <div className="yt-skeleton-line" style={{ width: '80%', height: '20px' }} />
                <div className="yt-skeleton-line" style={{ width: '40%', height: '14px' }} />
                <div className="yt-skeleton-line" style={{ width: '30%', height: '14px' }} />
                <div className="yt-skeleton-line" style={{ width: '90%', height: '14px' }} />
              </div>
            </div>
          ))}
        </div>
      ) : hasResults ? (
        <div className="yt-search-list">
          {filteredList.map((item, idx) => (
            <YTSearchResultItem
              key={`${item._searchType}-${item.id || item.slug || item.movieplexSlug || idx}`}
              item={item}
              type={item._searchType}
              onClick={() => {
                if (item._searchType === 'anime') onAnimeClick(item.id);
                else if (item._searchType === 'movie') onMovieClick(item);
                else if (item._searchType === 'drama') onDramaClick(item);
                else if (item._searchType === 'manga') onMangaClick(item);
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: '#aaa' }}>
          <AlertCircle size={48} style={{ marginBottom: '1rem', color: '#717171' }} />
          <h3>No search results for "{query}"</h3>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Try checking your spelling or trying different keywords.
          </p>
        </div>
      )}
    </div>
  );
}

function GlobalLoader() {
  return (
    <div className="yt-top-bar" role="progressbar" aria-label="Loading...">
      <div className="yt-top-bar-fill" />
    </div>
  );
}

function InlineLoader({ label }) {
  return (
    <div className="inline-loader" role="status" aria-live="polite">
      <div className="blob-loader" />
      <p className="blob-loader-text">
        Loading<span className="blob-dots"><span>.</span><span>.</span><span>.</span></span>
      </p>
    </div>
  );
}

/* ''' Skeleton Components ''''''''''''''''''''''''''''''''''''''''''' */
function SkeletonHero() {
  return (
    <div className="skeleton-hero">
      <div className="skeleton-hero-bg skeleton-shimmer" />
      <div className="skeleton-hero-content">
        <div className="skeleton-badge skeleton-shimmer" />
        <div className="skeleton-title skeleton-shimmer" />
        <div className="skeleton-title skeleton-shimmer" style={{ width: '55%' }} />
        <div className="skeleton-meta">
          <div className="skeleton-pill skeleton-shimmer" />
          <div className="skeleton-pill skeleton-shimmer" />
          <div className="skeleton-pill skeleton-shimmer" />
        </div>
        <div className="skeleton-desc skeleton-shimmer" />
        <div className="skeleton-desc skeleton-shimmer" style={{ width: '70%' }} />
        <div className="skeleton-btns">
          <div className="skeleton-btn skeleton-shimmer" />
          <div className="skeleton-btn skeleton-shimmer" style={{ width: '140px' }} />
        </div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="skeleton-row">
      <div className="skeleton-row-title skeleton-shimmer" />
      <div className="skeleton-cards">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-card skeleton-shimmer" />
        ))}
      </div>
    </div>
  );
}

function CategorySkeleton() {
  return (
    <div className="skeleton-page">
      <SkeletonHero />
      <div className="netflix-rows" style={{ marginTop: '0' }}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  );
}

function Top10Row({ title, items, onAnimeClick }) {
  if (!items || items.length === 0) return null;

  return (
    <section className="hv-section top10-row-section">
      <div className="hv-section-header">
        <h2 className="hv-section-title">
          <Trophy className="hv-icon" size={20} style={{ color: 'var(--accent-primary)' }} /> {title}
        </h2>
        <span className="hv-section-line" />
      </div>
      <div className="top10-slider">
        {items.slice(0, 10).map((anime, index) => (
          <Top10Tile
            key={`top10-${anime.id}`}
            anime={anime}
            rank={index + 1}
            onClick={() => onAnimeClick(anime.id)}
          />
        ))}
      </div>
    </section>
  );
}

function Top10Tile({ anime, rank, onClick }) {
  return (
    <button className="top10-tile" onClick={onClick}>
      <div className="top10-rank-container">
        <span className="top10-rank-number">{rank}</span>
      </div>
      <div className="top10-card">
        <div className="top10-card-img-wrapper">
          <img src={anime.coverImage} alt={anime.title} loading="lazy" />
          <div className="top10-card-glow" />
        </div>
        <div className="top10-card-overlay">
          <span className="top10-card-rating"> {anime.rating}</span>
          <span className="top10-card-title">{anime.title}</span>
          <span className="top10-card-type">{anime.type}</span>
        </div>
      </div>
    </button>
  );
}

const HOME_FEATURED_ITEMS = [
  {
    id: 154587,
    title: "Frieren: Beyond Journey's End",
    badge: "Trending Anime",
    description: "After the party of heroes defeated the Demon King, elf mage Frieren sets out on a journey to understand humanity.",
    bannerImage: "/home-carousel/81wyRXGKnpL.jpg",
    coverImage: "/home-carousel/81wyRXGKnpL.jpg",
    type: "ANIME",
    rating: "9.3",
    hasHindiDub: true,
    actionType: "anime"
  }
];

//  YouTube Card Component 
function YTCard({ item, onClick, badge }) {
  const thumb = item.episodeThumbnail || item.bannerImage || item.coverImage || item.thumbnail || item.cover || '';
  const animeTitle = item.title || 'Untitled';
  const seasonNum = item.season || 1;
  const epNum = item.episode || 1;
  const displayTitle = `${animeTitle} | Season ${seasonNum} | Episode ${epNum}`;

  const channelText = item.genres?.slice(0, 2).join(' â€¢ ') || item.type || 'Anime';
  const viewsText = formatViews(item.popularity || item.viewsCount);
  const timeAgoText = formatRelativeTime(item.startDate, epNum);
  const durationText = item.formattedDuration || (item.rawDuration ? `${item.rawDuration}:00` : (item.duration && !isNaN(parseInt(item.duration)) ? `${parseInt(item.duration)}:00` : '23:45'));

  const initial = animeTitle.charAt(0).toUpperCase();
  const colorMap = { A:'#FF0000',B:'#3ea6ff',C:'#7B68EE',D:'#FF69B4',F:'#00C853',J:'#FF6D00',K:'#1DE9B6',M:'#AA00FF',N:'#FFD600',O:'#FF5252',S:'#00BCD4',T:'#8D6E63' };
  const avatarColor = colorMap[initial] || '#606060';

  return (
    <div className="yt-card" onClick={onClick} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="yt-card-thumb-wrap">
        {thumb ? (
          <img src={thumb} alt={displayTitle} loading="lazy" onError={e => { e.target.style.display='none'; }} />
        ) : (
          <div style={{ width:'100%',height:'100%',background:'#272727',display:'flex',alignItems:'center',justifyContent:'center',color:'#717171',fontSize:'14px' }}>No Image</div>
        )}
        {badge && <span className="yt-card-badge">{badge}</span>}
        <span className="yt-card-duration">{durationText}</span>
      </div>
      <div className="yt-card-meta">
        <div className="yt-card-avatar" style={{ background: avatarColor }}>
          <span style={{ color:'white',fontSize:'14px',fontWeight:'700',display:'flex',alignItems:'center',justifyContent:'center',height:'100%' }}>{initial}</span>
        </div>
        <div className="yt-card-info">
          <div className="yt-card-title">{displayTitle}</div>
          <div className="yt-card-channel">{channelText}</div>
          <div className="yt-card-stats">{viewsText} Â· {timeAgoText}</div>
        </div>
      </div>
    </div>
  );
}
//  Chip Bar Component 
function ChipBar({ chips, active, onSelect }) {
  return (
    <div className="yt-chip-bar">
      {chips.map(chip => (
        <button
          key={chip.id}
          className={`yt-chip ${active === chip.id ? 'active' : ''}`}
          onClick={() => onSelect(chip.id)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

//  HomeView (YouTube-style infinite scroll grid) 
function HomeView({ onAnimeClick, onStartWatching, onManhwaClick }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chipActive, setChipActive] = useState('all');
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);

  const HOME_CHIPS = [
    { id: 'all', label: 'All' },
    { id: 'anime', label: 'Anime' },
    { id: 'action', label: 'Action' },
    { id: 'adventure', label: 'Adventure' },
    { id: 'romance', label: 'Romance' },
    { id: 'comedy', label: 'Comedy' },
    { id: 'drama', label: 'Drama' },
    { id: 'fantasy', label: 'Fantasy' },
    { id: 'thriller', label: 'Thriller' },
    { id: 'popular', label: 'Popular' },
    { id: 'new', label: 'New' },
  ];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setItems([]);

    (async () => {
      let results;
      try {
        results = await Promise.allSettled([
          api.getAnimeList(),
          api.getTop10Famous(),
          api.getNewAndPopular(),
        ]);
      } catch (e) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (cancelled) return;

      const allItems = [];
      const seen = new Set();
      results.forEach(r => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          r.value.forEach(item => {
            if (item.id && !seen.has(String(item.id))) {
              seen.add(String(item.id));
              const epNum = Math.random() < 0.8 ? 1 : Math.floor(Math.random() * 3) + 2;
              allItems.push({ ...item, _contentType: 'anime', season: 1, episode: epNum });
            }
          });
        }
      });

      // Shuffle for variety
      for (let i = allItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
      }

      // Render immediately with fallback banners
      if (!cancelled) {
        setItems(allItems);
        setLoading(false);
      }

      // Background: resolve unique per-episode thumbnails in batches
      const BATCH_SIZE = 6;
      for (let start = 0; start < allItems.length; start += BATCH_SIZE) {
        if (cancelled) break;
        const batch = allItems.slice(start, start + BATCH_SIZE);
        const thumbResults = await Promise.allSettled(
          batch.map(item => resolveEpisodeThumbnail(item, item.episode, item.season || 1))
        );
        if (cancelled) break;
        setItems(prev => {
          const updated = [...prev];
          batch.forEach((item, idx) => {
            const thumb = thumbResults[idx].status === 'fulfilled' ? thumbResults[idx].value : null;
            const pos = updated.findIndex(u => u.id === item.id);
            if (pos !== -1 && thumb && thumb !== updated[pos].bannerImage) {
              updated[pos] = { ...updated[pos], episodeThumbnail: thumb };
            }
          });
          return updated;
        });
        await new Promise(r => setTimeout(r, 300));
      }
    })();

    return () => { cancelled = true; };
  }, [chipActive]);

  const filtered = chipActive === 'all'
    ? items
    : items.filter(item => {
        if (chipActive === 'popular' || chipActive === 'new') return true;
        return item.genres?.some(g => g.toLowerCase() === chipActive.toLowerCase());
      });

  return (
    <div className="yt-home-view">
      <ChipBar chips={HOME_CHIPS} active={chipActive} onSelect={setChipActive} />

      {loading ? (
        <div className="yt-content-grid">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="yt-card-skeleton">
              <div className="yt-skeleton-thumb" />
              <div className="yt-card-meta" style={{ padding: '4px 0' }}>
                <div className="yt-skeleton-avatar" />
                <div style={{ flex: 1 }}>
                  <div className="yt-skeleton-line" style={{ width: '90%' }} />
                  <div className="yt-skeleton-line" style={{ width: '60%', marginTop: '6px' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="yt-content-grid">
          {filtered.map(item => (
            <YTCard
              key={item.id}
              item={item}
              onClick={() => onStartWatching(item, item.episode || 1)}
            />
          ))}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
              No content found for this filter.
            </div>
          )}
        </div>
      )}
      <div ref={sentinelRef} style={{ height: '1px' }} />
    </div>
  );
}

//  AnimeView (YouTube-style chip + grid) 
function AnimeView({
  activeFeatured,
  featured = [],
  activeCategory = 'All',
  filteredTrending = [],
  top10Famous = [],
  setActiveCategory,
  onAnimeClick,
  onStartWatching,
  watchHistory = [],
  onDramaClick,
  onManhwaClick,
  hindiLoading = false
}) {
  const ANIME_CHIPS = [
    { id: 'All', label: 'All' },
    { id: 'Action', label: 'Action' },
    { id: 'Adventure', label: 'Adventure' },
    { id: 'Romance', label: 'Romance' },
    { id: 'Comedy', label: 'Comedy' },
    { id: 'Fantasy', label: 'Fantasy' },
    { id: 'Thriller', label: 'Thriller' },
    { id: 'Horror', label: 'Horror' },
    { id: 'Sci-Fi', label: 'Sci-Fi' },
    { id: 'Sports', label: 'Sports' },
    { id: 'Hindi', label: 'Hindi Dub' },
  ];

  const continueWatching = watchHistory.slice(0, 10).filter(h => h.type === 'anime' || !h.type);

  return (
    <div className="yt-section-view">
      {/* Chip filter bar */}
      <ChipBar chips={ANIME_CHIPS} active={activeCategory} onSelect={setActiveCategory} />

      {/* Continue Watching row (if exists) */}
      {continueWatching.length > 0 && (
        <div className="yt-section-block">
          <div className="yt-section-header">
            <span className="yt-section-title">Continue Watching</span>
          </div>
          <div className="yt-content-grid">
            {continueWatching.slice(0, 8).map(h => (
              <YTCard
                key={h.media_id || h.id}
                item={{ id: h.media_id || h.id, title: h.title, coverImage: h.cover || h.coverImage, rating: 'N/A', genres: [] }}
                badge={`Ep. ${h.episode_number || '?'}`}
                onClick={() => onAnimeClick(h.media_id || h.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Top 10 */}
      {top10Famous.length > 0 && (
        <div className="yt-section-block">
          <div className="yt-section-header">
            <span className="yt-section-title"> Top 10 This Week</span>
          </div>
          <div className="yt-content-grid">
            {top10Famous.slice(0, 10).map((anime, i) => (
              <YTCard
                key={anime.id}
                item={anime}
                badge={`#${i + 1}`}
                onClick={() => onStartWatching(anime, 1)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="yt-section-block">
        <div className="yt-section-header">
          <span className="yt-section-title">
            {activeCategory === 'All' ? 'Trending Anime' : activeCategory === 'Hindi' ? 'Hindi Dubbed Anime' : `${activeCategory} Anime`}
          </span>
          {featured.length > 0 && (
            <button className="yt-section-more" onClick={() => onAnimeClick(featured[0]?.id)}>
              View all â†’
            </button>
          )}
        </div>
        <div className="yt-content-grid">
          {filteredTrending.length > 0 ? (
            filteredTrending.map(anime => (
              <YTCard
                key={anime.id}
                item={anime}
                onClick={() => onStartWatching(anime, 1)}
              />
            ))
          ) : (activeCategory === 'Hindi' && hindiLoading) || (activeCategory === 'All' && featured.length === 0) ? (
            Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="yt-card-skeleton">
                <div className="yt-skeleton-thumb" />
                <div className="yt-card-meta" style={{ padding: '4px 0' }}>
                  <div className="yt-skeleton-avatar" />
                  <div style={{ flex: 1 }}>
                    <div className="yt-skeleton-line" style={{ width: '90%' }} />
                    <div className="yt-skeleton-line" style={{ width: '60%', marginTop: '6px' }} />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ gridColumn: '1 / -1', padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No {activeCategory} anime found at the moment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function NetflixRow({ title, icon, items, onAnimeClick, progress = false, ranked = false }) {
  const sliderRef = useRef(null);
  const [hoverZone, setHoverZone] = useState(null); // 'left' | 'right' | null
  const [dwellProgress, setDwellProgress] = useState(0); // 0 to 100
  const [isSliding, setIsSliding] = useState(false);

  const dwellTimerRef = useRef(null);
  const animFrameRef = useRef(null);
  const hoverStartTimeRef = useRef(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  const stopAutoScroll = () => {
    if (dwellTimerRef.current) clearInterval(dwellTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    dwellTimerRef.current = null;
    animFrameRef.current = null;
    hoverStartTimeRef.current = null;
    setDwellProgress(0);
    setHoverZone(null);
    setIsSliding(false);
  };

  const startContinuousSlide = (direction) => {
    setIsSliding(true);
    const slideStep = () => {
      const slider = sliderRef.current;
      if (!slider) return;

      const speed = direction === 'right' ? 7 : -7;
      slider.scrollLeft += speed;

      // Check boundary conditions
      if (direction === 'right' && slider.scrollLeft >= slider.scrollWidth - slider.clientWidth - 2) {
        stopAutoScroll();
        return;
      }
      if (direction === 'left' && slider.scrollLeft <= 2) {
        stopAutoScroll();
        return;
      }

      animFrameRef.current = requestAnimationFrame(slideStep);
    };

    animFrameRef.current = requestAnimationFrame(slideStep);
  };

  const handleMouseMove = (e) => {
    const slider = sliderRef.current;
    if (!slider) return;

    const rect = slider.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dist = Math.hypot(x - lastMousePosRef.current.x, y - lastMousePosRef.current.y);
    lastMousePosRef.current = { x, y };

    const width = rect.width;
    const zoneWidth = Math.max(100, width * 0.15); // End 15% edge zone

    let newZone = null;
    if (x >= width - zoneWidth && slider.scrollLeft < slider.scrollWidth - slider.clientWidth - 5) {
      newZone = 'right';
    } else if (x <= zoneWidth && slider.scrollLeft > 5) {
      newZone = 'left';
    }

    if (newZone !== hoverZone) {
      stopAutoScroll();
      if (newZone) {
        setHoverZone(newZone);
        hoverStartTimeRef.current = Date.now();

        dwellTimerRef.current = setInterval(() => {
          if (!hoverStartTimeRef.current) return;
          const elapsed = Date.now() - hoverStartTimeRef.current;
          const pct = Math.min(100, (elapsed / 3000) * 100);
          setDwellProgress(pct);

          if (elapsed >= 3000) {
            clearInterval(dwellTimerRef.current);
            dwellTimerRef.current = null;
            startContinuousSlide(newZone);
          }
        }, 30);
      }
    } else if (hoverZone && dist > 150) {
      stopAutoScroll();
    }
  };

  const handleMouseLeave = () => {
    stopAutoScroll();
  };

  const handleWheel = (e) => {
    const slider = sliderRef.current;
    if (!slider) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      slider.scrollLeft += e.deltaY;
    }
  };

  const manualScroll = (direction) => {
    stopAutoScroll();
    const slider = sliderRef.current;
    if (!slider) return;
    const scrollAmount = slider.clientWidth * 0.75;
    slider.scrollBy({
      left: direction === 'right' ? scrollAmount : -scrollAmount,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    return () => stopAutoScroll();
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className="hv-section netflix-row">
      <div className="hv-section-header">
        <h2 className="hv-section-title">
          {icon && <span className="hv-title-accent">{icon}</span>} {title}
        </h2>
        <span className="hv-section-line" />

        {hoverZone && (
          <div className="auto-slide-banner">
            <span>{isSliding ? 'Auto-sliding...' : `Hold cursor at edge to slide (${Math.max(1, Math.ceil((3000 - (dwellProgress / 100) * 3000) / 1000))}s)`}</span>
            <div className="auto-slide-progress-bar">
              <div className="auto-slide-progress-fill" style={{ width: `${dwellProgress}%` }} />
            </div>
          </div>
        )}
      </div>

      <div
        className="row-container-wrapper"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        <button
          className="row-scroll-btn row-scroll-btn--left"
          onClick={() => manualScroll('left')}
          title="Scroll Left"
        >
          <ChevronLeft size={22} />
        </button>

        <div ref={sliderRef} className={`netflix-slider ${ranked ? 'ranked-row' : ''}`}>
          {items.map((anime, index) => (
            <NetflixTile
              key={`${title}-${anime.id}`}
              anime={anime}
              rank={ranked ? index + 1 : null}
              progress={progress
                ? (anime.progressPercent !== undefined ? anime.progressPercent : ((index + 2) * 13) % 88)
                : null
              }
              onClick={() => onAnimeClick(anime)}
            />
          ))}
        </div>

        <button
          className="row-scroll-btn row-scroll-btn--right"
          onClick={() => manualScroll('right')}
          title="Scroll Right"
        >
          <ChevronRight size={22} />
        </button>
      </div>
    </section>
  );
}

function NetflixTile({ anime, rank, progress, onClick }) {
  return (
    <button className={`netflix-tile ${rank ? 'ranked-tile' : ''}`} onClick={onClick}>
      {rank && <span className="tile-rank">{rank}</span>}
      <span className="tile-art">
        <img src={anime.bannerImage || anime.coverImage} alt={anime.title} loading="lazy" />
        <span className="tile-logo-mark">N</span>
        <span className="tile-hover-overlay">
          <span className="tile-hover-play"><Play size={20} fill="white" style={{ color: 'white' }} /></span>
        </span>
        {progress !== null && (
          <span className="watch-progress">
            <span style={{ width: `${progress}%` }} />
          </span>
        )}
        {anime.rating && anime.rating !== 'N/A' && (
          <span className="tile-rating-badge"> {anime.rating}</span>
        )}
      </span>
      <span className="tile-info">
        <strong>{anime.title}</strong>
        <small>{anime.subtitle || `${anime.type} Â· ${anime.rating}`}</small>
      </span>
    </button>
  );
}

function GenreView({ genreName, items = [], isLoading, loadingMore = false, hasMore = true, onAnimeClick, onStartWatching }) {
  if (isLoading) {
    return <CategorySkeleton />;
  }

  const featured = items[0] || null;

  return (
    <div className="genre-view-container" style={{ paddingTop: '5.5rem', paddingBottom: '5rem' }}>
      {/*  Glassmorphic Genre Hero Card  */}
      <div className="container">
        <div
          className="genre-hero-glass-card"
          style={{
            position: 'relative',
            borderRadius: '20px',
            overflow: 'hidden',
            marginBottom: '2.5rem',
            background: 'rgba(18, 18, 28, 0.65)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            minHeight: '300px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {/* Background Image & Blur */}
          {featured && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url(${featured.bannerImage || featured.coverImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.35,
                filter: 'blur(4px)',
                transform: 'scale(1.05)',
              }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, #09090d 0%, rgba(9,9,13,0.85) 50%, rgba(9,9,13,0.4) 100%)',
            }}
          />

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 2, padding: '3rem 2.5rem', maxWidth: '680px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.9rem',
                borderRadius: '20px',
                background: 'rgba(229, 9, 20, 0.15)',
                border: '1px solid rgba(229, 9, 20, 0.4)',
                color: '#ff4d4d',
                fontSize: '0.72rem',
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '1rem',
              }}
            >
              <Sparkles size={14} /> {genreName} COLLECTION
            </div>

            <h1
              style={{
                fontSize: '3rem',
                fontWeight: 900,
                color: '#fff',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                marginBottom: '0.8rem',
              }}
            >
              {genreName} Anime
            </h1>

            <p style={{ color: '#9ca3af', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Explore the complete {genreName.toLowerCase()} anime universe. Stream top-rated series, movies, and trending releases in high quality.
            </p>

            {featured && (
              <div style={{ display: 'flex', gap: '0.85rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => onStartWatching(featured, 1)}
                  style={{
                    borderRadius: '24px',
                    padding: '0.7rem 1.8rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 18px rgba(229, 9, 20, 0.4)',
                  }}
                >
                  <Play size={18} fill="currentColor" /> Watch Spotlight
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => onAnimeClick(featured.id)}
                  style={{
                    borderRadius: '24px',
                    padding: '0.7rem 1.6rem',
                    background: 'rgba(255,255,255,0.08)',
                    borderColor: 'rgba(255,255,255,0.15)',
                  }}
                >
                  View Details
                </button>
              </div>
            )}
          </div>
        </div>

        {/*  Section Title  */}
        <div className="hv-section-header" style={{ marginBottom: '1.8rem' }}>
          <h2 className="hv-section-title" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
            <Sparkles className="hv-icon" size={20} style={{ color: '#e50914' }} />
            All {genreName} Anime ({items.length})
          </h2>
          <span className="hv-section-line" />
        </div>

        {/*  16:9 Bento Cards Grid  */}
        <div
          className="bento-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '1.3rem',
          }}
        >
          {items.map((item) => (
            <AnimeCard
              key={item.id}
              anime={item}
              onClick={() => onAnimeClick(item.id)}
              variant="bento"
            />
          ))}
        </div>

        {/*  Infinite Scroll Skeleton Loader  */}
        {loadingMore && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '1.3rem',
              marginTop: '1.3rem',
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={`more-skel-${i}`}
                className="skeleton-bento-card"
                style={{ height: '200px', borderRadius: '14px' }}
              />
            ))}
          </div>
        )}

        {/* 200 items limit reached notice */}
        {!hasMore && items.length >= 200 && (
          <div style={{ textAlign: 'center', padding: '3.5rem 0', color: '#6b7280', fontSize: '0.85rem' }}>
            Showing top 200 {genreName} anime. Explore other categories from the left slider menu!
          </div>
        )}
      </div>
    </div>
  );
}

function DetailView({ anime, franchiseList = [], myList = [], onToggleWatchlist, onAnimeSelect, onBackHome, onStartWatching, subscriptions = [], onToggleSubscribe }) {
  const EPISODES_PER_PART = 100;
  const totalPages = anime.episodePagination?.lastPage || 1;
  const totalEpisodes = anime.totalEpisodes || anime.episodes?.length || 0;

  const isSubscribed = subscriptions.some(s => String(s.id || s.media_id) === String(anime.id));

  const getPartLabel = (pageNum) => {
    const start = (pageNum - 1) * EPISODES_PER_PART + 1;
    const end = Math.min(pageNum * EPISODES_PER_PART, totalEpisodes);
    if (totalPages <= 1) return 'Season 1';
    return `Part ${pageNum} (Ep ${start}\u2013${end})`;
  };

  const [selectedPart, setSelectedPart] = React.useState(1);
  const [pageEpisodes, setPageEpisodes] = React.useState(anime.episodes || []);
  const [loadingPage, setLoadingPage] = React.useState(false);
  const [filter, setFilter] = React.useState('all');
  const [showSeasonDropdown, setShowSeasonDropdown] = React.useState(false);
  const dropdownRef = React.useRef(null);

  // Close season dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowSeasonDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    // Reset selection to part 1 when selected anime changes
    setSelectedPart(1);
  }, [anime.id]);

  React.useEffect(() => {
    if (selectedPart === 1) {
      setPageEpisodes(anime.episodes || []);
      return;
    }
    if (!anime.malId) return;
    setLoadingPage(true);
    api.getEpisodePage(anime.malId, selectedPart).then((data) => {
      if (data && data.episodes) {
        setPageEpisodes(data.episodes.map(ep => ({
          id: null,
          number: ep.number,
          title: ep.title,
          aired: ep.aired,
          score: ep.score,
          filler: ep.filler,
          recap: ep.recap,
          thumbnail: anime.bannerImage || anime.coverImage,
          sources: []
        })));
      }
    }).finally(() => setLoadingPage(false));
  }, [selectedPart, anime.malId, anime.episodes]);

  const filteredEpisodes = pageEpisodes.filter(ep => {
    if (filter === 'canon') return !ep.filler && !ep.recap;
    if (filter === 'filler') return ep.filler;
    if (filter === 'recap') return ep.recap;
    return true;
  });

  const isLongRunning = totalPages > 1;
  const hasFranchise = franchiseList.length > 1;

  // Build season/franchise selector options (mirrors WatchView logic)
  const seasonOptions = [];
  if (franchiseList && franchiseList.length > 0) {
    franchiseList.forEach(item => {
      const isActive = item.id === anime.id;
      if (isActive && isLongRunning) {
        for (let p = 1; p <= totalPages; p++) {
          const start = (p - 1) * EPISODES_PER_PART + 1;
          const end = Math.min(p * EPISODES_PER_PART, totalEpisodes || (p * EPISODES_PER_PART));
          seasonOptions.push({
            id: item.id,
            title: `${item.title} - Part ${p} (Ep ${start}â€“${end})`,
            part: p,
            isActive: isActive && selectedPart === p
          });
        }
      } else {
        seasonOptions.push({
          id: item.id,
          title: `${item.title} (${item.format || ''})`.trim(),
          part: 1,
          isActive
        });
      }
    });
  }
  if (seasonOptions.length === 0) {
    seasonOptions.push({ id: anime.id, title: 'Season 1', part: 1, isActive: true });
  }
  const activeOption = seasonOptions.find(opt => opt.isActive) || seasonOptions[0];
  const activeLabel = activeOption ? activeOption.title : 'Select Season';

  return (
    <div>
      <div
        className="detail-banner"
        style={{ backgroundImage: `url(${anime.bannerImage || anime.coverImage})` }}
      >
        <div className="detail-banner-overlay"></div>
      </div>

      <div className="container">
        <div className="detail-content">
          <div className="detail-left">
            <div className="detail-poster">
              <img src={anime.coverImage} alt={anime.title} />
            </div>
          </div>
          <div className="detail-right">
            <h1 className="detail-title">{anime.title}</h1>
            <div className="detail-sub">{anime.japaneseTitle}</div>

            <div className="detail-tags">
              <div className="detail-tag" style={{ borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}>
                {'\u2605'} {anime.rating}
              </div>
              <div className="detail-tag">{anime.type}</div>
              <div className="detail-tag">{anime.status}</div>
              {anime.totalEpisodes && (
                <div className="detail-tag">{anime.totalEpisodes} Episodes</div>
              )}
              {anime.genres?.map((genre) => (
                <div key={genre} className="detail-tag">{genre}</div>
              ))}
            </div>

            <p className="detail-synopsis">{anime.description}</p>

            <div className="btn-group">
              <button className="btn btn-primary" onClick={() => onStartWatching(anime, 1)}>
                <Play size={18} fill="currentColor" /> Play Episode 1
              </button>
              <button
                className={`btn ${isSubscribed ? 'btn-subscribed' : 'btn-subscribe'}`}
                onClick={() => onToggleSubscribe && onToggleSubscribe(anime)}
              >
                <Bell size={18} fill={isSubscribed ? "currentColor" : "none"} />
                {isSubscribed ? 'Subscribed' : 'Subscribe'}
              </button>
              <button
                className={`btn ${myList.some(item => item.id === anime.id) ? 'âœ“ Saved' : '+ Save'}`}
                onClick={() => onToggleWatchlist(anime)}
              >
                {myList.some(item => item.id === anime.id) ? 'âœ“ In My List' : '+ My List'}
              </button>
              <button className="btn btn-secondary" onClick={onBackHome}>
                Back to Home
              </button>
            </div>
          </div>
        </div>

        {/* Episodes Section */}
        <div className="episodes-section">
          <div className="episodes-section-header">
            <h2 className="section-title">Episodes</h2>

            <div className="episodes-controls">
              {/* Franchise / Season Selector */}
              {hasFranchise && (
                <div className="franchise-selector" ref={dropdownRef}>
                  <button className="franchise-btn" onClick={() => setShowSeasonDropdown(v => !v)}>
                    <span>{activeLabel}</span>
                    <ChevronDown size={14} />
                  </button>
                  {showSeasonDropdown && (
                    <div className="franchise-dropdown">
                      {seasonOptions.map((opt, idx) => (
                        <button
                          key={`${opt.id}-${idx}`}
                          className={`franchise-option ${opt.isActive ? "active" : ""}`}
                          onClick={() => {
                            if (opt.id !== anime.id) {
                              const target = franchiseList.find(f => f.id === opt.id);
                              if (target) onAnimeSelect(target);
                            } else { setSelectedPart(opt.part || 1); }
                            setShowSeasonDropdown(false);
                          }}>
                          {opt.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Filter pills for DetailView */}
              <div className="episodes-filter-bar">
                {[["all","All"],["canon","Canon"],["filler","Filler"],["recap","Recap"]].map(([f,label]) => (
                  <button key={f} className={`ep-filter-pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{label}</button>
                ))}
              </div>
            </div>
          </div>
          {/* Episode Grid */}
          <div className="episodes-grid">
            {loadingPage ? (
              Array.from({length: 12}).map((_, i) => <BentoEpisodeSkeleton key={i} />)
            ) : filteredEpisodes.length === 0 ? (
              <div className="episodes-empty">No episodes found.</div>
            ) : filteredEpisodes.map(ep => (
              <div
                key={ep.id || ep.number}
                className={`ep-bento-card ${ep.number === 1 ? "active" : ""}`}
                onClick={() => onStartWatching(anime, ep.number)}
              >
                <div className="ep-bento-number">{ep.number}</div>
                <div className="ep-bento-thumb">
                  {ep.thumbnail ? <img src={ep.thumbnail} alt={`Episode ${ep.number}`} loading="lazy" /> : <div className="ep-bento-thumb-placeholder"><Play size={16} /></div>}
                </div>
                <div className="ep-bento-info">
                  <div className="ep-bento-header">
                    <div className="ep-bento-title">{ep.title && ep.title !== `Episode ${ep.number}` ? ep.title : `Episode ${ep.number}`}</div>
                    {ep.filler && <span className="ep-bento-badge filler">Filler</span>}
                    {ep.recap && <span className="ep-bento-badge recap">Recap</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WatchView({
  anime,
  episode,
  source,
  franchiseList = [],
  currentSourceIndex,
  loadingSources,
  setCurrentSourceIndex,
  onStartWatching,
  onAnimeSelect,
  audioMode = 'sub',
  setAudioMode,
  showToast,
  onOpenSaveModal,
  onToggleLike,
  isLiked,
  subscriptions = [],
  onToggleSubscribe
}) {
  const EPISODES_PER_PART = 100;
  const totalPages = anime.episodePagination?.lastPage || 1;
  const isLongRunning = totalPages > 1;
  const defaultPart = Math.ceil(episode.number / EPISODES_PER_PART) || 1;

  const [selectedPart, setSelectedPart] = React.useState(defaultPart);
  const [episodesList, setEpisodesList] = React.useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = React.useState(false);
  const [filter, setFilter] = React.useState('all');
  const [showSeasonDropdown, setShowSeasonDropdown] = React.useState(false);
  const [cbfPool, setCbfPool] = React.useState([]);
  const [cbfPage, setCbfPage] = React.useState(1);
  const [visibleCbfCount, setVisibleCbfCount] = React.useState(8);
  const [cbfLoadingMore, setCbfLoadingMore] = React.useState(false);
  const [liked, setLiked] = React.useState(false);
  const [descExpanded, setDescExpanded] = React.useState(false);

  const isSubscribed = subscriptions.some(s => String(s.id || s.media_id) === String(anime.id));

  const currentEpNum = episode.number || 1;
  const totalEpCount = anime.totalEpisodes || anime.episodes?.length || (episodesList.length || 1000);
  const hasPrevEp = currentEpNum > 1;
  const hasNextEp = currentEpNum < totalEpCount;

  const handlePrevEp = () => {
    if (hasPrevEp && onStartWatching) {
      onStartWatching(anime, currentEpNum - 1, true, audioMode);
    }
  };

  const handleNextEp = () => {
    if (hasNextEp && onStartWatching) {
      onStartWatching(anime, currentEpNum + 1, true, audioMode);
    }
  };

  const dropdownRef = React.useRef(null);
  const activeEpisodeRef = React.useRef(null);
  const secondaryColRef = React.useRef(null);

  // Sync part with current episode number when it changes
  React.useEffect(() => {
    const currentPart = Math.ceil(episode.number / EPISODES_PER_PART) || 1;
    setSelectedPart(currentPart);
  }, [episode.number]);

  // Handle click outside to close dropdown
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowSeasonDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch episodes when part changes
  React.useEffect(() => {
    if (selectedPart === 1) {
      setEpisodesList(anime.episodes || []);
      return;
    }
    if (!anime.malId) {
      setEpisodesList([]);
      return;
    }
    setLoadingEpisodes(true);
    const fetchPromise = api.getEpisodePage(anime.malId, selectedPart);
    const delayPromise = new Promise(resolve => setTimeout(resolve, 800));
    Promise.all([fetchPromise, delayPromise]).then(([data]) => {
      if (data && data.episodes) {
        setEpisodesList(data.episodes.map(ep => ({
          id: null,
          number: ep.number,
          title: ep.title,
          filler: ep.filler,
          recap: ep.recap,
          thumbnail: anime.bannerImage || anime.coverImage,
          sources: []
        })));
      }
    }).finally(() => setLoadingEpisodes(false));
  }, [selectedPart, anime.malId, anime.episodes]);

  // Center active episode in viewport if needed
  React.useEffect(() => {
    if (activeEpisodeRef.current) {
      setTimeout(() => {
        activeEpisodeRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }, 400);
    }
  }, [episode.number, loadingEpisodes]);

  const hasProviderProblem = ['fallback', 'error', 'unavailable'].includes(episode.provider);

  // Generate Season dropdown options
  const seasonOptions = [];
  if (franchiseList && franchiseList.length > 0) {
    franchiseList.forEach(item => {
      const isActive = item.id === anime.id;
      if (isActive) {
        if (isLongRunning) {
          for (let p = 1; p <= totalPages; p++) {
            const start = (p - 1) * EPISODES_PER_PART + 1;
            const end = Math.min(p * EPISODES_PER_PART, anime.totalEpisodes || (p * EPISODES_PER_PART));
            seasonOptions.push({
              id: item.id,
              title: `${item.title} - Part ${p} (Ep ${start}â€“${end})`,
              part: p,
              isActive: isActive && selectedPart === p
            });
          }
        } else {
          seasonOptions.push({
            id: item.id,
            title: `${item.title} (${item.format})`,
            part: 1,
            isActive: true
          });
        }
      } else {
        seasonOptions.push({
          id: item.id,
          title: `${item.title} (${item.format})`,
          part: 1,
          isActive: false
        });
      }
    });
  }

  // Fallback if no franchise list
  if (seasonOptions.length === 0) {
    if (isLongRunning) {
      for (let p = 1; p <= totalPages; p++) {
        const start = (p - 1) * EPISODES_PER_PART + 1;
        const end = Math.min(p * EPISODES_PER_PART, anime.totalEpisodes || (p * EPISODES_PER_PART));
        seasonOptions.push({
          id: anime.id,
          title: `Season 1 - Part ${p} (Ep ${start}â€“${end})`,
          part: p,
          isActive: selectedPart === p
        });
      }
    } else {
      seasonOptions.push({
        id: anime.id,
        title: `Season 1`,
        part: 1,
        isActive: true
      });
    }
  }

  const activeOption = seasonOptions.find(opt => opt.isActive) || seasonOptions[0];
  const activeLabel = activeOption ? activeOption.title : 'Select Season';

  // Filtered episodes
  const filteredEpisodes = episodesList.filter(ep => {
    if (filter === 'canon') return !ep.filler && !ep.recap;
    if (filter === 'filler') return ep.filler;
    if (filter === 'recap') return ep.recap;
    return true;
  });

  // Initialize CBF Pool when selected anime changes
  React.useEffect(() => {
    if (!anime) return;
    setCbfPage(1);
    setVisibleCbfCount(8);
    const initialPool = window.__eetnet_trending_pool__ || [];
    if (initialPool.length > 0) {
      setCbfPool(initialPool);
    } else {
      api.getAnimeList(1, 30).then(list => {
        if (list && list.length > 0) {
          window.__eetnet_trending_pool__ = list;
          setCbfPool(list);
        }
      }).catch(() => {});
    }
  }, [anime?.id]);

  // Compute recommendations dynamically over the entire pool
  const cbfRecs = React.useMemo(() => {
    if (!anime || !cbfPool || cbfPool.length === 0) return [];
    return getRecommendations(anime, cbfPool, cbfPool.length);
  }, [anime, cbfPool]);

  const displayedCbfRecs = cbfRecs.slice(0, visibleCbfCount);

  // Load more CBF recommendations
  const loadMoreCbf = React.useCallback(async () => {
    if (cbfLoadingMore) return;
    if (visibleCbfCount < cbfRecs.length) {
      setVisibleCbfCount(prev => Math.min(prev + 8, cbfRecs.length));
      return;
    }
    setCbfLoadingMore(true);
    try {
      const nextPage = cbfPage + 1;
      const newItems = await api.getAnimeList(nextPage, 30);
      if (newItems && newItems.length > 0) {
        setCbfPool(prev => {
          const existingIds = new Set(prev.map(item => String(item.id)));
          const filteredNew = newItems.filter(item => !existingIds.has(String(item.id)));
          return [...prev, ...filteredNew];
        });
        setCbfPage(nextPage);
        setVisibleCbfCount(prev => prev + 8);
      }
    } catch (err) {
      console.warn('[CBF] Failed to fetch more recommendations:', err);
    } finally {
      setCbfLoadingMore(false);
    }
  }, [cbfLoadingMore, visibleCbfCount, cbfRecs.length, cbfPage]);

  // Attach infinite scroll listener on window
  React.useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.scrollHeight - 450;
      if (scrollPos >= threshold) {
        loadMoreCbf();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMoreCbf]);

  const franchiseIndex = franchiseList.findIndex(item => item.id === anime.id);
  const seasonNum = franchiseIndex !== -1 ? franchiseIndex + 1 : 1;

  return (
    <div className="yt-watch-page">
      {/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ 2-Column Grid Layout Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className="yt-watch-layout">

        {/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ LEFT COLUMN: Primary Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <div className="yt-watch-primary">

          {/* Video Player */}
          <div className="yt-player-wrap">
            {loadingSources ? (
              <LoadingPlayer />
            ) : (
              <VideoPlayer
                source={source}
                poster={episode.thumbnail || anime.bannerImage}
                subtitles={episode?.subtitles}
                malId={anime.idMal}
                episodeNumber={episode.number}
                onNextEpisode={handleNextEp}
                onPrevEpisode={handlePrevEp}
                hasNextEpisode={hasNextEp}
                hasPrevEpisode={hasPrevEp}
                className="yt-player-skin"
              />
            )}
            {hasProviderProblem && <ProviderWarning error={episode.error} />}
          </div>

          {/* Title block */}
          <div className="yt-watch-title-block">
            <h1 className="yt-watch-title">
              {anime.title}
            </h1>
            <div className="yt-watch-ep-label">
              Season {seasonNum} Ã‚Â· Episode {episode.number}{episode.title && episode.title !== `Episode ${episode.number}` ? `  ${episode.title}` : ''}
            </div>
          </div>

          {/* Action bar */}
          <div className="yt-watch-action-bar">
            <div className="yt-watch-action-left">
              {/* Audio mode */}
              <div className="yt-audio-pills">
                {['sub','dub','hindi'].map(mode => (
                  <button
                    key={mode}
                    className={`yt-audio-pill ${audioMode === mode ? 'active' : ''}`}
                    onClick={() => {
                      if (setAudioMode) setAudioMode(mode);
                      if (onStartWatching) onStartWatching(anime, episode.number, true, mode);
                    }}
                  >
                    {mode === 'sub' ? 'ðŸ‡¯ðŸ‡µ SUB' : mode === 'dub' ? 'ðŸ‡ºðŸ‡¸ DUB' : 'ðŸ‡®ðŸ‡³ HIN'}
                    {mode === 'hindi' && anime.hindiAvailable && (
                      <span className="yt-hindi-badge">âœ“</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="yt-watch-action-right">
              <button
                className={`yt-action-btn ${isSubscribed ? 'btn-subscribed' : 'btn-subscribe'}`}
                onClick={() => onToggleSubscribe && onToggleSubscribe(anime)}
                style={{ height: '36px', padding: '0 1rem' }}
              >
                <Bell size={16} fill={isSubscribed ? "currentColor" : "none"} />
                <span>{isSubscribed ? 'Subscribed' : 'Subscribe'}</span>
              </button>
              <button
                className={`yt-action-btn ${(isLiked || liked) ? 'active' : ''}`}
                onClick={() => {
                  setLiked(v => !v);
                  if (onToggleLike) onToggleLike({ ...anime, episode_number: episode.number });
                }}
              >
                <ThumbsUp size={18} fill={(isLiked || liked) ? "currentColor" : "none"} />
                <span>{(isLiked || liked) ? 'Liked' : 'Like'}</span>
              </button>
              <button
                className="yt-action-btn"
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(window.location.href);
                  }
                  if (showToast) showToast('Link copied to clipboard!');
                }}
              >
                <Share2 size={18} />
                <span>Share</span>
              </button>
              <button
                className="yt-action-btn"
                onClick={() => {
                  if (onOpenSaveModal) onOpenSaveModal({ ...anime, episode_number: episode.number });
                }}
              >
                <Bookmark size={18} />
                <span>Save</span>
              </button>
              <button className="yt-action-btn">
                <MoreHorizontal size={18} />
              </button>
            </div>
          </div>

          {/* Server selector */}
          {episode.sources && episode.sources.length > 1 && (
            <div className="yt-server-selector">
              <span className="yt-server-label">Server / Quality:</span>
              {episode.sources.map((src, idx) => (
                <button
                  key={`${src.url}-${idx}`}
                  className={`yt-server-btn ${currentSourceIndex === idx ? 'active' : ''}`}
                  onClick={() => setCurrentSourceIndex(idx)}
                >
                  {src.quality || `Server ${idx + 1}`}
                </button>
              ))}
            </div>
          )}

          {/* Description */}
          {anime.description && (
            <div className="yt-watch-desc-block">
              <p
                className={`yt-watch-desc ${descExpanded ? 'expanded' : ''}`}
                onClick={() => setDescExpanded(v => !v)}
              >
                {anime.description}
              </p>
              <button className="yt-desc-toggle" onClick={() => setDescExpanded(v => !v)}>
                {descExpanded ? 'Show less' : 'more'}
              </button>
            </div>
          )}
        </div>

        {/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ RIGHT COLUMN: Secondary Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <div className="yt-watch-secondary" ref={secondaryColRef}>

          {/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Season Panel (YouTube playlist bento) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
          <div className="yt-season-panel">
            {/* Panel header */}
            <div className="yt-season-panel-header">
              <div className="yt-season-panel-header-left">
                <div className="yt-season-panel-title">Episodes</div>
                <div className="yt-season-panel-subtitle">
                  {filteredEpisodes.length} episodes
                </div>
              </div>
              {/* Clickable Season Selector */}
              <div className="yt-season-selector-wrap" ref={dropdownRef}>
                <button
                  className="yt-season-selector-btn"
                  onClick={() => setShowSeasonDropdown(v => !v)}
                >
                  <span>{activeLabel}</span>
                  <ChevronDown size={14} />
                </button>
                {showSeasonDropdown && (
                  <div className="yt-season-dropdown">
                    {seasonOptions.map((opt, idx) => (
                      <button
                        key={`${opt.id}-${idx}`}
                        className={`yt-season-option ${opt.isActive ? 'active' : ''}`}
                        onClick={() => {
                          if (opt.id !== anime.id) {
                            if (onAnimeSelect) onAnimeSelect(opt.id);
                          } else {
                            setSelectedPart(opt.part || 1);
                          }
                          setShowSeasonDropdown(false);
                        }}
                      >
                        {opt.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Filter pills */}
            <div className="yt-ep-filters">
              {['all','canon','filler','recap'].map(f => (
                <button
                  key={f}
                  className={`yt-ep-filter-pill ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'All' : f === 'canon' ? 'Canon' : f === 'filler' ? 'Filler' : 'Recap'}
                </button>
              ))}
            </div>

            {/* Episode bento list */}
            <div className="yt-ep-bento-list">
              {loadingEpisodes ? (
                Array.from({ length: 6 }).map((_, i) => <BentoEpisodeSkeleton key={i} />)
              ) : filteredEpisodes.length === 0 ? (
                <div className="yt-ep-empty">No episodes found.</div>
              ) : (
                filteredEpisodes.map(ep => {
                  const isActive = ep.number === episode.number;
                  return (
                    <div
                      key={ep.id || ep.number}
                      ref={isActive ? activeEpisodeRef : null}
                      className={`ep-bento-card ${isActive ? 'active' : ''} ${ep.filler ? 'filler' : ''}`}
                      onClick={() => {
                        if (!isActive && onStartWatching) {
                          onStartWatching(anime, ep.number, true, audioMode);
                        }
                      }}
                    >
                      <div className="ep-bento-number">{ep.number}</div>
                      <div className="ep-bento-thumb">
                        {ep.thumbnail ? (
                          <img src={ep.thumbnail} alt={ep.title || `Episode ${ep.number}`} loading="lazy" />
                        ) : (
                          <div className="ep-bento-thumb-placeholder">
                            <Play size={16} />
                          </div>
                        )}
                        {isActive && <div className="ep-bento-playing-overlay"><div className="ep-bento-playing-bar" /><div className="ep-bento-playing-bar" /><div className="ep-bento-playing-bar" /></div>}
                      </div>
                      <div className="ep-bento-info">
                        <div className="ep-bento-header">
                          <div className="ep-bento-title">{ep.title || `Episode ${ep.number}`}</div>
                          {ep.filler && <span className="ep-bento-badge filler">Filler</span>}
                          {ep.recap && <span className="ep-bento-badge recap">Recap</span>}
                        </div>
                        <div className="ep-bento-sub">{anime.title}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Up Next / Recommendations Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
          <div className="yt-cbf-section">
            <div className="yt-cbf-header">Up next</div>
            {displayedCbfRecs.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="yt-cbf-card skeleton">
                  <div className="yt-cbf-thumb skeleton-shimmer" />
                  <div className="yt-cbf-info" style={{ gap: 8, flex: 1 }}>
                    <div className="yt-skeleton-line" style={{ width: '85%', height: 14 }} />
                    <div className="yt-skeleton-line" style={{ width: '50%', height: 12 }} />
                  </div>
                </div>
              ))
            ) : (
              displayedCbfRecs.map(rec => (
                <div
                  key={rec.id}
                  className="yt-cbf-card"
                  onClick={() => onAnimeSelect && onAnimeSelect(rec.id)}
                >
                  <div className="yt-cbf-thumb">
                    <img src={rec.coverImage} alt={rec.title} loading="lazy" />
                  </div>
                  <div className="yt-cbf-info">
                    <div className="yt-cbf-title">{rec.title}</div>
                    <div className="yt-cbf-sub">{rec.type} Ã‚Â· {rec.totalEpisodes ? `${rec.totalEpisodes} eps` : ''}</div>
                  </div>
                </div>
              ))
            )}
            {cbfLoadingMore && (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={`loading-${i}`} className="yt-cbf-card skeleton">
                  <div className="yt-cbf-thumb skeleton-shimmer" />
                  <div className="yt-cbf-info" style={{ gap: 8, flex: 1 }}>
                    <div className="yt-skeleton-line" style={{ width: '85%', height: 14 }} />
                    <div className="yt-skeleton-line" style={{ width: '50%', height: 12 }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
function BentoEpisodeSkeleton() {
  return (
    <div className="ep-bento-card skeleton-bento">
      <div className="ep-bento-number skeleton-shimmer" style={{ height: '30px', width: '20px', borderRadius: '4px' }} />
      <div className="ep-bento-thumb skeleton-shimmer" style={{ background: 'none' }} />
      <div className="ep-bento-info">
        <div className="ep-bento-header">
          <div className="skeleton-shimmer" style={{ height: '18px', width: '40%', borderRadius: '4px' }} />
          <div className="skeleton-shimmer" style={{ height: '14px', width: '60px', borderRadius: '4px' }} />
        </div>
        <div className="skeleton-shimmer" style={{ height: '14px', width: '90%', borderRadius: '4px', marginTop: '8px' }} />
        <div className="skeleton-shimmer" style={{ height: '14px', width: '70%', borderRadius: '4px', marginTop: '6px' }} />
      </div>
    </div>
  );
}

function LoadingPlayer() {
  return (
    <div className="player-wrapper player-loading">
      <div className="blob-loader-wrap">
        <div className="blob-loader" />
        <p className="blob-loader-text">
          Loading<span className="blob-dots"><span>.</span><span>.</span><span>.</span></span>
        </p>
      </div>
    </div>
  );
}

function ProviderWarning({ error }) {
  return (
    <div className="provider-warning">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}>
        <AlertCircle size={16} />
        <span>Streaming providers are currently unavailable</span>
      </div>
      <span style={{ color: '#fca5a5', fontSize: '0.8rem' }}>
        {error || 'The streaming provider did not return a playable source.'} Try another episode or connect a working stream source.
      </span>
    </div>
  );
}

function CategoryGridView({
  viewName,
  featuredItem,
  genresData = {},
  onAnimeClick,
  onStartWatching,
  isLoading = false
}) {
  if (isLoading || !featuredItem) {
    return <CategorySkeleton />;
  }

  return (
    <div className="netflix-home">
      <div
        className="hero netflix-hero"
        style={{ backgroundImage: `url(${featuredItem.bannerImage})` }}
      >
        <div className="hero-overlay"></div>
        <div className="container hero-shell">
          <div className="hero-content">
            <div className="netflix-series-mark">
              <span>N</span>
              <strong>{viewName === 'movies' ? 'Film' : 'Series'}</strong>
            </div>
            <h1 className="hero-title">{featuredItem.title}</h1>

            <div className="hero-meta">
              <span className="top-ten-badge">Top Picks</span>
              <span>
                <Star size={16} fill="var(--accent-primary)" style={{ color: 'var(--accent-primary)' }} />
                {featuredItem.rating}
              </span>
              <span>{featuredItem.type}</span>
              <span>{featuredItem.duration || 'HD'}</span>
              <span>{featuredItem.status}</span>
            </div>

            <p className="hero-desc">{featuredItem.description}</p>

            <div className="btn-group">
              <button className="btn btn-primary" onClick={() => onStartWatching(featuredItem, 1)}>
                <Play size={22} fill="currentColor" /> Play
              </button>
              <button className="btn btn-secondary" onClick={() => onAnimeClick(featuredItem.id)}>
                <Info size={22} /> More Info
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Netflix Horizontal Rows Grouped by Genres */}
      <div className="netflix-rows">
        {Object.entries(genresData).map(([genreName, list]) => {
          if (!list || list.length === 0) return null;
          return (
            <NetflixRow
              key={genreName}
              title={`${genreName} ${viewName === 'movies' ? 'Movies' : 'Shows'}`}
              items={list}
              onAnimeClick={(a) => onAnimeClick(a.id ?? a)}
            />
          );
        })}
      </div>
    </div>
  );
}

function HindiView({ hindiAnime = [], onAnimeClick, onStartWatching, isLoading = false }) {
  const [activeFilter, setActiveFilter] = React.useState('All');
  const [sortBy, setSortBy] = React.useState('popularity');

  if (isLoading && hindiAnime.length === 0) {
    return (
      <div className="hindi-yt-page">
        <div className="hindi-yt-banner-skeleton" />
        <div className="hindi-yt-chips-row">
          {['All','Action','Adventure','Fantasy','Romance','Thriller'].map(c => (
            <div key={c} className="hindi-chip-skeleton" />
          ))}
        </div>
        <div className="hindi-yt-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="hindi-yt-card-skeleton">
              <div className="hindi-yt-card-thumb-skeleton" />
              <div className="hindi-yt-card-meta-skeleton">
                <div className="hindi-yt-line-skeleton w70" />
                <div className="hindi-yt-line-skeleton w50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const FILTERS = ['All', 'Action', 'Adventure', 'Fantasy', 'Romance', 'Thriller', 'Supernatural', 'Comedy', 'Sci-Fi'];

  const filtered = activeFilter === 'All'
    ? hindiAnime
    : hindiAnime.filter(a => a.genres?.some(g => g.toLowerCase() === activeFilter.toLowerCase()));

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'popularity') return (b.popularity || 0) - (a.popularity || 0);
    if (sortBy === 'rating') return parseFloat(b.rating || 0) - parseFloat(a.rating || 0);
    if (sortBy === 'az') return (a.title || '').localeCompare(b.title || '');
    return 0;
  });

  const topPick = hindiAnime[0];

  return (
    <div className="hindi-yt-page">

      {/*  Channel Header Banner  */}
      {topPick && (
        <div
          className="hindi-yt-banner"
          style={{ backgroundImage: `url(${topPick.bannerImage || topPick.coverImage})` }}
        >
          <div className="hindi-yt-banner-overlay" />
          <div className="hindi-yt-banner-content">
            <div className="hindi-yt-channel-info">
              <div className="hindi-yt-channel-avatar">
                
              </div>
              <div className="hindi-yt-channel-text">
                <div className="hindi-yt-channel-name">Hindi Dubbed Anime</div>
                <div className="hindi-yt-channel-sub">
                  <span className="hindi-yt-live-dot" />
                  <span>{hindiAnime.length} series available</span>
                  <span className="hindi-yt-badge">Hindi Audio</span>
                </div>
              </div>
            </div>
            {topPick && (
              <button
                className="hindi-yt-play-btn"
                onClick={() => onStartWatching(topPick, 1)}
              >
                <Play size={16} fill="currentColor" />
                <span>Play Featured</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/*  Filter Chips Row  */}
      <div className="hindi-yt-controls">
        <div className="hindi-yt-chips-row">
          {FILTERS.map(f => (
            <button
              key={f}
              className={`hindi-yt-chip ${activeFilter === f ? 'active' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <select
          className="hindi-yt-sort"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          <option value="popularity">Most Popular</option>
          <option value="rating">Highest Rated</option>
          <option value="az">A  Z</option>
        </select>
      </div>

      {/*  Results count  */}
      <div className="hindi-yt-count">
        {filtered.length} Hindi dubbed {activeFilter !== 'All' ? activeFilter : ''} series
        {isLoading && <span className="hindi-yt-loading-badge"> Loading more</span>}
      </div>

      {/*  Video Grid  */}
      {sorted.length === 0 ? (
        <div className="hindi-yt-empty">
          <span></span>
          <p>No Hindi dubbed anime found for <strong>{activeFilter}</strong></p>
          <button className="hindi-yt-chip active" onClick={() => setActiveFilter('All')}>Show All</button>
        </div>
      ) : (
        <div className="hindi-yt-grid">
          {sorted.map((anime) => (
            <HindiYTCard
              key={anime.id}
              anime={anime}
              onPlay={() => onStartWatching(anime, 1)}
              onInfo={() => onAnimeClick(anime.id)}
            />
          ))}
        </div>
      )}

    </div>
  );
}

function HindiYTCard({ anime, onPlay, onInfo }) {
  const [imgErr, setImgErr] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  const episodeCount = anime.totalEpisodes || anime.episodes?.length || '?';
  const rating = parseFloat(anime.rating) || 0;
  const genre = anime.genres?.[0] || 'Anime';

  return (
    <div
      className={`hindi-yt-card ${hovered ? 'hovered' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <div className="hindi-yt-card-thumb" onClick={onInfo}>
        {!imgErr ? (
          <img
            src={anime.coverImage || anime.bannerImage}
            alt={anime.title}
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="hindi-yt-card-thumb-fallback">
            <span>{anime.title?.charAt(0) || '?'}</span>
          </div>
        )}

        {/* Duration/Episodes badge */}
        <div className="hindi-yt-card-ep-badge">
          {episodeCount} EP
        </div>

        {/* Hindi audio badge */}
        <div className="hindi-yt-card-audio-badge">ðŸ‡®ðŸ‡³ HINDI</div>

        {/* Hover overlay */}
        <div className="hindi-yt-card-hover-overlay">
          <button className="hindi-yt-card-play-circle" onClick={(e) => { e.stopPropagation(); onPlay(); }}>
            <Play size={22} fill="white" />
          </button>
        </div>
      </div>

      {/* Meta info  YouTube style */}
      <div className="hindi-yt-card-meta">
        <div className="hindi-yt-card-avatar-dot">
          <span></span>
        </div>
        <div className="hindi-yt-card-info">
          <div className="hindi-yt-card-title" title={anime.title} onClick={onInfo}>
            {anime.title}
          </div>
          <div className="hindi-yt-card-channel">{genre} â€¢ {anime.type || 'TV'}</div>
          <div className="hindi-yt-card-stats">
            {rating > 0 && (
              <span className="hindi-yt-card-rating">
                <Star size={11} fill="#fbbf24" style={{ color: '#fbbf24' }} />
                {rating.toFixed(1)}
              </span>
            )}
            <span>{anime.status || 'Finished'}</span>
          </div>
        </div>
        <button className="hindi-yt-card-more" title="More options"></button>
      </div>
    </div>
  );
}


function WatchlistView({ items, onAnimeClick, onBackHome }) {
  return (
    <div className="container" style={{ marginTop: '5rem', minHeight: '60vh' }}>
      <div className="section-header" style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">My List</h2>
      </div>

      {items.length > 0 ? (
        <div className="anime-grid">
          {items.map((anime) => (
            <AnimeCard
              key={anime.id}
              anime={anime}
              onClick={() => onAnimeClick(anime.id)}
            />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '6rem 0', color: 'var(--text-secondary)' }}>
          <Star size={48} style={{ marginBottom: '1rem', color: 'var(--text-muted)' }} />
          <h3>Your watchlist is empty</h3>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
            Explore shows and movies, and click "+ My List" to bookmark them.
          </p>
          <button className="btn btn-primary" onClick={onBackHome} style={{ marginTop: '1.5rem', display: 'inline-flex' }}>
            Browse Shows
          </button>
        </div>
      )}
    </div>
  );
}

export default App;

// '''''''''''''''''''''''''''''''''''''''''''''''''''''
// MANHWA COMPONENTS (Hivetoons)
// '''''''''''''''''''''''''''''''''''''''''''''''''''''

function ManhwaCard({ series, onClick }) {
  const [imgErr, setImgErr] = React.useState(false);
  return (
    <button className="manhwa-card" onClick={onClick}>
      <div className="manhwa-card-art">
        {!imgErr ? (
          <img
            src={series.cover}
            alt={series.title}
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="manhwa-card-placeholder">
            <span>{series.title?.[0] || '?'}</span>
          </div>
        )}
        <div className="manhwa-card-overlay">
          <div className="manhwa-card-read">Read</div>
        </div>
      </div>
      <div className="manhwa-card-info">
        <span className="manhwa-card-title">{series.title}</span>
      </div>
    </button>
  );
}

function ManhwaRow({ title, series, onSeriesClick }) {
  if (!series || series.length === 0) return null;
  return (
    <section className="manhwa-row">
      <h2 className="manhwa-row-title">{title}</h2>
      <div className="manhwa-row-slider">
        {series.map((s, i) => (
          <ManhwaCard key={s.slug + i} series={s} onClick={() => onSeriesClick(s)} />
        ))}
      </div>
    </section>
  );
}

function ManhwaHomeView({ data, error, isLoading, searchQuery, searchResults, searchLoading, onSearch, onSeriesClick }) {
  return (
    <div className="manhwa-home" style={{ paddingTop: '5rem' }}>

      {searchQuery.trim() ? (
        <div className="container manhwa-search-results">
          <h2 className="manhwa-row-title">Results for "{searchQuery}"</h2>
          {searchLoading ? (
            <div className="manhwa-loading"><InlineLoader /></div>
          ) : searchResults.length ? (
            <div className="manhwa-grid">
              {searchResults.map((s, i) => <ManhwaCard key={s.slug + i} series={s} onClick={() => onSeriesClick(s)} />)}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem 0' }}>No results found.</p>
          )}
        </div>
      ) : isLoading ? (
        <CategorySkeleton />
      ) : !data ? (
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.2rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', textAlign: 'center', maxWidth: '640px' }}>
            {error || 'Could not load manhwa catalog.'}
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
        </div>
      ) : (
        <>
          {/* Hero banner using first popular series */}
          {data.popular?.[0] && (
            <div
              className="manhwa-hero"
              style={{ backgroundImage: `url(${data.popular[0].cover})` }}
            >
              <div className="manhwa-hero-overlay" />
              <div className="manhwa-hero-content">
                <div className="manhwa-hero-badge">Featured Manhwa</div>
                <h1 className="manhwa-hero-title">{data.popular[0].title}</h1>
                <button
                  className="btn btn-primary manhwa-hero-btn"
                  onClick={() => onSeriesClick(data.popular[0])}
                >
                  Start Reading
                </button>
              </div>
            </div>
          )}

          <div className="manhwa-rows-container">
            <ManhwaRow title="Popular Now" series={data.popular} onSeriesClick={onSeriesClick} />
            <ManhwaRow title="Latest Updates" series={data.latest} onSeriesClick={onSeriesClick} />
          </div>
        </>
      )}
    </div>
  );
}

function ManhwaDetailView({ series, isLoading, onBack, onReadChapter }) {
  const chapters = Array.isArray(series?.chapters) ? series.chapters : [];
  const [showAll, setShowAll] = React.useState(false);
  const displayed = showAll ? chapters : chapters.slice(-50).reverse();

  return (
    <div className="manhwa-detail">
      {/* Hero */}
      <div
        className="manhwa-detail-hero"
        style={{ backgroundImage: `url(${series.cover})` }}
      >
        <div className="manhwa-hero-overlay" />
        <div className="manhwa-detail-hero-content">
          <button className="manhwa-back-btn" onClick={onBack}>Â Ã‚Â </button>
          <div className="manhwa-detail-meta-row">
            <img src={series.cover} alt={series.title} className="manhwa-detail-cover" />
            <div className="manhwa-detail-info">
              <h1 className="manhwa-detail-title">{series.title}</h1>
              {series.genres?.length > 0 && (
                <div className="manhwa-genres">
                  {series.genres.slice(0, 5).map(g => (
                    <span key={g} className="manhwa-genre-tag">{g}</span>
                  ))}
                </div>
              )}
              {chapters.length > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={() => onReadChapter(series, chapters[0])}
                  style={{ marginTop: '1rem' }}
                >
                  Read Chapter 1
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="manhwa-detail-body container">
        {series.description && (
          <div className="manhwa-detail-desc">
            <h3>Synopsis</h3>
            <p>{series.description}</p>
          </div>
        )}

        <div className="manhwa-chapters-section">
          <h3 className="manhwa-chapters-heading">
            Chapters <span className="manhwa-ch-count">({chapters.length})</span>
          </h3>

          {isLoading ? (
            <div className="manhwa-loading"><InlineLoader /></div>
          ) : chapters.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No chapters available.</p>
          ) : (
            <>
              <div className="manhwa-chapters-list">
                {displayed.map(ch => {
                  return (
                    <button
                      key={ch.slug}
                      className="manhwa-chapter-row"
                      onClick={() => onReadChapter(series, ch)}
                    >
                      <div className="manhwa-chapter-thumb-container">
                        {ch.thumbnail ? (
                          <img
                            src={ch.thumbnail}
                            alt={`Chapter ${ch.number}`}
                            className="manhwa-chapter-thumb"
                            loading="lazy"
                          />
                        ) : (
                          <div className="manhwa-chapter-thumb-placeholder"></div>
                        )}
                      </div>
                      <div className="manhwa-chapter-meta">
                        <div className="manhwa-chapter-name-row">
                          <span className="manhwa-chapter-label">Chapter {ch.number}</span>
                          {ch.title && <span className="manhwa-chapter-sub">&middot; {ch.title}</span>}
                        </div>
                        {ch.date && <span className="manhwa-chapter-date">{ch.date}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              {chapters.length > 50 && (
                <button
                  className="manhwa-show-more-btn"
                  onClick={() => setShowAll(p => !p)}
                >
                  {showAll ? 'Show Recent Only' : `Show All ${chapters.length} Chapters`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ManhwaReadView({ series, chapter, images, isLoading, onBack, onChapterSelect }) {
  const chapters = Array.isArray(series?.chapters) ? series.chapters : [];
  const currentIdx = chapters.findIndex(ch => ch.slug === chapter.slug);
  const prevChapter = currentIdx > 0 ? chapters[currentIdx - 1] : null;
  const nextChapter = currentIdx < chapters.length - 1 ? chapters[currentIdx + 1] : null;

  return (
    <div className="manhwa-reader">
      {/* Top navigation bar */}
      <div className="manhwa-reader-header">
        <button className="manhwa-back-btn" onClick={onBack}>Â Ã‚Â Back</button>
        <span className="manhwa-reader-chapter-label">Chapter {chapter.number}</span>
        <div className="manhwa-reader-nav">
          {prevChapter && (
            <button className="manhwa-nav-btn" onClick={() => onChapterSelect(prevChapter)}>
              Â Ã‚Â Prev
            </button>
          )}
          {nextChapter && (
            <button className="manhwa-nav-btn" onClick={() => onChapterSelect(nextChapter)}>
              Next â†’
            </button>
          )}
        </div>
      </div>

      {/* Chapter images */}
      <div className="manhwa-reader-pages">
        {isLoading ? (
          <div className="manhwa-loading" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <InlineLoader />
          </div>
        ) : images.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            <p>No pages found for this chapter.</p>
          </div>
        ) : (
          images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Page ${i + 1}`}
              className="manhwa-reader-page"
              loading="lazy"
            />
          ))
        )}
      </div>

      {/* Bottom navigation */}
      {!isLoading && images.length > 0 && (
        <div className="manhwa-reader-footer">
          {prevChapter && (
            <button className="manhwa-nav-btn" onClick={() => { onChapterSelect(prevChapter); window.scrollTo(0,0); }}>
              Â Ã‚Â Previous Chapter
            </button>
          )}
          <button className="manhwa-back-btn-plain" onClick={() => { onBack(); }}>
            Chapter List
          </button>
          {nextChapter && (
            <button className="manhwa-nav-btn" onClick={() => { onChapterSelect(nextChapter); window.scrollTo(0,0); }}>
              Next Chapter â†’
            </button>
          )}
        </div>
      )}

      {/* Chapter picker */}
      {chapters.length > 0 && (
        <div className="manhwa-reader-picker container">
          <h3 className="manhwa-chapters-heading">All Chapters</h3>
          <div className="manhwa-chapters-grid">
            {chapters.slice().reverse().map(ch => (
              <button
                key={ch.slug}
                className={`manhwa-ch-btn ${ch.slug === chapter.slug ? 'active' : ''}`}
                onClick={() => { onChapterSelect(ch); window.scrollTo(0, 0); }}
              >
                Ch. {ch.number}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// '''''''''''''''''''''''''''''''''''''''''''''''''''''
// DRAMA COMPONENTS
// '''''''''''''''''''''''''''''''''''''''''''''''''''''

function DramaCard({ drama, onClick }) {
  const [imgErr, setImgErr] = React.useState(false);
  return (
    <button className="netflix-tile drama-tile" onClick={onClick}>
      <span className="tile-art">
        {!imgErr ? (
          <img
            src={drama.thumbnail}
            alt={drama.title}
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="drama-card-placeholder">
            <span>{drama.title?.[0] || '?'}</span>
          </div>
        )}
        <span className="tile-logo-mark">EN</span>
        <span className="tile-hover-overlay">
          <span className="tile-hover-play"><Play size={20} fill="white" style={{ color: 'white' }} /></span>
        </span>
        {drama.episodesCount && (
          <span className="tile-rating-badge" style={{ color: '#fff' }}>{drama.episodesCount} Ep</span>
        )}
      </span>
      <span className="tile-info">
        <strong>{drama.title}</strong>
        <small>{drama.country || 'Drama'} Â· {drama.status || 'Ongoing'}</small>
      </span>
    </button>
  );
}

function DramaRow({ title, icon, dramas, onDramaClick }) {
  if (!dramas || dramas.length === 0) return null;
  return (
    <section className="hv-section netflix-row">
      <div className="hv-section-header">
        <h2 className="hv-section-title">
          {icon && <span className="hv-title-accent">{icon}</span>} {title}
        </h2>
        <span className="hv-section-line" />
      </div>
      <div className="netflix-slider">
        {dramas.map(d => (
          <DramaCard key={d.id} drama={d} onClick={() => onDramaClick(d)} />
        ))}
      </div>
    </section>
  );
}

function DramaHomeView({ data, error, isLoading, searchQuery, searchResults, searchLoading, onSearch, onDramaClick }) {
  const featured = data?.show?.[0];

  return (
    <div className="netflix-home drama-home" style={{ paddingTop: '5rem' }}>

      {searchQuery.trim() ? (
        <div className="container drama-search-results" style={{ marginTop: '2rem' }}>
          <div className="hv-section-header">
            <h2 className="hv-section-title">
              <Sparkles className="hv-icon" size={20} style={{ color: '#eab308' }} /> Results for "{searchQuery}"
            </h2>
            <span className="hv-section-line" />
          </div>
          {searchLoading ? (
            <div className="drama-loading" style={{ minHeight: '30vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <InlineLoader />
            </div>
          ) : searchResults.length ? (
            <div className="netflix-slider" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gridAutoFlow: 'initial', gap: '1.5rem' }}>
              {searchResults.map(d => <DramaCard key={d.id} drama={d} onClick={() => onDramaClick(d)} />)}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem 0' }}>No dramas found.</p>
          )}
        </div>
      ) : isLoading ? (
        <CategorySkeleton />
      ) : !data || !Array.isArray(data.korean) ? (
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.2rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', textAlign: 'center', maxWidth: '640px' }}>
            {error || 'Could not load drama catalog. Check that the backend is online.'}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Cinematic Drama Hero */}
          {featured && (
            <div
              className="hero netflix-hero drama-hero"
              style={{ backgroundImage: `url(${featured.thumbnail})` }}
            >
              <div className="hero-overlay" />
              <div className="hero-scanline" />
              <div className="container hero-shell">
                <div className="hero-content">
                  <div className="hero-eyebrow">
                    <span className="hero-eyebrow-badge" style={{ background: '#3b82f6' }}>D</span>
                    <span className="hero-eyebrow-text">Drama</span>
                    <span className="hero-eyebrow-dot">â€¢</span>
                    <span className="hero-live-tag" style={{ background: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.5)', color: '#60a5fa' }}>Popular</span>
                  </div>

                  <h1 className="hero-title">{featured.title}</h1>

                  <div className="hero-meta">
                    <span className="top-ten-badge" style={{ background: '#3b82f6' }}>TRENDING</span>
                    <span className="hero-rank">#1 in Asian Shows Today</span>
                    {featured.episodesCount && (
                      <span className="hero-meta-tag">{featured.episodesCount} Episodes</span>
                    )}
                  </div>

                  <div className="btn-group">
                    <button className="btn btn-primary hero-btn-play" onClick={() => onDramaClick(featured)}>
                      <Play size={20} fill="currentColor" /> Play Now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="netflix-rows">
            <DramaRow
              title="Featured"
              icon={<Sparkles className="hv-icon" size={20} style={{ color: '#eab308' }} />}
              dramas={data?.show || []}
              onDramaClick={onDramaClick}
            />
            <DramaRow
              title="Most Popular Korean Dramas"
              icon={<Flame className="hv-icon" size={20} style={{ color: '#f97316' }} />}
              dramas={data?.korean || []}
              onDramaClick={onDramaClick}
            />
            <DramaRow
              title="Most Popular Chinese Dramas"
              icon={<Tv className="hv-icon" size={20} style={{ color: '#3b82f6' }} />}
              dramas={data?.chinese || []}
              onDramaClick={onDramaClick}
            />
            <DramaRow
              title="Top Rated"
              icon={<Trophy className="hv-icon" size={20} style={{ color: 'var(--accent-primary)' }} />}
              dramas={data?.topRating || []}
              onDramaClick={onDramaClick}
            />
            <DramaRow
              title="Recently Updated"
              icon={<History className="hv-icon" size={20} style={{ color: '#06b6d4' }} />}
              dramas={data?.lastUpdate || []}
              onDramaClick={onDramaClick}
            />
          </div>
        </>
      )}
    </div>
  );
}

function DramaDetailView({ drama, onBack, onWatchEpisode }) {
  const episodes = Array.isArray(drama?.episodes) ? drama.episodes : [];
  const [showAll, setShowAll] = React.useState(false);
  const displayedEps = showAll ? episodes : episodes.slice(0, 24);

  return (
    <div className="drama-detail">
      {/* Hero */}
      <div className="drama-detail-hero" style={{ backgroundImage: `url(${drama.thumbnail})` }}>
        <div className="drama-hero-overlay" />
        <div className="drama-detail-hero-content">
          <button className="drama-back-btn" onClick={onBack}>Â Ã‚Â Back</button>
          <h1 className="drama-detail-title">{drama.title}</h1>
          {drama.releaseDate && (
            <span className="drama-detail-meta">
              {new Date(drama.releaseDate).getFullYear()} Â· {drama.country} Â· {drama.status}
            </span>
          )}
          {episodes.length > 0 && (
            <button
              className="btn btn-primary"
              onClick={() => onWatchEpisode(drama, episodes[episodes.length - 1])}
            >
              <Play size={20} fill="currentColor" /> Episode 1
            </button>
          )}
        </div>
      </div>

      <div className="drama-detail-body container">
        {drama.description && (
          <div className="drama-detail-desc">
            <h3>Synopsis</h3>
            <p>{drama.description}</p>
          </div>
        )}

        <div className="drama-episodes-section">
          <h3 className="drama-episodes-heading">
            Episodes <span className="drama-ep-count">({episodes.length})</span>
          </h3>
          {episodes.length === 0 ? (
            <div className="drama-loading"><InlineLoader /></div>
          ) : (
            <>
              <div className="drama-episodes-grid">
                {displayedEps.map(ep => (
                  <button
                    key={ep.id}
                    className="drama-ep-btn"
                    onClick={() => onWatchEpisode(drama, ep)}
                  >
                    <span className="drama-ep-num">Ep {ep.number}</span>
                    {ep.sub > 0 && <span className="drama-ep-sub-badge">SUB</span>}
                  </button>
                ))}
              </div>
              {episodes.length > 24 && (
                <button className="drama-show-more-btn" onClick={() => setShowAll(p => !p)}>
                  {showAll ? 'Show Less' : `Show All ${episodes.length} Episodes`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DramaWatchView({ drama, episode, stream, loading, onBack, onEpisodeSelect }) {
  const episodes = Array.isArray(drama?.episodes) ? drama.episodes : [];
  // activeSub = the `file` URL of the selected subtitle, or null = off
  const [activeSub, setActiveSub] = React.useState(null);

  // Auto-select English subtitle whenever a new stream loads
  React.useEffect(() => {
    if (stream?.subtitles?.length) {
      const eng = stream.subtitles.find(s => s.default) || stream.subtitles[0];
      setActiveSub(eng?.file || null);
    } else {
      setActiveSub(null);
    }
  }, [stream]);

  // Build a SINGLE-element subtitle array for VideoPlayer so only one track
  // is ever mounted. Swapping this triggers VideoPlayer to remount the track.
  const playerSubtitle = React.useMemo(() => {
    if (!activeSub || !stream?.subtitles) return [];
    const found = stream.subtitles.find(s => s.file === activeSub);
    if (!found) return [];
    return [{ url: found.file, lang: 'en', label: found.label, default: true }];
  }, [activeSub, stream]);

  return (
    <div className="drama-watch">
      <div className="drama-watch-header">
        <button className="drama-back-btn" onClick={onBack}>Â Ã‚Â {drama.title}</button>
        <span className="drama-watch-ep-label">Episode {episode.number}</span>
      </div>

      <div className="drama-player-wrap">
        {loading ? (
          <div className="drama-player-loading">
            <div className="blob-loader-wrap">
              <div className="blob-loader" />
              <p className="blob-loader-text">
                Loading<span className="blob-dots"><span>.</span><span>.</span><span>.</span></span>
              </p>
            </div>
          </div>
        ) : stream?.error ? (
          <div className="drama-player-error">
            <AlertCircle size={40} />
            <p>{stream.error}</p>
          </div>
        ) : stream?.streamUrl ? (
          <VideoPlayer
            source={{
              url: stream.streamUrl,
              isM3U8: stream.type === 'hls',
              error: stream.error
            }}
            subtitles={playerSubtitle}
            poster={drama.thumbnail}
          />
        ) : null}
      </div>

      {/* Subtitle selector */}
      {stream?.subtitles?.length > 0 && (
        <div className="drama-sub-selector">
          <span className="drama-sub-label">Subtitles:</span>
          <button
            className={`drama-sub-btn ${!activeSub ? 'active' : ''}`}
            onClick={() => setActiveSub(null)}
          >Off</button>
          {stream.subtitles.map(s => (
            <button
              key={s.file}
              className={`drama-sub-btn ${activeSub === s.file ? 'active' : ''}`}
              onClick={() => setActiveSub(s.file)}
            >{s.label}</button>
          ))}
        </div>
      )}

      {/* Episode list */}
      {episodes.length > 0 && (
        <div className="drama-watch-episodes container">
          <h3 className="drama-episodes-heading">Episodes</h3>
          <div className="drama-episodes-grid">
            {episodes.slice(0, 50).map(ep => (
              <button
                key={ep.id}
                className={`drama-ep-btn ${ep.id === episode.id ? 'active' : ''}`}
                onClick={() => onEpisodeSelect(ep)}
              >
                <span className="drama-ep-num">Ep {ep.number}</span>
                {ep.sub > 0 && <span className="drama-ep-sub-badge">SUB</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 
// MOVIE COMPONENTS
// 

function MovieCard({ movie, onClick }) {
  const [imgSrc, setImgSrc] = React.useState(movie.coverImage || movie.thumbnail || null);
  const [imgErr, setImgErr] = React.useState(false);
  const [fetchedPoster, setFetchedPoster] = React.useState(null);

  // Sync src when parent updates the movie object (e.g. after background enrichment)
  React.useEffect(() => {
    const src = movie.coverImage || movie.thumbnail || null;
    if (src && src !== imgSrc) { setImgSrc(src); setImgErr(false); }
  }, [movie.coverImage, movie.thumbnail]);

  // If img failed or no poster at all, try fetching from backend on-demand
  const handleImgErr = React.useCallback(() => {
    setImgErr(true);
    if (movie.movieplexSlug && !fetchedPoster) {
      fetch(apiUrl('/api/movieplex/post-info?slug=' + encodeURIComponent(movie.movieplexSlug)))
        .then(r => r.json())
        .then(d => {
          if (d.thumbnail) { setFetchedPoster(d.thumbnail); setImgErr(false); }
        })
        .catch(() => {});
    }
  }, [movie.movieplexSlug, fetchedPoster]);

  const activeSrc = fetchedPoster || imgSrc;

  // Generate a stable vibrant gradient per title initial
  const GRADIENTS = [
    'linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    'linear-gradient(145deg, #2d1b33 0%, #1a0a2e 50%, #6b21a8 100%)',
    'linear-gradient(145deg, #1e3a1e 0%, #14532d 50%, #166534 100%)',
    'linear-gradient(145deg, #1e1a0e 0%, #451a03 50%, #7c2d12 100%)',
    'linear-gradient(145deg, #0c1445 0%, #1e3a5f 50%, #1e40af 100%)',
    'linear-gradient(145deg, #3f0d0d 0%, #7f1d1d 50%, #991b1b 100%)',
    'linear-gradient(145deg, #1a1a1a 0%, #374151 50%, #111827 100%)',
    'linear-gradient(145deg, #0d2137 0%, #0e4f69 50%, #155e75 100%)',
  ];
  const gradientIdx = (movie.title?.charCodeAt(0) || 0) % GRADIENTS.length;
  const placeholder = GRADIENTS[gradientIdx];

  return (
    <button
      className="movie-tile"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        textAlign: 'left',
        width: '100%',
      }}
    >
      <span style={{
        display: 'block',
        position: 'relative',
        aspectRatio: '2/3',
        borderRadius: '6px',
        overflow: 'hidden',
        background: '#161618',
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.08) translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 14px 36px rgba(0,0,0,0.85)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1) translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      >
        {activeSrc && !imgErr ? (
          <img
            src={activeSrc}
            alt={movie.title}
            loading="lazy"
            onError={handleImgErr}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          /* Beautiful gradient placeholder — no more grey letter boxes */
          <div style={{
            width: '100%', height: '100%',
            background: placeholder,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '1rem', textAlign: 'center', position: 'relative', overflow: 'hidden'
          }}>
            {/* Decorative glow rings */}
            <div style={{
              position: 'absolute', width: '150px', height: '150px',
              borderRadius: '50%', border: '1px solid rgba(255,255,255,0.06)',
              top: '-30px', right: '-30px'
            }} />
            <div style={{
              position: 'absolute', width: '100px', height: '100px',
              borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)',
              bottom: '-20px', left: '-20px'
            }} />
            <span style={{
              fontSize: '2.8rem', fontWeight: 900,
              color: 'rgba(255,255,255,0.22)',
              letterSpacing: '-1px', lineHeight: 1,
              textTransform: 'uppercase', fontFamily: 'Inter, sans-serif',
              position: 'relative', zIndex: 1
            }}>
              {movie.title?.[0] || '?'}
            </span>
            <span style={{
              position: 'absolute', bottom: '10px',
              left: '8px', right: '8px',
              fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)',
              fontWeight: 600, textAlign: 'center',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>{movie.title}</span>
          </div>
        )}
        {/* Hover overlay */}
        <span style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
          opacity: 0, transition: 'opacity 0.22s ease',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0.75rem'
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = 1}
        onMouseLeave={e => e.currentTarget.style.opacity = 0}
        >
          <span style={{
            background: '#E50914', color: '#fff',
            padding: '0.4rem 1rem', borderRadius: '20px',
            fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.4px',
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            boxShadow: '0 4px 12px rgba(229,9,20,0.4)'
          }}>▶ Play</span>
        </span>
        {/* Rating badge */}
        {movie.rating && (
          <span style={{
            position: 'absolute', top: '6px', right: '6px',
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
            color: '#facc15', padding: '2px 6px',
            borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700
          }}>★ {movie.rating}</span>
        )}
      </span>
      {/* Title below card */}
      <span style={{ display: 'block', padding: '0.45rem 0.1rem 0' }}>
        <strong style={{
          display: 'block', color: '#ffffff', fontSize: '0.82rem',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontWeight: 500, lineHeight: 1.3
        }}>{movie.title}</strong>
        <small style={{ color: '#b3b3b3', fontSize: '0.7rem' }}>
          {movie.releaseDate ? String(movie.releaseDate).split('-')[0] : movie.type || 'Movie'}
        </small>
      </span>
    </button>

  );
}

function MovieRow({ title, icon, movies, onMovieClick }) {
  const rowRef = React.useRef(null);
  const [showChevrons, setShowChevrons] = React.useState(false);

  if (!movies || movies.length === 0) return null;

  const scroll = (direction) => {
    if (!rowRef.current) return;
    const scrollAmount = direction === 'left' ? -480 : 480;
    rowRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  return (
    <section style={{ marginTop: '2.2rem', position: 'relative' }}
      onMouseEnter={() => setShowChevrons(true)}
      onMouseLeave={() => setShowChevrons(false)}
    >
      {/* Row Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
        {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
        <h2 style={{
          margin: 0, fontSize: '1.15rem', fontWeight: 700,
          color: '#ffffff', letterSpacing: '-0.2px'
        }}>{title}</h2>
      </div>

      {/* Horizontal scrolling row wrapper with chevrons */}
      <div style={{ position: 'relative' }}>
        {showChevrons && (
          <>
            <button
              onClick={() => scroll('left')}
              style={{
                position: 'absolute', left: '-16px', top: '50%', transform: 'translateY(-50%)',
                zIndex: 10, width: '40px', height: '40px', borderRadius: '50%',
                background: 'rgba(20,20,20,0.85)', border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)'
              }}
              aria-label="Scroll left"
            ><ChevronLeft size={22} /></button>
            <button
              onClick={() => scroll('right')}
              style={{
                position: 'absolute', right: '-16px', top: '50%', transform: 'translateY(-50%)',
                zIndex: 10, width: '40px', height: '40px', borderRadius: '50%',
                background: 'rgba(20,20,20,0.85)', border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)'
              }}
              aria-label="Scroll right"
            ><ChevronRight size={22} /></button>
          </>
        )}

        <div ref={rowRef} className="mp-scroll-row">
          {movies.slice(0, 30).map(m => (
            <div key={m.id} className="mp-scroll-item">
              <MovieCard movie={m} onClick={() => onMovieClick(m)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MovieHomeView({
  data,
  error,
  isLoading,
  activeCategory,
  setActiveCategory,
  searchQuery,
  searchResults,
  searchLoading,
  onSearch,
  onMovieClick,
  user
}) {
  const mpTrending   = data?.movieplex?.trending    || data?.trending  || [];
  const mpWebSeries  = data?.movieplex?.webSeries   || [];
  const mpHindiDub   = data?.movieplex?.hindiDubbed || [];
  const mpBollywood  = data?.movieplex?.bollywood   || data?.bollywood || [];
  const mpHollywood  = data?.movieplex?.hollywood   || data?.hollywood || [];
  const mpAction     = data?.movieplex?.action      || data?.action    || [];
  const mpShortFilm  = data?.movieplex?.shortFilm   || [];
  const mpThriller   = data?.movieplex?.thriller    || [];
  const mpRomance    = data?.movieplex?.romance     || [];
  const mpHot        = data?.movieplex?.hot         || [];

  // Hero carousel auto-rotate
  const featuredPool = React.useMemo(() => {
    const list = mpTrending.length ? mpTrending : mpHindiDub.length ? mpHindiDub : mpBollywood;
    return list.slice(0, 5);
  }, [mpTrending, mpHindiDub, mpBollywood]);

  const [heroIdx, setHeroIdx] = React.useState(0);
  React.useEffect(() => {
    if (!featuredPool.length) return;
    const interval = setInterval(() => {
      setHeroIdx(prev => (prev + 1) % featuredPool.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [featuredPool]);

  const featured = featuredPool[heroIdx] || data?.featured || mpTrending[0] || null;

  const categories = ['All', 'Trending', 'Hindi Dubbed', 'Bollywood', 'Hollywood', 'Web Series', 'Action', 'Short Film', 'Thriller', 'Romance', '🔞 18+'];

  const CAT_MAP = {
    'Trending': { id: 29 },
    'Hindi Dubbed': { id: 17 },
    'Bollywood': { id: 10 },
    'Hollywood': { id: 19 },
    'Web Series': { id: 33 },
    'Action': { id: 6 },
    'Short Film': { id: 26 },
    'Thriller': { id: 28 },
    'Romance': { id: 24 },
    '🔞 18+': { id: 21, is18: true }
  };

  // ─── Admin identity (only this user can see Dev Options and push picks) ───
  const ADMIN_UID = '01d0cb3e-2c7b-4357-9c5b-5500be26e592';
  const isAdmin = user?.id === ADMIN_UID || user?.email === 'godkillermhz98@gmail.com';

  // ─── Random Picks (Supabase-backed: visible to ALL visitors) ───
  const [randomPicks, setRandomPicks] = React.useState([]);
  const [picksLoaded, setPicksLoaded] = React.useState(false);

  // Load picks from Supabase on mount
  React.useEffect(() => {
    const loadPicks = async () => {
      try {
        const { data, error } = await supabase
          .from('site_config')
          .select('value')
          .eq('key', 'random_picks')
          .single();
        if (!error && data) setRandomPicks(data.value || []);
      } catch (e) {
        console.warn('[RandomPicks] Could not load from Supabase:', e);
      } finally {
        setPicksLoaded(true);
      }
    };
    loadPicks();

    // Realtime: update all open tabs when admin pushes new picks
    const channel = supabase
      .channel('site_config_picks')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'site_config', filter: 'key=eq.random_picks' },
        (payload) => { if (payload.new?.value) setRandomPicks(payload.new.value); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const saveRandomPicks = async (picks) => {
    setRandomPicks(picks);
    try {
      const { error } = await supabase
        .from('site_config')
        .upsert({ key: 'random_picks', value: picks, updated_at: new Date().toISOString() });
      if (error) {
        console.error('[RandomPicks] Supabase write error:', error);
        alert('⚠️ Cloud Sync Warning: ' + (error.message || 'Row Level Security policy blocked the update in Supabase. Please check SQL permissions.'));
      }
    } catch (e) {
      console.error('[RandomPicks] Save failed:', e);
    }
  };

  // ─── Dev Selection Mode ───
  const [devModeActive, setDevModeActive] = React.useState(false);
  const [selectedMovieIds, setSelectedMovieIds] = React.useState(new Set());
  const [showPushPopup, setShowPushPopup] = React.useState(false);

  const toggleMovieSelection = (movie) => {
    setSelectedMovieIds(prev => {
      const next = new Set(prev);
      if (next.has(movie.id)) next.delete(movie.id);
      else next.add(movie.id);
      if (next.size > 0) setShowPushPopup(true);
      return next;
    });
  };

  const handlePushPicks = async () => {
    const picked = catMovies.filter(m => selectedMovieIds.has(m.id));
    const merged = [...randomPicks, ...picked.filter(p => !randomPicks.some(e => e.id === p.id))];
    await saveRandomPicks(merged);
    setSelectedMovieIds(new Set());
    setShowPushPopup(false);
    setDevModeActive(false);
    setActiveCategory('All');
  };

  const handleCancelPicks = () => {
    setSelectedMovieIds(new Set());
    setShowPushPopup(false);
  };

  // State for category grid view (paginated loading for 200+ movies per category)
  const [catMovies, setCatMovies] = React.useState([]);
  const [catPage, setCatPage] = React.useState(1);
  const [catTotalPages, setCatTotalPages] = React.useState(1);
  const [catTotalCount, setCatTotalCount] = React.useState(0);
  const [catLoading, setCatLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);

  // Filter out any movies that have been pushed to Random Picks from the 18+ category view
  const randomPickIds = React.useMemo(() => {
    const set = new Set();
    randomPicks.forEach(p => {
      if (p.id) set.add(String(p.id));
      if (p.slug) set.add(String(p.slug));
      if (p.movieplexSlug) set.add(String(p.movieplexSlug));
    });
    return set;
  }, [randomPicks]);

  const displayCatMovies = React.useMemo(() => {
    if (activeCategory === '🔞 18+') {
      return catMovies.filter(m => 
        !randomPickIds.has(String(m.id)) && 
        !randomPickIds.has(String(m.slug || '')) && 
        !randomPickIds.has(String(m.movieplexSlug || ''))
      );
    }
    return catMovies;
  }, [catMovies, activeCategory, randomPickIds]);

  // Fetch paginated category movies whenever activeCategory changes
  React.useEffect(() => {
    if (activeCategory === 'All') {
      setCatMovies([]);
      setCatPage(1);
      return;
    }

    const config = CAT_MAP[activeCategory];
    if (!config) return;

    setCatLoading(true);
    setCatPage(1);

    const queryParams = new URLSearchParams({ page: 1, limit: 36 });
    if (config.id) queryParams.set('category', config.id);
    if (config.is18) queryParams.set('is18', 'true');

    fetch(apiUrl(`/api/movieplex/catalog?${queryParams.toString()}`))
      .then(r => r.json())
      .then(res => {
        setCatMovies(Array.isArray(res.movies) ? res.movies : []);
        setCatTotalPages(res.totalPages || 1);
        setCatTotalCount(res.total || 0);
        setCatLoading(false);
      })
      .catch(() => {
        setCatMovies([]);
        setCatLoading(false);
      });
  }, [activeCategory]);

  const loadMoreCategoryMovies = () => {
    if (loadingMore || catPage >= catTotalPages) return;
    const nextPage = catPage + 1;
    setLoadingMore(true);

    const config = CAT_MAP[activeCategory] || {};
    const queryParams = new URLSearchParams({ page: nextPage, limit: 36 });
    if (config.id) queryParams.set('category', config.id);
    if (config.is18) queryParams.set('is18', 'true');

    fetch(apiUrl(`/api/movieplex/catalog?${queryParams.toString()}`))
      .then(r => r.json())
      .then(res => {
        if (Array.isArray(res.movies)) {
          setCatMovies(prev => [...prev, ...res.movies]);
        }
        setCatPage(nextPage);
        setLoadingMore(false);
      })
      .catch(() => setLoadingMore(false));
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: '"Inter","Roboto",sans-serif' }}>

      {searchQuery.trim() ? (
        <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem', color: '#fff' }}>
            Results for "{searchQuery}"
          </h2>
          {searchLoading ? (
            <div style={{ minHeight: '30vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <InlineLoader />
            </div>
          ) : searchResults.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
              {searchResults.map(m => <MovieCard key={m.id} movie={m} onClick={() => onMovieClick(m)} />)}
            </div>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '4rem 0' }}>No movies found.</p>
          )}
        </div>
      ) : isLoading ? (
        <div style={{ padding: '2rem', display: 'flex', gap: '1rem', overflow: 'hidden' }}>
          {[1,2,3,4,5,6].map(i => <div key={i} className="mp-skeleton-card" style={{ flex: '0 0 148px' }} />)}
        </div>
      ) : !data || (!Array.isArray(data.popular) && !Array.isArray(data.bollywood) && !data.movieplex) ? (
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.2rem' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1rem', textAlign: 'center', maxWidth: '520px' }}>
            {error || 'Could not load movie catalog.'}
          </p>
          <button onClick={() => window.location.reload()} style={{
            padding: '0.7rem 2rem', background: '#E50914', color: '#fff',
            border: 'none', borderRadius: '4px', fontWeight: 700, cursor: 'pointer'
          }}>Retry</button>
        </div>
      ) : (
        <>
          {/* Billboard Hero only visible in 'All' mode */}
          {activeCategory === 'All' && featured && (
            <div style={{
              width: '100%', height: '70vh', minHeight: '440px',
              position: 'relative',
              backgroundImage: `url(${featured.bannerImage || featured.coverImage || featured.thumbnail})`,
              backgroundPosition: 'center top', backgroundSize: 'cover', backgroundRepeat: 'no-repeat',
              transition: 'background-image 0.8s ease-in-out'
            }}>
              {/* Dual scrim gradient */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to right, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.6) 45%, transparent 85%), linear-gradient(to top, #0a0a0a 0%, rgba(10,10,10,0.5) 50%, transparent 100%)'
              }} />

              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '3rem clamp(1rem, 5vw, 4rem) 3.5rem',
                maxWidth: '850px'
              }}>
                {/* Category tag */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem' }}>
                  <span style={{ background: '#E50914', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '3px', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>Featured</span>
                  {featured.releaseDate && <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem', fontWeight: 600 }}>{String(featured.releaseDate).split('-')[0]}</span>}
                </div>

                <h1 style={{
                  margin: '0 0 0.8rem',
                  fontSize: 'clamp(1.8rem, 5vw, 3.2rem)',
                  fontWeight: 800, letterSpacing: '-0.5px',
                  textShadow: '0 2px 20px rgba(0,0,0,0.9)',
                  lineHeight: 1.15
                }}>{featured.title}</h1>

                {featured.description && (
                  <p style={{
                    color: 'rgba(255,255,255,0.8)', fontSize: '0.95rem',
                    margin: '0 0 1.6rem', maxWidth: '540px', lineHeight: 1.55,
                    textShadow: '0 1px 4px rgba(0,0,0,0.8)'
                  }}>
                    {featured.description.substring(0, 170)}{featured.description.length > 170 ? '…' : ''}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => onMovieClick(featured)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                      background: '#E50914', color: '#fff',
                      padding: '0.8rem 2.2rem', borderRadius: '6px',
                      border: 'none', fontSize: '1.05rem', fontWeight: 700,
                      cursor: 'pointer', transition: 'all 0.18s ease',
                      boxShadow: '0 6px 20px rgba(229,9,20,0.45)'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F6121D'}
                    onMouseLeave={e => e.currentTarget.style.background = '#E50914'}
                  >
                    ▶ Play
                  </button>
                  <button
                    onClick={() => onMovieClick(featured)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                      background: 'rgba(255,255,255,0.14)', color: '#fff',
                      padding: '0.8rem 1.8rem', borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.2)', fontSize: '1rem', fontWeight: 600,
                      cursor: 'pointer', backdropFilter: 'blur(8px)', transition: 'background 0.18s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.24)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
                  >
                    <Info size={18} /> More Info
                  </button>
                </div>
              </div>

              {/* Carousel Indicator Dots */}
              {featuredPool.length > 1 && (
                <div style={{
                  position: 'absolute', bottom: '1.5rem', right: '3rem',
                  display: 'flex', gap: '0.5rem', zIndex: 5
                }}>
                  {featuredPool.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setHeroIdx(idx)}
                      style={{
                        width: heroIdx === idx ? '24px' : '8px', height: '8px',
                        borderRadius: '4px', border: 'none', cursor: 'pointer',
                        background: heroIdx === idx ? '#E50914' : 'rgba(255,255,255,0.3)',
                        transition: 'all 0.3s ease'
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Category Filter Pills Navbar */}
          <div style={{ padding: '1.8rem clamp(1rem, 4vw, 3rem) 0' }}>
            <div className="mp-scroll-row" style={{ gap: '0.6rem', paddingBottom: '0.4rem' }}>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveCategory(c)}
                  style={{
                    padding: '0.45rem 1.2rem', borderRadius: '20px', border: 'none',
                    cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                    whiteSpace: 'nowrap', flexShrink: 0,
                    background: activeCategory === c ? (c.includes('18+') ? '#dc2626' : '#E50914') : '#1e1e22',
                    color: activeCategory === c ? '#fff' : '#b3b3b3',
                    transition: 'all 0.18s ease',
                    boxShadow: activeCategory === c ? '0 4px 14px rgba(229,9,20,0.35)' : 'none'
                  }}
                >{c}</button>
              ))}
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          {activeCategory === 'All' ? (
            /* ALL CATEGORIES HOME VIEW (Horizontal Scrolling Rows) */
            <div style={{ padding: '0.5rem clamp(1rem, 4vw, 3rem) 4rem' }}>
              {mpTrending.length > 0 && (
                <MovieRow title="Trending" icon={<Flame size={20} style={{ color: '#ef4444' }} />} movies={mpTrending} onMovieClick={onMovieClick} />
              )}
              {mpHindiDub.length > 0 && (
                <MovieRow title="Hindi Dubbed" icon={<Globe size={20} style={{ color: '#06b900' }} />} movies={mpHindiDub} onMovieClick={onMovieClick} />
              )}
              {mpBollywood.length > 0 && (
                <MovieRow title="Bollywood" icon={<Flame size={20} style={{ color: '#f97316' }} />} movies={mpBollywood} onMovieClick={onMovieClick} />
              )}
              {mpHollywood.length > 0 && (
                <MovieRow title="Hollywood" icon={<Tv size={20} style={{ color: '#3b82f6' }} />} movies={mpHollywood} onMovieClick={onMovieClick} />
              )}
              {mpWebSeries.length > 0 && (
                <MovieRow title="Web Series" icon={<Tv size={20} style={{ color: '#8b5cf6' }} />} movies={mpWebSeries} onMovieClick={onMovieClick} />
              )}
              {mpAction.length > 0 && (
                <MovieRow title="Action" icon={<Zap size={20} style={{ color: '#f97316' }} />} movies={mpAction} onMovieClick={onMovieClick} />
              )}
              {mpThriller.length > 0 && (
                <MovieRow title="Thriller" icon={<Zap size={20} style={{ color: '#ef4444' }} />} movies={mpThriller} onMovieClick={onMovieClick} />
              )}
              {mpShortFilm.length > 0 && (
                <MovieRow title="Short Films" icon={<Sparkles size={20} style={{ color: '#06b900' }} />} movies={mpShortFilm} onMovieClick={onMovieClick} />
              )}
              {mpRomance.length > 0 && (
                <MovieRow title="Romance" icon={<Star size={20} style={{ color: '#ec4899' }} />} movies={mpRomance} onMovieClick={onMovieClick} />
              )}

              {/* ──  Random Picks Section (Developer-Curated Infinite Grid at Bottom) ── */}
              {randomPicks.length > 0 && (
                <section style={{ marginTop: '3.5rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Sparkles size={20} style={{ color: '#a78bfa' }} />
                      <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.2px' }}>Random Picks</h2>
                      <span style={{ background: 'rgba(139,92,246,0.25)', color: '#a78bfa', padding: '2px 9px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700 }}>{randomPicks.length} movies</span>
                    </div>
                    <button
                      onClick={() => { if (window.confirm('Clear all Random Picks?')) saveRandomPicks([]); }}
                      style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)', padding: '3px 10px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.72rem' }}
                    >Clear</button>
                  </div>
                  {/* Infinite Grid for Random Picks */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1.2rem 1rem' }}>
                    {randomPicks.map((m, idx) => (
                      <MovieCard key={m.id + '-rp-' + idx} movie={m} onClick={() => onMovieClick(m)} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            /* DEDICATED CATEGORY GRID VIEW (Full paginated catalog of 200+ movies) */
            <div style={{ padding: '1.5rem clamp(1rem, 4vw, 3rem) 4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#fff' }}>
                    {activeCategory} Movies {displayCatMovies.length > 0 && <span style={{ fontSize: '0.9rem', color: '#b3b3b3', fontWeight: 400 }}>({displayCatMovies.length} items)</span>}
                  </h2>
                  {/* Developer mode toggle – only shown to admin godkiller in 18+ category */}
                  {activeCategory === '🔞 18+' && isAdmin && (
                    <button
                      onClick={() => { setDevModeActive(v => !v); setSelectedMovieIds(new Set()); setShowPushPopup(false); }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                        background: devModeActive ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.07)',
                        border: `1px solid ${devModeActive ? '#8b5cf6' : 'rgba(255,255,255,0.15)'}`,
                        color: devModeActive ? '#c4b5fd' : 'rgba(255,255,255,0.5)',
                        padding: '0.3rem 0.9rem', borderRadius: '20px', cursor: 'pointer',
                        fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.18s',
                      }}
                    >
                      🛠️ {devModeActive ? 'Dev Mode ON – tap to select' : 'Developer Options'}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => { setActiveCategory('All'); setDevModeActive(false); setSelectedMovieIds(new Set()); setShowPushPopup(false); }}
                  style={{
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', padding: '0.4rem 1rem', borderRadius: '20px',
                    fontSize: '0.8rem', cursor: 'pointer'
                  }}
                >← All Categories</button>
              </div>

              {/* Dev mode instruction banner */}
              {devModeActive && activeCategory === '🔞 18+' && (
                <div style={{
                  background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.35)',
                  borderRadius: '10px', padding: '0.8rem 1.2rem', marginBottom: '1.2rem',
                  display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
                }}>
                  <span style={{ fontSize: '1.2rem' }}>🛠️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#c4b5fd', fontWeight: 700, fontSize: '0.88rem' }}>Developer Selection Mode Active</div>
                    <div style={{ color: 'rgba(196,181,253,0.7)', fontSize: '0.75rem', marginTop: '2px' }}>Tap any movie card to select it. Selected movies will be pushed to the <strong>🎲 Random Picks!</strong> row on the homepage.</div>
                  </div>
                  {selectedMovieIds.size > 0 && (
                    <span style={{ background: '#8b5cf6', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontWeight: 700, fontSize: '0.78rem' }}>{selectedMovieIds.size} selected</span>
                  )}
                </div>
              )}

              {catLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
                    <div key={i} className="mp-skeleton-card" />
                  ))}
                </div>
              ) : displayCatMovies.length > 0 ? (
                <>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: '1.2rem 1rem'
                  }}>
                    {displayCatMovies.map((m, idx) => (
                      <div key={m.id + '-' + idx} style={{ position: 'relative' }}
                        onClick={devModeActive ? (e) => { e.stopPropagation(); toggleMovieSelection(m); } : undefined}
                      >
                        {/* Checkmark overlay in dev mode */}
                        {devModeActive && (
                          <div style={{
                            position: 'absolute', top: '6px', right: '6px', zIndex: 10,
                            width: '22px', height: '22px', borderRadius: '50%',
                            background: selectedMovieIds.has(m.id) ? '#8b5cf6' : 'rgba(0,0,0,0.55)',
                            border: `2px solid ${selectedMovieIds.has(m.id) ? '#8b5cf6' : 'rgba(255,255,255,0.5)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s', cursor: 'pointer',
                          }}>
                            {selectedMovieIds.has(m.id) && (
                              <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                        )}
                        <div style={{ opacity: devModeActive && selectedMovieIds.has(m.id) ? 0.85 : 1, outline: devModeActive && selectedMovieIds.has(m.id) ? '2px solid #8b5cf6' : 'none', borderRadius: '8px', transition: 'all 0.15s' }}>
                          <MovieCard movie={m} onClick={devModeActive ? () => {} : () => onMovieClick(m)} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {catPage < catTotalPages && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem' }}>
                      <button
                        onClick={loadMoreCategoryMovies}
                        disabled={loadingMore}
                        style={{
                          padding: '0.85rem 3rem', background: '#E50914', color: '#fff',
                          border: 'none', borderRadius: '6px', fontSize: '0.95rem', fontWeight: 700,
                          cursor: 'pointer', opacity: loadingMore ? 0.6 : 1,
                          boxShadow: '0 4px 16px rgba(229,9,20,0.4)', transition: 'all 0.18s'
                        }}
                      >
                        {loadingMore ? 'Loading More Movies...' : `Load More (${catTotalCount - catMovies.length} remaining)`}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '4rem 0' }}>No movies found in this category.</p>
              )}
            </div>
          )}

          {/* ── Push to Random Picks Popup ── */}
          {showPushPopup && selectedMovieIds.size > 0 && (
            <div style={{
              position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)',
              zIndex: 9999, minWidth: 'min(92vw, 380px)',
            }}>
              <div style={{
                background: '#1a1a2e', border: '1px solid rgba(139,92,246,0.5)',
                borderRadius: '16px', padding: '1.2rem 1.4rem',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                display: 'flex', flexDirection: 'column', gap: '0.9rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>🎲</span>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>{selectedMovieIds.size} movie{selectedMovieIds.size > 1 ? 's' : ''} selected</div>
                    <div style={{ color: 'rgba(196,181,253,0.7)', fontSize: '0.75rem' }}>Push to <strong>Random Picks!</strong> on the homepage?</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.7rem' }}>
                  <button
                    onClick={handleCancelPicks}
                    style={{
                      flex: 1, padding: '0.65rem', background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)', color: '#fff',
                      borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
                    }}
                  >✕ Cancel</button>
                  <button
                    onClick={handlePushPicks}
                    style={{
                      flex: 2, padding: '0.65rem', background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
                      border: 'none', color: '#fff',
                      borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
                      boxShadow: '0 4px 16px rgba(139,92,246,0.5)',
                    }}
                  >🚀 Push to Random Picks!</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}




// Helper to clean raw WordPress titles for display (e.g. "Drishyam 3 (2026) Hindi Dubbed Movie Watch Online" -> "Drishyam 3")
function cleanMovieDisplayTitle(raw) {
  if (!raw) return 'Untitled Movie';
  const cleaned = raw
    .replace(/\bWatch\s+Online\b/gi, '')
    .replace(/\bFull\s+Movie\b/gi, '')
    .replace(/\bFull\s+Web\s+Series\b/gi, '')
    .replace(/\bDownload\s+Now\b/gi, '')
    .replace(/\(\d{4}\)/g, '').replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/E\d+[-T]\d+/gi, '').replace(/\bE\d+\b/gi, '').replace(/\bS\d+\b/gi, '')
    .replace(/\bPart\s*\d+\b/gi, '').replace(/\bVolume\s*\d+\b/gi, '').replace(/\bVol\.?\s*\d+\b/gi, '')
    .replace(/\bEpisode\s*\d+\b/gi, '').replace(/\bSeason\s*\d+\b/gi, '').replace(/\bComplete\b/gi, '')
    .replace(/\b(Hindi Dubbed|Hindi Dub|Hindi|Bengali|Malayalam|Tamil|Telugu|Kannada|Marathi|Punjabi|Gujarati|English|Bangladeshi|South Indian|Korean|Japanese|Chinese|Thai)\b/gi, '')
    .replace(/\b(HDRip|BluRay|WEB-DL|WEBRip|UNCUT|HDTS|HDTC|HDCam|HDCAM|CAMRip|CAM|DVDSCR|DVDScr|SCR|TS|DVDRIP|DVDRip|HD|4K|1080p|720p|480p|360p|Extended|Directors.?Cut)\b/gi, '')
    .replace(/\b(Hollywood|Bollywood|Tollywood|Mollywood|Kollywood|Pollywood)\b/gi, '')
    .replace(/\b(Short Film|App Video|Webseries|Web Series|OTT|Originals|Exclusive)\b/gi, '')
    .replace(/\b(Sigmaseries|Sigma|Cukkuboo|Hulchul|HulChul|Hoichoi|Moodx|Kooku|Ullu|ALTBalaji|PrimeShots|Rabbit|RabbitMovies|Voovi|Chikooflix|Atrangii|NewSensations|LookEnt|Nuefliks|GupChup|Hotshots|Flizmovies|Mastram|DigiMoviePlex|Balloons|Besharams|Cinemadosti|Netflix|Amazon|Hotstar|SonyLiv|ZEE5|Voot|MXPlayer|JioCinema|Aha|Lionsgate|Disney)\b/gi, '')
    .replace(/\bMovie\b/gi, '').replace(/\bSeries\b/gi, '').replace(/\bFilm\b/gi, '')
    .replace(/[-_:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || raw;
}

// ── Netflix-Style Movie Detail View ──────────────────────────────────────────
function MovieDetailView({ movie, isLoading, onBack, onWatch }) {
  const [relatedMovies, setRelatedMovies] = React.useState([]);
  const [relatedLoading, setRelatedLoading] = React.useState(false);
  const [inWatchlist, setInWatchlist] = React.useState(false);

  const displayTitle = cleanMovieDisplayTitle(movie.title);
  const yearMatch = (movie.title || '').match(/\b(19|20)\d{2}\b/);
  const releaseYear = movie.releaseDate ? String(movie.releaseDate).split('-')[0] : (yearMatch ? yearMatch[0] : '2024');
  const heroImage = movie.bannerImage || movie.coverImage || movie.thumbnail || '';

  // Fetch "More Like This" recommendations
  React.useEffect(() => {
    setRelatedLoading(true);
    fetch(apiUrl('/api/movieplex/catalog?page=1&limit=12'))
      .then(r => r.json())
      .then(res => {
        const items = Array.isArray(res.movies) ? res.movies.filter(m => m.id !== movie.id) : [];
        setRelatedMovies(items.slice(0, 10));
        setRelatedLoading(false);
      })
      .catch(() => setRelatedLoading(false));
  }, [movie.id]);

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a', color: '#fff',
      fontFamily: '"Inter","Roboto",sans-serif'
    }}>
      {/* Full-bleed 75vh Billboard Hero */}
      <div style={{
        position: 'relative', minHeight: '72vh', width: '100%',
        backgroundImage: `url(${heroImage})`,
        backgroundSize: 'cover', backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat'
      }}>
        {/* Triple Netflix Scrim Gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, #0a0a0a 0%, rgba(10,10,10,0.8) 35%, rgba(10,10,10,0.2) 75%, transparent 100%), linear-gradient(to top, #0a0a0a 0%, rgba(10,10,10,0.6) 45%, transparent 100%)'
        }} />

        {/* Floating Back Button */}
        <div style={{ position: 'absolute', top: '1.5rem', left: 'clamp(1rem, 4vw, 3rem)', zIndex: 10 }}>
          <button onClick={onBack} style={{
            background: 'rgba(20,20,20,0.8)', border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', padding: '0.5rem 1.2rem', borderRadius: '30px',
            cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            backdropFilter: 'blur(10px)', boxShadow: '0 4px 16px rgba(0,0,0,0.6)'
          }}>← Back to Movies</button>
        </div>

        {/* Hero Content */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '3rem clamp(1rem, 4vw, 3rem) 3rem',
          maxWidth: '850px', zIndex: 5
        }}>
          {/* Netflix Quality & Language Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
            <span style={{ background: '#E50914', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '3px', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>Movie</span>
            <span style={{ color: '#46d369', fontWeight: 800, fontSize: '0.88rem' }}>98% Match</span>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600 }}>{releaseYear}</span>
            <span style={{ border: '1px solid rgba(255,255,255,0.4)', padding: '1px 5px', borderRadius: '2px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>16+</span>
            <span style={{ border: '1px solid rgba(255,255,255,0.4)', padding: '1px 5px', borderRadius: '2px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>4K Ultra HD</span>
            <span style={{ background: 'rgba(255,255,255,0.15)', padding: '2px 7px', borderRadius: '3px', fontSize: '0.72rem', color: '#fff', fontWeight: 600 }}>Hindi Dubbed</span>
            {movie.rating && <span style={{ color: '#facc15', fontWeight: 700, fontSize: '0.85rem' }}>★ {movie.rating}</span>}
          </div>

          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3.4rem)', margin: '0 0 1rem',
            fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.12,
            textShadow: '0 2px 24px rgba(0,0,0,0.95)'
          }}>{displayTitle}</h1>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '1.8rem' }}>
            <button
              onClick={onWatch}
              style={{
                background: '#E50914', color: '#fff',
                border: 'none', padding: '0.85rem 2.5rem',
                borderRadius: '6px', fontSize: '1.05rem', fontWeight: 800,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                transition: 'all 0.18s ease',
                boxShadow: '0 6px 20px rgba(229,9,20,0.5)'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#F6121D'}
              onMouseLeave={e => e.currentTarget.style.background = '#E50914'}
            >
              ▶ Play Movie
            </button>

            <button
              onClick={() => setInWatchlist(!inWatchlist)}
              style={{
                background: inWatchlist ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)',
                color: '#fff', border: '1px solid rgba(255,255,255,0.25)',
                padding: '0.85rem 1.8rem', borderRadius: '6px', fontSize: '0.95rem', fontWeight: 600,
                cursor: 'pointer', backdropFilter: 'blur(8px)', transition: 'all 0.18s'
              }}
            >
              {inWatchlist ? '✓ In My List' : '+ Add to My List'}
            </button>
          </div>
        </div>
      </div>

      {/* Netflix 2-Column Info & Overview Section */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2.5rem clamp(1rem, 4vw, 3rem) 4rem' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2.5rem', marginBottom: '3.5rem'
        }}>
          {/* Left Column: Synopsis */}
          <div>
            <h3 style={{ margin: '0 0 0.8rem', color: '#fff', fontSize: '1.1rem', fontWeight: 700 }}>Storyline</h3>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.78)', lineHeight: 1.7, fontSize: '0.95rem' }}>
              {movie.description || `${displayTitle} is a gripping high-stakes cinematic release featuring high quality dual audio, intense drama, and suspenseful twists. Stream in full HD resolution with CORS-enabled fast playback on EetNet.`}
            </p>
          </div>

          {/* Right Column: Metadata Sidebar */}
          <div style={{
            background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
            padding: '1.5rem', border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>Audio & Dubbing</span>
              <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>Hindi Dubbed, Original Audio (Dual Audio)</span>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>Genres</span>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {(movie.genres || ['Action', 'Thriller', 'Drama']).map(g => (
                  <span key={g} style={{
                    padding: '0.2rem 0.7rem', background: 'rgba(255,255,255,0.08)',
                    borderRadius: '12px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)'
                  }}>{g}</span>
                ))}
              </div>
            </div>

            <div>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>Quality & Format</span>
              <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>1080p Full HD (HLS CORS Stream)</span>
            </div>
          </div>
        </div>

        {/* "More Like This" Recommendation Grid */}
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 1.2rem', color: '#fff' }}>
            More Like This
          </h2>

          {relatedLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
              {[1,2,3,4,5,6].map(i => <div key={i} className="mp-skeleton-card" />)}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '1.2rem 1rem'
            }}>
              {relatedMovies.map((m, idx) => (
                <MovieCard key={m.id + '-' + idx} movie={m} onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  onWatch(m);
                }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MoviePlex Cinema Player View ─────────────────────────────────────────────
function MoviePlexPlayerView({ movie, onBack }) {
  const [streamData, setStreamData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [useFallback, setUseFallback] = React.useState(false);
  const [postInfo, setPostInfo] = React.useState(null);
  const [moreMovies, setMoreMovies] = React.useState([]);

  const slug = movie.movieplexSlug || movie.slug;
  const displayTitle = cleanMovieDisplayTitle(movie.title || postInfo?.title || '');

  React.useEffect(() => {
    if (!slug) return;
    fetch(apiUrl(`/api/movieplex/post-info?slug=${encodeURIComponent(slug)}`))
      .then(r => r.json())
      .then(data => { setPostInfo(data); })
      .catch(() => {});
  }, [slug]);

  React.useEffect(() => {
    if (!slug) { setError('No slug provided'); setLoading(false); return; }
    setLoading(true); setError(null); setUseFallback(false);
    fetch(apiUrl(`/api/movieplex/stream?slug=${encodeURIComponent(slug)}`))
      .then(r => r.json())
      .then(data => {
        setStreamData(data);
        setLoading(false);
        if (data.source === 'streamtape') setUseFallback(true);
      })
      .catch(err => { setError(err.message || 'Failed to load stream'); setLoading(false); });
  }, [slug]);

  // Fetch recommendations for below player
  React.useEffect(() => {
    fetch(apiUrl('/api/movieplex/catalog?page=1&limit=12'))
      .then(r => r.json())
      .then(res => {
        if (Array.isArray(res.movies)) setMoreMovies(res.movies.slice(0, 10));
      })
      .catch(() => {});
  }, []);

  const thumbnail = postInfo?.thumbnail || movie.thumbnail || movie.coverImage || '';
  const isHLS = (streamData?.source === 'lulustream' || streamData?.directHls) && !!streamData?.streamUrl;
  const extractionFailed = !loading && streamData && !streamData.source && !!streamData.error;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: '"Inter","Roboto",sans-serif' }}>

      {/* Top Navbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        padding: '0.9rem clamp(1rem, 4vw, 2rem)',
        background: 'rgba(10,10,10,0.96)', backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 30,
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        <button onClick={onBack} style={{
          background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff',
          padding: '0.4rem 1rem', borderRadius: '20px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          fontSize: '0.85rem', fontWeight: 600, flexShrink: 0
        }} aria-label="Back">← Back</button>

        <span style={{
          fontWeight: 800, fontSize: '1.05rem', color: '#fff',
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>{displayTitle}</span>

        <span style={{
          fontSize: '0.68rem', fontWeight: 800, letterSpacing: '1px',
          color: '#e50914', border: '1px solid #e50914',
          padding: '0.2rem 0.6rem', borderRadius: '3px', flexShrink: 0,
          textTransform: 'uppercase'
        }}>CINEMA 4K</span>
      </div>

      {/* Main Player Box with Ambient Shadow */}
      <div style={{
        width: '100%', maxWidth: '1200px', margin: '1.5rem auto 0',
        padding: '0 clamp(1rem, 3vw, 2rem)'
      }}>
        <div style={{
          width: '100%', aspectRatio: '16/9', position: 'relative',
          background: '#000', borderRadius: '12px', overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 40px rgba(229,9,20,0.08)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', background: '#111', gap: '1.2rem'
            }}>
              {thumbnail && <img src={thumbnail} alt={displayTitle} style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', opacity: 0.3
              }} />}
              <div className="loading-spinner" style={{ width: '48px', height: '48px', borderWidth: '3px', zIndex: 2 }} />
              <p style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600, zIndex: 2 }}>Preparing High-Speed HLS Stream…</p>
            </div>
          )}
          {!loading && isHLS && !useFallback && (
            <VideoPlayer
              source={{ url: streamData.streamUrl, isM3U8: true }}
              poster={thumbnail}
              title={displayTitle}
              className="movieplex-player"
              onError={() => {
                if (streamData?.fallbackIframe) setUseFallback(true);
              }}
            />
          )}
          {!loading && useFallback && streamData?.fallbackIframe && (
            <iframe
              src={streamData.fallbackIframe}
              title={displayTitle}
              style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', inset: 0 }}
              allowFullScreen
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            />
          )}
          {!loading && extractionFailed && !useFallback && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '1rem', background: '#111'
            }}>
              {thumbnail && <img src={thumbnail} alt={displayTitle} style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', opacity: 0.12
              }} />}
              <div style={{ zIndex: 2, textAlign: 'center', padding: '0 2rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚠️</div>
                <p style={{ fontWeight: 700, fontSize: '1.1rem', margin: '0 0 0.4rem' }}>Stream Unavailable</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', margin: '0 0 1.2rem' }}>
                  Could not extract a direct stream. Switch to external player below.
                </p>
                {streamData?.fallbackIframe && (
                  <button onClick={() => setUseFallback(true)} style={{
                    padding: '0.6rem 1.6rem', background: '#E50914',
                    border: 'none', borderRadius: '6px',
                    color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700
                  }}>🌐 Switch to External Player</button>
                )}
              </div>
            </div>
          )}
          {!loading && error && !streamData && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '1rem'
            }}>
              <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>Could not load stream: {error}</p>
              <button onClick={onBack} style={{
                padding: '0.5rem 1.5rem', background: '#e50914',
                border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer'
              }}>Go Back</button>
            </div>
          )}
        </div>
      </div>

      {/* Below Player Controls & Recommendations */}
      {!loading && streamData && (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem clamp(1rem, 3vw, 2rem) 4rem' }}>

          {/* Player Switcher Bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.8rem',
            padding: '0.8rem 1.2rem', background: 'rgba(255,255,255,0.03)',
            borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)',
            marginBottom: '2rem', flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginRight: '0.5rem' }}>Server Source:</span>
            {isHLS && (
              <button onClick={() => setUseFallback(false)} style={{
                padding: '0.45rem 1.3rem', borderRadius: '20px', border: 'none', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: 700,
                background: !useFallback ? '#E50914' : 'rgba(255,255,255,0.08)',
                color: '#fff', transition: 'all 0.18s'
              }}>⚡ Our HLS Player (Ad-Free)</button>
            )}
            {streamData.fallbackIframe && (
              <button onClick={() => setUseFallback(true)} style={{
                padding: '0.45rem 1.3rem', borderRadius: '20px', border: 'none', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: 700,
                background: useFallback ? '#E50914' : 'rgba(255,255,255,0.08)',
                color: '#fff', transition: 'all 0.18s'
              }}>🌐 External Player</button>
            )}
          </div>

          {/* Movie Recommendation Grid Below Player */}
          {moreMovies.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 1.2rem', color: '#fff' }}>
                More Movies to Watch
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '1.2rem 1rem'
              }}>
                {moreMovies.map((m, idx) => (
                  <MovieCard key={m.id + '-' + idx} movie={m} onClick={() => {
                    window.location.href = `/movie/${m.movieplexSlug || m.slug || m.id}`;
                  }} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MovieWatchView({ movie, onBack, onProgress }) {
  const isMoviePlex = !!(movie.movieplexSlug || movie.source === 'movieplex');

  // All hooks must be declared unconditionally (Rules of Hooks)
  const [movieData, setMovieData] = React.useState(movie);
  const [activeServerId, setActiveServerId] = React.useState('vidlink-pro');
  const [resolving, setResolving] = React.useState(false);

  // If it's a MoviePlex movie, delegate to MoviePlexPlayerView.
  // We still need the hooks above unconditionally but we short-circuit the render here.
  if (isMoviePlex) {
    return <MoviePlexPlayerView movie={movie} onBack={onBack} />;
  }



  // For NetMirror items: search TMDB by title to get a TMDB ID for embed servers
  // For regular TMDB items: fetch full info to get imdbId
  React.useEffect(() => {
    if (movie.netmirrorId && movie.title) {
      setResolving(true);
      // Search TMDB for this title to get the TMDB numeric ID
      fetch(`/api/movies/search?q=${encodeURIComponent(movie.title)}`)
        .then(r => r.json())
        .then(results => {
          if (results?.length) {
            const best = results.find(r => r.title?.toLowerCase() === movie.title?.toLowerCase()) || results[0];
            setMovieData(prev => ({ ...prev, id: best.id, tmdbId: best.id, imdbId: best.imdbId }));
          }
        })
        .catch(() => {})
        .finally(() => setResolving(false));
    } else if (!movie.imdbId && movie.id && !movie.netmirrorId) {
      fetch(`/api/movies/info/${movie.id}`)
        .then(r => r.json())
        .then(data => { if (data?.imdbId) setMovieData(prev => ({ ...prev, imdbId: data.imdbId })); })
        .catch(() => {});
    }
  }, [movie.id, movie.title]);

  const tmdbId = movieData.tmdbId || movieData.id;
  const imdbId = movieData.imdbId;
  const activeId = imdbId || tmdbId;

  const iframeServers = [
    { id: 'vidlink-pro', name: 'Server 1', tag: 'VidLink Pro', getUrl: () => `https://vidlink.pro/movie/${tmdbId}` },
    { id: 'vidsrc-cc', name: 'Server 2', tag: 'VidSrc HD', getUrl: () => `https://vidsrc.cc/v2/embed/movie/${tmdbId}` },
    { id: 'vidsrc-xyz', name: 'Server 3', tag: 'VidSrc XYZ', getUrl: () => `https://vidsrc.xyz/embed/movie/${activeId}` },
    { id: '2embed', name: 'Server 4', tag: '2Embed', getUrl: () => `https://www.2embed.cc/embed/${tmdbId}` },
    { id: 'smashy', name: 'Server 5', tag: 'SmashyStream', getUrl: () => `https://player.smashystream.com/movie/${tmdbId}` },
    { id: 'multiembed', name: 'Server 6', tag: 'MultiEmbed', getUrl: () => `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1` }
  ];

  // Track progress
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (onProgress) onProgress({ progress_seconds: 100, duration_seconds: 100 });
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const currentServer = iframeServers.find(s => s.id === activeServerId) || iframeServers[0];

  return (
    <div className="nm-watch" style={{
      minHeight: '100vh',
      background: '#000',
      color: '#fff',
      fontFamily: '"Roboto","HelveticaNeue-Light",sans-serif'
    }}>
      {/* NetMirror-style top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem 1.5rem',
        background: 'linear-gradient(#000 20%, #0000001c 86%, #0000 94%)',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: '1.5rem',
            cursor: 'pointer',
            padding: '0.4rem',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center'
          }}
          aria-label="Back"
        >
          ←
        </button>
        <span style={{ color: '#06b900', fontWeight: 700, fontSize: '1.3rem' }}>NET MIRROR</span>
      </div>

      {/* Player area — NetMirror style fullscreen black */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '900px',
        margin: '0 auto',
        aspectRatio: '16/9',
        background: '#000',
        boxShadow: '0 0 40px rgba(0,0,0,0.8)'
      }}>
        <iframe
          key={activeServerId + '-' + (imdbId || 'noimdb')}
          src={currentServer.getUrl()}
          title={movie.title}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        />
      </div>

      {/* Server selector — NetMirror pill style */}
      <div style={{
        maxWidth: '900px',
        margin: '1.5rem auto',
        padding: '0 1rem'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem',
          flexWrap: 'wrap'
        }}>
          <span style={{
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginRight: '0.5rem'
          }}>Servers</span>
          {iframeServers.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveServerId(s.id)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                transition: 'all 0.2s',
                background: activeServerId === s.id ? '#06b900' : 'rgba(255,255,255,0.1)',
                color: activeServerId === s.id ? '#000' : '#fff'
              }}
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* Movie info block — NetMirror style */}
        <div style={{
          marginTop: '1.5rem',
          padding: '1.5rem',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '8px',
          borderLeft: '3px solid #06b900'
        }}>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.8rem', fontWeight: 700 }}>
            {movie.title}
          </h1>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', marginBottom: '1rem' }}>
            {movie.releaseDate && <span>{String(movie.releaseDate).split('-')[0]}</span>}
            {movie.rating && <span style={{ color: '#06b900' }}>★ {movie.rating}</span>}
            {movie.runtime && <span>{movie.runtime} mins</span>}
            <span style={{ color: '#06b900', fontWeight: 600 }}>HD Available</span>
          </div>
          {movie.description && (
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              {movie.description}
            </p>
          )}
          {movie.genres && movie.genres.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              {movie.genres.map(g => (
                <span key={g} style={{
                  padding: '0.25rem 0.75rem',
                  background: 'rgba(6,185,0,0.15)',
                  border: '1px solid rgba(6,185,0,0.3)',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  color: '#06b900'
                }}>{g}</span>
              ))}
            </div>
          )}
        </div>

        {/* Currently watching tag */}
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem 1rem',
          background: 'rgba(6,185,0,0.08)',
          borderRadius: '6px',
          fontSize: '0.8rem',
          color: 'rgba(255,255,255,0.5)',
          textAlign: 'center'
        }}>
          You're watching <span style={{ color: '#06b900', fontWeight: 600 }}>{movie.title}</span> · Source: {currentServer.tag}
          <br />
          If the video doesn't load, try another server above.
        </div>
      </div>
    </div>
  );
}

// 
// MANGA COMPONENTS
// 

function MangaCard({ manga, onClick, index = 0 }) {
  const [imgError, setImgError] = React.useState(false);
  const rating = Number.parseFloat(manga.rating);
  const hasRating = Number.isFinite(rating) && rating > 0;
  if (!hasRating) manga = { ...manga, rating: '' };
  return (
    <button type="button" className="manga-card" style={{ '--manga-card-index': index }} onClick={() => onClick(manga)}>
      <div className="manga-card-art">
        {manga.cover && !imgError ? (
          <img src={manga.cover} alt={manga.title} onError={() => setImgError(true)} loading="lazy" />
        ) : (
          <div className="manga-card-placeholder">
            <BookOpen size={32} style={{ opacity: 0.4 }} />
          </div>
        )}
        <div className="manga-card-overlay">
          <span className="manga-card-read">Read</span>
        </div>
        {manga.status && (
          <span className={`manga-status-badge ${manga.status === 'ongoing' ? 'ongoing' : manga.status === 'completed' ? 'completed' : ''}`}>
            {manga.status}
          </span>
        )}
      </div>
      <div className="manga-card-info">
        <p className="manga-card-title">{manga.title}</p>
        {manga.rating && <span style={{ color: '#f59e0b', fontWeight: 600 }}> {manga.rating}</span>}
      </div>
    </button>
  );
}

function MangaRow({ title, icon, mangas, onMangaClick }) {
  return (
    <section className="manga-row">
      <header className="manga-row-heading">
        <div className="hv-section-header">
          <h2 className="hv-section-title">{icon} {title}</h2>
          <span className="hv-section-line" />
        </div>
        <span className="manga-row-count">{mangas.length} titles</span>
      </header>
      <div className="manga-row-slider">
        {mangas.map((m, i) => (
          <MangaCard key={m.id || i} manga={m} index={i} onClick={onMangaClick} />
        ))}
      </div>
    </section>
  );
}

function MangaBentoGrid({ items, onMangaClick }) {
  if (!items || items.length === 0) return null;
  const heroItem = items[0];
  const restItems = items.slice(1, 10);

  return (
    <div className="manga-bento-container">
      <div className="manga-bento-header">
        <h2 className="manga-bento-title">
          <Trophy size={22} style={{ color: '#f59e0b' }} /> Top 10 Comics
        </h2>
      </div>

      <div className="manga-bento-grid">
        {/* Item #1: Hero Bento Card (2x2) */}
        {heroItem && (
          <div className="bento-card-hero" onClick={() => onMangaClick(heroItem)}>
            <img src={heroItem.cover || heroItem.banner} alt={heroItem.title} className="bento-hero-bg" />
            <div className="bento-hero-overlay" />
            <div className="bento-rank-badge rank-1">
              <Trophy size={14} /> #1 TOP COMIC
            </div>
            <div className="bento-hero-content">
              <span className="manga-hero-rating"> {heroItem.rating || '9.0'} â€¢ SPOTLIGHT
              </span>
              <h3 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 800, margin: '0.2rem 0' }}>
                {heroItem.title}
              </h3>
              {heroItem.description && (
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {heroItem.description}
                </p>
              )}
              <div style={{ marginTop: '0.6rem' }}>
                <button className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
                  <BookOpen size={15} style={{ marginRight: '0.3rem' }} /> Read Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Items #2 to #10 */}
        {restItems.map((item, idx) => {
          const rank = idx + 2;
          const rankClass = rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-standard';
          return (
            <div key={item.id || idx} className="bento-card-standard" onClick={() => onMangaClick(item)}>
              <img src={item.cover || item.banner} alt={item.title} className="bento-card-img" />
              <div className="bento-card-overlay" />
              <div className={`bento-rank-badge ${rankClass}`}>
                #{rank}
              </div>
              <div className="bento-card-info">
                <span className="manga-badge"> {item.rating || '8.5'}</span>

                <div className="bento-card-title">{item.title}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MangaCategoryCards({ onSelectCategory }) {
  const categories = [
    {
      id: 'manga',
      title: 'Manga',
      flag: 'ðŸ‡¯ðŸ‡µ',
      desc: 'Japanese Comics â€¢ Shonen, Seinen, Shojo & Romance',
      className: 'manga'
    },
    {
      id: 'manhwa',
      title: 'Manhwa',
      flag: '',
      desc: 'Korean Webtoons â€¢ Solo Leveling, System, Reincarnation & Action',
      className: 'manhwa'
    },
    {
      id: 'manhua',
      title: 'Manhua / Donghua Comic',
      flag: '',
      desc: 'Chinese Webtoons â€¢ Martial Arts, Cultivation & Donghua Adaptations',
      className: 'manhua'
    }
  ];

  return (
    <div className="manga-categories-section">
      <div className="hv-section-header" style={{ marginBottom: '1.25rem' }}>
        <h2 className="hv-section-title">
          <Compass size={20} style={{ color: '#3b82f6' }} /> Browse by Format
        </h2>
        <span className="hv-section-line" />
      </div>
      <div className="manga-category-grid">
        {categories.map(cat => (
          <div key={cat.id} className={`manga-cat-card ${cat.className}`} onClick={() => onSelectCategory(cat.id)}>
            <div className="manga-cat-flag">{cat.flag}</div>
            <div className="manga-cat-title">{cat.title}</div>
            <div className="manga-cat-desc">{cat.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MangaCategoryHub({ category, onBack, onMangaClick }) {
  const [selectedGenre, setSelectedGenre] = React.useState('all');
  const [catData, setCatData] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const categoryMeta = {
    manga: { title: 'Manga Hub', subtitle: 'Explore Japanese Manga Comics' },
    manhwa: { title: 'Manhwa Hub', subtitle: 'Explore Korean Webtoons & Manhwa' },
    manhua: { title: 'Manhua Hub', subtitle: 'Explore Chinese Manhua & Cultivation Comics' }
  }[category] || { title: 'Manga Hub', subtitle: 'Browse Catalog' };

  const genres = [
    { id: 'all', label: 'All Genres' },
    { id: 'action', label: 'Action' },
    { id: 'fantasy', label: 'Fantasy' },
    { id: 'romance', label: 'Romance' },
    { id: 'system', label: 'System' },
    { id: 'isekai', label: 'Isekai' },
    { id: 'adventure', label: 'Adventure' },
    { id: 'drama', label: 'Drama' },
    { id: 'sci-fi', label: 'Sci-Fi' }
  ];

  React.useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    api.getMangaCategoryData(category, selectedGenre).then(res => {
      if (isMounted) {
        setCatData(res);
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [category, selectedGenre]);

  return (
    <div className="container manga-subhub-header">
      {/* Breadcrumb Header */}
      <div className="manga-breadcrumb">
        <span className="manga-breadcrumb-link" onClick={onBack}>Â Ã‚Â Back to Manga Landing</span>
        <span>/</span>
        <span style={{ color: '#ffffff', fontWeight: 600 }}>{categoryMeta.title}</span>
      </div>

      <div className="manga-subhub-title-row">
        <span className="manga-subhub-flag">{categoryMeta.flag}</span>
        <div>
          <h1 className="manga-subhub-heading">{categoryMeta.title}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{categoryMeta.subtitle}</p>
        </div>
      </div>

      {/* Horizontal Genre Slider */}
      <div className="manga-genre-slider">
        {genres.map(g => (
          <button
            key={g.id}
            className={`manga-genre-pill ${selectedGenre === g.id ? 'active' : ''}`}
            onClick={() => setSelectedGenre(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Rows */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <InlineLoader />
        </div>
      ) : !catData || !catData.trending?.length ? (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem 0' }}>
          No titles found for this genre filter.
        </p>
      ) : (
        <div className="manga-rows-container">
          {catData.trending?.length > 0 && (
            <MangaRow
              title="Trending Now"
              icon={<Flame size={18} style={{ color: '#f97316' }} />}
              mangas={catData.trending}
              onMangaClick={onMangaClick}
            />
          )}
          {catData.popular?.length > 0 && (
            <MangaRow
              title="Most Popular"
              icon={<Trophy size={18} style={{ color: '#eab308' }} />}
              mangas={catData.popular}
              onMangaClick={onMangaClick}
            />
          )}
          {catData.topPick?.length > 0 && (
            <MangaRow
              title="Fan's Top Pick"
              icon={<Star size={18} fill="#a855f7" style={{ color: '#a855f7' }} />}
              mangas={catData.topPick}
              onMangaClick={onMangaClick}
            />
          )}
          {catData.recent?.length > 0 && (
            <MangaRow
              title="Recently Updated"
              icon={<Sparkles size={18} style={{ color: '#3b82f6' }} />}
              mangas={catData.recent}
              onMangaClick={onMangaClick}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MangaHomeView({ data, error, isLoading, searchQuery, searchResults, searchLoading, onSearch, onMangaClick }) {
  const [selectedCategory, setSelectedCategory] = React.useState(null);
  const bentoItems = data?.bentoTop10 || data?.trending || [];

  return (
    <div className="manga-home" style={{ paddingTop: '4rem' }}>
      {searchQuery.trim() ? (
        <div className="container manga-search-results">
          <div className="hv-section-header" style={{ marginBottom: '1.5rem' }}>
            <h2 className="hv-section-title">
              <Sparkles size={20} style={{ color: '#eab308' }} /> Results for &quot;{searchQuery}&quot;
            </h2>
            <span className="hv-section-line" />
          </div>
          {searchLoading ? (
            <div className="manga-loading"><InlineLoader /></div>
          ) : searchResults.length ? (
            <div className="manga-grid">
              {searchResults.map((m, i) => <MangaCard key={m.id || i} manga={m} onClick={onMangaClick} />)}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem 0' }}>No manga found.</p>
          )}
        </div>
      ) : selectedCategory ? (
        /* Render Dedicated Category Hub Sub-Page (Manga / Manhwa / Manhua) */
        <MangaCategoryHub
          category={selectedCategory}
          onBack={() => setSelectedCategory(null)}
          onMangaClick={onMangaClick}
        />
      ) : isLoading ? (
        <CategorySkeleton />
      ) : !data || (!data.bentoTop10?.length && !data.trending?.length) ? (
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.2rem' }}>
          <BookOpen size={48} style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', textAlign: 'center', maxWidth: '640px' }}>
            {error || 'Could not load manga catalog. Check your connection.'}
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
        </div>
      ) : (
        /* Main Bento Top 10 Landing Page + Category Selector Cards */
        <div className="container">
          {/* Top 10 Bento Grid */}
          <MangaBentoGrid items={bentoItems} onMangaClick={onMangaClick} />

          {/* Category Choice Cards (Manga, Manhwa, Manhua) */}
          <MangaCategoryCards onSelectCategory={(catId) => setSelectedCategory(catId)} />

          {/* Previews */}
          {data.manhwaPreview?.length > 0 && (
            <MangaRow
              title="Trending Manhwa Webtoons"
              icon={<Flame size={18} style={{ color: '#3b82f6' }} />}
              mangas={data.manhwaPreview}
              onMangaClick={onMangaClick}
            />
          )}

          {data.mangaPreview?.length > 0 && (
            <MangaRow
              title="Popular Japanese Manga"
              icon={<Trophy size={18} style={{ color: '#ef4444' }} />}
              mangas={data.mangaPreview}
              onMangaClick={onMangaClick}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MangaLandingShowcase({ items, onMangaClick }) {
  if (!items?.length) return null;
  const featured = items[0];
  const railItems = items.slice(1, 10);

  return (
    <section className="manga-landing-showcase">
      <article className="manga-featured-story" style={{ backgroundImage: `url(${featured.banner || featured.cover})` }}>
        <div className="manga-featured-scrim" />
        <div className="manga-featured-content">
          <span className="manga-featured-kicker">Top story this week</span>
          <h1>{featured.title}</h1>
          {featured.description && <p>{featured.description}</p>}
          <div className="manga-featured-actions">
            <button type="button" className="manga-featured-read" onClick={() => onMangaClick(featured)}>
              <BookOpen size={17} /> Read now
            </button>
            <span className="manga-featured-rating"><Star size={15} fill="currentColor" /> {featured.rating || '8.8'}</span>
          </div>
        </div>
        <span className="manga-featured-rank">01</span>
      </article>

      {railItems.length > 0 && (
        <div className="manga-story-rail-wrap">
          <div className="manga-story-rail-heading">
            <div>
              <span>Top 10</span>
              <h2>Keep exploring</h2>
            </div>
            <span className="manga-story-rail-note">This week&apos;s most-read stories</span>
          </div>
          <div className="manga-story-rail">
            {railItems.map((item, index) => (
              <button key={item.id || index} type="button" className="manga-story-rail-card" onClick={() => onMangaClick(item)}>
                <img src={item.cover || item.banner} alt="" loading="lazy" />
                <span className="manga-story-rail-rank">{String(index + 2).padStart(2, '0')}</span>
                <span className="manga-story-rail-title">{item.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MangaShelfSpotlight({ item, category, onMangaClick }) {
  if (!item) return null;
  const labels = { manga: 'Featured manga', manhwa: 'Featured manhwa', manhua: 'Featured manhua' };

  return (
    <article className="manga-shelf-spotlight" style={{ backgroundImage: `url(${item.banner || item.cover})` }}>
      <div className="manga-shelf-spotlight-scrim" />
      <div className="manga-shelf-spotlight-content">
        <span>{labels[category] || 'Featured story'}</span>
        <h2>{item.title}</h2>
        {item.description && <p>{item.description}</p>}
        <button type="button" onClick={() => onMangaClick(item)}><BookOpen size={16} /> Start reading</button>
      </div>
    </article>
  );
}

function MangaCategoryCardsV2({ onSelectCategory }) {
  const categories = [
    { id: 'manga', title: 'Manga', country: 'Japan', description: 'Shonen, seinen, shojo and every kind of panel-to-panel escape.', icon: BookOpen },
    { id: 'manhwa', title: 'Manhwa', country: 'Korea', description: 'Webtoons, action fantasy, romance and cliffhangers worth chasing.', icon: Sparkles },
    { id: 'manhua', title: 'Donghua', country: 'China', description: 'Chinese manhua, cultivation stories and worlds built on scale.', icon: Globe }
  ];

  return (
    <section className="manga-categories-section manga-categories-section--v2">
      <div className="hv-section-header manga-shelf-header">
        <h2 className="hv-section-title"><Compass size={20} /> Choose Your Shelf</h2>
        <span className="hv-section-line" />
      </div>
      <div className="manga-category-grid manga-category-grid--v2">
        {categories.map(({ icon: Icon, ...category }) => (
          <button key={category.id} type="button" className={`manga-cat-card manga-cat-card--v2 ${category.id}`} onClick={() => onSelectCategory(category.id)}>
            <span className="manga-cat-icon"><Icon size={23} /></span>
            <span className="manga-cat-eyebrow">{category.country}</span>
            <strong className="manga-cat-title">{category.title}</strong>
            <span className="manga-cat-desc">{category.description}</span>
            <span className="manga-cat-enter">Explore <ChevronRight size={16} /></span>
          </button>
        ))}
      </div>
    </section>
  );
}

function MangaGenreBrowse({ category, genre, onMangaClick }) {
  const [items, setItems] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [error, setError] = React.useState('');
  const sentinelRef = React.useRef(null);
  const pageRef = React.useRef(0);
  const keyRef = React.useRef('');
  const knownIdsRef = React.useRef(new Set());

  const loadBatch = React.useCallback(async (page, replace = false) => {
    const requestKey = `${category}:${genre}`;
    if (keyRef.current !== requestKey) return;

    if (replace) setIsLoading(true);
    else setIsLoadingMore(true);
    setError('');

    try {
      const response = await api.getMangaCategoryData(category, genre, page);
      if (keyRef.current !== requestKey) return;

      const incoming = Array.isArray(response?.items) ? response.items : [];
      if (replace) knownIdsRef.current = new Set();
      const unique = incoming.filter(item => {
        const id = item.id || item.comickSlug || item.title;
        if (!id || knownIdsRef.current.has(id)) return false;
        knownIdsRef.current.add(id);
        return true;
      });

      setItems(previous => replace ? unique : [...previous, ...unique]);
      pageRef.current = page;
      setHasMore(Boolean(response?.hasMore && unique.length > 0));
    } catch (err) {
      if (keyRef.current === requestKey) setError('Could not load more titles right now.');
    } finally {
      if (keyRef.current === requestKey) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [category, genre]);

  React.useEffect(() => {
    keyRef.current = `${category}:${genre}`;
    pageRef.current = 0;
    knownIdsRef.current = new Set();
    setItems([]);
    setHasMore(true);
    loadBatch(1, true);
  }, [category, genre, loadBatch]);

  const loadMore = React.useCallback(() => {
    if (!isLoading && !isLoadingMore && hasMore) loadBatch(pageRef.current + 1);
  }, [hasMore, isLoading, isLoadingMore, loadBatch]);

  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || isLoading) return undefined;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) loadMore();
    }, { rootMargin: '500px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore]);

  return (
    <section className="manga-genre-results" aria-live="polite">
      <div className="manga-genre-results-heading">
        <div>
          <span className="manga-results-kicker">{category}</span>
          <h2>{genre}</h2>
        </div>
        {!isLoading && <span className="manga-results-count">{items.length} titles</span>}
      </div>

      {isLoading ? (
        <div className="manga-genre-loading"><InlineLoader /></div>
      ) : items.length ? (
        <>
          <div className="manga-genre-grid">
            {items.map((manga, index) => <MangaCard key={manga.id || manga.comickSlug || index} manga={manga} onClick={onMangaClick} />)}
          </div>
          <div ref={sentinelRef} className="manga-load-sentinel">
            {isLoadingMore && <InlineLoader />}
            {error && <p className="manga-load-message">{error}</p>}
            {!isLoadingMore && hasMore && <button type="button" className="manga-load-more" onClick={loadMore}>Load more</button>}
            {!hasMore && <p className="manga-load-message">You have reached the end of this shelf.</p>}
          </div>
        </>
      ) : (
        <p className="manga-empty-state">No titles were found in this genre.</p>
      )}
    </section>
  );
}

function MangaCategoryHubV2({ category, onBack, onMangaClick }) {
  const [selectedGenre, setSelectedGenre] = React.useState('all');
  const [data, setData] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const categoryMeta = {
    manga: { title: 'Manga', eyebrow: 'Japanese comics', subtitle: 'A home for long-running favorites, new discoveries and every genre in between.' },
    manhwa: { title: 'Manhwa', eyebrow: 'Korean webtoons', subtitle: 'The stories people cannot stop reading, arranged for relaxed browsing.' },
    manhua: { title: 'Manhua', eyebrow: 'Chinese comics', subtitle: 'Manhua, donghua, cultivation epics and wide-open worlds with room to roam.' }
  }[category] || { title: 'Manga', eyebrow: 'Comic library', subtitle: 'Browse the catalog.' };

  const genres = [
    { id: 'all', label: 'For You' },
    { id: 'action', label: 'Action' },
    { id: 'fantasy', label: 'Fantasy' },
    { id: 'romance', label: 'Romance' },
    { id: 'system', label: 'System' },
    { id: 'isekai', label: 'Isekai' },
    { id: 'adventure', label: 'Adventure' },
    { id: 'drama', label: 'Drama' },
    { id: 'sci-fi', label: 'Sci-Fi' }
  ];

  React.useEffect(() => {
    if (selectedGenre !== 'all') {
      setIsLoading(false);
      return undefined;
    }
    let active = true;
    setIsLoading(true);
    api.getMangaCategoryData(category, 'all')
      .then(result => { if (active) setData(result); })
      .catch(() => { if (active) setData(null); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [category, selectedGenre]);

  return (
    <div className={`container manga-subhub-header manga-subhub-header--v2 manga-subhub-header--${category}`}>
      <div className="manga-breadcrumb">
        <button type="button" className="manga-breadcrumb-link" onClick={onBack}>Comics</button>
        <ChevronRight size={15} />
        <span>{categoryMeta.title}</span>
      </div>

      <header className="manga-subhub-title-row manga-subhub-title-row--v2">
        <p className="manga-subhub-eyebrow">{categoryMeta.eyebrow}</p>
        <h1 className="manga-subhub-heading">{categoryMeta.title}</h1>
        <p className="manga-subhub-subtitle">{categoryMeta.subtitle}</p>
      </header>

      {selectedGenre === 'all' && data?.trending?.[0] && (
        <MangaShelfSpotlight item={data.trending[0]} category={category} onMangaClick={onMangaClick} />
      )}

      <section className="manga-genre-deck" aria-label={`${categoryMeta.title} genres`}>
        <div className="manga-genre-deck-heading">
          <span>Explore by genre</span>
          <span>Choose a lane</span>
        </div>
        <div className="manga-genre-slider manga-genre-slider--v2">
          {genres.map(genre => (
            <button key={genre.id} type="button" className={`manga-genre-pill ${selectedGenre === genre.id ? 'active' : ''}`} onClick={() => setSelectedGenre(genre.id)}>
              {genre.label}
            </button>
          ))}
        </div>
      </section>

      {selectedGenre !== 'all' ? (
        <MangaGenreBrowse category={category} genre={selectedGenre} onMangaClick={onMangaClick} />
      ) : isLoading ? (
        <div className="manga-category-loading"><InlineLoader /></div>
      ) : !data?.trending?.length ? (
        <p className="manga-empty-state">No titles are available in this shelf right now.</p>
      ) : (
        <div className="manga-rows-container manga-category-rows">
          <MangaRow title="Trending Now" icon={<Flame size={18} />} mangas={data.trending || []} onMangaClick={onMangaClick} />
          <MangaRow title="Most Read" icon={<Trophy size={18} />} mangas={data.popular || []} onMangaClick={onMangaClick} />
          <MangaRow title="Fan Favorites" icon={<Sparkles size={18} />} mangas={data.topPick || []} onMangaClick={onMangaClick} />
          <MangaRow title="Fresh Chapters" icon={<BookOpen size={18} />} mangas={data.recent || []} onMangaClick={onMangaClick} />
        </div>
      )}
    </div>
  );
}

function ComicCoverFlow({ data, onCategorySelect }) {
  const fallbackCovers = data?.bentoTop10 || data?.trending || [];
  const categories = [
    {
      id: 'manga',
      title: 'Manga',
      label: 'Japan',
      description: 'Panel stories from Japan, from long-running classics to new favorites.',
      cover: data?.mangaPreview?.[0]?.cover || fallbackCovers[1]?.cover || fallbackCovers[0]?.cover
    },
    {
      id: 'manhwa',
      title: 'Manhwa',
      label: 'Korea',
      description: 'Korean webcomics built for one more chapter.',
      cover: data?.manhwaPreview?.[0]?.cover || fallbackCovers[2]?.cover || fallbackCovers[0]?.cover
    },
    {
      id: 'manhua',
      title: 'Manhua',
      label: 'China / Donghua',
      description: 'Chinese comics, cultivation worlds, and stories on a grand scale.',
      cover: data?.manhuaPreview?.[0]?.cover || fallbackCovers[3]?.cover || fallbackCovers[0]?.cover
    }
  ];

  return (
    <section className="comic-gateway" aria-labelledby="comic-gateway-title">
      <header className="comic-gateway-header">
        <span>Explore EetNet</span>
        <h1 id="comic-gateway-title">Comics</h1>
        <p>Choose a world to enter.</p>
      </header>

      <div className="comic-coverflow" role="list">
        {categories.map((category, index) => (
          <button
            key={category.id}
            type="button"
            className={`comic-coverflow-card comic-coverflow-card--${category.id}`}
            style={{ '--coverflow-index': index }}
            onClick={() => onCategorySelect(category.id)}
            role="listitem"
          >
            {category.cover ? <img src={category.cover} alt="" loading={index === 1 ? 'eager' : 'lazy'} /> : <span className="comic-coverflow-fallback" />}
            <span className="comic-coverflow-scrim" />
            <span className="comic-coverflow-copy">
              <span className="comic-coverflow-label">{category.label}</span>
              <strong>{category.title}</strong>
              <span className="comic-coverflow-description">{category.description}</span>
              <span className="comic-coverflow-enter">Open library <ChevronRight size={16} /></span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function MangaHomeViewV2({ data, searchQuery, searchResults, searchLoading, onMangaClick, onCategorySelect }) {

  if (searchQuery.trim()) {
    return (
      <div className="manga-home" style={{ paddingTop: '4rem' }}>
        <div className="container manga-search-results">
          <div className="hv-section-header" style={{ marginBottom: '1.5rem' }}>
            <h2 className="hv-section-title"><Sparkles size={20} /> Results for &quot;{searchQuery}&quot;</h2>
            <span className="hv-section-line" />
          </div>
          {searchLoading ? <div className="manga-loading"><InlineLoader /></div> : searchResults.length ? (
            <div className="manga-grid">{searchResults.map((manga, index) => <MangaCard key={manga.id || index} manga={manga} onClick={onMangaClick} />)}</div>
          ) : <p className="manga-empty-state">No manga found.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="manga-home manga-home--v2 comic-gateway-page" style={{ paddingTop: '4rem' }}>
      <div className="container">
        <ComicCoverFlow data={data} onCategorySelect={onCategorySelect} />
      </div>
    </div>
  );
}

function MangaDetailView({ manga, isLoading, onBack, onReadChapter }) {
  const [chapterSearch, setChapterSearch] = React.useState('');
  const [sortDesc, setSortDesc] = React.useState(true);

  const filteredChapters = React.useMemo(() => {
    let chs = manga.chapters || [];
    if (chapterSearch.trim()) {
      const q = chapterSearch.toLowerCase();
      chs = chs.filter(c => (c.chapter + '').includes(q) || (c.title || '').toLowerCase().includes(q));
    }
    return sortDesc ? [...chs].reverse() : chs;
  }, [manga.chapters, chapterSearch, sortDesc]);

  return (
    <div className="manga-detail">
      {/* Hero */}
      <div className="manga-detail-hero" style={{ backgroundImage: `url(${manga.banner || manga.cover})` }}>
        <div className="manga-detail-hero-overlay" />
        <div className="container manga-detail-hero-content">
          <button className="drama-back-btn" onClick={onBack}>Â Ã‚Â Back</button>
        </div>
      </div>

      {/* Meta Row */}
      <div className="container manga-detail-meta-row">
        <div className="manga-detail-cover">
          {manga.cover && <img src={manga.cover} alt={manga.title} />}
        </div>
        <div className="manga-detail-info">
          <h1 className="manga-detail-title">{manga.title}</h1>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', margin: '0.6rem 0' }}>
            {manga.status && (
              <span className={`manga-status-badge inline ${manga.status === 'ongoing' ? 'ongoing' : 'completed'}`}>{manga.status}</span>
            )}
            {manga.rating && <span style={{ color: '#f59e0b', fontWeight: 600 }}> {manga.rating}</span>}
            {manga.chapters?.length > 0 && <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{manga.chapters.length} chapters</span>}
          </div>
          {manga.genres?.length > 0 && (
            <div className="manhwa-genres" style={{ marginBottom: '0.75rem' }}>
              {manga.genres.slice(0, 6).map(g => <span key={g} className="manhwa-genre-tag">{g}</span>)}
            </div>
          )}
          {manga.description && <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>{manga.description.slice(0, 400)}{manga.description.length > 400 ? '...' : ''}</p>}
        </div>
      </div>

      {/* Chapter List */}
      <div className="container manga-detail-body">
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><InlineLoader /></div>
        ) : (
          <>
            <div className="manga-chapter-controls">
              <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.1rem' }}>
                <BookOpen size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                Chapters
              </h3>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  className="manga-chapter-search"
                  type="text"
                  placeholder="Search chapters..."
                  value={chapterSearch}
                  onChange={e => setChapterSearch(e.target.value)}
                />
                <button
                  className="manga-sort-btn"
                  onClick={() => setSortDesc(p => !p)}
                  title="Toggle sort order"
                >
                  {sortDesc ? ' â€œ Newest' : ' â€˜ Oldest'}
                </button>
              </div>
            </div>
            {filteredChapters.length > 0 ? (
              <div className="manga-chapter-list">
                {filteredChapters.map((ch) => (
                  <button
                    key={ch.id}
                    className="manga-chapter-item"
                    onClick={() => onReadChapter(ch)}
                  >
                    <span className="manga-chapter-num">Ch. {ch.chapter}</span>
                    <span className="manga-chapter-title">{ch.title && ch.title !== `Chapter ${ch.chapter}` ? ch.title : ''}</span>
                    {ch.pages > 0 && <span className="manga-chapter-pages">{ch.pages}p</span>}
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
                {chapterSearch
                  ? 'No chapters match your search.'
                  : 'No readable chapters available. This manga may be licensed exclusively on Manga Plus or Bilibili - chapters are hosted externally and cannot be read here.'
                }
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

//  Lazy-loading manga page wrapper using IntersectionObserver 
// Prevents Chrome's 6-connection limit from aborting off-screen images.
// Only starts loading when the image enters the viewport (+ 800px margin).
function MangaPage({ page, pageIdx }) {
  const [status, setStatus] = React.useState('idle'); // 'idle' | 'loading' | 'ok'
  const [retryCount, setRetryCount] = React.useState(0);
  const containerRef = React.useRef(null);
  const imgRef = React.useRef(null);

  React.useEffect(() => {
    setStatus('idle');
    setRetryCount(0);
  }, [page.url]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && status === 'idle') {
            setStatus('loading');
            observer.disconnect();
          }
        });
      },
      { rootMargin: '800px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [status, page.url]);

  const handleLoad = () => setStatus('ok');

  const handleError = () => {
    // Silently auto-retry up to 6 times in background with backoff
    if (retryCount < 6) {
      const nextRetry = retryCount + 1;
      setRetryCount(nextRetry);
      setTimeout(() => {
        if (imgRef.current) {
          const sep = page.url.includes('?') ? '&' : '?';
          imgRef.current.src = `${page.url}${sep}retry=${nextRetry}_${Date.now()}`;
        }
      }, 1000 * Math.min(nextRetry, 4));
    }
  };

  return (
    <div
      ref={containerRef}
      className="manga-page-wrap"
      style={{
        minHeight: status === 'ok' ? 'auto' : '500px',
        display: 'flex',
        justify: 'center',
        alignItems: 'center',
        background: status === 'ok' ? 'transparent' : 'rgba(255, 255, 255, 0.02)'
      }}
    >
      {status !== 'idle' && (
        <img
          ref={imgRef}
          src={page.url}
          alt={`Page ${page.page}`}
          className="manga-page-img"
          onLoad={handleLoad}
          onError={handleError}
          style={{ opacity: status === 'ok' ? 1 : 0.0, transition: 'opacity 0.2s' }}
        />
      )}
    </div>
  );
}

function MangaReaderView({ manga, chapter, pages, isLoading, onBack, onChapterSelect }) {
  const [readMode, setReadMode] = React.useState('scroll'); // 'scroll' | 'page'
  const [currentPage, setCurrentPage] = React.useState(0);
  const [showControls, setShowControls] = React.useState(true);

  //  Reset everything when chapter changes 
  React.useEffect(() => {
    setCurrentPage(0);
  }, [chapter?.id]);

  const allChapters = manga.chapters || [];
  const currentChIdx = allChapters.findIndex(c => c.id === chapter.id);

  const goNextChapter = () => {
    if (currentChIdx < allChapters.length - 1) {
      onChapterSelect(allChapters[currentChIdx + 1]);
      setCurrentPage(0);
    }
  };
  const goPrevChapter = () => {
    if (currentChIdx > 0) {
      onChapterSelect(allChapters[currentChIdx - 1]);
      setCurrentPage(0);
    }
  };

  // Page-mode single-image retry state
  const [pageImgKey, setPageImgKey] = React.useState(0);
  const [pageImgError, setPageImgError] = React.useState(false);

  React.useEffect(() => {
    setPageImgKey(0);
    setPageImgError(false);
  }, [chapter?.id, currentPage]);

  const handlePageImgError = () => {
    if (pageImgKey < 3) {
      setTimeout(() => setPageImgKey(k => k + 1), 1500);
    } else {
      setPageImgError(true);
    }
  };

  return (
    <div className="manga-reader" onClick={() => setShowControls(p => !p)}>
      {/* Top Toolbar */}
      <div className={`manga-reader-toolbar top ${showControls ? 'visible' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="manga-reader-back-btn" onClick={onBack}>
          <ArrowLeft size={18} /> {manga.title}
        </button>
        <span className="manga-reader-chapter-label">Ch. {chapter.chapter}</span>
        <div className="manga-reader-controls">
          <button className={`manga-mode-btn ${readMode === 'scroll' ? 'active' : ''}`} onClick={() => setReadMode('scroll')}>Scroll</button>
          <button className={`manga-mode-btn ${readMode === 'page' ? 'active' : ''}`} onClick={() => { setReadMode('page'); setCurrentPage(0); }}>Page</button>
        </div>
      </div>

      {/* Chapter nav */}
      <div className={`manga-reader-toolbar bottom ${showControls ? 'visible' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="manga-chapter-nav-btn" disabled={currentChIdx <= 0} onClick={goPrevChapter}>
          <ChevronLeft size={18} /> Prev Ch
        </button>
        {allChapters.length > 0 && (
          <select
            className="manga-chapter-select"
            value={chapter.id}
            onChange={e => {
              const ch = allChapters.find(c => c.id === e.target.value);
              if (ch) { onChapterSelect(ch); setCurrentPage(0); }
            }}
          >
            {allChapters.map(c => (
              <option key={c.id} value={c.id}>Ch. {c.chapter}</option>
            ))}
          </select>
        )}
        <button className="manga-chapter-nav-btn" disabled={currentChIdx >= allChapters.length - 1} onClick={goNextChapter}>Next Ch <ChevronRight size={18} /></button>
      </div>

      {/* Pages */}
      <div className="manga-reader-content">
        {isLoading ? (
          <div className="manga-reader-loading"><InlineLoader /><p>Loading chapter...</p></div>
        ) : pages.length === 0 ? (
          <div className="manga-reader-loading">
            <BookOpen size={48} style={{ opacity: 0.4 }} />
            <p>Pages could not be loaded.<br />Try a different chapter.</p>
          </div>
        ) : readMode === 'scroll' ? (
          <div className="manga-reader-scroll">
            {pages.map((p, idx) => (
              <MangaPage key={`${chapter.id}-${idx}`} page={p} pageIdx={idx} />
            ))}
          </div>
        ) : (
          <div className="manga-reader-page-mode">
            {pageImgError ? (
              <div className="manga-page-error" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '40px', color: '#999' }}>
                <span>Â  Page {currentPage + 1} failed to load</span>
                <button onClick={e => { e.stopPropagation(); setPageImgKey(0); setPageImgError(false); }}
                  style={{ background: '#00e561', color: '#000', border: 'none', borderRadius: '4px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  Â Ã‚Âº Retry
                </button>
              </div>
            ) : (
              <img
                key={`${chapter.id}-pg-${currentPage}-${pageImgKey}`}
                src={pages[currentPage]?.url}
                alt={`Page ${currentPage + 1}`}
                className="manga-page-img-single"
                onError={handlePageImgError}
              />
            )}
            <div className="manga-page-nav">
              <button
                className="manga-page-btn"
                disabled={currentPage === 0}
                onClick={e => { e.stopPropagation(); setCurrentPage(p => Math.max(0, p - 1)); }}
              >
                <ChevronLeft size={22} />
              </button>
              <span className="manga-page-counter">{currentPage + 1} / {pages.length}</span>
              <button
                className="manga-page-btn"
                disabled={currentPage >= pages.length - 1}
                onClick={e => { e.stopPropagation(); setCurrentPage(p => Math.min(pages.length - 1, p + 1)); }}
              >
                <ChevronRight size={22} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

