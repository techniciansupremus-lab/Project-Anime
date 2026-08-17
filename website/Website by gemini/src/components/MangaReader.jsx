import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Sliders,
  BookOpen,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { comicsApi, API_CONFIG } from '../config/api';
import { useMangaHistoryStore } from '../store/useStore';

export default function MangaReader({ mangaItem, chapterId = '1', onClose, onNavigateChapter }) {
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState([]);
  const [chapterTitle, setChapterTitle] = useState(`Chapter ${chapterId}`);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [readerMode, setReaderMode] = useState('webtoon'); // 'webtoon' (vertical) | 'single'

  const containerRef = useRef(null);
  const { saveReadProgress } = useMangaHistoryStore();

  const title = mangaItem?.title?.english || mangaItem?.title?.romaji || mangaItem?.title || 'Manga';

  useEffect(() => {
    let isMounted = true;
    async function loadChapterImages() {
      setLoading(true);
      try {
        const data = await comicsApi.getChapterPages(chapterId);
        if (isMounted && data) {
          const rawImages = data.images || data.pages || [];
          // Proxy images if needed
          const proxied = rawImages.map((img) => {
            const rawUrl = typeof img === 'string' ? img : img.url || '';
            if (rawUrl.startsWith('http') && !rawUrl.includes('image-proxy')) {
              return `${API_CONFIG.COMICS_API}/api/manga/image-proxy?url=${encodeURIComponent(rawUrl)}`;
            }
            return rawUrl;
          });
          setPages(proxied);
          setChapterTitle(data.title || `Chapter ${chapterId}`);

          // Save history
          saveReadProgress({
            slug: mangaItem?.slug || mangaItem?.id,
            title,
            cover: mangaItem?.cover || mangaItem?.thumbnail || '',
            chapterId,
            chapterNumber: String(chapterId),
          });
        }
      } catch (err) {
        console.warn('Failed to load chapter pages:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadChapterImages();
    return () => { isMounted = false; };
  }, [chapterId, mangaItem, title, saveReadProgress]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[#08090C] text-white flex flex-col overflow-hidden select-none"
    >
      {/* Top Reader Navigation Bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#0F1117]/90 backdrop-blur-xl border-b border-white/10 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-all"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm sm:text-base font-bold font-display text-white line-clamp-1">
              {title}
            </h2>
            <p className="text-xs text-slate-400">{chapterTitle}</p>
          </div>
        </div>

        {/* Reader Controls (Zoom, Mode, Fullscreen) */}
        <div className="flex items-center gap-2">
          {/* Zoom In / Out */}
          <button
            onClick={() => setZoomLevel((z) => Math.max(60, z - 15))}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-slate-400">{zoomLevel}%</span>
          <button
            onClick={() => setZoomLevel((z) => Math.min(160, z + 15))}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Reader Page Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center my-auto space-y-3">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-400">Loading High-Definition Pages...</p>
          </div>
        ) : pages.length > 0 ? (
          <div
            className="flex flex-col items-center gap-1 transition-all duration-200"
            style={{ width: `${Math.min(100, zoomLevel)}%`, maxWidth: `${(zoomLevel / 100) * 900}px` }}
          >
            {pages.map((imgUrl, idx) => (
              <img
                key={idx}
                src={imgUrl}
                alt={`Page ${idx + 1}`}
                loading="lazy"
                className="w-full h-auto object-contain select-none shadow-lg"
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=800&auto=format&fit=crop';
                }}
              />
            ))}
          </div>
        ) : (
          <div className="text-center my-auto text-slate-500">
            No pages found for this chapter.
          </div>
        )}
      </main>

      {/* Bottom Floating Navigation Bar */}
      <footer className="flex items-center justify-between px-6 py-3 bg-[#0F1117]/95 backdrop-blur-xl border-t border-white/10 z-20">
        <button
          onClick={() => onNavigateChapter && onNavigateChapter('prev')}
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Prev Chapter</span>
        </button>

        <span className="text-xs font-medium text-slate-400 font-mono">
          {pages.length} Pages Loaded
        </span>

        <button
          onClick={() => onNavigateChapter && onNavigateChapter('next')}
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-all shadow-lg shadow-indigo-600/30"
        >
          <span>Next Chapter</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
}
