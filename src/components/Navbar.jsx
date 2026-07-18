import React, { useState, useEffect } from 'react';
import { Bell, ChevronDown, Search } from 'lucide-react';

export default function Navbar({ onSearch, activeView, setView, onHome, activeSection = 'anime' }) {
  const [searchVal, setSearchVal] = useState('');

  // Sync searchVal state when section changes or search is cleared externally
  useEffect(() => {
    setSearchVal('');
  }, [activeSection]);

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
      case 'comic':
        return 'Search manhwa, comics...';
      default:
        return 'Search anime titles, genres...';
    }
  };

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <div className="logo" onClick={handleHomeClick}>
          <img src="/logo.png" alt="EetNet Logo" className="logo-img" />
          <span className={`section-badge section-badge--${activeSection}`}>
            {activeSection === 'comic' ? 'Comic' : activeSection === 'drama' ? 'Drama' : 'Anime'}
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
                New & Popular
              </div>
              <div
                className={`nav-link ${activeView === 'my-list' ? 'active' : ''}`}
                onClick={() => { setSearchVal(''); if (onSearch) onSearch(''); setView('my-list'); }}
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
          <div className="profile-chip">
            <span>A</span>
            <ChevronDown size={15} />
          </div>
        </div>
      </div>
    </nav>
  );
}

