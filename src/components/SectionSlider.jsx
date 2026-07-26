import React, { useEffect, useRef, useState } from 'react';
import { Flame, Mic, Swords, Compass, Skull, Zap, Heart, Smile, Film, Clapperboard, BookOpen, Tv } from 'lucide-react';
import './SectionSlider.css';

const SECTIONS = [
  { id: 'anime', label: 'Anime', icon: Tv },
  { id: 'drama', label: 'Drama', icon: Film },
  { id: 'movies', label: 'Movies', icon: Clapperboard },
  { id: 'comic', label: 'Comic', icon: BookOpen },
];

const ANIME_CATEGORIES = [
  {
    id: 'topanime',
    label: 'Top Anime / Shows',
    path: '/anime/topanime',
    icon: Flame,
    sub: 'Trending & Popular',
    desc: 'Highest rated and trending anime series',
    color: '#ff4757',
  },
  {
    id: 'hindi',
    label: 'Hindi Dubbed Anime',
    path: '/anime/hindi',
    icon: Mic,
    sub: 'Hindi Audio Available',
    desc: 'Stream anime dubbed in Hindi',
    color: '#e50914',
  },
  {
    id: 'action',
    label: 'Action',
    path: '/anime/action',
    icon: Swords,
    sub: 'High Octane & Fights',
    desc: 'Epic martial arts, battles & powers',
    color: '#ff6b81',
  },
  {
    id: 'adventure',
    label: 'Adventure',
    path: '/anime/adventure',
    icon: Compass,
    sub: 'Quests & Fantasy',
    desc: 'Journeys into mysterious new worlds',
    color: '#ffa502',
  },
  {
    id: 'horror',
    label: 'Horror',
    path: '/anime/horror',
    icon: Skull,
    sub: 'Supernatural & Dark',
    desc: 'Chilling tales and terrifying curses',
    color: '#a4b0be',
  },
  {
    id: 'thriller',
    label: 'Thriller',
    path: '/anime/thriller',
    icon: Zap,
    sub: 'Suspense & Mind Games',
    desc: 'Psychological tension and twists',
    color: '#70a1ff',
  },
  {
    id: 'romance',
    label: 'Romance',
    path: '/anime/romance',
    icon: Heart,
    sub: 'Love & High School',
    desc: 'Heartwarming romantic stories',
    color: '#ff78ae',
  },
  {
    id: 'comedy',
    label: 'Comedy',
    path: '/anime/comedy',
    icon: Smile,
    sub: 'Fun & Parody',
    desc: 'Hilarious, lighthearted entertainment',
    color: '#2ed573',
  },
];

export default function SectionSlider({ activeSection = 'anime', onSectionChange, activeCategory = 'topanime', onCategoryChange }) {
  const [open, setOpen] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const panelRef = useRef(null);
  const hotzoneRef = useRef(null);
  const closeTimer = useRef(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) &&
          hotzoneRef.current && !hotzoneRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const handleHotzoneEnter = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const handlePanelLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 300);
  };

  const handlePanelEnter = () => {
    clearTimeout(closeTimer.current);
  };

  const handleMainSectionClick = (sectionId) => {
    if (onSectionChange) onSectionChange(sectionId);
  };

  const handleCategoryClick = (cat) => {
    setOpen(false);
    // Push browser URL e.g. /anime/topanime, /anime/action, /anime/hindi
    try {
      window.history.pushState(null, '', cat.path);
    } catch (e) {}

    if (onCategoryChange) {
      onCategoryChange(cat.id, cat);
    } else if (onSectionChange) {
      onSectionChange('anime', cat.id);
    }
  };

  return (
    <>
      {/* Invisible left-edge hotzone */}
      <div
        ref={hotzoneRef}
        className="slider-hotzone"
        onMouseEnter={handleHotzoneEnter}
      />

      {/* Animated tab hint visible on the edge */}
      <div
        className={`slider-tab-hint ${open ? 'slider-tab-hint--hidden' : ''}`}
        onMouseEnter={handleHotzoneEnter}
        aria-hidden="true"
      >
        <span className="slider-tab-hint__chevron">›</span>
      </div>

      {/* Backdrop overlay */}
      <div
        className={`slider-backdrop ${open ? 'slider-backdrop--visible' : ''}`}
        onClick={() => setOpen(false)}
      />

      {/* Slide panel with Glassmorphism */}
      <div
        ref={panelRef}
        className={`slider-panel slider-panel--glass ${open ? 'slider-panel--open' : ''}`}
        onMouseLeave={handlePanelLeave}
        onMouseEnter={handlePanelEnter}
        role="dialog"
        aria-label="Anime categories sidebar"
      >
        {/* Panel Header */}
        <div className="slider-panel__header">
          <div className="slider-panel__brand-row">
            <img src="/logo.png" alt="Logo" className="slider-panel__brand-img" />
            <div className="slider-panel__logo">EetNet</div>
          </div>
          <p className="slider-panel__subtitle">ANIME MULTIVERSE & GENRES</p>

          {/* Section Switcher Pills */}
          <div className="slider-section-pills">
            {SECTIONS.map((sec) => (
              <button
                key={sec.id}
                className={`slider-sec-pill ${activeSection === sec.id ? 'active' : ''}`}
                onClick={() => handleMainSectionClick(sec.id)}
              >
                <sec.icon size={13} />
                <span>{sec.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Categories / Genres List */}
        <div className="slider-panel__cards">
          {activeSection === 'anime' && (
            <>
              <div className="slider-category-heading">ANIME CATEGORIES</div>
              {ANIME_CATEGORIES.map((cat, i) => {
                const isActive = activeCategory === cat.id;
                const IconComponent = cat.icon;
                return (
                  <button
                    key={cat.id}
                    className={`slider-card ${isActive ? 'slider-card--active' : ''}`}
                    style={{
                      '--card-accent': cat.color,
                      animationDelay: `${i * 0.04}s`,
                    }}
                    onClick={() => handleCategoryClick(cat)}
                    onMouseEnter={() => setHoveredCard(cat.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                    id={`anime-cat-${cat.id}-btn`}
                  >
                    {/* Active indicator bar */}
                    {isActive && <div className="slider-card__active-bar" style={{ background: cat.color }} />}

                    {/* Content */}
                    <div className="slider-card__content">
                      <span
                        className="slider-card__icon-container"
                        style={{ color: isActive ? '#fff' : cat.color, background: isActive ? cat.color : 'rgba(255, 255, 255, 0.05)' }}
                      >
                        <IconComponent size={20} className="slider-card__icon" />
                      </span>
                      <div className="slider-card__text">
                        <span className="slider-card__label">{cat.label}</span>
                        <span className="slider-card__sub">{cat.sub}</span>
                        <span className="slider-card__desc">{cat.desc}</span>
                      </div>
                      {isActive && (
                        <span className="slider-card__check" style={{ color: cat.color }} aria-label="Active">✓</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {activeSection !== 'anime' && (
            <div style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.85rem' }}>
              Select <strong>Anime</strong> tab above to view all anime genres & categories.
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="slider-panel__footer">
          <span className="slider-panel__footer-hint">Hover left edge anytime to filter anime</span>
        </div>
      </div>
    </>
  );
}
