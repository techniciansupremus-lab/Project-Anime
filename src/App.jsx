import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Info, Play, Star } from 'lucide-react';
import Navbar from './components/Navbar';
import SectionSlider from './components/SectionSlider';
import AnimeCard from './components/AnimeCard';
import VideoPlayer from './components/VideoPlayer';
import { api, animeCategories, recentReleases } from './mockData';
import { apiUrl, getBackendConfigError } from './runtimeConfig';

function App() {
  const [view, setView] = useState('home');
  // activeSection tracks which major section the user is browsing
  const [activeSection, setActiveSection] = useState('anime');
  const [featured, setFeatured] = useState([]);
  const [trending, setTrending] = useState([]);
  const [searchResults, setSearchResults] = useState({ anime: [], dramas: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [loadingSources, setLoadingSources] = useState(false);
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

  const detailRequestRef = useRef(0);
  const watchRequestRef = useRef(0);
  const searchRequestRef = useRef(0);
  const searchDebounceRef = useRef(null);

  // Load My List on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('anistream_watchlist');
      if (stored) {
        setMyList(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to load watchlist from localStorage', e);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    api.getFeatured().then((items) => {
      if (mounted) setFeatured(items);
    });
    api.getAnimeList().then((items) => {
      if (mounted) setTrending(items);
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

  const toggleWatchlist = (animeItem) => {
    setMyList((prev) => {
      let updated;
      const exists = prev.some((item) => item.id === animeItem.id);
      if (exists) {
        updated = prev.filter((item) => item.id !== animeItem.id);
      } else {
        const item = {
          id: animeItem.id,
          title: animeItem.title,
          coverImage: animeItem.coverImage,
          bannerImage: animeItem.bannerImage,
          rating: animeItem.rating,
          type: animeItem.type || animeItem.format,
          genres: animeItem.genres || []
        };
        updated = [item, ...prev];
      }
      try {
        localStorage.setItem('anistream_watchlist', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save watchlist to localStorage', e);
      }
      return updated;
    });
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

  // Called by SectionSlider when user picks Anime / Drama / Comic
  const handleSectionChange = (sectionId) => {
    if (sectionId === 'anime') {
      goHome();
    } else if (sectionId === 'drama') {
      goDramas();
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
        // KissKH returns { value: [...], Count: N } â€” extract the array
        const arr = Array.isArray(data) ? data : (Array.isArray(data?.value) ? data.value : []);
        setDramaSearchResults(arr);
        setDramaSearchLoading(false);
      })
      .catch(() => { setDramaSearchResults([]); setDramaSearchLoading(false); });
  };

  const handleSearch = (query) => {
    if (activeSection === 'drama') {
      setSearchQuery('');
      setView('dramas');
      handleDramaSearch(query);
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
          // KissKH returns { value: [...], Count: N } â€” extract the array
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

  const startWatching = async (anime, episodeNum = 1, keepFranchise = false) => {
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
      const result = await api.getEpisodeSources(
        episode.id,
        anime.title,
        anime.japaneseTitle,
        episodeNum
      );

      if (requestId !== watchRequestRef.current) return;

      setCurrentEpisode({
        ...episode,
        sources: result.sources || [],
        subtitles: result.subtitles || [],
        iframeSrc: result.iframeSrc || null,
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
    : trending.filter((anime) => anime.genres?.includes(activeCategory));

  const activeFeatured = featured[carouselIndex];
  const playerSource = currentEpisode?.iframeSrc
    ? currentEpisode
    : (currentEpisode?.sources?.[currentSourceIndex] || currentEpisode?.sources?.[0] || currentEpisode);

  return (
    <div className="app-container">
      <SectionSlider activeSection={activeSection} onSectionChange={handleSectionChange} />
      <Navbar onSearch={handleSearch} activeView={view} setView={setView} onHome={goHome} activeSection={activeSection} />
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
                setActiveCategory={setActiveCategory}
                onAnimeClick={handleAnimeClick}
                onStartWatching={startWatching}
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

            {view === 'movies' && (
              <CategoryGridView
                title="Movies"
                viewName="movies"
                featuredItem={moviesData.featured}
                genresData={moviesData.genres}
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
                onStartWatching={(animeNode, epNum) => startWatching(animeNode, epNum, true)}
                onAnimeSelect={(id) => {
                  setPageLoading(true);
                  api.getAnimeDetails(id).then((newDetails) => {
                    if (newDetails) {
                      startWatching(newDetails, 1, true);
                    }
                  }).finally(() => setPageLoading(false));
                }}
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
          </>
        )}
      </main>
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
      <div className="global-loader-content">
        <div className="loading-spinner"></div>
        <div className="global-loader-text">{label}</div>
      </div>
    </div>
  );
}

function InlineLoader({ label }) {
  return (
    <div className="inline-loader" role="status" aria-live="polite">
      <div className="loading-spinner"></div>
      <p>{label}</p>
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

function HomeView({
  activeFeatured,
  featured,
  activeCategory,
  filteredTrending,
  setActiveCategory,
  onAnimeClick,
  onStartWatching
}) {
  const continueWatching = featured.filter((anime) => anime.id !== activeFeatured?.id).slice(0, 5);
  const popularNow = filteredTrending.slice(0, 10);
  const genrePicks = filteredTrending.slice(6, 16);

  return (
    <div className="netflix-home">
      {activeFeatured && (
        <div
          className="hero netflix-hero"
          style={{ backgroundImage: `url(${activeFeatured.bannerImage})` }}
        >
          <div className="hero-overlay"></div>
          <div className="container hero-shell">
            <div className="hero-content">
              <div className="netflix-series-mark">
                <span>N</span>
                <strong>Series</strong>
              </div>
              <h1 className="hero-title">{activeFeatured.title}</h1>

              <div className="hero-meta">
                <span className="top-ten-badge">Top 10</span>
                <span className="hero-rank">#1 in TV Shows Today</span>
                <span>
                  <Star size={16} fill="var(--accent-primary)" style={{ color: 'var(--accent-primary)' }} />
                  {activeFeatured.rating}
                </span>
                <span>{activeFeatured.type}</span>
                <span>{activeFeatured.duration}</span>
                <span>{activeFeatured.status}</span>
              </div>

              <p className="hero-desc">{activeFeatured.description}</p>

              <div className="btn-group">
                <button className="btn btn-primary" onClick={() => onStartWatching(activeFeatured, 1)}>
                  <Play size={22} fill="currentColor" /> Play
                </button>
                <button className="btn btn-secondary" onClick={() => onAnimeClick(activeFeatured.id)}>
                  <Info size={22} /> More Info
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="netflix-rows">
        {continueWatching.length > 0 && (
          <NetflixRow
            title="Continue Watching"
            items={continueWatching}
            onAnimeClick={onAnimeClick}
            progress
          />
        )}

        <NetflixRow
          title="Popular on EetNet"
          items={popularNow}
          onAnimeClick={onAnimeClick}
        />

        <div className="category-row netflix-category-row">
          <div className="section-header">
            <h2 className="section-title">Browse by Genre</h2>
          </div>
          <div className="categories-container">
            <button
              className={`category-pill ${activeCategory === 'All' ? 'active' : ''}`}
              onClick={() => setActiveCategory('All')}
            >
              All
            </button>
            {animeCategories.map((cat) => (
              <button
                key={cat}
                className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <NetflixRow
          title={activeCategory === 'All' ? 'Trending Now' : `${activeCategory} Picks`}
          items={filteredTrending}
          onAnimeClick={onAnimeClick}
          ranked
        />

        {genrePicks.length > 0 && (
          <NetflixRow
            title="Because You Watch Anime"
            items={genrePicks}
            onAnimeClick={onAnimeClick}
          />
        )}

        {recentReleases.length > 0 && (
          <div className="anime-row">
            <div className="section-header">
              <h2 className="section-title">Recent Releases</h2>
            </div>
            <div className="recent-grid">
              {recentReleases.map((rel) => (
                <div
                  key={`${rel.id}-${rel.episodeNumber}`}
                  className="recent-card"
                  onClick={() => onAnimeClick(rel.id)}
                >
                  <div className="recent-img-wrapper">
                    <img src={rel.coverImage} alt={rel.title} className="recent-img" />
                  </div>
                  <div className="recent-info">
                    <h4 className="recent-title">{rel.title}</h4>
                    <div className="recent-ep">Episode {rel.episodeNumber}</div>
                    <div className="recent-meta">
                      <span>{rel.type}</span>
                      <span>-</span>
                      <span>{rel.timeAgo}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NetflixRow({ title, items, onAnimeClick, progress = false, ranked = false }) {
  if (!items || items.length === 0) return null;

  return (
    <section className="netflix-row">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
      </div>
      <div className={`netflix-slider ${ranked ? 'ranked-row' : ''}`}>
        {items.map((anime, index) => (
          <NetflixTile
            key={`${title}-${anime.id}`}
            anime={anime}
            rank={ranked ? index + 1 : null}
            progress={progress ? ((index + 2) * 13) % 88 : null}
            onClick={() => onAnimeClick(anime.id)}
          />
        ))}
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
        {progress !== null && (
          <span className="watch-progress">
            <span style={{ width: `${progress}%` }}></span>
          </span>
        )}
      </span>
      <span className="tile-info">
        <strong>{anime.title}</strong>
        <small>{anime.type} &middot; {anime.rating}</small>
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
            <div className="inline-loader" role="status">
              <div className="loading-spinner"></div>
              <p>Loading episodes...</p>
            </div>
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
  onAnimeSelect
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
      <div className="loading-spinner"></div>
      <p style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>
        Resolving streaming server links...
      </p>
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
              onAnimeClick={onAnimeClick}
            />
          );
        })}
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
          <div className="manhwa-card-read">ðŸ“– Read</div>
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
          <span className="manhwa-search-icon">ðŸ”</span>
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
            <div className="manhwa-loading"><div className="loading-spinner" /></div>
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
          <div className="loading-spinner" />
        </div>
      ) : !data ? (
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.2rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', textAlign: 'center', maxWidth: '640px' }}>
            âš ï¸ {error || 'Could not load manhwa catalog.'}
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>ðŸ”„ Retry</button>
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
                <div className="manhwa-hero-badge">ðŸ“š Featured Manhwa</div>
                <h1 className="manhwa-hero-title">{data.popular[0].title}</h1>
                <button
                  className="btn btn-primary manhwa-hero-btn"
                  onClick={() => onSeriesClick(data.popular[0])}
                >
                  ðŸ“– Start Reading
                </button>
              </div>
            </div>
          )}

          <div className="manhwa-rows-container">
            <ManhwaRow title="ðŸ”¥ Popular Now" series={data.popular} onSeriesClick={onSeriesClick} />
            <ManhwaRow title="ðŸ†• Latest Updates" series={data.latest} onSeriesClick={onSeriesClick} />
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
                  ðŸ“– Read Chapter 1
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
            <div className="manhwa-loading"><div className="loading-spinner" /></div>
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
                          <div className="manhwa-chapter-thumb-placeholder">ðŸ“–</div>
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
              Next â†’
            </button>
          )}
        </div>
      </div>

      {/* Chapter images */}
      <div className="manhwa-reader-pages">
        {isLoading ? (
          <div className="manhwa-loading" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div>
              <div className="loading-spinner" style={{ margin: '0 auto' }} />
              <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', textAlign: 'center' }}>Loading pages...</p>
            </div>
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DRAMA COMPONENTS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function DramaCard({ drama, onClick }) {
  const [imgErr, setImgErr] = React.useState(false);
  return (
    <button className="drama-card" onClick={onClick}>
      <div className="drama-card-art">
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
        <div className="drama-card-overlay">
          <div className="drama-card-play">â–¶</div>
        </div>
        {drama.episodesCount && (
          <span className="drama-card-ep-badge">{drama.episodesCount} Ep</span>
        )}
      </div>
      <div className="drama-card-info">
        <span className="drama-card-title">{drama.title}</span>
      </div>
    </button>
  );
}

function DramaRow({ title, dramas, onDramaClick }) {
  if (!dramas || dramas.length === 0) return null;
  return (
    <section className="drama-row">
      <h2 className="drama-row-title">{title}</h2>
      <div className="drama-row-slider">
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
    <div className="drama-home">
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
        <div className="container drama-search-results">
          <h2 className="drama-row-title">Results for "{searchQuery}"</h2>
          {searchLoading ? (
            <div className="drama-loading"><div className="loading-spinner" /></div>
          ) : searchResults.length ? (
            <div className="drama-grid">
              {searchResults.map(d => <DramaCard key={d.id} drama={d} onClick={() => onDramaClick(d)} />)}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem 0' }}>No dramas found.</p>
          )}
        </div>
      ) : isLoading ? (
        <div className="drama-loading" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="loading-spinner" />
        </div>
      ) : !data || !Array.isArray(data.korean) ? (
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.2rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', textAlign: 'center', maxWidth: '640px' }}>
            âš ï¸ {error || 'Could not load drama catalog. Check that the backend is online.'}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            ðŸ”„ Retry
          </button>
        </div>
      ) : (
        <>
          {/* Featured Banner */}
          {featured && (
            <div className="drama-hero" style={{ backgroundImage: `url(${featured.thumbnail})` }}>
              <div className="drama-hero-overlay" />
              <div className="drama-hero-content">
                <div className="drama-hero-badge">ðŸŽ¬ Featured Drama</div>
                <h1 className="drama-hero-title">{featured.title}</h1>
                <button className="btn btn-primary drama-hero-btn" onClick={() => onDramaClick(featured)}>
                  <Play size={20} fill="currentColor" /> Watch Now
                </button>
              </div>
            </div>
          )}

          <div className="drama-rows-container">
            <DramaRow title="Featured" dramas={data?.show || []} onDramaClick={onDramaClick} />
            <DramaRow title="ðŸ‡°ðŸ‡· Most Popular Korean Dramas" dramas={data?.korean || []} onDramaClick={onDramaClick} />
            <DramaRow title="ðŸ‡¨ðŸ‡³ Most Popular Chinese Dramas" dramas={data?.chinese || []} onDramaClick={onDramaClick} />
            <DramaRow title="â­ Top Rated" dramas={data?.topRating || []} onDramaClick={onDramaClick} />
            <DramaRow title="ðŸ†• Recently Updated" dramas={data?.lastUpdate || []} onDramaClick={onDramaClick} />
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
            <div className="drama-loading"><div className="loading-spinner" /></div>
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
            <div className="loading-spinner large" />
            <p>Loading stream for Episode {episode.number}...</p>
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
