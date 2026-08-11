import React from 'react';
import { Play, Bookmark, ThumbsUp, Share2, Star } from 'lucide-react';
import { apiUrl } from '../../../runtimeConfig';
import { InlineLoader } from '../../../App';
import MovieCard from './MovieCard';

function cleanMovieDisplayTitle(raw) {
  if (!raw) return 'Untitled Movie';
  const cleaned = raw
    .replace(/\bWatch\s+Online\b/gi, '')
    .replace(/\bFull\s+Movie\b/gi, '')
    .replace(/\bFull\s+Web\s+Series\b/gi, '')
    .replace(/\bDownload\s+Now\b/gi, '')
    .replace(/\(\d{4}\)/g, '').replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/E\d+[-T]\d+/gi, '').replace(/\bE\d+\b/gi, '').replace(/\bS\d+\b/gi, '')
    .replace(/\bPart\s*\d+\b/gi, '').replace(/\bVolume\s*\d+\b/gi, '').replace(/\bVol\.?\s*\d+\b/gi, '')
    .replace(/\bEpisode\s*\d+\b/gi, '').replace(/\bSeason\s*\d+\b/gi, '').replace(/\bComplete\b/gi, '')
    .replace(/\b(Hindi Dubbed|Hindi Dub|Hindi|Bengali|Malayalam|Tamil|Telugu|Kannada|Marathi|Punjabi|Gujarati|English|Bangladeshi|South Indian|Korean|Japanese|Chinese|Thai)\b/gi, '')
    .replace(/\b(HDRip|BluRay|WEB-DL|WEBRip|UNCUT|HDTS|HDTC|HDCam|HDCAM|CAMRip|CAM|DVDSCR|DVDScr|SCR|TS|DVDRIP|DVDRip|HD|4K|1080p|720p|480p|360p|Extended|Directors.?Cut)\b/gi, '')
    .replace(/\b(Hollywood|Bollywood|Tollywood|Mollywood|Kollywood|Pollywood)\b/gi, '')
    .replace(/\b(Short Film|App Video|Webseries|Web Series|OTT|Originals|Exclusive)\b/gi, '')
    .replace(/\b(Sigmaseries|Sigma|Cukkuboo|Hulchul|HulChul|Hoichoi|Moodx|Kooku|Ullu|ALTBalaji|PrimeShots|Rabbit|RabbitMovies|Voovi|Chikooflix|Atrangii|NewSensations|LookEnt|Nuefliks|GupChup|Hotshots|Flizmovies|Mastram|DigiMoviePlex|Balloons|Besharams|Cinemadosti|Netflix|Amazon|Hotstar|SonyLiv|ZEE5|Voot|MXPlayer|JioCinema|Aha|Lionsgate|Disney)\b/gi, '')
    .replace(/\bMovie\b/gi, '').replace(/\bSeries\b/gi, '').replace(/\bFilm\b/gi, '')
    .replace(/[-_:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || raw;
}

function MovieDetailView({ movie, isLoading, onBack, onWatch }) {
  const [relatedMovies, setRelatedMovies] = React.useState([]);
  const [relatedLoading, setRelatedLoading] = React.useState(false);
  const [inWatchlist, setInWatchlist] = React.useState(false);

  const displayTitle = cleanMovieDisplayTitle(movie.title);
  const yearMatch = (movie.title || '').match(/\b(19|20)\d{2}\b/);
  const releaseYear = movie.releaseDate ? String(movie.releaseDate).split('-')[0] : (yearMatch ? yearMatch[0] : '2024');
  const heroImage = movie.bannerImage || movie.coverImage || movie.thumbnail || '';

  // Fetch "More Like This" recommendations
  React.useEffect(() => {
    setRelatedLoading(true);
    fetch(apiUrl('/api/movieplex/catalog?page=1&limit=12'))
      .then(r => r.json())
      .then(res => {
        const items = Array.isArray(res.movies) ? res.movies.filter(m => m.id !== movie.id) : [];
        setRelatedMovies(items.slice(0, 10));
        setRelatedLoading(false);
      })
      .catch(() => setRelatedLoading(false));
  }, [movie.id]);

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a', color: '#fff',
      fontFamily: '"Inter","Roboto",sans-serif'
    }}>
      {/* Full-bleed 75vh Billboard Hero */}
      <div style={{
        position: 'relative', minHeight: '72vh', width: '100%',
        backgroundImage: `url(${heroImage})`,
        backgroundSize: 'cover', backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat'
      }}>
        {/* Triple Netflix Scrim Gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, #0a0a0a 0%, rgba(10,10,10,0.8) 35%, rgba(10,10,10,0.2) 75%, transparent 100%), linear-gradient(to top, #0a0a0a 0%, rgba(10,10,10,0.6) 45%, transparent 100%)'
        }} />

        {/* Floating Back Button */}
        <div style={{ position: 'absolute', top: '1.5rem', left: 'clamp(1rem, 4vw, 3rem)', zIndex: 10 }}>
          <button onClick={onBack} style={{
            background: 'rgba(20,20,20,0.8)', border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', padding: '0.5rem 1.2rem', borderRadius: '30px',
            cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            backdropFilter: 'blur(10px)', boxShadow: '0 4px 16px rgba(0,0,0,0.6)'
          }}>← Back to Movies</button>
        </div>

        {/* Hero Content */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '3rem clamp(1rem, 4vw, 3rem) 3rem',
          maxWidth: '850px', zIndex: 5
        }}>
          {/* Netflix Quality & Language Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
            <span style={{ background: '#E50914', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '3px', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>Movie</span>
            <span style={{ color: '#46d369', fontWeight: 800, fontSize: '0.88rem' }}>98% Match</span>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600 }}>{releaseYear}</span>
            <span style={{ border: '1px solid rgba(255,255,255,0.4)', padding: '1px 5px', borderRadius: '2px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>16+</span>
            <span style={{ border: '1px solid rgba(255,255,255,0.4)', padding: '1px 5px', borderRadius: '2px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>4K Ultra HD</span>
            <span style={{ background: 'rgba(255,255,255,0.15)', padding: '2px 7px', borderRadius: '3px', fontSize: '0.72rem', color: '#fff', fontWeight: 600 }}>Hindi Dubbed</span>
            {movie.rating && <span style={{ color: '#facc15', fontWeight: 700, fontSize: '0.85rem' }}>★ {movie.rating}</span>}
          </div>

          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3.4rem)', margin: '0 0 1rem',
            fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.12,
            textShadow: '0 2px 24px rgba(0,0,0,0.95)'
          }}>{displayTitle}</h1>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '1.8rem' }}>
            <button
              onClick={onWatch}
              style={{
                background: '#E50914', color: '#fff',
                border: 'none', padding: '0.85rem 2.5rem',
                borderRadius: '6px', fontSize: '1.05rem', fontWeight: 800,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                transition: 'all 0.18s ease',
                boxShadow: '0 6px 20px rgba(229,9,20,0.5)'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#F6121D'}
              onMouseLeave={e => e.currentTarget.style.background = '#E50914'}
            >
              ▶ Play Movie
            </button>

            <button
              onClick={() => setInWatchlist(!inWatchlist)}
              style={{
                background: inWatchlist ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)',
                color: '#fff', border: '1px solid rgba(255,255,255,0.25)',
                padding: '0.85rem 1.8rem', borderRadius: '6px', fontSize: '0.95rem', fontWeight: 600,
                cursor: 'pointer', backdropFilter: 'blur(8px)', transition: 'all 0.18s'
              }}
            >
              {inWatchlist ? '✓ In My List' : '+ Add to My List'}
            </button>
          </div>
        </div>
      </div>

      {/* Netflix 2-Column Info & Overview Section */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2.5rem clamp(1rem, 4vw, 3rem) 4rem' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2.5rem', marginBottom: '3.5rem'
        }}>
          {/* Left Column: Synopsis */}
          <div>
            <h3 style={{ margin: '0 0 0.8rem', color: '#fff', fontSize: '1.1rem', fontWeight: 700 }}>Storyline</h3>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.78)', lineHeight: 1.7, fontSize: '0.95rem' }}>
              {movie.description || `${displayTitle} is a gripping high-stakes cinematic release featuring high quality dual audio, intense drama, and suspenseful twists. Stream in full HD resolution with CORS-enabled fast playback on EetNet.`}
            </p>
          </div>

          {/* Right Column: Metadata Sidebar */}
          <div style={{
            background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
            padding: '1.5rem', border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>Audio & Dubbing</span>
              <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>Hindi Dubbed, Original Audio (Dual Audio)</span>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>Genres</span>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {(movie.genres || ['Action', 'Thriller', 'Drama']).map(g => (
                  <span key={g} style={{
                    padding: '0.2rem 0.7rem', background: 'rgba(255,255,255,0.08)',
                    borderRadius: '12px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)'
                  }}>{g}</span>
                ))}
              </div>
            </div>

            <div>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>Quality & Format</span>
              <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>1080p Full HD (HLS CORS Stream)</span>
            </div>
          </div>
        </div>

        {/* "More Like This" Recommendation Grid */}
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 1.2rem', color: '#fff' }}>
            More Like This
          </h2>

          {relatedLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
              {[1,2,3,4,5,6].map(i => <div key={i} className="mp-skeleton-card" />)}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '1.2rem 1rem'
            }}>
              {relatedMovies.map((m, idx) => (
                <MovieCard key={m.id + '-' + idx} movie={m} onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  onWatch(m);
                }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MovieDetailView;
