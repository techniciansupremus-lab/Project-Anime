import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Search, 
  Bookmark, 
  Clock, 
  Settings, 
  Sparkles, 
  Film, 
  Tv, 
  BookOpen, 
  Compass, 
  X,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { useBookmarkStore, useWatchProgressStore } from '../store/useStore';

export default function Navbar({ activeTab, onTabChange, onOpenSearch, onOpenSettings, onOpenLibrary }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const bookmarks = useBookmarkStore((state) => state.bookmarks);
  const continueWatching = useWatchProgressStore((state) => state.getContinueWatchingList)();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { id: 'home', label: 'Home', icon: Sparkles },
    { id: 'anime', label: 'Anime', icon: Compass, badge: 'Hindi Dub' },
    { id: 'drama', label: 'Dramas', icon: Tv, badge: 'Asian' },
    { id: 'comics', label: 'Comics & Manga', icon: BookOpen },
    { id: 'movies', label: 'Movies & OTT', icon: Film, badge: 'Bollywood' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#08090C]/85 backdrop-blur-xl border-b border-white/[0.08] shadow-2xl py-3'
          : 'bg-gradient-to-b from-[#08090C]/90 via-[#08090C]/40 to-transparent py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Left: Brand Logo & Desktop Nav Links */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <button
            onClick={() => onTabChange('home')}
            className="flex items-center gap-2.5 group focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-200">
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xl font-extrabold tracking-tight font-display bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                EetNet
              </span>
              <span className="text-[0.65rem] tracking-widest text-indigo-400 font-bold uppercase -mt-1">
                STREAM
              </span>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 relative ${
                    isActive
                      ? 'text-white bg-white/10 shadow-inner'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[0.6rem] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-indigo-400 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Actions (Search, History, Library, Settings) */}
        <div className="flex items-center gap-2.5">
          {/* Quick Search Button */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.08] text-slate-300 hover:text-white transition-all text-sm group"
            title="Search Anime, Movies, Comics (Ctrl+K)"
          >
            <Search className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition-colors" />
            <span className="hidden sm:inline font-medium text-xs text-slate-400">Search</span>
            <kbd className="hidden lg:inline text-[0.65rem] px-1.5 py-0.5 rounded bg-white/10 text-slate-400 font-mono">
              /
            </kbd>
          </button>

          {/* Library / Watchlist Quick Pill */}
          <button
            onClick={onOpenLibrary}
            className="relative p-2 rounded-full bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.08] text-slate-300 hover:text-white transition-all"
            title="My Library & Watch History"
          >
            <Bookmark className="w-4 h-4" />
            {bookmarks.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-500 text-[0.65rem] font-bold flex items-center justify-center text-white">
                {bookmarks.length > 9 ? '9+' : bookmarks.length}
              </span>
            )}
          </button>

          {/* Continue Watching / History Indicator */}
          {continueWatching.length > 0 && (
            <button
              onClick={onOpenLibrary}
              className="hidden sm:flex items-center gap-1.5 p-2 rounded-full bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.08] text-slate-300 hover:text-white transition-all"
              title="Continue Watching Queue"
            >
              <Clock className="w-4 h-4 text-amber-400" />
            </button>
          )}

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-full bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.08] text-slate-400 hover:text-white transition-all"
            title="Streaming Settings & API Config"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-full bg-white/[0.07] hover:bg-white/[0.12] text-slate-300"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <SlidersHorizontal className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-3 px-4 pt-2 pb-4 bg-[#0B0C10]/95 backdrop-blur-2xl border-b border-white/10 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                    {item.badge}
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
