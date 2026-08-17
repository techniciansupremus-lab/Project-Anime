import React, { useState } from 'react';
import {
  X,
  Clock,
  Bookmark,
  BookOpen,
  Trash2,
  Download,
  Upload,
  Play,
  RotateCcw
} from 'lucide-react';
import { useWatchProgressStore, useBookmarkStore, useMangaHistoryStore } from '../store/useStore';
import MediaCard from './MediaCard';

export default function LibraryModal({ onClose, onPlay, onOpenDetail, onReadChapter }) {
  const [activeTab, setActiveTab] = useState('continue'); // 'continue' | 'bookmarks' | 'manga'

  const { progress, getContinueWatchingList, removeProgress, clearAllProgress } = useWatchProgressStore();
  const { bookmarks, removeBookmark } = useBookmarkStore();
  const { history } = useMangaHistoryStore();

  const continueWatching = getContinueWatchingList();
  const mangaHistoryList = Object.values(history).sort((a, b) => b.updatedAt - a.updatedAt);

  const handleExportBackup = () => {
    const data = {
      progress,
      bookmarks,
      history,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eetnet_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.bookmarks) localStorage.setItem('eetnet_bookmarks_v2', JSON.stringify(parsed.bookmarks));
        if (parsed.progress) localStorage.setItem('eetnet_watch_progress_v2', JSON.stringify(parsed.progress));
        if (parsed.history) localStorage.setItem('eetnet_manga_history_v2', JSON.stringify(parsed.history));
        window.location.reload();
      } catch (err) {
        alert('Invalid backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-2xl animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#0F1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] my-auto">
        {/* Header with Tabs */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold font-display text-white">My Library</h2>
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setActiveTab('continue')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'continue' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Resume ({continueWatching.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('bookmarks')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'bookmarks' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Watchlist ({bookmarks.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('manga')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'manga' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Manga ({mangaHistoryList.length})</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export JSON */}
            <button
              onClick={handleExportBackup}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
              title="Export Library Backup (JSON)"
            >
              <Download className="w-4 h-4" />
            </button>
            {/* Import JSON */}
            <label
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
              title="Import Library Backup"
            >
              <Upload className="w-4 h-4" />
              <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
            </label>
            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Tab 1: Continue Watching Shelf */}
          {activeTab === 'continue' && (
            <div>
              {continueWatching.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {continueWatching.map((item) => (
                    <div key={item.id} className="relative group/card">
                      <MediaCard
                        item={item}
                        onPlay={onPlay}
                        onOpenDetail={onOpenDetail}
                        aspectRatio="poster"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeProgress(item.id);
                        }}
                        className="absolute top-2 right-2 z-20 p-1.5 rounded-full bg-black/80 hover:bg-red-600 text-slate-400 hover:text-white opacity-0 group-hover/card:opacity-100 transition-all shadow-md"
                        title="Remove from history"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500 space-y-2">
                  <Clock className="w-10 h-10 mx-auto text-slate-600" />
                  <p>No active watch progress. Play any anime or movie to resume later!</p>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Watchlist */}
          {activeTab === 'bookmarks' && (
            <div>
              {bookmarks.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {bookmarks.map((item) => (
                    <MediaCard
                      key={item.id}
                      item={item}
                      onPlay={onPlay}
                      onOpenDetail={onOpenDetail}
                      aspectRatio="poster"
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500 space-y-2">
                  <Bookmark className="w-10 h-10 mx-auto text-slate-600" />
                  <p>Your watchlist is empty. Click "+ Watchlist" on any title to save it!</p>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Manga & Webtoon Reading History */}
          {activeTab === 'manga' && (
            <div>
              {mangaHistoryList.length > 0 ? (
                <div className="space-y-3">
                  {mangaHistoryList.map((m) => (
                    <div
                      key={m.slug}
                      onClick={() => onReadChapter({ slug: m.slug, title: m.title, cover: m.cover }, m.chapterId)}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] hover:bg-indigo-600/15 border border-white/5 hover:border-indigo-500/30 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={m.cover}
                          alt={m.title}
                          className="w-12 h-16 rounded-lg object-cover"
                        />
                        <div>
                          <h4 className="text-sm font-bold text-white line-clamp-1">{m.title}</h4>
                          <p className="text-xs text-indigo-400 font-semibold">Last read: Chapter {m.chapterNumber}</p>
                        </div>
                      </div>
                      <button className="btn-primary text-xs px-4 py-2">
                        Resume
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500 space-y-2">
                  <BookOpen className="w-10 h-10 mx-auto text-slate-600" />
                  <p>No manga reading history found.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
