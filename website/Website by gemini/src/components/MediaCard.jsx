import React from 'react';
import { Play, Plus, Check, Star, BookOpen, Clock } from 'lucide-react';
import { useBookmarkStore, useWatchProgressStore } from '../store/useStore';

export default function MediaCard({ item, onPlay, onOpenDetail, aspectRatio = 'poster', showProgress = true }) {
  const { isBookmarked, toggleBookmark } = useBookmarkStore();
  const progressItem = useWatchProgressStore((state) => state.getItemProgress(item?.id || item?.slug));

  if (!item) return null;

  const id = item.id || item.slug || item.movieplexId || item.animerulz_id;
  const bookmarked = isBookmarked(id);

  const title = item.title?.english || item.title?.romaji || item.title?.userPreferred || item.title || 'Untitled';
  const cover = item.coverImage?.large || item.coverImage || item.cover || item.thumbnail || item.poster || item.default_thumbnail || '';
  const rating = item.rating || item.score || (item.averageScore ? (item.averageScore / 10).toFixed(1) : null);
  const mediaType = item.mediaType || item.type || 'anime';
  const isComics = mediaType === 'manga' || mediaType === 'manhwa' || mediaType === 'webtoon';

  // Sub / Dub / Hindi Audio indicators
  const isHindi = item.isHindiDubbed || (Array.isArray(item.languages) && item.languages.includes('hindi')) || item.hindi;
  const isDub = item.hasDub || item.subOrDub === 'dub';

  return (
    <div className="group relative flex flex-col cursor-pointer select-none">
      {/* Thumbnail Container with Glass Border & Glow on Hover */}
      <div
        onClick={() => onOpenDetail(item)}
        className={`relative w-full overflow-hidden rounded-xl bg-[#151821] border border-white/[0.08] group-hover:border-indigo-500/50 transition-all duration-300 shadow-md group-hover:shadow-xl group-hover:shadow-indigo-500/10 group-hover:-translate-y-1 ${
          aspectRatio === 'backdrop' ? 'aspect-video' : 'aspect-[2/3]'
        }`}
      >
        {/* Cover Image */}
        <img
          src={cover}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=600&auto=format&fit=crop';
          }}
        />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
          <div className="flex items-center gap-1">
            {isHindi && <span className="badge-hindi text-[0.65rem]">Hindi</span>}
            {!isHindi && isDub && <span className="badge-dub text-[0.65rem]">Dub</span>}
            {!isHindi && !isDub && !isComics && <span className="badge-sub text-[0.65rem]">Sub</span>}
            {isComics && (
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[0.65rem] font-bold px-1.5 py-0.5 rounded">
                {mediaType.toUpperCase()}
              </span>
            )}
          </div>

          {rating && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-amber-300 text-[0.68rem] font-bold border border-white/10">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
              {rating}
            </span>
          )}
        </div>

        {/* Bottom Playback Progress Bar (if watched previously) */}
        {showProgress && progressItem && progressItem.percentage > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50 z-10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
              style={{ width: `${progressItem.percentage}%` }}
            />
          </div>
        )}

        {/* Hover Overlay with Quick Action Buttons */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#08090C] via-[#08090C]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 p-3">
          {/* Quick Play Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(item);
            }}
            className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 hover:scale-110 transition-all"
            title={isComics ? 'Read Chapter' : 'Play Video'}
          >
            {isComics ? <BookOpen className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
          </button>

          {/* Quick Bookmark Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleBookmark(item);
            }}
            className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all ${
              bookmarked
                ? 'bg-indigo-600/40 border-indigo-400 text-indigo-300'
                : 'bg-black/60 border-white/20 text-white hover:bg-black/80'
            }`}
            title={bookmarked ? 'In Watchlist' : 'Add to Watchlist'}
          >
            {bookmarked ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Media Info Details */}
      <div className="mt-2.5 space-y-1">
        <h3
          onClick={() => onOpenDetail(item)}
          className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors line-clamp-1 leading-snug"
          title={title}
        >
          {title}
        </h3>

        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>{item.year || item.status || (isComics ? 'Chapter 1' : 'EP 1')}</span>
          {item.episodesCount && <span>{item.episodesCount} Eps</span>}
        </div>
      </div>
    </div>
  );
}
