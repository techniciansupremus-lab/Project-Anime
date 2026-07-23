import React, { useState, useEffect, useRef } from 'react';
import { Bell, ChevronDown, Search, LogOut, User, Bookmark, History, X, Home, Tv, Clapperboard, Film } from 'lucide-react';

export function MobileBottomNav({ activeSection, activeView, setView, setSection, user, onSignIn }) {
  return (
    <nav className="mobile-bottom-nav">
      <button
        className={`mobile-nav-item ${activeSection === 'anime' && (activeView === 'home' || activeView === 'tv-shows') ? 'active' : ''}`}
        onClick={() => { setSection('anime'); setView('home'); window.scrollTo(0,0); }}
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
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Sync searchVal state when section changes or search is cleared externally
  useEffect(() => {
    setSearchVal('');
  }, [activeSection]);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(searchVal);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchVal(val);
    if (onSearch) onSearch(val);
  };

  const handleHomeClick = () => {
    setSearchVal('');
    if (onSearch) onSearch('');
    
    if (activeSection === 'drama') {
      setView('dramas');
    } else if (activeSection === 'movies') {
      setView('movies');
    } else if (activeSection === 'comic') {
      setView('manhwa');
    } else {
      if (onHome) {
        onHome();
      } else {
        setView('home');
      }
    }
  };

  const getSearchPlaceholder = () => {
    switch (activeSection) {
      case 'drama':
        return 'Search dramas, actors...';
      case 'movies':
        return 'Search movies, Bollywood...';
      case 'comic':
        return 'Search manhwa, comics...';
      default:
        return 'Search anime titles, genres...';
    }
  };

  // Derive user display name / avatar letter
  const displayName = user?.user_metadata?.username || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const avatarUrl = user?.user_metadata?.avatar_url || null;

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <div className="logo" onClick={handleHomeClick}>
          <img src="/logo.png" alt="EetNet Logo" className="logo-img" />
          <span className={`section-badge section-badge--${activeSection}`}>
            {activeSection === 'comic' ? 'Comic' : activeSection === 'drama' ? 'Drama' : activeSection === 'movies' ? 'Movies' : 'Anime'}
          </span>
        </div>

        <div className="nav-links primary-nav">
          {activeSection === 'anime' && (
            <>
              <div
                className={`nav-link ${activeView === 'home' ? 'active' : ''}`}
                onClick={handleHomeClick}
              >
                Home
              </div>
              <div
                className={`nav-link ${activeView === 'tv-shows' ? 'active' : ''}`}
                onClick={() => { setSearchVal(''); if (onSearch) onSearch(''); setView('tv-shows'); }}
              >
                TV Shows
              </div>
              <div
                className={`nav-link ${activeView === 'movies' ? 'active' : ''}`}
                onClick={() => { setSearchVal(''); if (onSearch) onSearch(''); setView('movies'); }}
              >
                Movies
              </div>
              <div
                className={`nav-link ${activeView === 'new-popular' ? 'active' : ''}`}
                onClick={() => { setSearchVal(''); if (onSearch) onSearch(''); setView('new-popular'); }}
              >
                New &amp; Popular
              </div>
              <div
                className={`nav-link nav-link--hindi ${activeView === 'hindi' ? 'active' : ''}`}
                onClick={() => { setSearchVal(''); if (onSearch) onSearch(''); setView('hindi'); }}
              >
                Hindi
              </div>
              <div
                className={`nav-link ${activeView === 'my-list' ? 'active' : ''}`}
                onClick={() => {
                  if (!user) { if (onSignIn) onSignIn(); return; }
                  setSearchVal(''); if (onSearch) onSearch(''); setView('my-list');
                }}
              >
                My List
              </div>
            </>
          )}

          {activeSection === 'drama' && (
            <>
              <div
                className={`nav-link ${activeView === 'dramas' ? 'active' : ''}`}
                onClick={handleHomeClick}
              >
                Drama Home
              </div>
            </>
          )}

          {activeSection === 'movies' && (
            <>
              <div
                className={`nav-link ${activeView === 'movies' ? 'active' : ''}`}
                onClick={handleHomeClick}
              >
                Movies Home
              </div>
            </>
          )}

          {activeSection === 'comic' && (
            <>
              <div
                className={`nav-link ${activeView === 'manhwa' ? 'active' : ''}`}
                onClick={handleHomeClick}
              >
                Comic Home
              </div>
            </>
          )}
        </div>

        <form onSubmit={handleSearchSubmit} className="search-bar">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder={getSearchPlaceholder()} 
            value={searchVal}
            onChange={handleInputChange}
          />
        </form>

        <div className="nav-actions">
          <Bell size={19} />

          {user ? (
            /* ── Logged-in profile chip ── */
            <div className="profile-chip-wrapper" ref={profileRef}>
              <button
                id="profile-chip-btn"
                className="profile-chip"
                onClick={() => setProfileOpen(v => !v)}
                aria-expanded={profileOpen}
                aria-label="Open profile menu"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="avatar-img" />
                ) : (
                  <span className="avatar-letter">{avatarLetter}</span>
                )}
                <ChevronDown size={15} className={`chevron ${profileOpen ? 'open' : ''}`} />
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
            /* ── Guest sign-in button ── */
            <button id="navbar-signin-btn" className="navbar-signin-btn" onClick={onSignIn}>
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
