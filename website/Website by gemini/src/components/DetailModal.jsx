import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Plus,
  Check,
  Star,
  Sparkles,
  Layers,
  Clock,
  Calendar,
  BookOpen,
  Tv,
  Film
} from 'lucide-react';
import { animeApi, dramaApi, comicsApi, moviesApi } from '../config/api';
import { useBookmarkStore, useWatchProgressStore } from '../store/useStore';

export default function DetailModal({ item, onClose, onPlayEpisode, onReadChapter }) {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(item || null);
  const [episodes, setEpisodes] = useState([]);
  const [malEpisodes, setMalEpisodes] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(1);

  const { isBookmarked, toggleBookmark } = useBookmarkStore();
  const progressItem = useWatchProgressStore((state) => state.getItemProgress(item?.id || item?.slug));

  const id = item?.id || item?.slug || item?.movieplexId || item?.animerulz_id;
  const mediaType = item?.mediaType || item?.type || 'anime';
  const isBookmarkedItem = isBookmarked(id);
  const isComics = mediaType === 'manga' || mediaType === 'manhwa' || mediaType === 'webtoon';

  useEffect(() => {
    let isMounted = true;
    async function loadFullDetails() {
      setLoading(true);
      try {
        if (mediaType === 'anime' && item?.id) {
          const info = await animeApi.getInfo(item.id);
          if (isMounted && info) {
            setDetails((prev) => ({ ...prev, ...info }));
            setEpisodes(info.episodes || []);
          }

          // Fetch Jikan episode metadata (titles & filler flags) if malId is present
          const malId = item.idMal || item.malId || item.id;
          if (malId) {
            try {
              const malData = await animeApi.getMalEpisodes(malId, 1);
              if (isMounted && malData?.episodes) {
                setMalEpisodes(malData.episodes);
              }
            } catch (e) {}
          }
        } else if (mediaType === 'drama' && item?.dramaId) {
          const info = await dramaApi.getInfo(item.dramaId);
          if (isMounted && info) {
            setDetails((prev) => ({ ...prev, ...info }));
            setEpisodes(info.episodes || []);
          }
        } else if (isComics && (item?.slug || item?.id)) {
          const info = await comicsApi.getInfo(item.slug || item.id);
          if (isMounted && info) {
            setDetails((prev) => ({ ...prev, ...info }));
            setEpisodes(info.chapters || []);
          }
        }
      } catch (err) {
        console.warn('Failed to load full item details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadFullDetails();
    return () => { isMounted = false; };
  }, [item, mediaType, isComics]);

  if (!item) return null;

  const title = details?.title?.english || details?.title?.romaji || details?.title?.userPreferred || details?.title || 'Title';
  const backdrop = details?.bannerImage || details?.backdrop || details?.banner || details?.coverImage?.large || details?.cover || '';
  const poster = details?.coverImage?.large || details?.cover || details?.thumbnail || details?.poster || '';
  const description = details?.description || details?.desc || 'No description available.';
  const rating = details?.rating || details?.score || (details?.averageScore ? (details?.averageScore / 10).toFixed(1) : '8.8');
  const genres = details?.genres || details?.categories || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#0F1117] border border-white/10 rounded-2xl overflow-hidden shadow-2xl my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 rounded-full bg-black/60 hover:bg-white/20 text-white backdrop-blur-md transition-all border border-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero Banner Header */}
        <div className="relative w-full h-[280px] sm:h-[360px] overflow-hidden">
          <img
            src={backdrop || poster}
            alt={title}
            className="w-full h-full object-cover object-center"
            onError={(e) => {
              e.target.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1200&auto=format&fit=crop';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F1117] via-[#0F1117]/60 to-transparent" />

          {/* Quick Actions inside Header */}
          <div className="absolute bottom-6 left-6 right-6 flex items-end gap-5">
            {/* Poster Thumbnail */}
            <img
              src={poster}
              alt={title}
              className="w-24 sm:w-32 aspect-[2/3] rounded-xl object-cover shadow-2xl border-2 border-white/20 hidden sm:block"
            />

            <div className="space-y-2 flex-1">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-400/30">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {rating}
                </span>
                <span className="badge-hd">HD 1080P</span>
                <span className="text-xs text-slate-300 font-medium">
                  {details?.year || details?.releaseDate || '2024'}
                </span>
                <span className="text-xs text-slate-400 font-semibold uppercase">
                  {details?.status || 'Completed'}
                </span>
              </div>

              {/* Title */}
              <h2 className="text-2xl sm:text-4xl font-extrabold font-display text-white line-clamp-2">
                {title}
              </h2>

              {/* Primary Action Buttons */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => {
                    if (isComics) {
                      onReadChapter(details, episodes[0]?.id || '1');
                    } else {
                      onPlayEpisode(details, 1);
                    }
                  }}
                  className="btn-primary text-sm px-6 py-2.5 shadow-lg shadow-indigo-600/30"
                >
                  {isComics ? <BookOpen className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                  <span>{isComics ? 'Read First Chapter' : 'Play Episode 1'}</span>
                </button>

                <button
                  onClick={() => toggleBookmark(details)}
                  className={`p-2.5 rounded-full border transition-all ${
                    isBookmarkedItem
                      ? 'bg-indigo-600/40 border-indigo-400 text-indigo-300'
                      : 'bg-white/10 border-white/15 text-slate-300 hover:bg-white/20'
                  }`}
                  title={isBookmarkedItem ? 'Remove from My List' : 'Add to My List'}
                >
                  {isBookmarkedItem ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Genres */}
          <div className="flex flex-wrap items-center gap-1.5">
            {genres.map((g, idx) => (
              <span key={idx} className="bg-white/5 border border-white/10 text-xs px-2.5 py-1 rounded-md text-slate-300">
                {typeof g === 'string' ? g : g.name || 'Genre'}
              </span>
            ))}
          </div>

          {/* Synopsis */}
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            {description.replace(/<[^>]*>?/gm, '')}
          </p>

          {/* Episodes / Chapters Grid Section */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold font-display text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <span>{isComics ? 'Chapters' : 'Episodes'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-mono">
                  {episodes.length || details?.totalEpisodes || 12}
                </span>
              </h3>
            </div>

            {/* Episode Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[350px] overflow-y-auto pr-1">
              {episodes.length > 0 ? (
                episodes.map((ep, idx) => {
                  const epNum = ep.number || idx + 1;
                  const malMeta = malEpisodes.find((m) => m.number === epNum);
                  const epTitle = ep.title || malMeta?.title || `Episode ${epNum}`;
                  const isFiller = malMeta?.filler;

                  return (
                    <button
                      key={ep.id || idx}
                      onClick={() => {
                        if (isComics) {
                          onReadChapter(details, ep.id || String(epNum));
                        } else {
                          onPlayEpisode(details, epNum);
                        }
                      }}
                      className="flex flex-col text-left p-3 rounded-xl bg-white/[0.04] hover:bg-indigo-600/20 border border-white/[0.06] hover:border-indigo-500/40 transition-all group/ep"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold font-mono text-indigo-400 group-hover/ep:text-white">
                          {isComics ? `CH ${epNum}` : `EP ${epNum}`}
                        </span>
                        {isFiller && (
                          <span className="text-[0.6rem] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                            FILLER
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 group-hover/ep:text-white line-clamp-1">
                        {epTitle}
                      </p>
                    </button>
                  );
                })
              ) : (
                // Fallback Quick Episode Buttons
                Array.from({ length: Math.min(24, details?.totalEpisodes || 12) }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => onPlayEpisode(details, idx + 1)}
                    className="p-3 rounded-xl bg-white/[0.04] hover:bg-indigo-600/20 border border-white/[0.06] text-xs font-bold text-center text-slate-300 hover:text-white"
                  >
                    Episode {idx + 1}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
