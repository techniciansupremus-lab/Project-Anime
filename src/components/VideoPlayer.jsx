import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Tv, Globe, Subtitles } from 'lucide-react';

export default function VideoPlayer({ source, poster, subtitles, malId, episodeNumber }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const isDraggingRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState(null);
  const [bufferPercent, setBufferPercent] = useState(0);
  const [ccActive, setCcActive] = useState(true);
  const [rippleAction, setRippleAction] = useState(null);

  // AniSkip state
  const [skipTimes, setSkipTimes] = useState(null); // { op: {start, end}, ed: {start, end} }
  const [activeSkip, setActiveSkip] = useState(null); // 'op' | 'ed' | null

  const isIframe = Boolean(source?.iframeSrc);
  const streamUrl = source?.url;
  const sourceError = source?.error;

  // ── AniSkip fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    setSkipTimes(null);
    setActiveSkip(null);

    if (!malId || !episodeNumber) return;

    const fetchSkipTimes = async () => {
      try {
        const url = `https://api.aniskip.com/v1/skip-times/${malId}/${episodeNumber}?types[]=op&types[]=ed`;
        const res = await fetch(url);
        const data = await res.json();

        if (!data.found || !data.results?.length) return;

        const times = {};
        for (const result of data.results) {
          times[result.skip_type] = {
            start: result.interval.start_time,
            end: result.interval.end_time
          };
        }
        setSkipTimes(times);
      } catch (e) {
        // silently fail — skip intro is optional
        console.warn('AniSkip fetch failed:', e);
      }
    };

    fetchSkipTimes();
  }, [malId, episodeNumber]);

  // ── Detect active skip window as video plays ───────────────────────────────
  useEffect(() => {
    if (!skipTimes) {
      setActiveSkip(null);
      return;
    }

    let detected = null;
    if (skipTimes.op && currentTime >= skipTimes.op.start && currentTime < skipTimes.op.end) {
      detected = 'op';
    } else if (skipTimes.ed && currentTime >= skipTimes.ed.start && currentTime < skipTimes.ed.end) {
      detected = 'ed';
    }
    setActiveSkip(detected);
  }, [currentTime, skipTimes]);

  const handleSkip = () => {
    const video = videoRef.current;
    if (!video || !activeSkip || !skipTimes[activeSkip]) return;
    video.currentTime = skipTimes[activeSkip].end;
    setActiveSkip(null);
  };

  // ── Initialize HLS / Video source ─────────────────────────────────────────
  useEffect(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isIframe) {
      setError(null);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    video.removeAttribute('src');
    video.load();
    setIsPlaying(false);
    setCurrentTime(0);
    setBufferPercent(0);
    setIsBuffering(false);
    setError(sourceError || null);

    if (!streamUrl) {
      if (!sourceError) {
        setError('No playable source is available for this episode.');
      }
      return;
    }

    setIsBuffering(true);

    if (source?.isM3U8 && Hls.isSupported()) {
      const hls = new Hls({
        maxMaxBufferLength: 60,
        enableWorker: true,
        // Aggressive retry: helps with slow KissKH CDN responses
        manifestLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 1000,
        levelLoadingMaxRetry: 6,
        levelLoadingRetryDelay: 1000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
      });
      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (!data.fatal) return;
        console.error('[HLS] Fatal error:', data.type, data.details);
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) { hls.startLoad(); return; }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { hls.recoverMediaError(); return; }
        setError('Stream failed to load. The episode may be unavailable.');
        setIsBuffering(false);
        hls.destroy();
      });
    } else {
      video.src = streamUrl;
    }

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [source, isIframe, streamUrl, sourceError]);

  // ── CC (subtitles) ────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = video.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = ccActive ? 'showing' : 'hidden';
    }
  }, [ccActive, subtitles]);

  // ── Video Events ──────────────────────────────────────────────────────────
  const onPlay = () => { setIsPlaying(true); setIsBuffering(false); };
  const onPause = () => setIsPlaying(false);
  const onWaiting = () => setIsBuffering(true);
  const onCanPlay = () => setIsBuffering(false);

  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);

    if (video.buffered.length > 0 && video.duration) {
      let bufferedEnd = 0;
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= video.currentTime && video.buffered.end(i) >= video.currentTime) {
          bufferedEnd = video.buffered.end(i);
          break;
        }
      }
      setBufferPercent((bufferedEnd / video.duration) * 100);
    }
  };

  const onDurationChange = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  // ── Video Actions ─────────────────────────────────────────────────────────
  const triggerRipple = (type) => {
    setRippleAction(type);
    setTimeout(() => setRippleAction(null), 500);
  };

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (!isDraggingRef.current) setShowControls(false);
    }, 2500);
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;
    if (video.paused) {
      video.play().catch(console.error);
      triggerRipple('play');
    } else {
      video.pause();
      triggerRipple('pause');
    }
    resetControlsTimeout();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
    resetControlsTimeout();
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    const video = videoRef.current;
    if (!video) return;
    video.volume = val;
    video.muted = val === 0;
    setVolume(val);
    setIsMuted(val === 0);
    resetControlsTimeout();
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
    resetControlsTimeout();
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const togglePiP = () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(console.error);
    } else {
      video.requestPictureInPicture().catch(console.error);
    }
    resetControlsTimeout();
  };

  const skipTime = (amount) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + amount));
    triggerRipple(amount > 0 ? 'forward' : 'backward');
    resetControlsTimeout();
  };

  // ── Keyboard Shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    if (isIframe) return;

    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT') return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k': e.preventDefault(); togglePlay(); break;
        case 'm': toggleMute(); break;
        case 'f': toggleFullscreen(); break;
        case 'arrowleft': e.preventDefault(); skipTime(-10); break;
        case 'arrowright': e.preventDefault(); skipTime(10); break;
        case 'arrowup':
          e.preventDefault();
          setVolume(prev => {
            const next = Math.min(1, prev + 0.1);
            if (videoRef.current) { videoRef.current.volume = next; videoRef.current.muted = false; }
            setIsMuted(false);
            return next;
          });
          break;
        case 'arrowdown':
          e.preventDefault();
          setVolume(prev => {
            const next = Math.max(0, prev - 0.1);
            if (videoRef.current) { videoRef.current.volume = next; videoRef.current.muted = next === 0; }
            setIsMuted(next === 0);
            return next;
          });
          break;
        case 'c': setCcActive(prev => !prev); break;
        default: break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isIframe, duration, isMuted, resetControlsTimeout]);

  // ── Timeline Scrubbing ────────────────────────────────────────────────────
  const seekTo = (e) => {
    const video = videoRef.current;
    const timeline = e.currentTarget;
    if (!video || !timeline || !duration) return;
    const rect = timeline.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const seekTime = Math.max(0, Math.min(duration, pos * duration));
    video.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const handleTimelineMouseDown = (e) => {
    isDraggingRef.current = true;
    seekTo(e);
    resetControlsTimeout();

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      seekTo({ ...moveEvent, currentTarget: e.currentTarget });
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [isPlaying, resetControlsTimeout]);

  // ── Time formatter ────────────────────────────────────────────────────────
  const formatTime = (timeInSecs) => {
    if (isNaN(timeInSecs)) return '0:00';
    const hrs = Math.floor(timeInSecs / 3600);
    const mins = Math.floor((timeInSecs - hrs * 3600) / 60);
    const secs = Math.floor(timeInSecs - hrs * 3600 - mins * 60);
    const pad = (n) => (n < 10 ? `0${n}` : n);
    return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`;
  };

  // ── Iframe Fallback ───────────────────────────────────────────────────────
  if (isIframe) {
    return (
      <div className="player-wrapper">
        <div className="iframe-badge">
          <Globe size={14} />
          <span>English Sub</span>
        </div>
        <iframe
          src={source.iframeSrc}
          className="player-iframe"
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="no-referrer"
          title="Episode player"
          style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', top: 0, left: 0 }}
        />
      </div>
    );
  }

  const playPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`player-wrapper custom-yt-player ${showControls ? 'show-controls' : 'hide-controls'}`}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {error ? (
        <div className="player-error">{error}</div>
      ) : (
        <>
          {/* Main Video Element */}
          <video
            ref={videoRef}
            className="player-video"
            poster={poster}
            playsInline
            crossOrigin="anonymous"
            onPlay={onPlay}
            onPause={onPause}
            onWaiting={onWaiting}
            onCanPlay={onCanPlay}
            onCanPlayThrough={onCanPlay}
            onTimeUpdate={onTimeUpdate}
            onDurationChange={onDurationChange}
            onClick={togglePlay}
            onDoubleClick={toggleFullscreen}
          >
            {subtitles && subtitles.map((sub, index) => (
              <track
                key={index}
                src={sub.url}
                kind="subtitles"
                srcLang={sub.lang || 'en'}
                label={sub.label || 'English'}
                default={index === 0 || sub.default}
              />
            ))}
          </video>

          {/* Buffering spinner overlay */}
          {isBuffering && !error && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.45)', zIndex: 5, pointerEvents: 'none'
            }}>
              <div className="loading-spinner" style={{ width: '52px', height: '52px', borderWidth: '4px' }} />
            </div>
          )}

          {/* Skip Intro / Skip Ending Button */}
          {activeSkip && (
            <button
              className={`skip-btn ${activeSkip === 'op' ? 'skip-op' : 'skip-ed'}`}
              onClick={handleSkip}
              aria-label={activeSkip === 'op' ? 'Skip Intro' : 'Skip Ending'}
            >
              <span className="skip-btn-label">
                {activeSkip === 'op' ? 'Skip Intro' : 'Skip Ending'}
              </span>
              <svg className="skip-btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="5 12 19 12"></polyline>
                <polyline points="13 6 19 12 13 18"></polyline>
              </svg>
            </button>
          )}

          {/* Center Ripple Indicator */}
          {rippleAction && (
            <div className="ripple-overlay-yt">
              <div className="ripple-icon-yt">
                {rippleAction === 'play' && <Play size={42} fill="white" />}
                {rippleAction === 'pause' && <Pause size={42} fill="white" />}
                {rippleAction === 'forward' && <span className="skip-text">+10s</span>}
                {rippleAction === 'backward' && <span className="skip-text">-10s</span>}
              </div>
            </div>
          )}

          {/* Custom YouTube Controls Overlay */}
          <div className="custom-yt-controls">
            {/* Timeline Progress Bar */}
            <div className="yt-timeline-container" onMouseDown={handleTimelineMouseDown}>
              <div className="yt-timeline">
                <div className="yt-buffer-bar" style={{ width: `${bufferPercent}%` }}></div>
                {/* AniSkip intro highlight markers */}
                {skipTimes?.op && duration > 0 && (
                  <div
                    className="yt-skip-marker yt-skip-marker-op"
                    style={{
                      left: `${(skipTimes.op.start / duration) * 100}%`,
                      width: `${((skipTimes.op.end - skipTimes.op.start) / duration) * 100}%`
                    }}
                    title="Opening"
                  />
                )}
                {skipTimes?.ed && duration > 0 && (
                  <div
                    className="yt-skip-marker yt-skip-marker-ed"
                    style={{
                      left: `${(skipTimes.ed.start / duration) * 100}%`,
                      width: `${((skipTimes.ed.end - skipTimes.ed.start) / duration) * 100}%`
                    }}
                    title="Ending"
                  />
                )}
                <div className="yt-play-bar" style={{ width: `${playPercent}%` }}>
                  <div className="yt-scrubber-handle"></div>
                </div>
              </div>
            </div>

            {/* Buttons & Actions Row */}
            <div className="yt-controls-row">
              <div className="yt-controls-left">
                <button className="yt-control-btn" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
                  {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
                </button>

                <div className="yt-volume-control">
                  <button className="yt-control-btn" onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'}>
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  <input
                    type="range"
                    min="0" max="1" step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="yt-volume-slider"
                    aria-label="Volume slider"
                  />
                </div>

                <div className="yt-time-display">
                  <span>{formatTime(currentTime)}</span>
                  <span className="yt-time-divider">/</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="yt-controls-right">
                {subtitles && subtitles.length > 0 && (
                  <button
                    className={`yt-control-btn CC-btn ${ccActive ? 'active' : ''}`}
                    onClick={() => setCcActive(!ccActive)}
                    aria-label="Toggle subtitles"
                  >
                    <Subtitles size={20} color={ccActive ? 'var(--accent-primary)' : 'white'} />
                  </button>
                )}

                <button className="yt-control-btn" onClick={togglePiP} aria-label="Picture in Picture">
                  <Tv size={20} />
                </button>

                <button className="yt-control-btn" onClick={toggleFullscreen} aria-label="Toggle fullscreen">
                  {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
