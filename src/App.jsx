import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Info, Play, Star, X, ArrowLeft, Flame, Trophy, Sparkles, Compass, History, Tv, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import Navbar, { MobileBottomNav } from './components/Navbar';
import SectionSlider from './components/SectionSlider';
import AnimeCard from './components/AnimeCard';
import VideoPlayer from './components/VideoPlayer';
import AuthModal from './components/AuthModal';
import { api, animeCategories, recentReleases, hasHindiDubAvailable, isKnownHindiDubTitle } from './mockData';
import { apiUrl, getBackendConfigError } from './runtimeConfig';
import { supabase } from './supabaseClient';

function App() {
  const [view, setRawView] = useState('home');
  // Wrapper to allow setView call compatibility
  const setView = (v) => setRawView(v);

  // activeSection tracks which major section the user is browsing
  const [activeSection, setActiveSection] = useState('anime');
  const [featured, setFeatured] = useState([]);
  const [trending, setTrending] = useState([]);
  const [top10Famous, setTop10Famous] = useState([]);
  const [searchResults, setSearchResults] = useState({ anime: [], dramas: [] });
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
  const [myList, setMyList] = useState([]);

  // â”€â”€ Drama state â”€â”€
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

  // â”€â”€ Manhwa state â”€â”€
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

  // ── Movies state ──
  const [moviesHomeData, setMoviesHomeData] = useState(null);
  const [moviesHomeLoading, setMoviesHomeLoading] = useState(false);
  const [moviesHomeError, setMoviesHomeError] = useState('');
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [selectedMovieLoading, setSelectedMovieLoading] = useState(false);
  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [movieSearchResults, setMovieSearchResults] = useState([]);
  const [movieSearchLoading, setMovieSearchLoading] = useState(false);
  const [movieActiveCategory, setMovieActiveCategory] = useState('All');

  // ── Scroll Intro Overlay state ──
  const [showIntroOverlay, setShowIntroOverlay] = useState(() => {
    try {
      return !sessionStorage.getItem('anistream_intro_seen');
    } catch (e) {
      return true;
    }
  });

  // ── Auth & Sync states ──
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [watchHistory, setWatchHistory] = useState([]);

  // ── Welcome & Toast Notification states ──
  const [showWelcome, setShowWelcome] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const toastTimeoutRef = useRef(null);

  const isPopStateRef = useRef(false);

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
        manhwaChapterImages: [],
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
        if (state.activeSection) setActiveSection(state.activeSection);
        
        // Clear search queries when navigating back to generic pages
        setSearchQuery('');
        setSearchResults({ anime: [], dramas: [] });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Hook to push views to browser history stack
  useEffect(() => {
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
  }, [view, selectedAnime?.id, currentEpisode?.number, selectedDrama?.id, dramaEpisode?.id, selectedManhwa?.slug, currentManhwaChapter?.slug, selectedMovie?.id]);

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

  // ── Watch History & Watchlist Sync Engine ──

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
      const id = path.replace('/anime/', '');
      if (id) {
        handleAnimeClick(id);
      }
    } else if (path.startsWith('/drama/')) {
      const id = decodeURIComponent(path.replace('/drama/', ''));
      if (id) {
        handleDramaClick({ id, title: id });
      }
    } else if (path.startsWith('/manhwa/')) {
      const slug = decodeURIComponent(path.replace('/manhwa/', ''));
      if (slug) {
        handleManhwaClick({ slug, title: slug });
      }
    }

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
      if (mounted) setTrending(items);
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
    } else if (view === 'hindi' && (!hindiData.list || hindiData.list.length === 0)) {
      setPageLoading(true);
      api.getHindiAnimeList().then((list) => {
        if (mounted) {
          setHindiData({
            featured: list[0] || null,
            list
          });
          setPageLoading(false);
        }
      }).catch((err) => {
        console.warn('Failed to load Hindi anime catalog:', err);
        if (mounted) setPageLoading(false);
      });
    }
    return () => {
      mounted = false;
    };
  }, [view, tvShowsData.featured, moviesData.featured, newPopularData.featured, hindiData.list]);

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
    fetch('/api/movies/home')
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

  const toggleWatchlist = async (animeItem) => {
    // Require login to use watchlist
    if (!user) {
      setShowAuthModal(true);
      showToast('Sign in to save titles to your watchlist! 🎬', 'info');
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
    setSearchResults({ anime: [], dramas: [] });
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

  // Called by SectionSlider when user picks Anime / Drama / Comic / Movies
  const handleSectionChange = (sectionId) => {
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
        // KissKH returns { value: [...], Count: N } – extract the array
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
    try {
      const r = await fetch(`/api/movies/info/${movie.id}`);
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
    fetch(`/api/movies/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => {
        setMovieSearchResults(Array.isArray(data) ? data : []);
        setMovieSearchLoading(false);
      })
      .catch(() => { setMovieSearchResults([]); setMovieSearchLoading(false); });
  };

  const handleSearch = (query) => {
    if (activeSection === 'drama') {
      setSearchQuery('');
      setView('dramas');
      handleDramaSearch(query);
      return;
    }
    if (activeSection === 'movies') {
      setSearchQuery('');
      setView('movies');
      handleMovieSearch(query);
      return;
    }
    if (activeSection === 'comic') {
      setSearchQuery('');
      setView('manhwa');
      handleManhwaSearch(query);
      return;
    }

    setSearchQuery(query);

    if (query.trim() === '') {
      setSearchResults({ anime: [], dramas: [] });
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
          // KissKH returns { value: [...], Count: N } – extract the array
          return Array.isArray(data) ? data : (Array.isArray(data?.value) ? data.value : []);
        })
        .catch(() => []);

      Promise.all([animePromise, dramaPromise]).then(([animeItems, dramaItems]) => {
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
            dramas: cleanDramas
          });
          setSearchLoading(false);
        }
      }).catch(() => {
        if (requestId === searchRequestRef.current) {
          setSearchResults({ anime: [], dramas: [] });
          setSearchLoading(false);
        }
      });
    }, 400);
  };

  const handleAnimeClick = (id, keepFranchise = false) => {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    watchRequestRef.current += 1;
    resetSearch();
    setLoadingSources(false);
    setPageLoading(true);

    api.getAnimeDetails(id).then((details) => {
      if (requestId !== detailRequestRef.current || !details) return;
      setSelectedAnime(details);
      setCurrentEpisode(null);
      setView('detail');
      window.scrollTo(0, 0);

      if (!keepFranchise) {
        setFranchiseList([]); // Reset
        api.getFranchise(details.id, details.title, details.relations)
          .then((list) => {
            if (requestId === detailRequestRef.current) {
              if (list.length === 0) {
                setFranchiseList([{
                  id: details.id.toString(),
                  title: details.title,
                  format: details.type,
                  coverImage: details.coverImage,
                  bannerImage: details.bannerImage,
                  rating: details.rating
                }]);
              } else {
                setFranchiseList(list);
              }
            }
          });
      }
    }).catch((err) => {
      console.error('Error loading anime details:', err);
    }).finally(() => {
      if (requestId === detailRequestRef.current) {
        setPageLoading(false);
      }
    });
  };

  const startWatching = async (anime, episodeNum = 1, keepFranchise = false, targetAudioMode = audioMode) => {
    const requestId = watchRequestRef.current + 1;
    watchRequestRef.current = requestId;
    detailRequestRef.current += 1;
    resetSearch();
    setPageLoading(false);

    const episode = anime.episodes?.find((ep) => ep.number === episodeNum) || {
      number: episodeNum,
      title: `Episode ${episodeNum}`,
      sources: []
    };

    setView('watch');
    setSelectedAnime(anime);
    setCurrentEpisode(episode);
    setCurrentSourceIndex(0);
    setLoadingSources(true);
    window.scrollTo(0, 0);

    if (!keepFranchise) {
      setFranchiseList([]); // Reset
      api.getFranchise(anime.id, anime.title, anime.relations)
        .then((list) => {
          if (list.length === 0) {
            setFranchiseList([{
              id: anime.id.toString(),
              title: anime.title,
              format: anime.type || anime.format,
              coverImage: anime.coverImage,
              bannerImage: anime.bannerImage,
              rating: anime.rating
            }]);
          } else {
            setFranchiseList(list);
          }
        });
    }

    try {
      // Pass anime.id (AniList ID) directly for HiAnime primary lookup.
      // Also compute seasonNum for AnimeKai title-search fallback.
      const franchiseIndex = franchiseList.findIndex(item => item.id === anime.id.toString() || item.id === anime.id);
      const seasonNum = franchiseIndex !== -1 ? (franchiseIndex + 1) : 1;

      const result = await api.getEpisodeSources(
        episode.id,
        anime.title,
        anime.japaneseTitle,
        episodeNum,
        anime.id,          // 5th arg: AniList ID for HiAnime
        seasonNum,         // 6th arg: Season number for AnimeKai fallback
        targetAudioMode    // 7th arg: 'sub' | 'dub' | 'hindi'
      );

      if (requestId !== watchRequestRef.current) return;

      if (targetAudioMode === 'hindi' && (result.provider === 'unavailable' || (!result.sources?.length && !result.iframeSrc))) {
        showToast(result.error || 'Hindi Dub stream is not connected yet. Staying on Japanese audio.', 'info');
        setAudioMode('sub');
        setCurrentEpisode({
          ...episode,
          sources: [],
          subtitles: [],
          iframeSrc: null,
          provider: 'unavailable',
          error: result.error || 'Hindi Dub stream is not connected yet.'
        });
        return;
      }

      if (targetAudioMode === 'dub' && (result.provider === 'unavailable' || (!result.sources?.length && !result.iframeSrc))) {
        const label = 'English Dub';
        showToast(`ℹ️ ${label} stream node is currently offline/updating. Reverting to Japanese audio.`, 'info');
        setAudioMode('sub');
        startWatching(anime, episodeNum, true, 'sub');
        return;
      }

      setCurrentEpisode({
        ...episode,
        sources: result.sources || [],
        subtitles: result.subtitles || [],
        iframeSrc: result.iframeSrc || null,
        iframeSandbox: result.iframeSandbox || null,
        language: result.language || null,
        audioMode: result.audioMode || targetAudioMode,
        provider: result.provider,
        error: result.error || null
      });
    } catch (err) {
      console.error('Error fetching stream sources:', err);
      if (requestId !== watchRequestRef.current) return;

      setCurrentEpisode({
        ...episode,
        sources: [],
        subtitles: [],
        iframeSrc: null,
        provider: 'error',
        error: 'Could not load this episode. Please try another episode or server.'
      });
    } finally {
      if (requestId === watchRequestRef.current) {
        setLoadingSources(false);
      }
    }
  };

  const filteredTrending = activeCategory === 'All'
    ? trending
    : activeCategory === 'Hindi'
    ? trending.filter((anime) => anime.hasHindiDub || hasHindiDubAvailable(anime.title, anime.japaneseTitle))
    : trending.filter((anime) => anime.genres?.includes(activeCategory));

  const activeFeatured = featured[carouselIndex];
  const playerSource = React.useMemo(() => {
    const selectedSource = currentEpisode?.sources?.[currentSourceIndex] || currentEpisode?.sources?.[0];
    return selectedSource
      ? { ...currentEpisode, ...selectedSource }
      : currentEpisode;
  }, [currentEpisode, currentSourceIndex]);

  // Watch/read views should hide the bottom nav to avoid interference
  const isImmersiveView = ['watch', 'drama-watch', 'movie-watch', 'manhwa-read'].includes(view);

  return (
    <div className="app-container">
      {/* ── Interactive Scroll Intro Overlay ── */}
      {showIntroOverlay && (
        <ScrollIntroOverlay
          onClose={() => {
            setShowIntroOverlay(false);
            try { sessionStorage.setItem('anistream_intro_seen', 'true'); } catch (e) {}
          }}
          onNavigateSection={(sec) => {
            handleSectionChange(sec);
            setShowIntroOverlay(false);
            try { sessionStorage.setItem('anistream_intro_seen', 'true'); } catch (e) {}
          }}
        />
      )}

      {/* SectionSlider hidden on mobile — replaced by bottom nav */}
      <div className="desktop-only-section-slider">
        <SectionSlider activeSection={activeSection} onSectionChange={handleSectionChange} />
      </div>
      <Navbar
        onSearch={handleSearch}
        activeView={view}
        setView={setView}
        onHome={goHome}
        activeSection={activeSection}
        user={user}
        onSignIn={() => setShowAuthModal(true)}
        onSignOut={async () => { await supabase.auth.signOut(); }}
      />
      {/* ── Mobile Bottom Navigation ── */}
      {!isImmersiveView && (
        <MobileBottomNav
          activeSection={activeSection}
          activeView={view}
          setView={setView}
          setSection={handleSectionChange}
          user={user}
          onSignIn={() => setShowAuthModal(true)}
        />
      )}
      {/* ── Global Floating Back Button (Detail Pages Only) ── */}
      {['detail', 'drama-detail', 'movie-detail', 'manhwa-detail'].includes(view) && (
        <button 
          className="global-back-btn" 
          onClick={() => window.history.back()}
          title="Go Back"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
      )}

      {pageLoading && view !== 'tv-shows' && view !== 'movies' && view !== 'new-popular' && (
        <GlobalLoader label="Loading anime details..." />
      )}

      <main className="main-content">
        {searchQuery.trim() !== '' ? (
          <SearchResults
            query={searchQuery}
            animeResults={searchResults.anime}
            dramaResults={searchResults.dramas}
            loading={searchLoading}
            onAnimeClick={handleAnimeClick}
            onDramaClick={handleDramaClick}
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
              />
            )}

            {view === 'tv-shows' && (
              <CategoryGridView
                title="TV Shows"
                viewName="tv-shows"
                featuredItem={tvShowsData.featured}
                genresData={tvShowsData.genres}
                onAnimeClick={handleAnimeClick}
                onStartWatching={startWatching}
                isLoading={pageLoading}
              />
            )}


            {view === 'new-popular' && (
              <CategoryGridView
                title="New &amp; Popular"
                viewName="new-popular"
                featuredItem={newPopularData.featured}
                genresData={newPopularData.rows}
                onAnimeClick={handleAnimeClick}
                onStartWatching={startWatching}
                isLoading={pageLoading}
              />
            )}

            {view === 'hindi' && (
              <HindiView
                hindiAnime={hindiData.list.length > 0 ? hindiData.list : trending.filter(a => a.hasHindiDub || hasHindiDubAvailable(a.title, a.japaneseTitle))}
                onAnimeClick={handleAnimeClick}
                onStartWatching={startWatching}
                isLoading={pageLoading}
              />
            )}

            {view === 'my-list' && (
              <WatchlistView
                items={myList}
                onAnimeClick={handleAnimeClick}
                onBackHome={goHome}
              />
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
              />
            )}

            {view === 'watch' && selectedAnime && currentEpisode && (
              <WatchView
                anime={selectedAnime}
                episode={currentEpisode}
                source={playerSource}
                franchiseList={franchiseList}
                currentSourceIndex={currentSourceIndex}
                loadingSources={loadingSources}
                setCurrentSourceIndex={setCurrentSourceIndex}
                onStartWatching={(animeNode, epNum, keepFranchise = true, targetAudio = audioMode) => startWatching(animeNode, epNum, keepFranchise, targetAudio)}
                onAnimeSelect={(id) => {
                  setPageLoading(true);
                  api.getAnimeDetails(id).then((newDetails) => {
                    if (newDetails) {
                      startWatching(newDetails, 1, true);
                    }
                  }).finally(() => setPageLoading(false));
                }}
                onProgress={(prog) => handleWatchProgress(selectedAnime, currentEpisode, 'anime', prog)}
                audioMode={audioMode}
                setAudioMode={setAudioMode}
                showToast={showToast}
              />
            )}

            {/* â”€â”€ Drama Views â”€â”€ */}
            {view === 'dramas' && (
              <DramaHomeView
                data={dramaHomeData}
                error={dramaHomeError}
                isLoading={dramaHomeLoading}
                searchQuery={dramaSearchQuery}
                searchResults={dramaSearchResults}
                searchLoading={dramaSearchLoading}
                onSearch={handleDramaSearch}
                onDramaClick={handleDramaClick}
              />
            )}

            {view === 'drama-detail' && selectedDrama && (
              <DramaDetailView
                drama={selectedDrama}
                onBack={goDramas}
                onWatchEpisode={startWatchingDrama}
              />
            )}

            {view === 'drama-watch' && selectedDrama && dramaEpisode && (
              <DramaWatchView
                drama={selectedDrama}
                episode={dramaEpisode}
                stream={dramaStream}
                loading={dramaStreamLoading}
                onBack={() => { setView('drama-detail'); window.scrollTo(0,0); }}
                onEpisodeSelect={(ep) => startWatchingDrama(selectedDrama, ep)}
                onProgress={(prog) => handleWatchProgress(selectedDrama, dramaEpisode, 'drama', prog)}
              />
            )}

            {/* â”€â”€ Manhwa Views â”€â”€ */}
            {view === 'manhwa' && (
              <ManhwaHomeView
                data={manhwaHomeData}
                error={manhwaHomeError}
                isLoading={manhwaHomeLoading}
                searchQuery={manhwaSearchQuery}
                searchResults={manhwaSearchResults}
                searchLoading={manhwaSearchLoading}
                onSearch={handleManhwaSearch}
                onSeriesClick={handleManhwaClick}
              />
            )}

            {view === 'manhwa-detail' && selectedManhwa && (
              <ManhwaDetailView
                series={selectedManhwa}
                isLoading={manhwaDetailLoading}
                onBack={goManhwa}
                onReadChapter={handleManhwaRead}
              />
            )}

            {view === 'manhwa-read' && selectedManhwa && currentManhwaChapter && (
              <ManhwaReadView
                series={selectedManhwa}
                chapter={currentManhwaChapter}
                images={manhwaChapterImages}
                isLoading={manhwaChapterLoading}
                onBack={() => { setView('manhwa-detail'); window.scrollTo(0, 0); }}
                onChapterSelect={(ch) => handleManhwaRead(selectedManhwa, ch)}
              />
            )}

            {/* ── Movie Views ── */}
            {view === 'movies' && activeSection === 'movies' && (
              <MovieHomeView
                data={moviesHomeData}
                error={moviesHomeError}
                isLoading={moviesHomeLoading}
                activeCategory={movieActiveCategory}
                setActiveCategory={setMovieActiveCategory}
                searchQuery={movieSearchQuery}
                searchResults={movieSearchResults}
                searchLoading={movieSearchLoading}
                onSearch={handleMovieSearch}
                onMovieClick={handleMovieClick}
              />
            )}

            {view === 'movie-detail' && selectedMovie && (
              <MovieDetailView
                movie={selectedMovie}
                isLoading={selectedMovieLoading}
                onBack={goMovies}
                onWatch={() => { setView('movie-watch'); window.scrollTo(0, 0); }}
              />
            )}

            {view === 'movie-watch' && selectedMovie && (
              <MovieWatchView
                movie={selectedMovie}
                onBack={() => { setView('movie-detail'); window.scrollTo(0, 0); }}
                onProgress={(prog) => handleWatchProgress(selectedMovie, { id: 'full', number: 1 }, 'movie', prog)}
              />
            )}
          </>
        )}
      </main>

      {/* ── Auth Modal ── */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}

      {/* ── Welcome Banner ── */}
      <div className={`welcome-banner ${showWelcome ? 'visible' : ''}`}>
        <div className="welcome-banner-content">
          <span>👋 First time here? Sign in to save your watchlist and sync your watch history!</span>
          <button className="welcome-banner-btn" onClick={() => { setShowWelcome(false); setShowAuthModal(true); }}>Sign In</button>
        </div>
        <button className="welcome-banner-close" onClick={() => setShowWelcome(false)} aria-label="Close welcome message">
          <X size={18} />
        </button>
      </div>

      {/* ── Toast Notifications ── */}
      <div className={`toast-notification toast-notification--${toast.type} ${toast.visible ? 'visible' : ''}`}>
        <div className="toast-notification-content">{toast.message}</div>
      </div>
    </div>
  );
}

function SearchResults({ query, animeResults = [], dramaResults = [], loading, onAnimeClick, onDramaClick }) {
  const hasResults = animeResults.length > 0 || dramaResults.length > 0;

  return (
    <div className="container" style={{ marginTop: '2rem', paddingBottom: '4rem' }}>
      <div className="section-header" style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Search Results for "{query}"</h2>
      </div>

      {loading ? (
        <InlineLoader label="Searching anime and dramas..." />
      ) : hasResults ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          {/* Anime Results */}
          {animeResults.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '1.2rem', color: 'var(--text-primary)', borderLeft: '4px solid var(--accent-primary)', paddingLeft: '0.8rem' }}>Anime</h3>
              <div className="drama-grid">
                {animeResults.map((anime) => (
                  <AnimeCard
                    key={anime.id}
                    anime={anime}
                    onClick={() => onAnimeClick(anime.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Drama Results */}
          {dramaResults.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '1.2rem', color: 'var(--text-primary)', borderLeft: '4px solid var(--accent-primary)', paddingLeft: '0.8rem' }}>Dramas</h3>
              <div className="drama-grid">
                {dramaResults.map((drama) => (
                  <DramaCard
                    key={drama.id}
                    drama={drama}
                    onClick={() => onDramaClick(drama)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
          <AlertCircle size={48} style={{ marginBottom: '1rem', color: 'var(--text-muted)' }} />
          <h3>No results found matching your query</h3>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Try checking your spelling or trying different keywords.
          </p>
        </div>
      )}
    </div>
  );
}

function GlobalLoader({ label }) {
  return (
    <div className="global-loader-overlay" role="status" aria-live="polite">
      <div className="blob-loader-wrap">
        <div className="blob-loader" />
        <p className="blob-loader-text">
          Loading<span className="blob-dots"><span>.</span><span>.</span><span>.</span></span>
        </p>
      </div>
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

/* â”€â”€â”€ Skeleton Components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
          <span className="top10-card-rating">★ {anime.rating}</span>
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
    badge: "✦ Trending Anime",
    description: "After the party of heroes defeated the Demon King, elf mage Frieren sets out on a journey to understand humanity.",
    bannerImage: "/home-carousel/81wyRXGKnpL.jpg",
    coverImage: "/home-carousel/81wyRXGKnpL.jpg",
    type: "ANIME",
    rating: "9.3",
    hasHindiDub: true,
    actionType: "anime"
  },
  {
    id: 501,
    title: "Doraemon",
    badge: "✦ Classic Legend",
    description: "A robotic cat travels back in time from the 22nd century to aid a young boy named Nobita Nobi.",
    bannerImage: "/home-carousel/Doraemonn.28_5.webp",
    coverImage: "/home-carousel/Doraemonn.28_5.webp",
    type: "ANIME",
    rating: "8.7",
    hasHindiDub: true,
    actionType: "anime"
  },
  {
    id: 199,
    title: "Spirited Away",
    badge: "✦ Masterpiece Movie",
    description: "During her family's move to the suburbs, a 10-year-old girl wanders into a world ruled by gods, witches, and spirits.",
    bannerImage: "/home-carousel/images.jpg",
    coverImage: "/home-carousel/images.jpg",
    type: "MOVIE",
    rating: "8.8",
    hasHindiDub: true,
    actionType: "anime"
  },
  {
    id: 31649,
    title: "Liar Game",
    badge: "✦ Psychological Thriller",
    description: "Nao Kanzaki receives 100 million yen and an invitation to join the Liar Game Tournament—a high-stakes game of deception.",
    bannerImage: "/home-carousel/MV5BNjcyMWRkZDUtMDgyZi00MDU4LWJjYjUtZGVjZGYyZWY2YjU2XkEyXkFqcGc@._V1_.jpg",
    coverImage: "/home-carousel/MV5BNjcyMWRkZDUtMDgyZi00MDU4LWJjYjUtZGVjZGYyZWY2YjU2XkEyXkFqcGc@._V1_.jpg",
    type: "MANGA",
    rating: "8.9",
    actionType: "manhwa",
    slug: "liar-game"
  },
  {
    id: 147149,
    title: "Smoking Behind the Supermarket with You",
    badge: "✦ Slice of Life",
    description: "Overworked salaryman Sasaki finds comfort in smoking breaks behind his local supermarket with the eccentric Yamada.",
    bannerImage: "/home-carousel/Super_no_Ura_de_Yani_Suu_Hanashi_Behind_the_Supermarket,_Smoking_With_You.png",
    coverImage: "/home-carousel/Super_no_Ura_de_Yani_Suu_Hanashi_Behind_the_Supermarket,_Smoking_With_You.png",
    type: "MANGA",
    rating: "8.9",
    actionType: "manhwa",
    slug: "super-no-ura-de-yani-suu-futari"
  }
];

function HomeView({
  onAnimeClick,
  onStartWatching,
  onManhwaClick
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % HOME_FEATURED_ITEMS.length);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const active = HOME_FEATURED_ITEMS[index];

  const handlePlayClick = () => {
    if (active.actionType === 'manhwa' && onManhwaClick) {
      onManhwaClick(active);
    } else {
      onStartWatching(active, 1);
    }
  };

  const handleInfoClick = () => {
    if (active.actionType === 'manhwa' && onManhwaClick) {
      onManhwaClick(active);
    } else {
      onAnimeClick(active.id);
    }
  };

  return (
    <div className="clean-home-landing">
      {active && (
        <div
          key={active.id}
          className="clean-home-hero"
          style={{
            backgroundImage: `url(${active.bannerImage})`,
          }}
        >
          <div className="clean-hero-overlay" />

          {/* Bottom-left title + description + buttons */}
          <div className="clean-home-hero-content">
            {active.badge && (
              <div className="clean-home-hero-badge">
                {active.badge}
              </div>
            )}
            <h1 className="clean-home-hero-title">{active.title}</h1>
            {active.description && (
              <p className="clean-home-hero-desc">{active.description}</p>
            )}

            <div className="clean-home-hero-btns">
              <button
                className="clean-hero-btn-play"
                onClick={handlePlayClick}
              >
                <Play size={17} fill="currentColor" style={{ marginRight: '0.55rem' }} />
                {active.actionType === 'manhwa' ? 'Read Now' : 'Play'}
              </button>
              <button
                className="clean-hero-btn-info"
                onClick={handleInfoClick}
              >
                <Info size={17} style={{ marginRight: '0.55rem' }} />
                Info
              </button>
            </div>
          </div>

          {/* Carousel progress dots (bottom-right) */}
          <div className="clean-home-dots">
            {HOME_FEATURED_ITEMS.map((item, i) => (
              <span
                key={item.id}
                className={`hero-dot ${index === i ? 'active' : ''}`}
                onClick={() => setIndex(i)}
                title={item.title}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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
  onManhwaClick
}) {
  const continueWatching = watchHistory.slice(0, 10).map(h => ({
    id: h.media_id || h.id,
    title: h.title,
    coverImage: h.cover || h.coverImage,
    bannerImage: h.cover || h.coverImage,
    rating: 'N/A',
    type: h.type,
    subtitle: h.type === 'manhwa'
      ? `Ch. ${h.chapter_number}`
      : `Ep. ${h.episode_number}`,
    progressPercent: (h.duration_seconds > 0)
      ? Math.min(100, Math.round((h.progress_seconds / h.duration_seconds) * 100))
      : 0,
    _historyRef: h
  }));

  const handleContinueWatchingClick = (item) => {
    const h = item._historyRef;
    if (!h) return;
    if (h.type === 'drama' && onDramaClick) {
      onDramaClick(h.media_id || h.id);
    } else if (h.type === 'manhwa' && onManhwaClick) {
      onManhwaClick(h);
    } else {
      onAnimeClick(h.media_id || h.id);
    }
  };

  const realAnimeFeaturedList = featured.filter(a => a.id !== 'backrooms-movie' && (a.bannerImage || a.coverImage));
  const activeAnimeHero = realAnimeFeaturedList.find(a => a.id === activeFeatured?.id) || realAnimeFeaturedList[0] || filteredTrending[0];

  const popularNow = filteredTrending.slice(0, 10);
  const hindiAnimeRow = filteredTrending.filter(a => a.hasHindiDub || hasHindiDubAvailable(a.title, a.japaneseTitle));
  const spotlightItem = filteredTrending.find(a => a.id !== activeAnimeHero?.id) || filteredTrending[0];
  const bentoItems = filteredTrending.filter(a => a.id !== activeAnimeHero?.id && a.id !== spotlightItem?.id).slice(0, 4);
  const classics = filteredTrending.filter(a => a.id !== activeAnimeHero?.id && a.id !== spotlightItem?.id && !bentoItems.some(b => b.id === a.id)).slice(0, 5);

  return (
    <div className="netflix-home">
      {/* ── Featured Anime Hero ── */}
      {activeAnimeHero && (
        <div
          className="hero netflix-hero"
          style={{
            height: '80vh',
            minHeight: '520px',
            backgroundImage: `url(${activeAnimeHero.bannerImage || activeAnimeHero.coverImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="clean-hero-overlay" />
          <div className="container hero-shell" style={{ position: 'relative', zIndex: 2, paddingBottom: '3.5rem' }}>
            <div className="hero-content" style={{ maxWidth: '620px' }}>
              <div className="bento-badge" style={{ marginBottom: '0.8rem', width: 'fit-content' }}>✦ Featured Anime</div>
              <h1 className="hero-title" style={{ fontSize: '3.6rem', fontWeight: '800', letterSpacing: '-0.02em', margin: '0 0 1.25rem 0', textShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
                {activeAnimeHero.title}
              </h1>

              <div className="btn-group" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button
                  className="clean-hero-btn-play"
                  onClick={() => onStartWatching(activeAnimeHero, 1)}
                  style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                >
                  <Play size={18} fill="currentColor" style={{ marginRight: '0.6rem' }} /> Watch Ep 1
                </button>

                <button
                  className="clean-hero-btn-info"
                  onClick={() => onAnimeClick(activeAnimeHero.id)}
                  style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                >
                  <Info size={18} style={{ marginRight: '0.6rem' }} /> Details
                </button>
              </div>
            </div>
          </div>

          {realAnimeFeaturedList.length > 1 && (
            <div className="hero-carousel-dots" style={{ position: 'absolute', bottom: '2rem', right: '3rem', zIndex: 3, display: 'flex', gap: '0.5rem' }}>
              {realAnimeFeaturedList.slice(0, 6).map((item, i) => (
                <span key={i} className={`hero-dot ${activeAnimeHero?.id === item.id ? 'active' : ''}`} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Anime Rows ── */}
      <div className="netflix-rows">
        {/* Continue Watching */}
        {continueWatching.length > 0 && (
          <NetflixRow
            title="Continue Watching"
            icon={<History className="hv-icon" size={20} style={{ color: 'var(--accent-primary)' }} />}
            items={continueWatching}
            onAnimeClick={handleContinueWatchingClick}
            progress
          />
        )}

        {/* Hindi Dubbed Anime Row */}
        {hindiAnimeRow.length > 0 && (
          <NetflixRow
            title="Hindi Dubbed Anime"
            icon={<Globe className="hv-icon" size={20} style={{ color: '#ff4757' }} />}
            items={hindiAnimeRow}
            onAnimeClick={(a) => onAnimeClick(a.id ?? a)}
          />
        )}

        {/* Popular Anime */}
        <NetflixRow
          title="Popular Anime on EetNet"
          icon={<Flame className="hv-icon" size={20} style={{ color: '#f97316' }} />}
          items={popularNow}
          onAnimeClick={(a) => onAnimeClick(a.id ?? a)}
        />

        {/* Genre Filter Pills */}
        <div className="category-row netflix-category-row">
          <div className="hv-section-header">
            <h2 className="hv-section-title">
              <Compass className="hv-icon" size={20} style={{ color: '#a855f7' }} /> Browse Anime by Genre
            </h2>
            <span className="hv-section-line" />
          </div>
          <div className="categories-container">
            <button
              className={`category-pill ${activeCategory === 'All' ? 'active' : ''}`}
              onClick={() => setActiveCategory('All')}
            >All</button>
            {animeCategories.map((cat) => (
              <button
                key={cat}
                className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >{cat}</button>
            ))}
          </div>
        </div>

        {/* Top 10 Famous Anime */}
        <Top10Row
          title="Top 10 Famous Anime"
          items={top10Famous && top10Famous.length > 0 ? top10Famous : filteredTrending}
          onAnimeClick={onAnimeClick}
        />

        {/* Bento Grid Spotlight */}
        {spotlightItem && (
          <div className="bento-section">
            <div className="hv-section-header">
              <h2 className="hv-section-title">
                <Sparkles className="hv-icon" size={20} style={{ color: '#eab308' }} /> Anime Spotlight &amp; Recommendations
              </h2>
              <span className="hv-section-line" />
            </div>
            <div className="bento-grid">
              {/* Large Spotlight card */}
              <div className="bento-card bento-card--large" onClick={() => onAnimeClick(spotlightItem.id)}>
                <div className="bento-card__bg" style={{ backgroundImage: `url(${spotlightItem.bannerImage || spotlightItem.coverImage})` }} />
                <div className="bento-card__overlay" />
                {(spotlightItem.hasHindiDub || hasHindiDubAvailable(spotlightItem.title, spotlightItem.japaneseTitle)) && (
                  <div className="bento-hindi-badge">Hindi</div>
                )}
                <div className="bento-card__content">
                  <div className="bento-badge">✦ Spotlight Pick</div>
                  <h3 className="bento-title">{spotlightItem.title}</h3>
                  <div className="bento-meta">
                    <span className="bento-rating">★ {spotlightItem.rating}</span>
                    <span className="bento-type">{spotlightItem.type}</span>
                  </div>
                  {spotlightItem.genres && (
                    <div className="bento-genres">
                      {spotlightItem.genres.slice(0, 3).map(g => (
                        <span key={g} className="bento-genre-tag">{g}</span>
                      ))}
                    </div>
                  )}
                  <button className="bento-play-btn">
                    <Play size={14} fill="currentColor" /> Watch Now
                  </button>
                </div>
              </div>

              {/* Medium mosaic cards */}
              <div className="bento-medium-wrapper">
                {bentoItems.map((item) => {
                  const isHindi = item.hasHindiDub || hasHindiDubAvailable(item.title, item.japaneseTitle);
                  return (
                    <div key={item.id} className="bento-card bento-card--medium" onClick={() => onAnimeClick(item.id)}>
                      <img src={item.coverImage} alt={item.title} className="bento-card__img" loading="lazy" />
                      {isHindi && <div className="bento-hindi-badge">Hindi</div>}
                      <div className="bento-card__info">
                        <h4 className="bento-card__title">{item.title}</h4>
                        <div className="bento-card__meta">
                          <span className="bento-card__rating">★ {item.rating}</span>
                          <span className="bento-card__type">{item.type}</span>
                        </div>
                      </div>
                      <div className="bento-card__hover-overlay">
                        <Play size={28} fill="white" style={{ color: 'white' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sidebar list */}
              {classics.length > 0 && (
                <div className="bento-card bento-card--list">
                  <h4 className="bento-list__header">
                    <span>Top Anime For You</span>
                    <span className="bento-list__header-line" />
                  </h4>
                  <div className="bento-list__items">
                    {classics.map((item, idx) => (
                      <div key={item.id} className="bento-list__item" onClick={() => onAnimeClick(item.id)}>
                        <span className="bento-list__index">{idx + 1}</span>
                        <img src={item.coverImage} alt={item.title} className="bento-list__thumb" loading="lazy" />
                        <div className="bento-list__details">
                          <span className="bento-list__title">{item.title}</span>
                          <span className="bento-list__meta">★ {item.rating} · {item.type}</span>
                        </div>
                        <span className="bento-list__arrow">›</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
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
  const isHindi = anime.hasHindiDub || hasHindiDubAvailable(anime.title, anime.japaneseTitle);

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
          <span className="tile-rating-badge">★ {anime.rating}</span>
        )}
      </span>
      <span className="tile-info">
        <strong>{anime.title}</strong>
        <small>{anime.subtitle || `${anime.type} · ${anime.rating}`}</small>
      </span>
    </button>
  );
}




function DetailView({ anime, franchiseList = [], myList = [], onToggleWatchlist, onAnimeSelect, onBackHome, onStartWatching }) {
  const EPISODES_PER_PART = 100;
  const totalPages = anime.episodePagination?.lastPage || 1;
  const totalEpisodes = anime.totalEpisodes || anime.episodes?.length || 0;

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
                className={`btn ${myList.some(item => item.id === anime.id) ? 'btn-watchlist-active' : 'btn-secondary'}`}
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
                <div className="season-selector-wrap">
                  <select
                    className="season-selector"
                    value={anime.id}
                    onChange={(e) => onAnimeSelect(e.target.value)}
                    aria-label="Select season or movie"
                  >
                    {franchiseList.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.title} ({item.format})
                      </option>
                    ))}
                  </select>
                  <span className="season-selector-arrow">&#9660;</span>
                </div>
              )}

              {/* Part selector (for long running shows) */}
              {isLongRunning && (
                <div className="season-selector-wrap">
                  <select
                    className="season-selector"
                    value={selectedPart}
                    onChange={(e) => setSelectedPart(Number(e.target.value))}
                    aria-label="Select part"
                  >
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <option key={p} value={p}>{getPartLabel(p)}</option>
                    ))}
                  </select>
                  <span className="season-selector-arrow">&#9660;</span>
                </div>
              )}

              <div className="episode-filter-bar">
                {['all', 'canon', 'filler', 'recap'].map(f => (
                  <button
                    key={f}
                    className={`ep-filter-btn${filter === f ? ' active' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="episode-count-info">
            {isLongRunning
              ? <span>{getPartLabel(selectedPart)} &middot; {filteredEpisodes.length} episodes</span>
              : <span>{filteredEpisodes.length} episodes total</span>
            }
          </div>

          {loadingPage ? (
            <InlineLoader label="Loading episodes..." />
          ) : filteredEpisodes.length === 0 ? (
            <div className="ep-empty-state">
              <p>No {filter !== 'all' ? filter : ''} episodes in this part.</p>
            </div>
          ) : (
            <div className="episode-list-netflix">
              {filteredEpisodes.map((ep) => (
                <EpisodeCard
                  key={ep.number}
                  ep={ep}
                  anime={anime}
                  onStartWatching={onStartWatching}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EpisodeCard({ ep, anime, onStartWatching }) {
  const [imgError, setImgError] = React.useState(false);
  return (
    <button
      className={`ep-card-netflix${ep.filler ? ' ep-filler' : ''}${ep.recap ? ' ep-recap' : ''}`}
      onClick={() => onStartWatching(anime, ep.number)}
    >
      <div className="ep-card-thumb">
        {!imgError ? (
          <img
            src={ep.thumbnail || anime.coverImage}
            alt={ep.title}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="ep-thumb-fallback"><Play size={24} /></div>
        )}
        <div className="ep-card-play-overlay"><Play size={28} fill="white" /></div>
        <div className="ep-card-num-badge">EP {ep.number}</div>
      </div>

      <div className="ep-card-body">
        <div className="ep-card-top">
          <span className="ep-card-number">Episode {ep.number}</span>
          <div className="ep-card-badges">
            {ep.filler && <span className="ep-badge ep-badge-filler">FILLER</span>}
            {ep.recap && <span className="ep-badge ep-badge-recap">RECAP</span>}
          </div>
        </div>
        <div className="ep-card-title">{ep.title}</div>
        <div className="ep-card-meta">
          {ep.aired && <span>{ep.aired}</span>}
          {ep.score && <span>{'\u2b50'} {ep.score}/5</span>}
          {anime.duration && <span>{anime.duration}</span>}
        </div>
      </div>

      <div className="ep-card-action"><Play size={20} /></div>
    </button>
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
  showToast
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

  const dropdownRef = React.useRef(null);
  const activeEpisodeRef = React.useRef(null);

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
    // Simulate slight lag to make the skeleton animation beautifully visible
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
              title: `${item.title} - Part ${p} (Ep ${start}–${end})`,
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
          title: `Season 1 - Part ${p} (Ep ${start}–${end})`,
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

  return (
    <div className="watch-page-wrapper">
      <div className="watch-container-netflix">
        {/* Player Block */}
        <div className="player-area-full">
          {loadingSources ? (
            <LoadingPlayer />
          ) : (
            <VideoPlayer
              source={source}
              poster={episode.thumbnail || anime.bannerImage}
              subtitles={episode?.subtitles}
              malId={anime.idMal}
              episodeNumber={episode.number}
            />
          )}

          {/* Warning banner */}
          {hasProviderProblem && (
            <ProviderWarning error={episode.error} />
          )}

          {/* Watch Page Title Block */}
          <div className="watch-action-bar" style={{ borderBottom: 'none', paddingBottom: '0.5rem' }}>
            <div className="action-bar-left">
              <div className="watch-ep-info">
                Episode {episode.number}: {episode.title}
              </div>
              <h1 className="watch-meta-title">{anime.title}</h1>
            </div>
          </div>

          {/* Description & Server Block */}
          <div className="watch-description-block" style={{ marginTop: '0' }}>
            {/* Audio Mode / Language Selector Bar */}
            <div className="audio-mode-selector">
              <span className="audio-mode-label">Audio Language:</span>
              <div className="audio-mode-pills">
                <button
                  className={`audio-pill ${audioMode === 'sub' ? 'active' : ''}`}
                  onClick={() => {
                    if (setAudioMode) setAudioMode('sub');
                    if (showToast) showToast('🇯🇵 Switched to Japanese (Subbed) Audio', 'info');
                    if (onStartWatching) onStartWatching(anime, episode.number, true, 'sub');
                  }}
                >
                  SUB (JPN)
                </button>
                <button
                  className={`audio-pill ${audioMode === 'dub' ? 'active' : ''}`}
                  onClick={() => {
                    if (setAudioMode) setAudioMode('dub');
                    if (showToast) showToast('🎙️ Switched to English Dubbed Audio', 'info');
                    if (onStartWatching) onStartWatching(anime, episode.number, true, 'dub');
                  }}
                >
                  DUB (ENG)
                </button>
                <button
                  className={`audio-pill audio-pill--hindi ${audioMode === 'hindi' ? 'active' : ''}`}
                  onClick={() => {
                    const isKnownHindiDub = isKnownHindiDubTitle(anime.title, anime.japaneseTitle);
                    if (setAudioMode) setAudioMode('hindi');
                    if (showToast) showToast(isKnownHindiDub ? 'Switching to Hindi Dub audio...' : 'Checking Hindi Dub source...', 'info');
                    if (onStartWatching) onStartWatching(anime, episode.number, true, 'hindi');
                  }}
                >
                  🇮🇳 HINDI DUB
                  {hasHindiDubAvailable(anime.title, anime.japaneseTitle) ? (
                    <span className="hindi-badge">Available</span>
                  ) : isKnownHindiDubTitle(anime.title, anime.japaneseTitle) ? (
                    <span className="hindi-badge" style={{ background: '#8a6d1d', color: '#ffe8a3' }}>Check</span>
                  ) : (
                    <span className="hindi-badge" style={{ background: '#555', color: '#ccc' }}>Try</span>
                  )}
                </button>
              </div>
            </div>

            {episode.sources && episode.sources.length > 1 && (
              <div className="server-selector" style={{ marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Choose Server / Quality:
                </span>
                {episode.sources.map((src, idx) => (
                  <button
                    key={`${src.url}-${idx}`}
                    className={`server-btn ${currentSourceIndex === idx ? 'active' : ''}`}
                    onClick={() => setCurrentSourceIndex(idx)}
                  >
                    Server {idx + 1} ({src.quality || 'auto'})
                  </button>
                ))}
              </div>
            )}

            <p className="watch-meta-desc">{anime.description}</p>
          </div>

          {/* Netflix-Style Bento Episodes Section */}
          <div className="watch-episodes-slider-section" style={{ borderTop: 'none', paddingTop: '1rem' }}>
            {/* Header: Title on Left, Season dropdown button on Right */}
            <div className="slider-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <h3 className="slider-title" style={{ margin: '0', fontSize: '1.5rem' }}>Episodes</h3>
                <div className="episode-filter-bar" style={{ marginTop: '0' }}>
                  {['all', 'canon', 'filler', 'recap'].map(f => (
                    <button
                      key={f}
                      className={`ep-filter-btn${filter === f ? ' active' : ''}`}
                      onClick={() => setFilter(f)}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Season Selector Button on the far right */}
              <div className="season-dropdown-wrapper" ref={dropdownRef}>
                <button
                  className="watch-action-btn season-btn"
                  onClick={() => setShowSeasonDropdown(!showSeasonDropdown)}
                  aria-expanded={showSeasonDropdown}
                  style={{ minWidth: '180px' }}
                >
                  <span>{activeLabel}</span>
                  <span className="btn-arrow">â–¼</span>
                </button>

                {showSeasonDropdown && (
                  <div className="season-dropdown-menu">
                    {seasonOptions.map((opt, idx) => (
                      <button
                        key={idx}
                        className={`season-dropdown-item${opt.isActive ? ' active' : ''}`}
                        onClick={() => {
                          setShowSeasonDropdown(false);
                          if (opt.id !== anime.id) {
                            onAnimeSelect(opt.id);
                          } else {
                            setSelectedPart(opt.part);
                          }
                        }}
                      >
                        {opt.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Episode List or Bento Skeletons */}
            {loadingEpisodes ? (
              <div className="ep-bento-list">
                {Array.from({ length: 4 }).map((_, i) => (
                  <BentoEpisodeSkeleton key={i} />
                ))}
              </div>
            ) : filteredEpisodes.length === 0 ? (
              <div className="slider-empty">
                <p>No {filter !== 'all' ? filter : ''} episodes found.</p>
              </div>
            ) : (
              <div className="ep-bento-list">
                {filteredEpisodes.map(ep => {
                  const isActive = ep.number === episode.number;
                  // Dynamic placeholder synopsis text for Netflix look
                  const dynamicDesc = `In Episode ${ep.number} of ${anime.title}, the journey intensifies. Watch as the characters face new challenges, make key decisions, and shape their destiny. Stream in Full HD quality now.`;
                  
                  // Calculate active season number from franchise list
                  const franchiseIndex = franchiseList.findIndex(item => item.id === anime.id);
                  const seasonNum = franchiseIndex !== -1 ? (franchiseIndex + 1) : 1;

                  // Avoid redundant "Episode X - Episode X" title labels
                  const rawTitle = ep.title || '';
                  const isRedundantTitle = rawTitle.trim().toLowerCase() === `episode ${ep.number}` || 
                                           rawTitle.trim().toLowerCase() === `episode 0${ep.number}`;
                  const cleanTitle = ep.title && !isRedundantTitle ? ep.title.trim() : '';

                  return (
                    <div
                      key={ep.number}
                      ref={isActive ? activeEpisodeRef : null}
                      className={`ep-bento-card${isActive ? ' active' : ''}${ep.filler ? ' filler' : ''}${ep.recap ? ' recap' : ''}`}
                      onClick={() => onStartWatching(anime, ep.number)}
                    >
                      {/* Left: Index Number */}
                      <div className="ep-bento-number">{ep.number}</div>

                      {/* Center: Image Thumbnail */}
                      <div className="ep-bento-thumb">
                        <img src={ep.thumbnail || anime.coverImage} alt={ep.title} loading="lazy" />
                        <div className="ep-bento-play-overlay">
                          <Play size={24} fill="currentColor" />
                        </div>
                        {ep.filler && <span className="ep-badge ep-badge-filler">FILLER</span>}
                        {ep.recap && <span className="ep-badge ep-badge-recap">RECAP</span>}
                      </div>

                      {/* Right: Content details */}
                      <div className="ep-bento-info">
                        <div className="ep-bento-header">
                          <h4 className="ep-bento-title">
                            Season {seasonNum} &middot; Episode {ep.number}{cleanTitle ? ` - ${cleanTitle}` : ''}
                          </h4>
                          <span className="ep-bento-duration">
                            {anime.duration || '24m'}
                          </span>
                        </div>
                        <p className="ep-bento-desc">{dynamicDesc}</p>
                        <div className="ep-bento-meta">
                          {ep.aired && <span>Aired: {ep.aired}</span>}
                          {ep.score && <span style={{ color: 'var(--accent-primary)' }}>â˜… {ep.score}/5</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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
  if (isLoading || !hindiAnime || hindiAnime.length === 0) {
    return <CategorySkeleton />;
  }

  const featuredItem = hindiAnime[0];
  const actionHindi = hindiAnime.filter(a => a.genres?.includes('Action') || a.genres?.includes('Adventure'));
  const fantasyHindi = hindiAnime.filter(a => a.genres?.includes('Fantasy') || a.genres?.includes('Supernatural'));

  return (
    <div className="netflix-home">
      {featuredItem && (
        <div
          className="hero netflix-hero"
          style={{ backgroundImage: `url(${featuredItem.bannerImage || featuredItem.coverImage})` }}
        >
          <div className="hero-overlay"></div>
          <div className="hero-scanline"></div>
          <div className="container hero-shell">
            <div className="hero-content">
              <div className="hero-eyebrow">
                <span className="hero-eyebrow-badge" style={{ background: '#ff4757' }}>N</span>
                <span className="hero-eyebrow-text">Hindi Audio Series</span>
                <span className="hero-eyebrow-dot">•</span>
                <span className="hero-live-tag" style={{ background: 'rgba(255,71,87,0.2)', color: '#ff4757', borderColor: 'rgba(255,71,87,0.4)' }}>Hindi Dub</span>
              </div>

              <h1 className="hero-title">{featuredItem.title}</h1>

              <div className="hero-meta">
                <span className="top-ten-badge" style={{ background: 'linear-gradient(135deg, #ff4757, #ff6b81)' }}>Hindi Dubbed</span>
                <span>
                  <Star size={14} fill="var(--accent-primary)" style={{ color: 'var(--accent-primary)' }} />
                  {featuredItem.rating}
                </span>
                <span className="hero-meta-tag">{featuredItem.type}</span>
                <span className="hero-meta-tag">{featuredItem.status}</span>
              </div>

              <p className="hero-desc">{featuredItem.description}</p>

              <div className="btn-group">
                <button className="btn btn-primary hero-btn-play" onClick={() => onStartWatching(featuredItem, 1)}>
                  <Play size={20} fill="currentColor" /> Play in Hindi
                </button>
                <button className="btn btn-secondary hero-btn-info" onClick={() => onAnimeClick(featuredItem.id)}>
                  <Info size={20} /> More Info
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="netflix-rows">
        <NetflixRow
          title="All Hindi Dubbed Anime"
          icon={<Globe className="hv-icon" size={20} style={{ color: '#ff4757' }} />}
          items={hindiAnime}
          onAnimeClick={(a) => onAnimeClick(a.id ?? a)}
        />
        {actionHindi.length > 0 && (
          <NetflixRow
            title="Action &amp; Adventure (Hindi Dubbed)"
            icon={<Flame className="hv-icon" size={20} style={{ color: '#f97316' }} />}
            items={actionHindi}
            onAnimeClick={(a) => onAnimeClick(a.id ?? a)}
          />
        )}
        {fantasyHindi.length > 0 && (
          <NetflixRow
            title="Fantasy &amp; Supernatural (Hindi Dubbed)"
            icon={<Sparkles className="hv-icon" size={20} style={{ color: '#a855f7' }} />}
            items={fantasyHindi}
            onAnimeClick={(a) => onAnimeClick(a.id ?? a)}
          />
        )}
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MANHWA COMPONENTS (Hivetoons)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    <div className="manhwa-home">
      {/* Search */}
      <div className="manhwa-search-bar-wrap">
        <div className="manhwa-search-inner">
          <span className="manhwa-search-icon"></span>
          <input
            className="manhwa-search-input"
            type="text"
            placeholder="Search Manhwa, Manga, Manhua..."
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
          />
        </div>
      </div>

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
        <div className="manhwa-loading" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <InlineLoader />
        </div>
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
          <button className="manhwa-back-btn" onClick={onBack}>â† Back</button>
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
        <button className="manhwa-back-btn" onClick={onBack}>â† {series.title}</button>
        <span className="manhwa-reader-chapter-label">Chapter {chapter.number}</span>
        <div className="manhwa-reader-nav">
          {prevChapter && (
            <button className="manhwa-nav-btn" onClick={() => onChapterSelect(prevChapter)}>
              â† Prev
            </button>
          )}
          {nextChapter && (
            <button className="manhwa-nav-btn" onClick={() => onChapterSelect(nextChapter)}>
              Next →
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
              â† Previous Chapter
            </button>
          )}
          <button className="manhwa-back-btn-plain" onClick={() => { onBack(); }}>
            Chapter List
          </button>
          {nextChapter && (
            <button className="manhwa-nav-btn" onClick={() => { onChapterSelect(nextChapter); window.scrollTo(0,0); }}>
              Next Chapter →
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DRAMA COMPONENTS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        <small>{drama.country || 'Drama'} · {drama.status || 'Ongoing'}</small>
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
    <div className="netflix-home drama-home">
      {/* Search bar */}
      <div className="drama-search-bar-wrap">
        <input
          className="drama-search-input"
          type="text"
          placeholder="Search Dramas, Chinese, Thai..."
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
        />
      </div>

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
        <div className="drama-loading" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="blob-loader-wrap">
            <div className="blob-loader" />
            <p className="blob-loader-text">Loading catalog...</p>
          </div>
        </div>
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
                    <span className="hero-eyebrow-dot">•</span>
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
          <button className="drama-back-btn" onClick={onBack}>â† Back</button>
          <h1 className="drama-detail-title">{drama.title}</h1>
          {drama.releaseDate && (
            <span className="drama-detail-meta">
              {new Date(drama.releaseDate).getFullYear()} · {drama.country} · {drama.status}
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
        <button className="drama-back-btn" onClick={onBack}>â† {drama.title}</button>
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

// ─────────────────────────────────────────────────────
// MOVIE COMPONENTS
// ─────────────────────────────────────────────────────

function MovieCard({ movie, onClick }) {
  const [imgErr, setImgErr] = React.useState(false);
  return (
    <button className="netflix-tile movie-tile" onClick={onClick}>
      <span className="tile-art">
        {!imgErr && movie.coverImage ? (
          <img
            src={movie.coverImage}
            alt={movie.title}
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="drama-card-placeholder">
            <span>{movie.title?.[0] || '?'}</span>
          </div>
        )}
        <span className="tile-logo-mark">EN</span>
        <span className="tile-hover-overlay">
          <span className="tile-hover-play"><Play size={20} fill="white" style={{ color: 'white' }} /></span>
        </span>
        {movie.rating && (
          <span className="tile-rating-badge" style={{ color: '#fff' }}>★ {movie.rating}</span>
        )}
      </span>
      <span className="tile-info">
        <strong>{movie.title}</strong>
        <small>{movie.releaseDate ? movie.releaseDate.split('-')[0] : 'Movie'} · {movie.genres?.[0] || 'Cinema'}</small>
      </span>
    </button>
  );
}

function MovieRow({ title, icon, movies, onMovieClick }) {
  if (!movies || movies.length === 0) return null;
  return (
    <section className="hv-section netflix-row">
      <div className="hv-section-header">
        <h2 className="hv-section-title">
          {icon && <span className="hv-title-accent">{icon}</span>} {title}
        </h2>
        <span className="hv-section-line" />
      </div>
      <div className="netflix-slider">
        {movies.map(m => (
          <MovieCard key={m.id} movie={m} onClick={() => onMovieClick(m)} />
        ))}
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
  onMovieClick
}) {
  const featured = data?.featured || data?.bollywood?.[0];

  const categories = ['All', 'Bollywood', 'Hollywood Hindi Dubbed', 'Bollywood Classics'];

  let displayedBollywood = data?.bollywood || [];
  let displayedHollywood = data?.hollywood || [];
  let displayedClassics = data?.classics || [];

  if (activeCategory === 'Bollywood') {
    displayedHollywood = [];
    displayedClassics = [];
  } else if (activeCategory === 'Hollywood Hindi Dubbed') {
    displayedBollywood = [];
    displayedClassics = [];
  } else if (activeCategory === 'Bollywood Classics') {
    displayedBollywood = [];
    displayedHollywood = [];
  }

  return (
    <div className="netflix-home movie-home">
      {/* Search bar */}
      <div className="drama-search-bar-wrap">
        <input
          className="drama-search-input"
          type="text"
          placeholder="Search Bollywood, Hollywood Hindi Dubbed, Classics..."
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
        />
      </div>

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
              {searchResults.map(m => <MovieCard key={m.id} movie={m} onClick={() => onMovieClick(m)} />)}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem 0' }}>No movies found.</p>
          )}
        </div>
      ) : isLoading ? (
        <div className="drama-loading" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="blob-loader-wrap">
            <div className="blob-loader" />
            <p className="blob-loader-text">Loading movie catalog...</p>
          </div>
        </div>
      ) : !data || !Array.isArray(data.bollywood) ? (
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.2rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', textAlign: 'center', maxWidth: '640px' }}>
            {error || 'Could not load movie catalog. Check connection or backend status.'}
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
        </div>
      ) : (
        <>
          {/* Hero Header */}
          {featured && (
            <div className="hero netflix-hero movie-hero" style={{ backgroundImage: `url(${featured.bannerImage || featured.coverImage})` }}>
              <div className="hero-overlay" />
              <div className="hero-scanline" />
              <div className="container hero-shell">
                <div className="hero-content">
                  <div className="hero-eyebrow">
                    <span className="hero-eyebrow-badge" style={{ background: '#e50914' }}>M</span>
                    <span className="hero-eyebrow-text">Movie Spotlight</span>
                    <span className="hero-eyebrow-dot">•</span>
                    <span className="hero-live-tag" style={{ background: 'rgba(229, 9, 20, 0.15)', borderColor: 'rgba(229, 9, 20, 0.5)', color: '#ef4444' }}>FEATURED</span>
                  </div>

                  <h1 className="hero-title">{featured.title}</h1>

                  <div className="hero-meta">
                    <span className="top-ten-badge" style={{ background: '#e50914' }}>BLOCKBUSTER</span>
                    <span className="hero-rank">#1 Popular Cinema</span>
                    {featured.rating && (
                      <span className="hero-star">
                        <Star size={14} fill="var(--accent-primary)" style={{ color: 'var(--accent-primary)' }} />
                        {featured.rating}
                      </span>
                    )}
                    {featured.releaseDate && (
                      <span className="hero-meta-tag">{featured.releaseDate.split('-')[0]}</span>
                    )}
                  </div>

                  {featured.description && <p className="hero-desc">{featured.description}</p>}

                  <div className="btn-group">
                    <button className="btn btn-primary hero-btn-play" onClick={() => onMovieClick(featured)}>
                      <Play size={20} fill="currentColor" /> Watch Movie
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="netflix-rows">
            {/* Category Filter Pills */}
            <div className="category-row netflix-category-row">
              <div className="hv-section-header">
                <h2 className="hv-section-title">
                  <Compass className="hv-icon" size={20} style={{ color: '#a855f7' }} /> Cinema Categories
                </h2>
                <span className="hv-section-line" />
              </div>
              <div className="categories-container">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
                    onClick={() => setActiveCategory(cat)}
                  >{cat}</button>
                ))}
              </div>
            </div>

            {displayedBollywood.length > 0 && (
              <MovieRow
                title="Popular Bollywood Hits"
                icon={<Flame className="hv-icon" size={20} style={{ color: '#f97316' }} />}
                movies={displayedBollywood}
                onMovieClick={onMovieClick}
              />
            )}

            {displayedHollywood.length > 0 && (
              <MovieRow
                title="Hollywood Hindi Dubbed"
                icon={<Tv className="hv-icon" size={20} style={{ color: '#3b82f6' }} />}
                movies={displayedHollywood}
                onMovieClick={onMovieClick}
              />
            )}

            {displayedClassics.length > 0 && (
              <MovieRow
                title="Bollywood Classics & Niche Old"
                icon={<Trophy className="hv-icon" size={20} style={{ color: 'var(--accent-primary)' }} />}
                movies={displayedClassics}
                onMovieClick={onMovieClick}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MovieDetailView({ movie, isLoading, onBack, onWatch }) {
  return (
    <div className="drama-detail movie-detail">
      <div className="drama-detail-hero" style={{ backgroundImage: `url(${movie.bannerImage || movie.coverImage})` }}>
        <div className="drama-hero-overlay" />
        <div className="drama-detail-hero-content">
          <button className="drama-back-btn" onClick={onBack}>← Back</button>
          <h1 className="drama-detail-title">{movie.title}</h1>
          <span className="drama-detail-meta">
            {movie.releaseDate ? movie.releaseDate.split('-')[0] : 'Movie'} · ★ {movie.rating || 'N/A'} {movie.runtime ? `· ${movie.runtime} mins` : ''}
          </span>
          <button className="btn btn-primary" onClick={onWatch}>
            <Play size={20} fill="currentColor" /> Play Movie
          </button>
        </div>
      </div>

      <div className="drama-detail-body container">
        {movie.description && (
          <div className="drama-detail-desc">
            <h3>Synopsis</h3>
            <p>{movie.description}</p>
          </div>
        )}

        {movie.genres && movie.genres.length > 0 && (
          <div className="bento-genres" style={{ marginTop: '1rem' }}>
            {movie.genres.map(g => (
              <span key={g} className="bento-genre-tag">{g}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MovieWatchView({ movie, onBack, onProgress }) {
  const [movieData, setMovieData] = React.useState(movie);
  const [activeServerId, setActiveServerId] = React.useState('vidsrc-me');

  // Dynamically resolve IMDb ID if not already present on the movie object
  React.useEffect(() => {
    if (!movie.imdbId && movie.id) {
      fetch(`/api/movies/info/${movie.id}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.imdbId) {
            setMovieData(prev => ({ ...prev, imdbId: data.imdbId }));
          }
        })
        .catch(() => {});
    }
  }, [movie.id]);

  const tmdbId = movieData.id;
  const imdbId = movieData.imdbId;
  const activeId = imdbId || tmdbId;

  // Verified high-availability movie embed providers (supporting IMDb & TMDB fallbacks)
  const servers = [
    {
      id: 'vidsrc-me',
      name: 'Server 1 (VidSrc Primary - HD)',
      getUrl: () => imdbId ? `https://vidsrc.me/embed/movie?imdb=${imdbId}` : `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`
    },
    {
      id: 'vidlink-pro',
      name: 'Server 2 (VidLink Pro)',
      getUrl: () => `https://vidlink.pro/movie/${tmdbId}`
    },
    {
      id: 'vidsrc-pm',
      name: 'Server 3 (VidSrc PM)',
      getUrl: () => `https://vidsrc.pm/embed/movie/${activeId}`
    },
    {
      id: '2embed',
      name: 'Server 4 (2Embed)',
      getUrl: () => `https://www.2embed.cc/embed/${tmdbId}`
    },
    {
      id: 'vidsrc-in',
      name: 'Server 5 (VidSrc IN)',
      getUrl: () => `https://vidsrc.in/embed/movie/${activeId}`
    },
    {
      id: 'vidsrc-to',
      name: 'Server 6 (VidSrc TO)',
      getUrl: () => `https://vidsrc.to/embed/movie/${activeId}`
    }
  ];

  const currentServer = servers.find(s => s.id === activeServerId) || servers[0];
  const iframeSrc = currentServer.getUrl();

  // Track progress periodically
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (onProgress) onProgress({ progress_seconds: 100, duration_seconds: 100 });
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="drama-watch movie-watch">
      <div className="drama-watch-header">
        <button className="drama-back-btn" onClick={onBack}>← {movie.title}</button>
        <span className="drama-watch-ep-label">Full Movie</span>
      </div>

      <div className="drama-player-wrap" style={{ aspectRatio: '16/9', background: '#000' }}>
        <iframe
          key={activeServerId + '-' + (imdbId || 'noimdb')}
          src={iframeSrc}
          title={movie.title}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </div>

      {/* Server selector */}
      <div className="drama-sub-selector" style={{ marginTop: '1.5rem' }}>
        <span className="drama-sub-label">Select Server / Source:</span>
        {servers.map(s => (
          <button
            key={s.id}
            className={`drama-sub-btn ${activeServerId === s.id ? 'active' : ''}`}
            onClick={() => setActiveServerId(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// INTERACTIVE SCROLL INTRO OVERLAY COMPONENT
// ─────────────────────────────────────────────────────────────
function ScrollIntroOverlay({ onClose, onNavigateSection }) {
  const [slideIndex, setSlideIndex] = React.useState(0);
  const [isHiding, setIsHiding] = React.useState(false);
  const totalSlides = 3;
  const touchStartY = React.useRef(0);
  const lastScrollTime = React.useRef(0);

  const handleNext = () => {
    if (slideIndex < totalSlides - 1) {
      setSlideIndex(prev => prev + 1);
    } else {
      finishIntro();
    }
  };

  const handlePrev = () => {
    if (slideIndex > 0) {
      setSlideIndex(prev => prev - 1);
    }
  };

  const finishIntro = () => {
    setIsHiding(true);
    setTimeout(() => {
      onClose();
    }, 700);
  };

  // Mouse wheel scroll & arrow key handler
  React.useEffect(() => {
    const handleWheel = (e) => {
      const now = Date.now();
      if (now - lastScrollTime.current < 500) return;
      
      if (e.deltaY > 20) {
        lastScrollTime.current = now;
        handleNext();
      } else if (e.deltaY < -20) {
        lastScrollTime.current = now;
        handlePrev();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        handleNext();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        handlePrev();
      } else if (e.key === 'Escape') {
        finishIntro();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [slideIndex]);

  // Touch Swipe handlers for mobile
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;
    if (Math.abs(diff) > 35) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
  };

  return (
    <div
      className={`intro-overlay ${isHiding ? 'intro-overlay--hiding' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="intro-background-canvas" />
      <div className="intro-ambient-orb" />

      {/* Cicada Glowing Tree Video Background */}
      <div className="banner-tree">
        <video autoPlay muted loop playsInline>
          <source src="https://cdn.zajno.com/dev/codepen/cicada/cicada_tree.mov" type='video/mp4; codecs="hvc1"' />
          <source src="https://cdn.zajno.com/dev/codepen/cicada/cicada_tree.webm" type="video/webm" />
        </video>
      </div>

      {/* SVG Cicada Wings Background */}
      <div
        className="wings-svg"
        style={{
          transform: `translateX(-50%) scale(${slideIndex === 1 ? 1.25 : 1})`,
          opacity: slideIndex === 0 ? 0.5 : (slideIndex === 1 ? 0.8 : 0.3)
        }}
      >
        <svg viewBox="0 0 1357 466" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clipRule="evenodd" d="M720.899 171.288C719.274 171.372 717.871 170.214 717.614 168.608L717.394 167.232C717.329 166.829 717.507 166.425 717.849 166.201V166.201C717.945 166.138 718.049 166.092 718.16 166.064C764.569 154.275 834.211 133.248 892.161 109.291C913.836 100.33 933.892 90.9529 950.491 81.4879C950.498 81.4837 950.508 81.4881 950.509 81.4965V81.4965C950.51 81.5031 950.517 81.5076 950.523 81.5064C978.652 76.5692 1019.23 67.5929 1056.69 55.8036C1059.87 54.8016 1063.38 56.3891 1064.13 59.6421C1065.77 66.7753 1064.9 73.5074 1061.91 79.8722C1058.01 88.1699 1050.46 95.8918 1040 103.045C1019.06 117.353 986.643 129.247 949.142 138.909C876.176 157.709 784.214 167.997 720.899 171.288ZM1067.55 52.2756C1065.38 53.0022 1064.29 55.3943 1064.91 57.5903C1067.19 65.6449 1066.43 73.2568 1063.06 80.413C1062.69 81.203 1062.29 81.987 1061.85 82.7651C1060.38 85.4066 1060.54 88.7261 1062.49 91.0392C1062.68 91.2676 1062.87 91.4956 1063.06 91.7232C1064.74 93.7529 1067.45 94.6665 1069.98 93.9336C1070.89 93.6693 1071.81 93.4036 1072.73 93.1363C1100.11 85.2152 1132.23 75.9226 1158.72 62.7823C1184.63 49.9302 1204.96 33.4958 1210.36 11.2429C1211.21 7.74129 1208.49 4.53693 1204.9 4.35312C1188.2 3.50028 1171.17 3.67412 1153.94 4.7476C1151.78 4.88199 1149.88 6.14303 1148.64 7.91357C1143.26 15.5954 1133.59 22.898 1121.26 29.7269C1106.46 37.9284 1087.69 45.5111 1067.55 52.2756V52.2756ZM1141.23 14.3404C1144.99 10.856 1142 5.60665 1136.9 6.09123C1091.88 10.3716 1045.74 20.4221 1000.61 34.0271C998.015 34.81 996.293 37.1964 995.605 39.8199C994.545 43.8621 992.274 47.9511 988.991 52.0523C983.907 58.4053 976.348 64.8521 966.919 71.2937V71.2937C964.346 73.0516 966.004 77.3288 969.059 76.7152C998.087 70.8847 1034.46 62.0455 1067.14 51.071C1087.25 44.3183 1105.94 36.7642 1120.65 28.6153C1128.96 24.0119 1135.96 19.2391 1141.23 14.3404ZM891.675 108.117C849.126 125.707 800.252 141.72 758.925 153.648C752.004 155.646 748.278 147.102 754.477 143.433C815.884 107.092 898.551 66.4977 986.243 38.4884C990.467 37.1392 994.453 40.5243 992.45 44.4802C991.322 46.7079 989.832 48.9686 987.999 51.2583C983.025 57.4734 975.579 63.838 966.202 70.2444C947.45 83.0555 921.09 95.9566 891.675 108.117ZM727.862 194.272C724.516 194.863 722.324 198.054 722.86 201.408L723.511 205.475C723.83 207.471 725.084 209.198 726.882 210.12C781.253 237.987 831.217 259.757 877.088 276.227C880.349 277.398 883.959 275.719 884.964 272.404C890.765 253.27 888.612 238.251 881.194 226.594C872.794 213.394 857.562 204.374 839.085 198.618C804.924 187.978 759.991 188.6 727.862 194.272ZM720.651 187.594C721.222 191.169 724.66 193.538 728.227 192.918C760.461 187.316 805.267 186.754 839.463 197.405C841.24 197.959 842.988 198.542 844.706 199.158C845.406 199.408 846.132 199.543 846.875 199.544C899.276 199.612 971.277 192.543 1020.64 175.023C1045.56 166.181 1064.54 154.732 1072.45 140.346C1076.38 133.182 1077.58 125.271 1075.37 116.525C1073.61 109.552 1069.68 102.027 1063.21 93.9231C1060.74 90.8361 1056.06 91.0597 1053.27 93.8543C1049.72 97.4061 1045.51 100.818 1040.71 104.094C1019.59 118.531 986.994 130.469 949.459 140.14C878.046 158.539 788.51 168.79 725.334 172.321C721.557 172.532 718.789 175.957 719.387 179.693L720.651 187.594ZM881.572 199.911C874.604 200.27 871.426 213.192 876.238 218.244C877.153 219.204 878.026 220.192 878.858 221.207C879.873 222.448 881.239 223.34 882.817 223.624C916.227 229.633 999.527 238.997 1089.18 232.036C1094.1 231.654 1099.05 231.211 1104.03 230.711C1104.03 230.711 1104.03 230.711 1104.03 230.71V230.71C1104.03 230.71 1104.03 230.709 1104.03 230.709C1160.19 222.525 1185.64 204.205 1194.94 186.928C1203.19 171.614 1198.83 157.081 1191.9 150.702C1190.52 149.426 1188.54 149.251 1186.75 149.839C1123.01 170.808 1019.72 183.79 976.213 188.523C976.173 188.527 976.139 188.498 976.135 188.457V188.457C976.13 188.414 976.089 188.384 976.047 188.393C945.546 194.657 912.085 198.339 881.572 199.911ZM1191.79 148.133C1191.49 148.239 1191.43 148.648 1191.68 148.847C1199.74 155.136 1204.94 171.049 1196.06 187.531C1187.66 203.129 1166.71 219.199 1123.8 228.461C1203.29 218.387 1284.98 196.207 1321.76 184.64C1323.39 184.128 1324.71 182.986 1325.47 181.455C1339.09 153.757 1347.66 124.449 1352.22 96.1927C1353.91 85.6881 1352.95 75.2183 1349.71 65.6505C1348.4 61.7933 1343.67 60.7225 1340.45 63.2147C1309.57 87.1088 1248.92 128.272 1191.79 148.133V148.133ZM986.682 186.073C1036.05 180.401 1132.88 167.27 1191.38 146.933C1222.68 136.049 1255.07 118.734 1283.01 101.386C1283.02 101.38 1283.02 101.367 1283.01 101.362V101.362C1283 101.36 1283 101.352 1283 101.345C1286.93 92.1506 1288.44 84.7864 1287.75 79.1225C1287.07 73.5059 1284.23 69.5231 1279.3 67.0252C1274.32 64.5049 1267.19 63.4818 1257.95 63.943C1248.99 64.39 1238.11 66.2282 1225.41 69.3865C1224.9 69.514 1224.41 69.7072 1223.94 69.9566C1212.29 76.1968 1199.66 81.5329 1186.75 86.2024C1166.33 93.5902 1145.16 99.3281 1125.97 104.336C1123.41 105.004 1120.89 105.66 1118.4 106.304C1102.26 110.492 1087.9 114.219 1077.04 118.091C1077.04 118.092 1077.04 118.091 1077.04 118.09V118.09C1077.03 118.088 1077.03 118.089 1077.03 118.091C1078.7 126.416 1077.36 134.033 1073.56 140.958C1065.41 155.785 1046.02 167.364 1021.07 176.221C1010.5 179.972 998.898 183.245 986.682 186.073ZM1343.53 52.6414C1345.14 55.1987 1344.41 58.5086 1342.04 60.371C1331.76 68.4245 1317.71 78.7301 1301.33 89.6169C1296.19 93.0268 1289.32 87.4081 1289.18 81.2486C1289.16 80.4644 1289.1 79.7047 1289.01 78.9695C1288.28 72.9295 1285.18 68.5801 1279.87 65.8916C1274.61 63.2255 1267.22 62.2081 1257.88 62.6738V62.6738C1252.95 62.9202 1249.19 53.6392 1252.92 50.3909C1262.63 41.9249 1270.57 32.2316 1275.95 21.0387C1277.36 18.1039 1280.62 16.4384 1283.74 17.369C1295.33 20.826 1306.61 24.9935 1317.53 29.9268C1328.58 34.9152 1337.43 42.9183 1343.53 52.6414ZM1270.14 13.6686C1273.81 14.5747 1275.81 18.5379 1274.1 21.9145C1264.14 41.6027 1245.99 56.5724 1224.2 68.3742C1224.18 68.3825 1224.17 68.3889 1224.15 68.3932L1223.98 68.4363C1223.96 68.4408 1223.95 68.4591 1223.95 68.4772V68.4772C1223.96 68.4921 1223.95 68.5077 1223.94 68.515C1212.21 74.8459 1199.43 80.2631 1186.32 85.0074C1165.96 92.3737 1144.84 98.0993 1125.65 103.107C1123.09 103.774 1120.57 104.428 1118.09 105.073C1102.33 109.162 1088.19 112.83 1077.37 116.627C1077.04 116.742 1076.69 116.548 1076.61 116.214V116.214C1075.45 111.634 1073.39 106.854 1070.36 101.867C1068.65 99.0537 1069.93 95.2696 1073.1 94.3545V94.3545L1073.1 94.3535C1100.46 86.4388 1132.68 77.1148 1159.29 63.9207C1185.5 50.9172 1206.46 34.0542 1211.75 10.8932C1212.51 7.55298 1215.46 5.01919 1218.88 5.31693C1236.43 6.84789 1253.56 9.58083 1270.14 13.6686ZM882.267 225.912V225.912C881.969 225.445 882.352 224.832 882.897 224.929C906.577 229.164 954.678 235.012 1012.24 235.706C1014.56 235.734 1016.74 237.005 1017.58 239.169C1019.06 242.94 1020.2 247.745 1020.01 252.739C1019.79 258.591 1017.75 264.706 1012.28 269.76C1010.95 270.991 1009.07 271.38 1007.29 271.017C962.796 261.955 921.183 252.293 893.012 244.996C890.555 244.36 888.771 242.307 888.178 239.839C886.957 234.764 884.951 230.131 882.267 225.912ZM898.224 247.645C893.872 246.539 889.699 250.169 889.483 254.654C889.216 260.214 888.162 266.189 886.232 272.6C885.207 276.006 886.955 279.717 890.319 280.87C1007.55 321.048 1097.32 325.912 1165.19 309.498C1172.07 307.835 1170.68 298.019 1163.63 297.39C1131.1 294.488 1090.35 288.116 1049.29 280.497C1036.38 278.101 1023.43 275.58 1010.69 273.004C1010.5 272.965 1010.3 273.008 1010.14 273.121V273.121C1009.82 273.346 1009.38 273.262 1009.16 272.94L1009.14 272.908C1009.03 272.746 1008.86 272.634 1008.67 272.596C966.376 264.008 926.552 254.848 898.224 247.645ZM1019.63 261.177C1017.73 266.205 1019.69 273.518 1024.96 274.554C1033.12 276.157 1041.33 277.727 1049.52 279.248C1108.6 290.211 1166.88 298.56 1200.97 297.748C1201.72 297.73 1202.45 297.573 1203.14 297.288C1255.6 275.803 1292.01 239.82 1316.14 198.783C1319 193.916 1314.34 188.275 1308.93 189.878C1261.25 204.004 1170.35 227.008 1089.28 233.303C1068.27 234.934 1047.61 235.67 1027.86 235.764C1023.11 235.786 1019.87 240.921 1020.74 245.597C1021.16 247.883 1021.38 250.31 1021.28 252.787C1021.18 255.567 1020.68 258.408 1019.63 261.177ZM1319.1 26.4526C1225.56 -15.7967 1106.47 -2.50054 994.909 31.7778C883.277 66.0778 778.783 121.51 714.163 164.061V164.061C713.537 164.474 713.21 165.214 713.329 165.954V165.954L720.406 210.203V210.203C720.502 210.801 720.876 211.318 721.415 211.596V211.596C949.937 329.453 1102.16 340.791 1200.6 302.409C1299.13 263.994 1343.2 176.028 1355.98 96.7999C1360.68 67.6652 1346.09 38.6408 1319.1 26.4526Z" fill="#BEACC1"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M635.95 171.288C637.575 171.372 638.979 170.214 639.236 168.608L639.456 167.232C639.52 166.829 639.342 166.425 639 166.201V166.201C638.904 166.138 638.801 166.092 638.69 166.064C592.28 154.275 522.638 133.248 464.689 109.291C443.013 100.33 422.957 90.953 406.359 81.4879C406.351 81.4837 406.342 81.4881 406.34 81.4965V81.4965C406.339 81.5031 406.333 81.5076 406.326 81.5064C378.197 76.5692 337.62 67.5929 300.159 55.8036C296.975 54.8016 293.47 56.3891 292.723 59.6421C291.082 66.7753 291.947 73.5074 294.94 79.8722C298.842 88.1699 306.388 95.8918 316.854 103.045C337.79 117.353 370.207 129.247 407.708 138.909C480.673 157.709 572.635 167.997 635.95 171.288ZM289.303 52.2756C291.467 53.0022 292.56 55.3943 291.938 57.5903C289.655 65.6448 290.424 73.2568 293.79 80.413C294.161 81.203 294.564 81.987 294.998 82.7651C296.47 85.4066 296.311 88.7261 294.364 91.0392C294.171 91.2676 293.981 91.4956 293.792 91.7232C292.111 93.7529 289.403 94.6665 286.872 93.9336C285.959 93.6693 285.041 93.4036 284.117 93.1363C256.739 85.2152 224.622 75.9226 198.129 62.7823C172.217 49.9302 151.887 33.4958 146.492 11.2429C145.643 7.74129 148.355 4.53693 151.954 4.35312C168.649 3.50028 185.676 3.67412 202.911 4.7476C205.069 4.88199 206.969 6.14302 208.21 7.91356C213.592 15.5954 223.257 22.898 235.585 29.7269C250.391 37.9284 269.16 45.5111 289.303 52.2756V52.2756ZM215.615 14.3404C211.864 10.856 214.852 5.60665 219.949 6.09123C264.966 10.3716 311.112 20.4221 356.238 34.0271C358.835 34.81 360.556 37.1964 361.244 39.8199C362.304 43.8621 364.576 47.9511 367.858 52.0523C372.943 58.4053 380.502 64.8521 389.931 71.2937V71.2937C392.504 73.0516 390.845 77.3288 387.79 76.7152C358.762 70.8847 322.388 62.0455 289.708 51.071C269.6 44.3183 250.912 36.7642 236.201 28.6153C227.891 24.0119 220.888 19.2391 215.615 14.3404ZM465.174 108.117C507.723 125.707 556.598 141.72 597.925 153.648C604.846 155.646 608.572 147.102 602.373 143.433C540.965 107.092 458.298 66.4977 370.607 38.4884C366.383 37.1392 362.396 40.5243 364.4 44.4802C365.528 46.7079 367.018 48.9686 368.85 51.2583C373.824 57.4734 381.27 63.838 390.647 70.2444C409.399 83.0555 435.76 95.9566 465.174 108.117ZM628.988 194.273C632.333 194.863 634.526 198.054 633.989 201.409L633.339 205.475C633.02 207.471 631.766 209.198 629.968 210.12C575.595 237.987 525.632 259.757 479.76 276.228C476.499 277.398 472.889 275.72 471.884 272.404C466.082 253.27 468.235 238.251 475.653 226.594C484.053 213.394 499.285 204.374 517.763 198.618C551.924 187.978 596.859 188.6 628.988 194.273ZM636.199 187.594C635.627 191.17 632.19 193.539 628.622 192.919C596.388 187.316 551.581 186.754 517.385 197.405C515.608 197.959 513.859 198.543 512.141 199.158C511.442 199.408 510.716 199.543 509.973 199.544C457.571 199.612 385.572 192.543 336.207 175.023C311.291 166.181 292.307 154.732 284.404 140.346C280.469 133.182 279.27 125.271 281.477 116.525C283.236 109.552 287.166 102.027 293.641 93.9231C296.107 90.8361 300.787 91.0597 303.58 93.8543C307.13 97.4061 311.344 100.818 316.137 104.094C337.262 118.531 369.856 130.469 407.39 140.14C478.803 158.539 568.339 168.79 631.516 172.321C635.293 172.532 638.06 175.957 637.463 179.693L636.199 187.594ZM475.276 199.911C482.244 200.27 485.422 213.192 480.609 218.244C479.695 219.204 478.821 220.192 477.99 221.208C476.974 222.449 475.608 223.34 474.03 223.624C440.618 229.633 357.32 238.997 267.67 232.036C261.518 231.558 255.309 230.984 249.066 230.325C249.033 230.322 249.013 230.286 249.027 230.256V230.256C249.038 230.232 249.027 230.203 249.003 230.191C239.337 225.512 231.973 219.68 227.345 213.572C222.709 207.453 220.848 201.104 222.069 195.346C223.288 189.594 227.617 184.271 235.698 180.276C243.603 176.368 255.052 173.76 270.516 173.293C270.935 173.28 271.358 173.311 271.772 173.383C315.111 180.872 356.826 185.933 380.637 188.523C380.678 188.527 380.712 188.498 380.717 188.457V188.457C380.722 188.414 380.762 188.384 380.805 188.393C411.304 194.657 444.764 198.339 475.276 199.911ZM271.16 171.987C271.18 171.991 271.201 171.992 271.222 171.992C271.313 171.989 271.404 171.987 271.495 171.985C271.516 171.985 271.533 172.001 271.534 172.022V172.022C271.535 172.039 271.548 172.055 271.565 172.058C309.141 178.562 345.552 183.244 370.166 186.072C357.95 183.245 346.352 179.972 335.781 176.221C310.826 167.364 291.436 155.785 283.29 140.958C279.486 134.033 278.145 126.416 279.819 118.091C279.819 118.089 279.815 118.088 279.814 118.09V118.09C279.814 118.091 279.813 118.092 279.812 118.091C268.949 114.219 254.586 110.492 238.446 106.304C235.963 105.66 233.438 105.004 230.878 104.336C211.687 99.3281 190.518 93.5902 170.098 86.2024C144.439 76.9192 119.876 65.0014 101.903 48.5823C100.214 47.0393 97.8341 46.39 95.7082 47.2352C88.6881 50.0261 84.5901 54.3472 82.7834 59.6124C80.6653 65.7847 81.6391 73.4121 85.0457 81.6996C91.7616 98.0383 107.79 116.584 126.917 130.679C127.23 130.909 127.564 131.109 127.914 131.277C140.374 137.246 153.011 142.599 165.476 146.933C194.702 157.094 233.497 165.456 271.16 171.987ZM234.726 166.395C239.084 167.295 239.122 177.151 235.133 179.123V179.123C226.825 183.23 222.159 188.817 220.836 195.059C219.514 201.295 221.562 208.025 226.35 214.344V214.344C229.544 218.559 226.085 227.565 220.848 226.824C145.323 216.146 69.9806 195.614 35.0835 184.639C33.4561 184.127 32.1364 182.986 31.3834 181.455C17.758 153.757 9.19277 124.449 4.63452 96.1927C2.9399 85.6876 3.90031 75.2173 7.1432 65.6491C8.45047 61.792 13.176 60.7219 16.3971 63.214C40.3889 81.7762 82.3457 110.761 126.659 132.084C126.679 132.093 126.697 132.104 126.715 132.117C126.801 132.18 126.888 132.244 126.975 132.307C126.993 132.32 127.017 132.315 127.029 132.298V132.298C127.04 132.282 127.061 132.277 127.078 132.285C139.671 138.329 152.451 143.75 165.059 148.133C184.982 155.06 209.327 161.15 234.726 166.395ZM13.3181 52.6402C11.7129 55.1975 12.4326 58.5045 14.809 60.367C27.877 70.6089 47.0536 84.4943 69.367 98.5856C75.7806 102.636 86.7745 89.2223 83.8907 82.2064V82.2064C80.4258 73.7771 79.336 65.7926 81.6016 59.1902C82.8854 55.449 85.2286 52.2016 88.7459 49.5921C92.5868 46.7425 94.1385 40.9091 91.1434 37.1805C87.1209 32.1729 83.6709 26.8045 80.9029 21.0381C79.4941 18.1033 76.2303 16.4384 73.1107 17.369C61.5211 20.826 50.2382 24.9935 39.3159 29.9268C28.2722 34.915 19.4209 42.9177 13.3181 52.6402ZM474.581 225.912V225.912C474.878 225.445 474.496 224.832 473.951 224.929C450.27 229.164 402.17 235.012 344.614 235.706C342.289 235.734 340.114 237.005 339.266 239.169C337.787 242.94 336.648 247.745 336.836 252.739C337.056 258.591 339.095 264.706 344.569 269.76C345.903 270.991 347.783 271.38 349.561 271.017C394.053 261.955 435.664 252.294 463.835 244.997C466.292 244.361 468.076 242.307 468.67 239.84C469.89 234.765 471.896 230.131 474.581 225.912ZM458.624 247.646C462.975 246.54 467.148 250.17 467.364 254.654C467.632 260.215 468.686 266.189 470.616 272.601C471.641 276.006 469.893 279.718 466.529 280.871C349.297 321.048 259.529 325.912 191.656 309.498C184.777 307.835 186.172 298.019 193.221 297.39C225.754 294.488 266.502 288.116 307.559 280.497C320.474 278.101 333.422 275.58 346.161 273.004C346.353 272.965 346.551 273.008 346.711 273.121V273.121C347.028 273.346 347.468 273.262 347.686 272.94L347.708 272.908C347.817 272.746 347.986 272.634 348.177 272.596C390.473 264.008 430.295 254.848 458.624 247.646ZM337.216 261.177C339.115 266.205 337.161 273.518 331.886 274.554C323.728 276.157 315.521 277.727 307.327 279.248C248.25 290.211 189.97 298.56 155.884 297.748C155.133 297.73 154.403 297.573 153.707 297.288C101.254 275.803 64.8365 239.82 40.7138 198.783C37.853 193.916 42.5049 188.275 47.9178 189.878C95.6023 204.004 186.498 227.008 267.572 233.303C288.579 234.934 309.237 235.67 328.989 235.764C333.744 235.786 336.975 240.921 336.114 245.597C335.693 247.883 335.473 250.31 335.566 252.787C335.671 255.567 336.17 258.408 337.216 261.177ZM145.103 10.8932C144.341 7.55298 141.387 5.01919 137.974 5.31693C120.423 6.84789 103.286 9.58083 86.7121 13.6686C83.0384 14.5747 81.0441 18.5383 82.7518 21.9148C98.1015 52.2653 132.927 71.4028 170.53 85.0074C190.891 92.3737 212.011 98.0993 231.199 103.107C233.755 103.774 236.278 104.428 238.761 105.073C254.522 109.162 268.657 112.83 279.483 116.627C279.809 116.742 280.16 116.548 280.244 116.214V116.214C281.4 111.634 283.455 106.854 286.488 101.867C288.199 99.0537 286.918 95.2696 283.755 94.3545V94.3545L283.751 94.3535C256.394 86.4388 224.166 77.1148 197.564 63.9207C171.347 50.9172 150.392 34.0542 145.103 10.8932ZM37.7467 26.4526C131.286 -15.7967 250.378 -2.50054 361.94 31.7778C473.573 66.0778 578.067 121.51 642.687 164.061V164.061C643.313 164.474 643.639 165.214 643.521 165.954V165.954L636.443 210.203V210.203C636.348 210.801 635.973 211.318 635.435 211.596V211.596C406.912 329.453 254.694 340.791 156.248 302.409C57.7205 263.994 13.6517 176.028 0.870972 96.7999C-3.82892 67.6652 10.7621 38.6408 37.7467 26.4526Z" fill="#BEACC1"/>
        </svg>
      </div>

      {/* Header Bar */}
      <div className="intro-header-bar">
        <div className="intro-brand-logo">
          <span>EETNET</span> PORTAL
        </div>
        <button className="intro-skip-btn" onClick={finishIntro}>
          Skip Intro ✕
        </button>
      </div>

      {/* Slide Indicators */}
      <div className="intro-dots">
        {Array.from({ length: totalSlides }).map((_, idx) => (
          <button
            key={idx}
            className={`intro-dot ${slideIndex === idx ? 'active' : ''}`}
            onClick={() => setSlideIndex(idx)}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>

      {/* Slides Container */}
      <div className="intro-slides-container">
        {/* Slide 1: Welcome / Intro */}
        <div className={`intro-slide ${slideIndex === 0 ? 'active' : ''}`}>
          <div className="intro-slide-badge">✦ EETNET CINEMATIC PORTAL</div>
          <h1 className="intro-slide-title">
            Discover the Future of <span>Entertainment.</span>
          </h1>
          <p className="intro-slide-desc">
            Stream thousands of Anime, Hindi Dubbed Series, Asian Dramas, Movies, and Manhwa in 4K resolution with zero buffering.
          </p>

          <div className="intro-scroll-indicator" onClick={handleNext} style={{ cursor: 'pointer' }}>
            <span>Scroll Down or Swipe to Enter</span>
            <span style={{ fontSize: '1.2rem' }}>↓</span>
          </div>
        </div>

        {/* Slide 2: The Multiverse */}
        <div className={`intro-slide ${slideIndex === 1 ? 'active' : ''}`}>
          <div className="intro-slide-badge">✦ UNLIMITED MULTIVERSE</div>
          <h1 className="intro-slide-title">
            Explore 10,000+ <span>Worlds.</span>
          </h1>
          <p className="intro-slide-desc">
            Choose your preferred entertainment category below or scroll to enter the portal.
          </p>

          <div className="intro-multiverse-nodes">
            <div className="intro-node-card" onClick={() => { onNavigateSection('anime'); finishIntro(); }}>
              <div className="intro-node-icon">🐉</div>
              <div className="intro-node-title">Anime Universe</div>
              <small style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>Sub & Hindi Dub</small>
            </div>

            <div className="intro-node-card" onClick={() => { onNavigateSection('drama'); finishIntro(); }}>
              <div className="intro-node-icon">🎎</div>
              <div className="intro-node-title">Asian Dramas</div>
              <small style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>K-Drama & C-Drama</small>
            </div>

            <div className="intro-node-card" onClick={() => { onNavigateSection('movies'); finishIntro(); }}>
              <div className="intro-node-icon">🎬</div>
              <div className="intro-node-title">Movies Hub</div>
              <small style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>Bollywood & World</small>
            </div>

            <div className="intro-node-card" onClick={() => { onNavigateSection('comic'); finishIntro(); }}>
              <div className="intro-node-icon">📖</div>
              <div className="intro-node-title">Manhwa / Manga</div>
              <small style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>Full HD Reader</small>
            </div>
          </div>

          <div className="intro-scroll-indicator" onClick={handleNext} style={{ cursor: 'pointer', marginTop: '2rem' }}>
            <span>Scroll for Final Gateway</span>
            <span style={{ fontSize: '1.2rem' }}>↓</span>
          </div>
        </div>

        {/* Slide 3: Final Gateway */}
        <div className={`intro-slide ${slideIndex === 2 ? 'active' : ''}`}>
          <div className="intro-slide-badge">✦ PORTAL READY</div>
          <h1 className="intro-slide-title">
            Your Journey <span>Begins Now.</span>
          </h1>
          <p className="intro-slide-desc">
            Step into EETNET's clean, full-screen cinematic home experience.
          </p>

          <button className="intro-enter-btn" onClick={finishIntro}>
            <span>ENTER EETNET HOME</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
