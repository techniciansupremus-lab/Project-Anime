import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Globe } from 'lucide-react';

export default function VideoPlayer({ source, poster, subtitles }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [error, setError] = useState(null);

  const isIframe = Boolean(source?.iframeSrc);
  const streamUrl = source?.url;
  const sourceError = source?.error;

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
    setShowOverlay(true);
    setError(sourceError || null);

    if (!streamUrl) {
      if (!sourceError) {
        setError('No playable source is available for this episode.');
      }
      return;
    }

    if (source?.isM3U8 && Hls.isSupported()) {
      const hls = new Hls({
        maxMaxBufferLength: 30,
        enableWorker: true
      });
      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (!data.fatal) return;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }

        setError('Failed to load video stream.');
        hls.destroy();
      });
    } else {
      video.src = streamUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [source, isIframe, streamUrl, sourceError]);

  const handleStartPlay = () => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    video.play()
      .then(() => setShowOverlay(false))
      .catch(() => setShowOverlay(false));
  };

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
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            position: 'absolute',
            top: 0,
            left: 0
          }}
        />
      </div>
    );
  }

  return (
    <div className="player-wrapper">
      {showOverlay && !error && (
        <div className="player-overlay" onClick={handleStartPlay}>
          <div className="player-overlay-icon">
            <Play size={32} fill="white" />
          </div>
        </div>
      )}

      {error ? (
        <div className="player-error">
          {error}
        </div>
      ) : (
        <video
          ref={videoRef}
          className="player-video"
          controls
          poster={poster}
          playsInline
          crossOrigin="anonymous"
          onPlay={() => setShowOverlay(false)}
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
      )}
    </div>
  );
}
