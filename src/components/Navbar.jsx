import React, { useState } from 'react';
import { Search, Play } from 'lucide-react';

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
          <Play size={24} fill="currentColor" style={{ color: 'var(--accent-primary)' }} />
          AniStream<span>.tv</span>
        </div>

        <form onSubmit={handleSearchSubmit} className="search-bar">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search anime, genres..." 
            value={searchVal}
            onChange={handleInputChange}
          />
        </form>

        <div className="nav-links">
          <div 
            className={`nav-link ${activeView === 'home' ? 'active' : ''}`}
            onClick={handleHomeClick}
          >
            Home
          </div>
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noreferrer" 
            className="nav-link"
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
            </svg>
            GitHub
          </a>
        </div>
      </div>
    </nav>
  );
}
