import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Info, Play, Star, X, ArrowLeft, Flame, Trophy, Sparkles, Compass, History, Tv, Globe } from 'lucide-react';
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
      ['home', 'dramas', 'manhwa', 'tv-shows', 'movies', 'new-popular', 'my-list'].includes(view)
    );

    if (shouldReplace) {
      window.history.replaceState(stateObj, '');
    } else {
      window.history.pushState(stateObj, '');
    }
  }, [view, selectedAnime?.id, currentEpisode?.number, selectedDrama?.id, dramaEpisode?.id, selectedManhwa?.slug, currentManhwaChapter?.slug]);

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

    api.getFeatured().then((items) => {
      if (mounted) setFeatured(items);
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
    if (featured.length === 0 || view !== 'home') return undefined;

    const timer = window.setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % featured.length);
    }, 7000);

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

  // Called by SectionSlider when user picks Anime / Drama / Comic / Movies
  const handleSectionChange = (sectionId) => {
    if (sectionId === 'anime') {
      goHome();
    } else if (sectionId === 'drama') {
      goDramas();
    } else if (sectionId === 'movies') {
      goMovies();
    } else if (sectionId === 'comic') {
      goManhwa();
    }
  };

  const handleManhwaClick = async (series) => {
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
          setSearchResults({
            anime: Array.isArray(animeItems) ? animeItems : [],
            dramas: Array.isArray(dramaItems) ? dramaItems : []
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
                hindiAnime={trending.filter(a => a.hasHindiDub || hasHindiDubAvailable(a.title, a.japaneseTitle))}
                onAnimeClick={handleAnimeClick}
                onStartWatching={startWatching}
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
              <div className="anime-grid">
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

function HomeView({
  activeFeatured,
  featured,
  activeCategory,
  filteredTrending,
  top10Famous,
  setActiveCategory,
  onAnimeClick,
  onStartWatching,
  watchHistory = [],
  onDramaClick,
  onManhwaClick
}) {
  // Build Continue Watching from real user watch history
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

  const popularNow = filteredTrending.slice(0, 10);
  const hindiAnimeRow = filteredTrending.filter(a => a.hasHindiDub || hasHindiDubAvailable(a.title, a.japaneseTitle));
  const spotlightItem = filteredTrending.find(a => a.id !== activeFeatured?.id) || filteredTrending[0];
  const bentoItems = filteredTrending.filter(a => a.id !== activeFeatured?.id && a.id !== spotlightItem?.id).slice(0, 4);
  const classics = filteredTrending.filter(a => a.id !== activeFeatured?.id && a.id !== spotlightItem?.id && !bentoItems.some(b => b.id === a.id)).slice(0, 5);

  return (
    <div className="netflix-home">
      {/* ── Cinematic Hero ── */}
      {activeFeatured && (
        <div
          className="hero netflix-hero"
          style={{ backgroundImage: `url(${activeFeatured.bannerImage})` }}
        >
          <div className="hero-overlay" />
          <div className="hero-scanline" />
          <div className="container hero-shell">
            <div className="hero-content">
              <div className="hero-eyebrow">
                <span className="hero-eyebrow-badge">N</span>
                <span className="hero-eyebrow-text">Series</span>
                <span className="hero-eyebrow-dot">•</span>
                <span className="hero-live-tag">Live</span>
              </div>

              <h1 className="hero-title">{activeFeatured.title}</h1>

              <div className="hero-genre-pills">
                {(activeFeatured.genres || []).slice(0, 4).map(g => (
                  <span key={g} className="hero-genre-pill">{g}</span>
                ))}
              </div>

              <div className="hero-meta">
                <span className="top-ten-badge">Top 10</span>
                <span className="hero-rank">#1 in TV Shows Today</span>
                <span className="hero-star">
                  <Star size={14} fill="var(--accent-primary)" style={{ color: 'var(--accent-primary)' }} />
                  {activeFeatured.rating}
                </span>
                <span className="hero-meta-tag">{activeFeatured.type}</span>
                <span className="hero-meta-tag">{activeFeatured.status}</span>
              </div>

              <p className="hero-desc">{activeFeatured.description}</p>

              <div className="btn-group">
                <button className="btn btn-primary hero-btn-play" onClick={() => onStartWatching(activeFeatured, 1)}>
                  <Play size={20} fill="currentColor" /> Play Now
                </button>
                <button className="btn btn-secondary hero-btn-info" onClick={() => onAnimeClick(activeFeatured.id)}>
                  <Info size={20} /> More Info
                </button>
              </div>
            </div>
          </div>

          {/* Carousel dots */}
          {featured.length > 1 && (
            <div className="hero-carousel-dots">
              {featured.slice(0, 5).map((_, i) => (
                <span key={i} className={`hero-dot ${activeFeatured?.id === featured[i]?.id ? 'active' : ''}`} />
              ))}
            </div>
          )}
        </div>
      )}

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

        {/* Popular */}
        <NetflixRow
          title="Popular on EetNet"
          icon={<Flame className="hv-icon" size={20} style={{ color: '#f97316' }} />}
          items={popularNow}
          onAnimeClick={(a) => onAnimeClick(a.id ?? a)}
        />

        {/* Genre Filter */}
        <div className="category-row netflix-category-row">
          <div className="hv-section-header">
            <h2 className="hv-section-title">
              <Compass className="hv-icon" size={20} style={{ color: '#a855f7' }} /> Browse by Genre
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

        {/* Top 10 */}
        <Top10Row
          title="Top 10 Famous Anime"
          items={top10Famous && top10Famous.length > 0 ? top10Famous : filteredTrending}
          onAnimeClick={onAnimeClick}
        />

        {/* Bento Grid */}
        {spotlightItem && (
          <div className="bento-section">
            <div className="hv-section-header">
              <h2 className="hv-section-title">
                <Sparkles className="hv-icon" size={20} style={{ color: '#eab308' }} /> Spotlight &amp; Recommendations
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
                    <span>Top Picks For You</span>
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
  if (!items || items.length === 0) return null;

  return (
    <section className="hv-section netflix-row">
      <div className="hv-section-header">
        <h2 className="hv-section-title">
          {icon && <span className="hv-title-accent">{icon}</span>} {title}
        </h2>
        <span className="hv-section-line" />
      </div>
      <div className={`netflix-slider ${ranked ? 'ranked-row' : ''}`}>
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

function HindiView({ hindiAnime = [], onAnimeClick, onStartWatching }) {
  const featuredItem = hindiAnime[0];

  if (!hindiAnime || hindiAnime.length === 0) {
    return (
      <div className="container" style={{ marginTop: '6rem', minHeight: '60vh', textAlign: 'center' }}>
        <Globe size={48} style={{ color: '#ff4757', marginBottom: '1rem' }} />
        <h2 className="section-title">Hindi Dubbed Anime</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          No Hindi dubbed titles available right now. Check back soon!
        </p>
      </div>
    );
  }

  const actionHindi = hindiAnime.filter(a => a.genres?.includes('Action'));
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
            title="Action Anime (Hindi Dubbed)"
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
