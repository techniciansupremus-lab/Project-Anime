import { create } from 'zustand';

// ─────────────────────────────────────────────────────────────────────────────
// 1. WATCH PROGRESS & CONTINUE WATCHING STORE
// ─────────────────────────────────────────────────────────────────────────────
const LOCAL_STORAGE_WATCH_KEY = 'eetnet_watch_progress_v2';
const LOCAL_STORAGE_BOOKMARKS_KEY = 'eetnet_bookmarks_v2';
const LOCAL_STORAGE_MANGA_KEY = 'eetnet_manga_history_v2';
const LOCAL_STORAGE_SETTINGS_KEY = 'eetnet_settings_v2';

function loadInitialState(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

export const useWatchProgressStore = create((set, get) => ({
  progress: loadInitialState(LOCAL_STORAGE_WATCH_KEY, {}),

  // Save or update exact playback progress
  saveProgress: ({ id, mediaType, title, poster, backdrop, season, episode, episodeTitle, currentTime, duration, audioMode }) => {
    if (!id || !duration || duration <= 0) return;
    const percentage = Math.min(100, Math.max(0, Math.round((currentTime / duration) * 100)));
    
    set((state) => {
      const updated = {
        ...state.progress,
        [id]: {
          id,
          mediaType: mediaType || 'anime',
          title: title || 'Untitled',
          poster: poster || '',
          backdrop: backdrop || poster || '',
          season: season || 1,
          episode: episode || 1,
          episodeTitle: episodeTitle || '',
          currentTime: Math.floor(currentTime),
          duration: Math.floor(duration),
          percentage,
          audioMode: audioMode || 'sub',
          updatedAt: Date.now(),
        }
      };

      try {
        localStorage.setItem(LOCAL_STORAGE_WATCH_KEY, JSON.stringify(updated));
      } catch (e) {}

      return { progress: updated };
    });
  },

  // Get single item progress
  getItemProgress: (id) => {
    return get().progress[id] || null;
  },

  // Get sorted list of continue watching items (most recent first)
  getContinueWatchingList: () => {
    const items = Object.values(get().progress);
    return items
      .filter((item) => item.percentage < 95 && item.currentTime > 5) // Exclude nearly completed
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },

  // Remove single item
  removeProgress: (id) => {
    set((state) => {
      const updated = { ...state.progress };
      delete updated[id];
      try {
        localStorage.setItem(LOCAL_STORAGE_WATCH_KEY, JSON.stringify(updated));
      } catch (e) {}
      return { progress: updated };
    });
  },

  // Clear all
  clearAllProgress: () => {
    localStorage.removeItem(LOCAL_STORAGE_WATCH_KEY);
    set({ progress: {} });
  }
}));

// ─────────────────────────────────────────────────────────────────────────────
// 2. BOOKMARKS & WATCHLIST STORE
// ─────────────────────────────────────────────────────────────────────────────
export const useBookmarkStore = create((set, get) => ({
  bookmarks: loadInitialState(LOCAL_STORAGE_BOOKMARKS_KEY, []),

  isBookmarked: (id) => {
    return get().bookmarks.some((b) => b.id === String(id));
  },

  toggleBookmark: ({ id, mediaType, title, cover, banner, rating, genres, type }) => {
    set((state) => {
      const exists = state.bookmarks.some((b) => b.id === String(id));
      let updated;
      if (exists) {
        updated = state.bookmarks.filter((b) => b.id !== String(id));
      } else {
        updated = [
          {
            id: String(id),
            mediaType: mediaType || 'anime',
            title: title || 'Untitled',
            cover: cover || '',
            banner: banner || cover || '',
            rating: rating || '8.5',
            genres: genres || [],
            type: type || mediaType,
            addedAt: Date.now(),
          },
          ...state.bookmarks,
        ];
      }

      try {
        localStorage.setItem(LOCAL_STORAGE_BOOKMARKS_KEY, JSON.stringify(updated));
      } catch (e) {}

      return { bookmarks: updated };
    });
  },

  removeBookmark: (id) => {
    set((state) => {
      const updated = state.bookmarks.filter((b) => b.id !== String(id));
      try {
        localStorage.setItem(LOCAL_STORAGE_BOOKMARKS_KEY, JSON.stringify(updated));
      } catch (e) {}
      return { bookmarks: updated };
    });
  }
}));

// ─────────────────────────────────────────────────────────────────────────────
// 3. MANGA & WEBTOON READING HISTORY STORE
// ─────────────────────────────────────────────────────────────────────────────
export const useMangaHistoryStore = create((set, get) => ({
  history: loadInitialState(LOCAL_STORAGE_MANGA_KEY, {}),

  saveReadProgress: ({ slug, title, cover, chapterId, chapterNumber, pageIndex = 1 }) => {
    if (!slug) return;
    set((state) => {
      const updated = {
        ...state.history,
        [slug]: {
          slug,
          title: title || slug,
          cover: cover || '',
          chapterId: chapterId || '',
          chapterNumber: chapterNumber || '1',
          pageIndex,
          updatedAt: Date.now(),
        }
      };

      try {
        localStorage.setItem(LOCAL_STORAGE_MANGA_KEY, JSON.stringify(updated));
      } catch (e) {}

      return { history: updated };
    });
  },

  getMangaProgress: (slug) => {
    return get().history[slug] || null;
  }
}));

// ─────────────────────────────────────────────────────────────────────────────
// 4. USER SETTINGS & PLAYER PREFERENCES STORE
// ─────────────────────────────────────────────────────────────────────────────
export const useSettingsStore = create((set) => ({
  settings: loadInitialState(LOCAL_STORAGE_SETTINGS_KEY, {
    autoSkipIntro: true,
    autoPlayNext: true,
    defaultAudio: 'sub', // 'sub' | 'eng' | 'hin'
    subtitleSize: 'medium', // 'small' | 'medium' | 'large'
    ambientGlow: true,
    theaterMode: false,
  }),

  updateSetting: (key, value) => {
    set((state) => {
      const updated = { ...state.settings, [key]: value };
      try {
        localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(updated));
      } catch (e) {}
      return { settings: updated };
    });
  }
}));
