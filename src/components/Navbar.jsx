import React, { useState, useEffect, useRef } from 'react';
import { Bell, ChevronDown, Search, LogOut, User, Bookmark, History, X, Home, Tv, Clapperboard, Film } from 'lucide-react';

export function MobileBottomNav({ activeSection, activeView, setView, setSection, user, onSignIn }) {
  return (
    <nav className="mobile-bottom-nav">
      <button
        className={`mobile-nav-item ${activeSection === 'anime' && (activeView === 'anime' || activeView === 'home') ? 'active' : ''}`}
        onClick={() => { setSection('anime'); setView('anime'); window.scrollTo(0,0); }}
      >
        <Home size={20} />
        <span>Anime</span>
      </button>

      <button
        className={`mobile-nav-item ${activeSection === 'drama' ? 'active' : ''}`}
        onClick={() => { setSection('drama'); setView('dramas'); window.scrollTo(0,0); }}
      >
        <Clapperboard size={20} />
        <span>Drama</span>
      </button>

      <button
        className={`mobile-nav-item ${activeSection === 'movies' ? 'active' : ''}`}
        onClick={() => { setSection('movies'); setView('movies'); window.scrollTo(0,0); }}
      >
        <Film size={20} />
        <span>Movies</span>
      </button>

      <button
        className={`mobile-nav-item ${activeSection === 'comic' ? 'active' : ''}`}
        onClick={() => { setSection('comic'); setView('manhwa'); window.scrollTo(0,0); }}
      >
        <Tv size={20} />
        <span>Comic</span>
      </button>

      <button
        className={`mobile-nav-item ${activeView === 'my-list' ? 'active' : ''}`}
        onClick={() => {
          if (!user) { if (onSignIn) onSignIn(); return; }
          setView('my-list'); window.scrollTo(0,0);
        }}
      >
        <Bookmark size={20} />
        <span>My List</span>
      </button>
    </nav>
  );
}

