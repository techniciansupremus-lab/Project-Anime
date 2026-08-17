import React, { useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import MediaCard from './MediaCard';

export default function MediaRow({
  title,
  subtitle,
  badge,
  items = [],
  onPlay,
  onOpenDetail,
  onExploreAll,
  aspectRatio = 'poster',
  showProgress = true
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
  });

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  if (!items || items.length === 0) return null;

  return (
    <section className="relative w-full py-5 select-none">
      {/* Row Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-3 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h2 className="text-xl sm:text-2xl font-bold font-display text-white tracking-tight">
              {title}
            </h2>
            {badge && (
              <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold uppercase tracking-wider">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-slate-400 font-medium">{subtitle}</p>
          )}
        </div>

        {/* Explore All Button */}
        {onExploreAll && (
          <button
            onClick={onExploreAll}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors pb-1"
          >
            <span>Explore All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Carousel Container */}
      <div className="relative group max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Left Arrow */}
        <button
          onClick={scrollPrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/70 hover:bg-indigo-600 text-white border border-white/10 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center shadow-2xl hover:scale-110"
          aria-label="Previous Slide"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Right Arrow */}
        <button
          onClick={scrollNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/70 hover:bg-indigo-600 text-white border border-white/10 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center shadow-2xl hover:scale-110"
          aria-label="Next Slide"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Embla Viewport */}
        <div className="overflow-hidden py-2" ref={emblaRef}>
          <div className="flex gap-4">
            {items.map((item, idx) => (
              <div
                key={item.id || item.slug || idx}
                className={`flex-none ${
                  aspectRatio === 'backdrop'
                    ? 'w-[260px] sm:w-[320px]'
                    : 'w-[140px] sm:w-[170px] lg:w-[195px]'
                }`}
              >
                <MediaCard
                  item={item}
                  onPlay={onPlay}
                  onOpenDetail={onOpenDetail}
                  aspectRatio={aspectRatio}
                  showProgress={showProgress}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
