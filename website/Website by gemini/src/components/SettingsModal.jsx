import React, { useState } from 'react';
import { X, Sliders, Server, Sparkles, Check, RefreshCw } from 'lucide-react';
import { useSettingsStore } from '../store/useStore';
import { API_CONFIG } from '../config/api';

export default function SettingsModal({ onClose }) {
  const { settings, updateSetting } = useSettingsStore();

  const [animeApiUrl, setAnimeApiUrl] = useState(API_CONFIG.ANIME_API);
  const [dramaApiUrl, setDramaApiUrl] = useState(API_CONFIG.DRAMA_API);
  const [comicsApiUrl, setComicsApiUrl] = useState(API_CONFIG.COMICS_API);
  const [moviesApiUrl, setMoviesApiUrl] = useState(API_CONFIG.MOVIES_API);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveApis = () => {
    const custom = {
      ANIME_API: animeApiUrl.trim(),
      DRAMA_API: dramaApiUrl.trim(),
      COMICS_API: comicsApiUrl.trim(),
      MOVIES_API: moviesApiUrl.trim(),
    };
    localStorage.setItem('eetnet_custom_apis', JSON.stringify(custom));
    Object.assign(API_CONFIG, custom);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleResetDefaults = () => {
    localStorage.removeItem('eetnet_custom_apis');
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-2xl animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#0F1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold font-display text-white">Streaming Preferences & APIs</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Player Toggles */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Player Features</h3>
          
          {/* Auto-Skip Intro */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div>
              <p className="text-sm font-semibold text-white">Auto-Skip Openings / Endings</p>
              <p className="text-xs text-slate-400">Uses AniSkip API to automatically jump anime intros</p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoSkipIntro}
              onChange={(e) => updateSetting('autoSkipIntro', e.target.checked)}
              className="w-5 h-5 accent-indigo-500 rounded cursor-pointer"
            />
          </div>

          {/* Ambient Glow */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div>
              <p className="text-sm font-semibold text-white">Ambient Backlight Glow</p>
              <p className="text-xs text-slate-400">Soft reactive lighting on the page around the player</p>
            </div>
            <input
              type="checkbox"
              checked={settings.ambientGlow}
              onChange={(e) => updateSetting('ambientGlow', e.target.checked)}
              className="w-5 h-5 accent-indigo-500 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Custom Backend Microservice URLs */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              Microservice Endpoints
            </h3>
            <button
              onClick={handleResetDefaults}
              className="text-[0.65rem] font-bold text-slate-400 hover:text-white flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Reset Localhost
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">🎌 Anime API Endpoint</label>
              <input
                type="text"
                value={animeApiUrl}
                onChange={(e) => setAnimeApiUrl(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">🎭 Drama API Endpoint</label>
              <input
                type="text"
                value={dramaApiUrl}
                onChange={(e) => setDramaApiUrl(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">📚 Comics API Endpoint</label>
              <input
                type="text"
                value={comicsApiUrl}
                onChange={(e) => setComicsApiUrl(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">🎬 Movies API Endpoint</label>
              <input
                type="text"
                value={moviesApiUrl}
                onChange={(e) => setMoviesApiUrl(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSaveApis}
          className="w-full btn-primary py-2.5 text-sm font-bold flex items-center justify-center gap-2"
        >
          {savedSuccess ? <Check className="w-4 h-4" /> : null}
          <span>{savedSuccess ? 'Settings Saved!' : 'Save & Apply Config'}</span>
        </button>
      </div>
    </div>
  );
}
