import React, { useState, useEffect, useRef } from 'react';
import { Search, Mic, Bell, LogOut, User, Bookmark, History, Menu, ArrowLeft, X, Settings } from 'lucide-react';

export function MobileBottomNav({ activeView, setView, setSection, user, onSignIn }) {
  return (
    <nav className="yt-mobile-bottom-nav">
      <button
        className={`yt-mobile-nav-item ${activeView === 'home' ? 'active' : ''}`}
        onClick={() => { setSection('anime'); setView('home'); window.scrollTo(0, 0); }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
        <span>Home</span>
      </button>
      <button
        className={`yt-mobile-nav-item ${activeView === 'anime' ? 'active' : ''}`}
        onClick={() => { setSection('anime'); setView('anime'); window.scrollTo(0, 0); }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/></svg>
        <span>Anime</span>
      </button>
      <button
        className={`yt-mobile-nav-item ${activeView === 'manga' || activeView === 'comic-category' ? 'active' : ''}`}
        onClick={() => { setSection('manga'); setView('manga'); window.scrollTo(0, 0); }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>
        <span>Comics</span>
      </button>
      <button
        className={`yt-mobile-nav-item ${activeView === 'dramas' ? 'active' : ''}`}
        onClick={() => { setSection('drama'); setView('dramas'); window.scrollTo(0, 0); }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/></svg>
        <span>Drama</span>
      </button>
      <button
        className={`yt-mobile-nav-item ${['my-list','watch-history','watch-later','liked'].includes(activeView) ? 'active' : ''}`}
        onClick={() => { if (!user) { if (onSignIn) onSignIn(); return; } setView('my-list'); window.scrollTo(0, 0); }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
        <span>You</span>
      </button>
    </nav>
  );
}

export default function Navbar({
  onSearch,
  activeView,
  setView,
  onHome,
  activeSection = 'anime',
  user,
  onSignIn,
  onSignOut,
  onToggleSidebar,
  notifications = [],
  onSelectNotification
}) {
  const [searchVal, setSearchVal] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const profileRef = useRef(null);
  const notifRef = useRef(null);
  const mobileInputRef = useRef(null);

  useEffect(() => { setSearchVal(''); }, [activeSection]);

  useEffect(() => {
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (mobileSearchOpen && mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  }, [mobileSearchOpen]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(searchVal);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchVal(val);
    if (onSearch) onSearch(val);
  };

  const displayName = user?.user_metadata?.username || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const avatarUrl = user?.user_metadata?.avatar_url || null;

  const unreadCount = notifications.filter(n => !n.read).length;
  const importantNotifs = notifications.filter(n => n.type === 'season');
  const regularNotifs = notifications.filter(n => n.type !== 'season');

  return (
    <header className="yt-header">
      {/* Mobile Expandable Search Bar Overlay */}
      {mobileSearchOpen ? (
        <div className="yt-mobile-search-bar">
          <button className="yt-icon-btn" onClick={() => setMobileSearchOpen(false)} aria-label="Close search">
            <ArrowLeft size={20} />
          </button>
          <form className="yt-mobile-search-form" onSubmit={handleSearchSubmit}>
            <input
              ref={mobileInputRef}
              type="text"
              className="yt-mobile-search-input"
              placeholder="Search anime, drama, movies, manga..."
              value={searchVal}
              onChange={handleInputChange}
            />
            {searchVal && (
              <button type="button" className="yt-search-clear-btn" onClick={() => { setSearchVal(''); if (onSearch) onSearch(''); }}>
                <X size={16} />
              </button>
            )}
          </form>
          <button className="yt-mic-btn" title="Voice search" aria-label="Voice search">
            <Mic size={18} />
          </button>
        </div>
      ) : (
        <>
          <div className="yt-header-left">
            <button className="yt-icon-btn" onClick={onToggleSidebar} aria-label="Toggle menu" title="Menu">
              <Menu size={22} />
            </button>
            <div className="yt-logo" onClick={onHome} title="EetNet Home">
              <svg viewBox="0 0 26 18" width="26" height="18" aria-hidden="true">
                <rect width="26" height="18" rx="4" fill="#FF0000"/>
                <polygon points="11,4.5 11,13.5 19,9" fill="white"/>
              </svg>
              <span className="yt-logo-text">EetNet</span>
            </div>
          </div>

          <div className="yt-header-center">
            <form className="yt-search-form" onSubmit={handleSearchSubmit}>
              <div className="yt-search-input-wrap">
                <input
                  type="text"
                  className="yt-search-input"
                  placeholder="Search anime, drama, movies, manga..."
                  value={searchVal}
                  onChange={handleInputChange}
                />
              </div>
              <button type="submit" className="yt-search-btn" aria-label="Search">
                <Search size={18} />
              </button>
            </form>
            <button className="yt-mic-btn" title="Voice search" aria-label="Voice search">
              <Mic size={18} />
            </button>
          </div>

          <div className="yt-header-right">
            {/* Mobile search trigger icon */}
            <button className="yt-icon-btn yt-mobile-search-trigger" onClick={() => setMobileSearchOpen(true)} aria-label="Search">
              <Search size={20} />
            </button>

            {/* Notifications Dropdown Wrap (Matching Image 3) */}
            <div className="yt-notif-wrap" ref={notifRef}>
              <button className="yt-icon-btn yt-notif-btn" onClick={() => setNotifOpen(v => !v)} title="Notifications" aria-label="Notifications">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="yt-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>

              {notifOpen && (
                <div className="yt-notif-dropdown">
                  <div className="yt-notif-header">
                    <span>Notifications</span>
                    <button className="yt-notif-gear-btn" title="Settings">
                      <Settings size={18} />
                    </button>
                  </div>

                  <div className="yt-notif-body">
                    {/* Important Section (Season releases) */}
                    {importantNotifs.length > 0 && (
                      <div className="yt-notif-section">
                        <div className="yt-notif-section-title">Important</div>
                        {importantNotifs.map((n) => (
                          <div
                            key={n.id}
                            className={`yt-notif-item ${!n.read ? 'unread' : ''}`}
                            onClick={() => {
                              setNotifOpen(false);
                              if (onSelectNotification) onSelectNotification(n);
                            }}
                          >
                            <div className="yt-notif-avatar">
                              {n.avatar ? <img src={n.avatar} alt={n.animeTitle} /> : <span>🎙️</span>}
                            </div>
                            <div className="yt-notif-content">
                              <div className="yt-notif-text">
                                <strong>{n.animeTitle}</strong> {n.message}
                              </div>
                              <div className="yt-notif-time">{n.timeAgo || 'Recently'}</div>
                            </div>
                            {n.thumb && (
                              <div className="yt-notif-thumb">
                                <img src={n.thumb} alt="Preview" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* More notifications Section (Episode releases) */}
                    <div className="yt-notif-section">
                      {importantNotifs.length > 0 && (
                        <div className="yt-notif-section-title">More notifications</div>
                      )}
                      {regularNotifs.length === 0 && importantNotifs.length === 0 ? (
                        <div className="yt-notif-empty">
                          <Bell size={32} />
                          <p>No notifications yet</p>
                          <small>Subscribe to anime shows to receive release updates!</small>
                        </div>
                      ) : (
                        regularNotifs.map((n) => (
                          <div
                            key={n.id}
                            className={`yt-notif-item ${!n.read ? 'unread' : ''}`}
                            onClick={() => {
                              setNotifOpen(false);
                              if (onSelectNotification) onSelectNotification(n);
                            }}
                          >
                            <div className="yt-notif-avatar">
                              {n.avatar ? <img src={n.avatar} alt={n.animeTitle} /> : <span>🎙️</span>}
                            </div>
                            <div className="yt-notif-content">
                              <div className="yt-notif-text">
                                <strong>{n.animeTitle}</strong> {n.message}
                              </div>
                              <div className="yt-notif-time">{n.timeAgo || 'Recently'}</div>
                            </div>
                            {n.thumb && (
                              <div className="yt-notif-thumb">
                                <img src={n.thumb} alt="Preview" />
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {user ? (
              <div className="yt-profile-wrap" ref={profileRef}>
                <button className="yt-avatar-btn" onClick={() => setProfileOpen(v => !v)} aria-label="Account">
                  {avatarUrl
                    ? <img src={avatarUrl} alt={displayName} className="yt-avatar-img" />
                    : <span className="yt-avatar-letter">{avatarLetter}</span>
                  }
                </button>
                {profileOpen && (
                  <div className="yt-profile-dropdown" role="menu">
                    <div className="yt-profile-dropdown-header">
                      <div className="yt-profile-dropdown-avatar">
                        {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : <span>{avatarLetter}</span>}
                      </div>
                      <div className="yt-profile-dropdown-info">
                        <strong>{displayName}</strong>
                        <small>{user.email}</small>
                      </div>
                    </div>
                    <div className="yt-dropdown-divider" />
                    <button className="yt-dropdown-item" onClick={() => { setProfileOpen(false); setView('my-list'); }}>
                      <Bookmark size={16} /> My Watchlist
                    </button>
                    <button className="yt-dropdown-item" onClick={() => { setProfileOpen(false); setView('watch-history'); }}>
                      <History size={16} /> Watch History
                    </button>
                    <div className="yt-dropdown-divider" />
                    <button className="yt-dropdown-item danger" onClick={() => { setProfileOpen(false); onSignOut(); }}>
                      <LogOut size={16} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="yt-signin-btn" onClick={onSignIn}>
                <User size={18} />
                <span className="yt-signin-text">Sign in</span>
              </button>
            )}
          </div>
        </>
      )}
    </header>
  );
}
