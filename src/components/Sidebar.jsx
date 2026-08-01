import React, { useState } from 'react';

// ── YouTube-style SVG Icons ──────────────────────────
const HomeIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>;
const AnimeIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/></svg>;
const ComicsIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>;
const DramaIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/></svg>;
const MoviesIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>;
const ChannelIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>;
const HistoryIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>;
const PlaylistIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>;
const ClockIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>;
const ThumbUpIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>;
const DownloadIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zm-8 2V5h2v6h1.17L12 13.17 9.83 11H11zm-6 7h14v2H5z"/></svg>;
const ChevronRightIcon = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>;
const ChevronDownIcon = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>;
const ChevronUpIcon = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/></svg>;

function SidebarItem({ icon, label, active, onClick, mini }) {
  return (
    <button
      className={`yt-sidebar-item ${active ? 'active' : ''} ${mini ? 'mini' : ''}`}
      onClick={onClick}
      title={mini ? label : undefined}
    >
      <span className="yt-sidebar-item-icon">{icon}</span>
      {!mini && <span className="yt-sidebar-item-label">{label}</span>}
    </button>
  );
}

function SidebarDivider() {
  return <div className="yt-sidebar-divider" />;
}

function SidebarSectionLabel({ label, onArrowClick, mini }) {
  if (mini) return null;
  return (
    <div className="yt-sidebar-section-label">
      <span>{label}</span>
      {onArrowClick && (
        <button className="yt-sidebar-section-arrow" onClick={onArrowClick} aria-label={`Open ${label} page`}>
          <ChevronRightIcon />
        </button>
      )}
    </div>
  );
}

export default function Sidebar({ activeView, setView, setSection, user, onSignIn, mini = false, subscriptions = [] }) {
  const [showMoreSubs, setShowMoreSubs] = useState(false);
  const [showMoreExplore, setShowMoreExplore] = useState(false);

  const nav = (view, section = 'anime') => {
    setSection(section);
    setView(view);
    window.scrollTo(0, 0);
  };

  // Show max 7 subscriptions by default
  const displayedSubs = showMoreSubs ? subscriptions : subscriptions.slice(0, 7);

  return (
    <aside className={`yt-sidebar ${mini ? 'mini' : ''}`}>
      <div className="yt-sidebar-inner">

        {/* ── SECTION 1: Home ── */}
        <SidebarItem
          icon={<HomeIcon />}
          label="Home"
          active={activeView === 'home'}
          onClick={() => nav('home')}
          mini={mini}
        />

        <SidebarDivider />

        {/* ── SECTION 2: Subscriptions ── */}
        {!mini && (
          <SidebarSectionLabel
            label="Subscriptions"
            onArrowClick={() => nav('subscriptions')}
          />
        )}

        {subscriptions.length === 0 ? (
          !mini && (
            <div className="yt-sidebar-sub-empty">
              {user ? (
                <p>Subscribe to anime, dramas and shows to see their updates here.</p>
              ) : (
                <button className="yt-sidebar-signin-prompt" onClick={onSignIn}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
                  Sign in to see subscriptions
                </button>
              )}
            </div>
          )
        ) : (
          <>
            {displayedSubs.map((sub) => (
              <button
                key={sub.id}
                className={`yt-sidebar-sub-item ${mini ? 'mini' : ''}`}
                onClick={() => { setView('detail'); /* navigate to anime detail */ }}
                title={mini ? sub.title : undefined}
              >
                <div className={`yt-sidebar-sub-avatar ${sub.hasNew ? 'has-new' : ''}`}>
                  {sub.coverImage
                    ? <img src={sub.coverImage} alt={sub.title} />
                    : <span>{sub.title.charAt(0)}</span>
                  }
                  {sub.hasNew && <span className="yt-sub-blue-dot" />}
                </div>
                {!mini && (
                  <span className="yt-sidebar-sub-title">{sub.title}</span>
                )}
              </button>
            ))}
            {subscriptions.length > 7 && !mini && (
              <button className="yt-sidebar-show-more" onClick={() => setShowMoreSubs(v => !v)}>
                {showMoreSubs ? <ChevronUpIcon /> : <ChevronDownIcon />}
                <span>{showMoreSubs ? 'Show less' : `Show ${subscriptions.length - 7} more`}</span>
              </button>
            )}
          </>
        )}

        <SidebarDivider />

        {/* ── SECTION 3: You ── */}
        <SidebarSectionLabel
          label="You"
          onArrowClick={user ? () => nav('profile') : onSignIn}
          mini={mini}
        />

        {user ? (
          <>
            <SidebarItem icon={<ChannelIcon />} label="Your channel" active={activeView === 'profile'} onClick={() => nav('profile')} mini={mini} />
            <SidebarItem icon={<HistoryIcon />} label="History" active={activeView === 'watch-history'} onClick={() => nav('watch-history')} mini={mini} />
            <SidebarItem icon={<PlaylistIcon />} label="Playlists" active={activeView === 'playlists'} onClick={() => nav('playlists')} mini={mini} />
            <SidebarItem icon={<ClockIcon />} label="Watch later" active={activeView === 'watch-later'} onClick={() => nav('watch-later')} mini={mini} />
            <SidebarItem icon={<ThumbUpIcon />} label="Liked videos" active={activeView === 'liked'} onClick={() => nav('liked')} mini={mini} />
            <SidebarItem icon={<DownloadIcon />} label="Downloads" active={activeView === 'downloads'} onClick={() => nav('downloads')} mini={mini} />
          </>
        ) : (
          !mini && (
            <button className="yt-sidebar-signin-prompt" onClick={onSignIn}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
              Sign in to see your data
            </button>
          )
        )}

        <SidebarDivider />

        {/* ── SECTION 4: Explore ── */}
        {!mini && <SidebarSectionLabel label="Explore" mini={mini} />}

        <SidebarItem icon={<AnimeIcon />} label="Anime" active={['anime','detail','watch','genre','hindi','new-popular','tv-shows'].includes(activeView)} onClick={() => { setSection('anime'); setView('anime'); window.scrollTo(0,0); }} mini={mini} />
        <SidebarItem icon={<ComicsIcon />} label="Comics" active={['manga','comic-category','manga-detail','manga-reader','manhwa','manhwa-detail','manhwa-read'].includes(activeView)} onClick={() => { setSection('manga'); setView('manga'); window.scrollTo(0,0); }} mini={mini} />
        <SidebarItem icon={<DramaIcon />} label="Drama" active={['dramas','drama-detail','drama-watch'].includes(activeView)} onClick={() => { setSection('drama'); setView('dramas'); window.scrollTo(0,0); }} mini={mini} />

        {showMoreExplore && (
          <SidebarItem icon={<MoviesIcon />} label="Movies" active={['movies','movie-detail','movie-watch'].includes(activeView)} onClick={() => { setSection('movies'); setView('movies'); window.scrollTo(0,0); }} mini={mini} />
        )}

        {!mini && (
          <button className="yt-sidebar-show-more" onClick={() => setShowMoreExplore(v => !v)}>
            {showMoreExplore ? <ChevronUpIcon /> : <ChevronDownIcon />}
            <span>{showMoreExplore ? 'Show less' : 'Show more'}</span>
          </button>
        )}

      </div>
    </aside>
  );
}