export default function Navbar({ onSearch, activeView, setView, onHome, activeSection = 'anime', user, onSignIn, onSignOut }) {
  const [searchVal, setSearchVal] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const searchInputRef = useRef(null);

  // Sync searchVal state when section changes or search is cleared externally
  useEffect(() => {
    setSearchVal('');
  }, [activeSection]);

  // Close profile dropdown & search on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (showSearchInput && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearchInput]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(searchVal);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchVal(val);
    if (onSearch) onSearch(val);
  };

  const handleNavClick = (viewName, sectionName = 'anime') => {
    setSearchVal('');
    if (onSearch) onSearch('');
    if (sectionName === 'anime') {
      if (viewName === 'home' && onHome) onHome();
      else setView(viewName);
    } else if (sectionName === 'drama') {
      setView('dramas');
    } else if (sectionName === 'movies') {
      setView('movies');
    } else if (sectionName === 'comic') {
      setView('manhwa');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Derive user display name / avatar letter
  const displayName = user?.user_metadata?.username || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const avatarUrl = user?.user_metadata?.avatar_url || null;

  return (
    <header className="floating-navbar-wrapper">
      <nav className="floating-glass-nav">
        {/* Brand Logo */}
        <div
          className="nav-brand-logo"
          onClick={() => handleNavClick('home', 'anime')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', marginRight: '0.85rem' }}
        >
          <img
            src="/logo.png"
            alt="Website Logo"
            style={{ height: '36px', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}
          />
        </div>

        {/* Navigation Links Pill Group */}
        <div className="nav-pill-links">
          <button
            className={`nav-pill-btn ${activeView === 'home' ? 'active' : ''}`}
            onClick={() => handleNavClick('home', 'anime')}
          >
            Home
          </button>
          <button
            className={`nav-pill-btn ${activeView === 'movies' ? 'active' : ''}`}
            onClick={() => handleNavClick('movies', 'movies')}
          >
            Movies
          </button>
          <button
            className={`nav-pill-btn ${activeView === 'tv-shows' ? 'active' : ''}`}
            onClick={() => handleNavClick('tv-shows', 'anime')}
          >
            TV Shows
          </button>
          <button
            className={`nav-pill-btn ${activeView === 'anime' ? 'active' : ''}`}
            onClick={() => handleNavClick('anime', 'anime')}
          >
            Anime
          </button>
          <button
            className={`nav-pill-btn ${activeView === 'dramas' ? 'active' : ''}`}
            onClick={() => handleNavClick('dramas', 'drama')}
          >
            Drama
          </button>
          <button
            className={`nav-pill-btn ${activeView === 'manhwa' ? 'active' : ''}`}
            onClick={() => handleNavClick('manhwa', 'comic')}
          >
            Manhwa
          </button>
        </div>

        {/* Action Icons Group */}
        <div className="nav-pill-actions">
          {/* Search Toggle / Input */}
          <div className={`nav-search-wrapper ${showSearchInput ? 'expanded' : ''}`}>
            {showSearchInput ? (
              <form onSubmit={handleSearchSubmit} className="nav-search-form">
                <Search size={15} className="nav-search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search..."
                  value={searchVal}
                  onChange={handleInputChange}
                  onBlur={() => { if (!searchVal) setShowSearchInput(false); }}
                />
                <button type="button" className="nav-search-close" onClick={() => setShowSearchInput(false)}>
                  <X size={14} />
                </button>
              </form>
            ) : (
              <button
                className="nav-icon-btn"
                onClick={() => setShowSearchInput(true)}
                title="Search"
                aria-label="Search"
              >
                <Search size={16} />
              </button>
            )}
          </div>

          {/* Watchlist Icon */}
          <button
            className={`nav-icon-btn ${activeView === 'my-list' ? 'active' : ''}`}
            onClick={() => {
              if (!user) { if (onSignIn) onSignIn(); return; }
              setView('my-list');
            }}
            title="My List"
            aria-label="My List"
          >
            <Bookmark size={16} />
          </button>

          {/* Auth Button or Profile Menu */}
          {user ? (
            <div className="profile-chip-wrapper" ref={profileRef}>
              <button
                className="profile-chip-btn"
                onClick={() => setProfileOpen(v => !v)}
                aria-label="Profile"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="avatar-img" />
                ) : (
                  <span className="avatar-letter">{avatarLetter}</span>
                )}
                <ChevronDown size={13} className={`chevron ${profileOpen ? 'open' : ''}`} />
              </button>

              {profileOpen && (
                <div className="profile-dropdown" role="menu">
                  <div className="profile-dropdown-header">
                    <div className="profile-dropdown-avatar">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={displayName} />
                      ) : (
                        <span>{avatarLetter}</span>
                      )}
                    </div>
                    <div className="profile-dropdown-info">
                      <strong>{displayName}</strong>
                      <small>{user.email}</small>
                    </div>
                  </div>
                  <div className="profile-dropdown-divider" />
                  <button className="profile-dropdown-item" onClick={() => { setProfileOpen(false); setView('my-list'); }}>
                    <Bookmark size={15} /> My Watchlist
                  </button>
                  <button className="profile-dropdown-item" onClick={() => { setProfileOpen(false); }}>
                    <History size={15} /> Watch History
                  </button>
                  <button className="profile-dropdown-item" onClick={() => { setProfileOpen(false); }}>
                    <User size={15} /> Account Settings
                  </button>
                  <div className="profile-dropdown-divider" />
                  <button className="profile-dropdown-item profile-dropdown-signout" onClick={() => { setProfileOpen(false); if (onSignOut) onSignOut(); }}>
                    <LogOut size={15} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="nav-signin-pill-btn" onClick={onSignIn}>
              <LogOut size={14} style={{ transform: 'rotate(180deg)' }} />
              <span>Sign in</span>
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
