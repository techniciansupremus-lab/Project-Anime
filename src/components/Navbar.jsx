import React, { useState } from 'react';
import { Bell, ChevronDown, Search } from 'lucide-react';

export default function Navbar({ onSearch, activeView, setView, onHome }) {
  const [searchVal, setSearchVal] = useState('');

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
    if (onHome) {
      onHome();
      return;
    }
    if (onSearch) onSearch('');
    setView('home');
  };

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <div className="logo" onClick={handleHomeClick}>
          AniStream
        </div>

        <div className="nav-links primary-nav">
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
            className={`nav-link drama-nav-link ${activeView === 'dramas' || activeView === 'drama-detail' || activeView === 'drama-watch' ? 'active' : ''}`}
            onClick={() => { setSearchVal(''); if (onSearch) onSearch(''); setView('dramas'); }}
          >
            Dramas
          </div>
          <div
            className={`nav-link manhwa-nav-link ${activeView === 'manhwa' || activeView === 'manhwa-detail' || activeView === 'manhwa-read' ? 'active' : ''}`}
            onClick={() => { setSearchVal(''); if (onSearch) onSearch(''); setView('manhwa'); }}
          >
            Manhwa
          </div>
          <div
            className={`nav-link ${activeView === 'my-list' ? 'active' : ''}`}
            onClick={() => { setSearchVal(''); if (onSearch) onSearch(''); setView('my-list'); }}
          >
            My List
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="search-bar">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Titles, genres..." 
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
