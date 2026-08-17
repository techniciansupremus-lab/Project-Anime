import React, { useState, useEffect } from 'react';
import { Search, X, Film, Tv, BookOpen, Compass, Play, Sparkles } from 'lucide-react';
import { animeApi, dramaApi, comicsApi, moviesApi } from '../config/api';
import MediaCard from './MediaCard';

export default function SearchModal({ onClose, onPlay, onOpenDetail }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all'); // 'all' | 'anime' | 'drama' | 'comics' | 'movies'
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  // Popular search suggestions
  const suggestions = [
    'Solo Leveling',
    'Demon Slayer',
    'Vincenzo',
    'Queen of Tears',
    'Omniscient Reader',
    'Jawan',
    'Animal',
    'Naruto Hindi'
  ];

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        let combined = [];

        // Search Anime via AniList GraphQL
        if (category === 'all' || category === 'anime') {
          try {
            const anilistRes = await animeApi.postAniList(`
              query ($search: String) {
                Page(page: 1, perPage: 8) {
                  media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
                    id
                    title { english romaji userPreferred }
                    coverImage { large }
                    bannerImage
                    averageScore
                    type
                    genres
                  }
                }
              }
            `, { search: query });
            if (anilistRes?.Page?.media) {
              combined.push(...anilistRes.Page.media.map(m => ({ ...m, mediaType: 'anime' })));
            }
          } catch (e) {}
        }

        // Search Dramas
        if (category === 'all' || category === 'drama') {
          try {
            const dramaRes = await dramaApi.search(query);
            if (Array.isArray(dramaRes)) {
              combined.push(...dramaRes.slice(0, 8).map(d => ({
                id: d.dramaId || d.id,
                dramaId: d.dramaId || d.id,
                title: d.title,
                cover: d.thumbnail || d.poster,
                mediaType: 'drama',
              })));
            }
          } catch (e) {}
        }

        // Search Comics & Manga
        if (category === 'all' || category === 'comics') {
          try {
            const comicsRes = await comicsApi.search(query);
            if (Array.isArray(comicsRes)) {
              combined.push(...comicsRes.slice(0, 8).map(c => ({
                id: c.slug || c.id,
                slug: c.slug || c.id,
                title: c.title,
                cover: c.cover || c.thumbnail,
                mediaType: 'manga',
              })));
            }
          } catch (e) {}
        }

        // Search Movies
        if (category === 'all' || category === 'movies') {
          try {
            const movieRes = await moviesApi.getCatalog(1, 8, '', query);
            if (movieRes?.items) {
              combined.push(...movieRes.items.map(m => ({
                id: m.slug || m.title,
                slug: m.slug,
                title: m.title,
                cover: m.poster || m.thumbnail,
                mediaType: 'movie',
              })));
            }
          } catch (e) {}
        }

        setResults(combined);
      } catch (err) {
        console.warn('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, category]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/85 backdrop-blur-2xl animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-[#0F1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/[0.02]">
          <Search className="w-5 h-5 text-indigo-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search thousands of Anime, Dramas, Comics & Movies..."
            autoFocus
            className="flex-1 bg-transparent text-white text-base sm:text-lg focus:outline-none placeholder:text-slate-500 font-sans"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-full text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-semibold px-2.5"
          >
            ESC
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-black/30 border-b border-white/5 overflow-x-auto">
          {[
            { id: 'all', label: 'All Media' },
            { id: 'anime', label: 'Anime' },
            { id: 'drama', label: 'Dramas' },
            { id: 'comics', label: 'Comics & Manga' },
            { id: 'movies', label: 'Movies & OTT' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategory(tab.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                category === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Suggestions (if empty) */}
        {!query && (
          <div className="p-6 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Trending Searches
            </h3>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setQuery(s)}
                  className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-indigo-600/20 hover:border-indigo-500/40 border border-white/[0.08] text-xs font-medium text-slate-300 hover:text-white transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Results Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {results.map((item, idx) => (
                <MediaCard
                  key={item.id || idx}
                  item={item}
                  onPlay={(it) => {
                    onClose();
                    onPlay(it);
                  }}
                  onOpenDetail={(it) => {
                    onClose();
                    onOpenDetail(it);
                  }}
                />
              ))}
            </div>
          ) : query ? (
            <div className="text-center py-16 text-slate-500">
              No results found for "{query}".
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
