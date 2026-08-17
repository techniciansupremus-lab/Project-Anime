import React, { useState, useEffect } from 'react';
import { Play, Info, Plus, Check, Star, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { useBookmarkStore } from '../store/useStore';

export default function HeroBanner({ items = [], onPlay, onOpenDetail }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const { isBookmarked, toggleBookmark } = useBookmarkStore();

  const currentItem = items[currentIndex] || items[0] || null;

  // Auto-rotate hero items every 7 seconds when not hovered
  useEffect(() => {
    if (!items.length || isHovered) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [items.length, isHovered]);

  if (!currentItem) {
    return (
      <div className="relative w-full h-[70vh] min-h-[500px] max-h-[750px] bg-gradient-to-b from-[#151821] to-[#08090C] animate-pulse flex items-center justify-center">
        <div className="text-center text-slate-500 font-display text-lg">
          Loading Spotlight...
        </div>
      </div>
    );
  }

  const bookmarked = isBookmarked(currentItem.id || currentItem.slug);

  const backdrop = currentItem.bannerImage || currentItem.backdrop || currentItem.banner || currentItem.coverImage || currentItem.cover || '';
  const title = currentItem.title?.english || currentItem.title?.romaji || currentItem.title?.userPreferred || currentItem.title || 'Featured Title';
  const description = currentItem.description || currentItem.desc || 'Stream high-definition movies, anime episodes, and dramas on EetNet with multiple audio tracks.';
  const rating = currentItem.rating || currentItem.score || (currentItem.averageScore ? (currentItem.averageScore / 10).toFixed(1) : '8.8');
  const genres = currentItem.genres || currentItem.categories || ['Trending', 'Spotlight'];

  return (
    <div
      className="relative w-full h-[75vh] min-h-[550px] max-h-[820px] overflow-hidden group select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Image with Cinematic Multi-Layer Gradients */}
      <div className="absolute inset-0 z-0">
        <img
          src={backdrop}
          alt={title}
          className="w-full h-full object-cover object-center scale-105 group-hover:scale-100 transition-transform duration-1000 ease-out"
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1920&auto=format&fit=crop';
          }}
        />
        {/* Layer 1: Left Dark Vignette for Text Contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#08090C] via-[#08090C]/80 to-transparent" />
        {/* Layer 2: Bottom Fade to Page Content */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#08090C] via-[#08090C]/40 to-transparent" />
        {/* Layer 3: Top Ambient Tint */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#08090C]/60 via-transparent to-transparent" />
      </div>

      {/* Hero Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-16 sm:pb-20">
        <div className="max-w-2xl space-y-4">
          {/* Tags & Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/25 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Spotlight #{currentIndex + 1}
            </span>
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {rating}
            </span>
            <span className="badge-hd">HD 1080P</span>
            {currentItem.isHindiDubbed && <span className="badge-hindi">Hindi Dub</span>}
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black font-display tracking-tight text-white drop-shadow-lg line-clamp-2">
            {title}
          </h1>

          {/* Genre Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-300">
            {genres.slice(0, 4).map((g, idx) => (
              <span key={idx} className="bg-white/10 px-2 py-0.5 rounded-md backdrop-blur-sm border border-white/5">
                {typeof g === 'string' ? g : g.name || 'Genre'}
              </span>
            ))}
          </div>

          {/* Synopsis */}
          <p className="text-sm sm:text-base text-slate-300/90 line-clamp-3 leading-relaxed drop-shadow">
            {description.replace(/<[^>]*>?/gm, '')}
          </p>

          {/* Interactive CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {/* Primary Watch Button */}
            <button
              onClick={() => onPlay(currentItem)}
              className="btn-primary text-sm sm:text-base px-6 py-3 shadow-lg shadow-indigo-600/30"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>Watch Now</span>
            </button>

            {/* More Details Button */}
            <button
              onClick={() => onOpenDetail(currentItem)}
              className="btn-secondary text-sm sm:text-base px-5 py-3"
            >
              <Info className="w-5 h-5 text-slate-300" />
              <span>Details</span>
            </button>

            {/* Add to Watchlist Button */}
            <button
              onClick={() => toggleBookmark(currentItem)}
              className={`p-3 rounded-full border transition-all ${
                bookmarked
                  ? 'bg-indigo-600/30 border-indigo-400 text-indigo-300'
                  : 'bg-white/10 border-white/15 text-slate-300 hover:bg-white/20'
              }`}
              title={bookmarked ? 'Remove from My List' : 'Add to My List'}
            >
              {bookmarked ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Hero Carousel Navigation Dots */}
      {items.length > 1 && (
        <div className="absolute bottom-6 right-6 sm:right-12 z-20 flex items-center gap-2">
          {items.slice(0, 6).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`transition-all duration-300 rounded-full ${
                currentIndex === idx
                  ? 'w-7 h-2 bg-indigo-500 shadow-md shadow-indigo-500/50'
                  : 'w-2 h-2 bg-white/30 hover:bg-white/60'
              }`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
