/**
 * ARCHIVE: NetMirror & Movies Frontend React Components
 * Preserved on: 2026-08-06
 * Location: archive_movies_netmirror/app_netmirror_movies_components.jsx
 */

import React from 'react';
import { Sparkles, Flame, Tv, Zap, Star, Trophy } from 'lucide-react';

export function MovieCard({ movie, onClick }) {
  return (
    <div
      className="netflix-card"
      onClick={onClick}
      style={{ cursor: 'pointer', position: 'relative', borderRadius: '6px', overflow: 'hidden' }}
    >
      <img
        src={movie.coverImage || movie.bannerImage}
        alt={movie.title}
        style={{ width: '100%', height: '280px', objectFit: 'cover' }}
      />
      <div className="netflix-card-info" style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.8)' }}>
        <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#fff' }}>{movie.title}</h4>
        {movie.year && <span style={{ fontSize: '0.75rem', color: '#888' }}>{movie.year}</span>}
      </div>
    </div>
  );
}

export function MovieRow({ title, icon, movies, onMovieClick }) {
  return (
    <div className="movie-row" style={{ margin: '2rem 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        {icon}
        <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>{title}</h3>
      </div>
      <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
        {movies.map(m => (
          <div key={m.id} style={{ minWidth: '180px', flexShrink: 0 }}>
            <MovieCard movie={m} onClick={() => onMovieClick(m)} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MovieHomeView({ data, isLoading, activeCategory, setActiveCategory, searchQuery, searchResults, searchLoading, onSearch, onMovieClick }) {
  const nmTrending = data?.netmirror?.trending || [];
  const nmNetflix  = data?.netmirror?.netflix  || [];
  const nmPrime    = data?.netmirror?.prime    || [];
  const nmHotstar  = data?.netmirror?.hotstar  || [];

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      <h2>Movies & NetMirror Catalog (Archived Component)</h2>
      {nmTrending.length > 0 && <MovieRow title="Trending on NetMirror" icon={<Flame size={20} />} movies={nmTrending} onMovieClick={onMovieClick} />}
    </div>
  );
}

export function MovieWatchView({ movie, onBack }) {
  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      <h2>Watch View (Archived Component)</h2>
      <button onClick={onBack}>Back</button>
    </div>
  );
}
