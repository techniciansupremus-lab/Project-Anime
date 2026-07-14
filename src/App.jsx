import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Info, Play, Star } from 'lucide-react';
import Navbar from './components/Navbar';
import AnimeCard from './components/AnimeCard';
import VideoPlayer from './components/VideoPlayer';
import { api, animeCategories, recentReleases } from './mockData';

function App() {
  const [view, setView] = useState('home');
  const [featured, setFeatured] = useState([]);
  const [trending, setTrending] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [loadingSources, setLoadingSources] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const detailRequestRef = useRef(0);
  const watchRequestRef = useRef(0);
  const searchRequestRef = useRef(0);
  const searchDebounceRef = useRef(null);

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

  const resetSearch = () => {
    searchRequestRef.current += 1;
    setSearchQuery('');
    setSearchResults([]);
  };

  const goHome = () => {
    resetSearch();
    detailRequestRef.current += 1;
    watchRequestRef.current += 1;
    setView('home');
    setSelectedAnime(null);
    setCurrentEpisode(null);
    setLoadingSources(false);
    window.scrollTo(0, 0);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);

    if (query.trim() === '') {
      setSearchResults([]);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      return;
    }

    // Debounce: wait 400ms after user stops typing before querying AniList
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      const requestId = searchRequestRef.current + 1;
      searchRequestRef.current = requestId;
      api.searchAnime(query).then((items) => {
        if (requestId === searchRequestRef.current) {
          setSearchResults(items);
        }
      });
    }, 400);
  };

  const handleAnimeClick = (id) => {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    watchRequestRef.current += 1;
    resetSearch();
    setLoadingSources(false);

    api.getAnimeDetails(id).then((details) => {
      if (requestId !== detailRequestRef.current || !details) return;
      setSelectedAnime(details);
      setCurrentEpisode(null);
      setView('detail');
      window.scrollTo(0, 0);
    });
  };

  const startWatching = async (anime, episodeNum = 1) => {
    const requestId = watchRequestRef.current + 1;
    watchRequestRef.current = requestId;
    detailRequestRef.current += 1;
    resetSearch();

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
      <Navbar onSearch={handleSearch} activeView={view} setView={setView} onHome={goHome} />

      <main className="main-content">
        {searchQuery.trim() !== '' ? (
          <SearchResults
            query={searchQuery}
            results={searchResults}
            onAnimeClick={handleAnimeClick}
          />
        ) : (
          <>
            {view === 'home' && (
              <HomeView
                activeFeatured={activeFeatured}
                activeCategory={activeCategory}
                filteredTrending={filteredTrending}
                setActiveCategory={setActiveCategory}
                onAnimeClick={handleAnimeClick}
                onStartWatching={startWatching}
              />
            )}

            {view === 'detail' && selectedAnime && (
              <DetailView
                anime={selectedAnime}
                onBackHome={goHome}
                onStartWatching={startWatching}
              />
            )}

            {view === 'watch' && selectedAnime && currentEpisode && (
              <WatchView
                anime={selectedAnime}
                episode={currentEpisode}
                source={playerSource}
                currentSourceIndex={currentSourceIndex}
                loadingSources={loadingSources}
                setCurrentSourceIndex={setCurrentSourceIndex}
                onStartWatching={startWatching}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SearchResults({ query, results, onAnimeClick }) {
  return (
    <div className="container" style={{ marginTop: '2rem' }}>
      <div className="section-header">
        <h2 className="section-title">Search Results for "{query}"</h2>
      </div>
      {results.length > 0 ? (
        <div className="anime-grid">
          {results.map((anime) => (
            <AnimeCard
              key={anime.id}
              anime={anime}
              onClick={() => onAnimeClick(anime.id)}
            />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
          <AlertCircle size={48} style={{ marginBottom: '1rem', color: 'var(--text-muted)' }} />
          <h3>No anime found matching your query</h3>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Try checking your spelling or trying different keywords.
          </p>
        </div>
      )}
    </div>
  );
}

function HomeView({
  activeFeatured,
  activeCategory,
  filteredTrending,
  setActiveCategory,
  onAnimeClick,
  onStartWatching
}) {
  return (
    <>
      {activeFeatured && (
        <div
          className="hero"
          style={{ backgroundImage: `url(${activeFeatured.bannerImage})` }}
        >
          <div className="hero-overlay"></div>
          <div className="container" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
            <div className="hero-content">
              <div className="badge">Featured Series</div>
              <h1 className="hero-title">{activeFeatured.title}</h1>

              <div className="hero-meta">
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
                  <Play size={18} fill="currentColor" /> Watch Now
                </button>
                <button className="btn btn-secondary" onClick={() => onAnimeClick(activeFeatured.id)}>
                  <Info size={18} /> View Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container">
        <div className="category-row">
          <div className="section-header">
            <h2 className="section-title">Explore Genres</h2>
          </div>
          <div className="categories-container">
            <div
              className={`category-pill ${activeCategory === 'All' ? 'active' : ''}`}
              onClick={() => setActiveCategory('All')}
            >
              All
            </div>
            {animeCategories.map((cat) => (
              <div
                key={cat}
                className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </div>
            ))}
          </div>
        </div>

        <div className="anime-row">
          <div className="section-header">
            <h2 className="section-title">Trending Anime</h2>
          </div>
          <div className="anime-grid">
            {filteredTrending.map((anime) => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                onClick={() => onAnimeClick(anime.id)}
              />
            ))}
          </div>
        </div>

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
    </>
  );
}

function DetailView({ anime, onBackHome, onStartWatching }) {
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
                * {anime.rating}
              </div>
              <div className="detail-tag">{anime.type}</div>
              <div className="detail-tag">{anime.status}</div>
              {anime.genres?.map((genre) => (
                <div key={genre} className="detail-tag">{genre}</div>
              ))}
            </div>

            <p className="detail-synopsis">{anime.description}</p>

            <div className="btn-group">
              <button className="btn btn-primary" onClick={() => onStartWatching(anime, 1)}>
                <Play size={18} fill="currentColor" /> Play Episode 1
              </button>
              <button className="btn btn-secondary" onClick={onBackHome}>
                Back to Home
              </button>
            </div>
          </div>
        </div>

        <div className="episodes-section">
          <h2 className="section-title">Episodes</h2>
          <div className="episodes-grid">
            {anime.episodes?.map((ep) => (
              <div
                key={ep.number}
                className="episode-card"
                onClick={() => onStartWatching(anime, ep.number)}
              >
                <div className="ep-thumb-wrapper">
                  <img src={ep.thumbnail || anime.coverImage} alt={ep.title} className="ep-thumb" />
                  <div className="ep-play-btn">
                    <Play size={20} fill="white" />
                  </div>
                  <div className="ep-num-badge">Episode {ep.number}</div>
                </div>
                <div className="ep-info">
                  <div className="ep-title">{ep.title}</div>
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
  currentSourceIndex,
  loadingSources,
  setCurrentSourceIndex,
  onStartWatching
}) {
  const hasProviderProblem = episode.provider === 'fallback' || episode.provider === 'error';

  return (
    <div className="container" style={{ marginTop: '2rem' }}>
      <div className="watch-container">
        <div className="player-area">
          {loadingSources ? (
            <LoadingPlayer />
          ) : (
            <VideoPlayer
              source={source}
              poster={episode.thumbnail || anime.bannerImage}
              subtitles={episode?.subtitles}
            />
          )}

          <div className="watch-meta">
            {hasProviderProblem && (
              <ProviderWarning error={episode.error} />
            )}

            <div className="watch-ep-info">
              Episode {episode.number}: {episode.title}
            </div>
            <h1 className="watch-meta-title">{anime.title}</h1>

            {episode.sources && episode.sources.length > 1 && (
              <div className="server-selector">
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

            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
              <p className="watch-meta-desc">{anime.description}</p>
            </div>
          </div>
        </div>

        <div className="sidebar-area">
          <div className="sidebar-panel">
            <h3 className="sidebar-title">Episodes</h3>
            <div className="sidebar-list">
              {anime.episodes?.map((ep) => (
                <div
                  key={ep.number}
                  className={`sidebar-item ${episode.number === ep.number ? 'active' : ''}`}
                  onClick={() => onStartWatching(anime, ep.number)}
                >
                  <div className="sidebar-thumb">
                    <img src={ep.thumbnail || anime.coverImage} alt={ep.title} />
                  </div>
                  <div className="sidebar-info">
                    <div className="sidebar-ep-num">Episode {ep.number}</div>
                    <div className="sidebar-ep-title" title={ep.title}>{ep.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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
        {error || 'The streaming provider did not return a playable source.'} Try another episode or restart the backend server.
      </span>
    </div>
  );
}

export default App;
