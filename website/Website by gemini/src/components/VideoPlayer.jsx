import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Settings,
  Subtitles,
  FastForward,
  ArrowLeft,
  Tv,
  Sparkles,
  Layers
} from 'lucide-react';
import { aniSkipApi } from '../config/api';
import { useWatchProgressStore, useSettingsStore } from '../store/useStore';

export default function VideoPlayer({
  mediaItem,
  episode = 1,
  streamUrl,
  subtitles = [],
  sources = [],
  fallbackIframe,
  audioMode = 'sub',
  onAudioModeChange,
  onNextEpisode,
  onPrevEpisode,
  onClose
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [selectedSub, setSelectedSub] = useState(0); // index or -1 for off
  const [skipTimes, setSkipTimes] = useState(null);
  const [currentSkip, setCurrentSkip] = useState(null);
  const [error, setError] = useState(null);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  const { saveProgress, getItemProgress } = useWatchProgressStore();
  const { autoSkipIntro, ambientGlow } = useSettingsStore((state) => state.settings);

  const mediaId = mediaItem?.id || mediaItem?.slug || 'media';
  const title = mediaItem?.title?.english || mediaItem?.title?.romaji || mediaItem?.title || 'Video Player';

  // ─────────────────────────────────────────────────────────────────────────
  // 1. ANISKIP INTEGRATION (Fetch OP/ED timestamps)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const malId = mediaItem?.malId || mediaItem?.id;
    if (malId && episode) {
      aniSkipApi.getSkipTimes(malId, episode).then((results) => {
        if (results && results.length) {
          setSkipTimes(results);
        }
      });
    }
  }, [mediaItem, episode]);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. INITIALIZE VIDEO ENGINE & HLS.JS
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl || useIframeFallback) return;

    setError(null);
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = streamUrl.includes('.m3u8') || streamUrl.includes('m3u8-proxy');

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });

      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Resume watch progress if available
        const savedProgress = getItemProgress(mediaId);
        if (savedProgress && savedProgress.currentTime > 5 && savedProgress.currentTime < savedProgress.duration - 15) {
          video.currentTime = savedProgress.currentTime;
        }
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              console.warn('[PLAYER] Fatal HLS error, switching to compatibility mode:', data);
              if (fallbackIframe) {
                setUseIframeFallback(true);
              } else {
                setError('Playback error. Stream unavailable.');
              }
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari HLS
      video.src = streamUrl;
      const savedProgress = getItemProgress(mediaId);
      if (savedProgress?.currentTime > 5) video.currentTime = savedProgress.currentTime;
      video.play().catch(() => {});
    } else {
      // Direct MP4
      video.src = streamUrl;
      const savedProgress = getItemProgress(mediaId);
      if (savedProgress?.currentTime > 5) video.currentTime = savedProgress.currentTime;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, useIframeFallback, mediaId]);

  // ─────────────────────────────────────────────────────────────────────────
  // 3. TIME UPDATE & AUTO-SAVE WATCH PROGRESS
  // ─────────────────────────────────────────────────────────────────────────
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const time = video.currentTime;
    const dur = video.duration || 0;
    setCurrentTime(time);
    setDuration(dur);

    // Calculate buffer progress
    if (video.buffered.length > 0) {
      setBuffered(video.buffered.end(video.buffered.length - 1));
    }

    // Check AniSkip Intervals
    if (skipTimes && skipTimes.length) {
      const active = skipTimes.find(
        (s) => time >= s.interval.startTime && time <= s.interval.endTime
      );
      if (active) {
        setCurrentSkip(active);
        // Auto-skip if enabled in user settings
        if (autoSkipIntro && active.skipType === 'op' && time < active.interval.endTime - 2) {
          video.currentTime = active.interval.endTime;
        }
      } else {
        setCurrentSkip(null);
      }
    }

    // Save watch progress to Zustand/LocalStorage
    if (dur > 0 && Math.floor(time) % 3 === 0) {
      saveProgress({
        id: mediaId,
        mediaType: mediaItem?.mediaType || mediaItem?.type || 'anime',
        title,
        poster: mediaItem?.cover || mediaItem?.thumbnail || '',
        backdrop: mediaItem?.banner || mediaItem?.backdrop || '',
        episode,
        currentTime: time,
        duration: dur,
        audioMode,
      });
    }
  }, [skipTimes, autoSkipIntro, saveProgress, mediaId, mediaItem, title, episode, audioMode]);

  // ─────────────────────────────────────────────────────────────────────────
  // 4. KEYBOARD SHORTCUTS MATRIX
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['input', 'textarea'].includes(document.activeElement.tagName.toLowerCase())) return;
      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          seekDelta(-10);
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          seekDelta(10);
          break;
        case 'arrowup':
          e.preventDefault();
          setVolumeLevel(Math.min(1, volume + 0.1));
          break;
        case 'arrowdown':
          e.preventDefault();
          setVolumeLevel(Math.max(0, volume - 0.1));
          break;
        case 's':
          if (currentSkip) {
            e.preventDefault();
            executeSkip();
          }
          break;
        case 'escape':
          if (isFullscreen) toggleFullscreen();
          break;
        default:
          break;
      }
      triggerControlsVisibility();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, volume, currentSkip]);

  // ─────────────────────────────────────────────────────────────────────────
  // 5. PLAYER CONTROLS ACTIONS
  // ─────────────────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const seekDelta = (delta) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta));
  };

  const handleScrubberChange = (e) => {
    const video = videoRef.current;
    if (!video) return;
    const newTime = parseFloat(e.target.value);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const setVolumeLevel = (val) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = val;
    setVolume(val);
    if (val === 0) {
      video.muted = true;
      setIsMuted(true);
    } else if (video.muted) {
      video.muted = false;
      setIsMuted(false);
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const executeSkip = () => {
    const video = videoRef.current;
    if (video && currentSkip) {
      video.currentTime = currentSkip.interval.endTime;
      setCurrentSkip(null);
    }
  };

  const triggerControlsVisibility = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3500);
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={triggerControlsVisibility}
      onClick={triggerControlsVisibility}
      className="relative w-full h-full min-h-[480px] max-h-[85vh] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 select-none group"
    >
      {/* Ambient Reactive Backglow */}
      {ambientGlow && (
        <div className="player-ambient-glow" />
      )}

      {/* Main Video Element or Iframe Fallback */}
      {!useIframeFallback ? (
        <video
          ref={videoRef}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={onNextEpisode}
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
          playsInline
        >
          {/* Subtitle Track */}
          {subtitles && subtitles.length > 0 && selectedSub >= 0 && subtitles[selectedSub] && (
            <track
              kind="subtitles"
              label={subtitles[selectedSub].label || 'English'}
              src={subtitles[selectedSub].file}
              default
            />
          )}
        </video>
      ) : (
        <iframe
          src={fallbackIframe}
          title={title}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      )}

      {/* AniSkip Button (Auto / 1-Click Skip Intro/Outro) */}
      {currentSkip && !useIframeFallback && (
        <button
          onClick={executeSkip}
          className="absolute bottom-24 right-8 z-40 btn-primary px-5 py-2.5 rounded-full shadow-2xl backdrop-blur-xl border border-indigo-400/40 text-sm font-bold animate-bounce"
        >
          <Sparkles className="w-4 h-4" />
          <span>Skip {currentSkip.skipType === 'op' ? 'Intro' : 'Outro'} (S)</span>
        </button>
      )}

      {/* Error / Fallback Banner */}
      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
          <p className="text-red-400 font-semibold mb-4">{error}</p>
          {fallbackIframe && (
            <button
              onClick={() => setUseIframeFallback(true)}
              className="btn-primary text-sm px-6 py-2.5"
            >
              Switch to External Player
            </button>
          )}
        </div>
      )}

      {/* Floating HUD Controls Overlay */}
      {!useIframeFallback && (
        <div
          className={`absolute inset-0 z-30 flex flex-col justify-between p-4 sm:p-6 bg-gradient-to-t from-black/90 via-transparent to-black/70 transition-opacity duration-300 pointer-events-none ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Top Bar: Title, Audio Mode Selector & Close */}
          <div className="flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all"
                title="Back to Catalog"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-base sm:text-lg font-bold font-display text-white line-clamp-1">
                  {title}
                </h2>
                <p className="text-xs text-slate-300">
                  Episode {episode} • {audioMode.toUpperCase()}
                </p>
              </div>
            </div>

            {/* Audio Mode Switcher (SUB / DUB / HINDI) */}
            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md p-1 rounded-full border border-white/10">
              <button
                onClick={() => onAudioModeChange && onAudioModeChange('sub')}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                  audioMode === 'sub' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                SUB
              </button>
              <button
                onClick={() => onAudioModeChange && onAudioModeChange('eng')}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                  audioMode === 'eng' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                ENG DUB
              </button>
              <button
                onClick={() => onAudioModeChange && onAudioModeChange('hin')}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                  audioMode === 'hin' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                HINDI DUB
              </button>
            </div>
          </div>

          {/* Center Play/Pause Indicator (Optional tap feedback) */}
          <div className="self-center pointer-events-auto">
            <button
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-indigo-600/80 hover:bg-indigo-500 text-white flex items-center justify-center backdrop-blur-md shadow-2xl hover:scale-110 transition-all"
            >
              {isPlaying ? <Pause className="w-8 h-8 fill-white" /> : <Play className="w-8 h-8 fill-white ml-1" />}
            </button>
          </div>

          {/* Bottom Controls: Scrubber Bar & Utility Buttons */}
          <div className="space-y-2.5 pointer-events-auto">
            {/* Timeline Progress Scrubber */}
            <div className="relative flex items-center group/scrubber cursor-pointer">
              {/* Buffer Bar */}
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-white/20 rounded-full"
                style={{ width: `${(buffered / (duration || 1)) * 100}%` }}
              />
              {/* Played Bar */}
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full pointer-events-none"
                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
              />
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleScrubberChange}
                className="w-full h-1.5 opacity-0 cursor-pointer z-10"
              />
            </div>

            {/* Bottom Actions Row */}
            <div className="flex items-center justify-between text-white text-sm">
              {/* Left Group: Play/Pause, Seek 10s, Volume, Time Display */}
              <div className="flex items-center gap-3 sm:gap-4">
                <button onClick={togglePlay} className="hover:text-indigo-400 transition-colors">
                  {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
                </button>

                <button onClick={() => seekDelta(-10)} className="hover:text-indigo-400 transition-colors" title="Rewind 10s (J)">
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button onClick={() => seekDelta(10)} className="hover:text-indigo-400 transition-colors" title="Forward 10s (L)">
                  <RotateCw className="w-4 h-4" />
                </button>

                {/* Volume Slider */}
                <div className="flex items-center gap-2 group/volume">
                  <button onClick={toggleMute} className="hover:text-indigo-400 transition-colors">
                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
                    className="w-16 h-1 bg-white/30 rounded-full accent-indigo-500 cursor-pointer hidden sm:inline-block"
                  />
                </div>

                {/* Time Display */}
                <span className="text-xs text-slate-300 font-mono">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Right Group: Subtitles, Playback Speed, Next Episode, Fullscreen */}
              <div className="flex items-center gap-3">
                {/* Subtitle Selector */}
                {subtitles && subtitles.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowSubMenu(!showSubMenu)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        selectedSub >= 0 ? 'text-indigo-400 bg-indigo-500/20' : 'text-slate-300 hover:text-white'
                      }`}
                      title="Subtitles"
                    >
                      <Subtitles className="w-5 h-5" />
                    </button>

                    {showSubMenu && (
                      <div className="absolute bottom-10 right-0 w-44 bg-[#0F1117]/95 backdrop-blur-xl border border-white/10 rounded-xl p-2 shadow-2xl space-y-1 z-50">
                        <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                          Subtitles
                        </p>
                        <button
                          onClick={() => { setSelectedSub(-1); setShowSubMenu(false); }}
                          className={`w-full text-left px-2 py-1 rounded text-xs ${selectedSub === -1 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-white/5'}`}
                        >
                          Off
                        </button>
                        {subtitles.map((s, idx) => (
                          <button
                            key={idx}
                            onClick={() => { setSelectedSub(idx); setShowSubMenu(false); }}
                            className={`w-full text-left px-2 py-1 rounded text-xs ${selectedSub === idx ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-white/5'}`}
                          >
                            {s.label || `Track ${idx + 1}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Speed Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                    className="text-xs font-bold px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200"
                  >
                    {playbackRate}x
                  </button>

                  {showSettingsMenu && (
                    <div className="absolute bottom-10 right-0 w-32 bg-[#0F1117]/95 backdrop-blur-xl border border-white/10 rounded-xl p-2 shadow-2xl space-y-1 z-50">
                      <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                        Speed
                      </p>
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => {
                            if (videoRef.current) videoRef.current.playbackRate = rate;
                            setPlaybackRate(rate);
                            setShowSettingsMenu(false);
                          }}
                          className={`w-full text-left px-2 py-1 rounded text-xs ${playbackRate === rate ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-white/5'}`}
                        >
                          {rate}x {rate === 1 && '(Normal)'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Next Episode Button */}
                {onNextEpisode && (
                  <button
                    onClick={onNextEpisode}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-400 transition-colors"
                    title="Next Episode"
                  >
                    <FastForward className="w-5 h-5" />
                  </button>
                )}

                {/* Fullscreen Button */}
                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white transition-colors"
                  title="Fullscreen (F)"
                >
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
