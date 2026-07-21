import React, { useEffect, useRef, useState } from 'react';
import { Tv, Film, BookOpen, Clapperboard } from 'lucide-react';
import './SectionSlider.css';

const SECTIONS = [
  {
    id: 'anime',
    label: 'Anime',
    icon: Tv,
    sub: 'Series · Movies · New & Popular',
    desc: 'The complete anime universe',
    accentColor: '#e50914',
  },
  {
    id: 'drama',
    label: 'Drama',
    icon: Film,
    sub: 'Korean · Chinese · Japanese',
    desc: 'Stories that move the heart',
    accentColor: '#e50914',
  },
  {
    id: 'movies',
    label: 'Movies',
    icon: Clapperboard,
    sub: 'Bollywood · Hollywood Hindi · Classics',
    desc: 'The best of Indian and global cinema',
    accentColor: '#e50914',
  },
  {
    id: 'comic',
    label: 'Comic',
    icon: BookOpen,
    sub: 'Manhwa · Manga · Webtoons',
    desc: 'Art you can read panel by panel',
    accentColor: '#e50914',
  },
];

export default function SectionSlider({ activeSection, onSectionChange }) {
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

  const handleSectionClick = (sectionId) => {
    setOpen(false);
    if (onSectionChange) onSectionChange(sectionId);
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

      {/* Slide panel */}
      <div
        ref={panelRef}
        className={`slider-panel ${open ? 'slider-panel--open' : ''}`}
        onMouseLeave={handlePanelLeave}
        onMouseEnter={handlePanelEnter}
        role="dialog"
        aria-label="Section selector"
      >
        {/* Panel header */}
        <div className="slider-panel__header">
          <div className="slider-panel__logo">EetNet</div>
          <p className="slider-panel__subtitle">Choose your world</p>
        </div>

        {/* Section cards */}
        <div className="slider-panel__cards">
          {SECTIONS.map((section, i) => {
            const isActive = activeSection === section.id;
            const isHovered = hoveredCard === section.id;
            return (
              <button
                key={section.id}
                className={`slider-card ${isActive ? 'slider-card--active' : ''}`}
                style={{
                  '--card-accent': section.accentColor,
                  animationDelay: `${i * 0.07}s`,
                }}
                onClick={() => handleSectionClick(section.id)}
                onMouseEnter={() => setHoveredCard(section.id)}
                onMouseLeave={() => setHoveredCard(null)}
                id={`section-${section.id}-btn`}
              >
                {/* Card background fill */}
                <div className="slider-card__bg" />

                {/* Active indicator */}
                {isActive && <div className="slider-card__active-bar" />}

                {/* Content */}
                <div className="slider-card__content">
                  <span className="slider-card__icon-container">
                    <section.icon size={24} className="slider-card__icon" />
                  </span>
                  <div className="slider-card__text">
                    <span className="slider-card__label">{section.label}</span>
                    <span className="slider-card__sub">{section.sub}</span>
                    <span className="slider-card__desc">{section.desc}</span>
                  </div>
                  {isActive && (
                    <span className="slider-card__check" aria-label="Active">✓</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="slider-panel__footer">
          <span className="slider-panel__footer-hint">Hover left edge anytime to switch</span>
        </div>
      </div>
    </>
  );
}
