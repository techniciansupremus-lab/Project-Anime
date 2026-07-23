import React from 'react';
import { Star } from 'lucide-react';
import { hasHindiDubAvailable } from '../mockData';

export default function AnimeCard({ anime, onClick }) {
  const { title, coverImage, rating, type, genres, hasHindiDub, japaneseTitle } = anime;
  const isHindi = hasHindiDub || hasHindiDubAvailable(title, japaneseTitle);

  return (
    <div className="anime-card" onClick={onClick}>
      <div className="card-img-wrapper">
        <img
          src={coverImage}
          alt={title}
          className="card-img"
          loading="lazy"
        />
        {isHindi && <div className="card-hindi-badge">Hindi</div>}
        {type && <div className="card-badge">{type}</div>}
        {rating && (
          <div className="card-rating">
            <Star size={10} fill="white" />
            {rating}
          </div>
        )}
      </div>
      <div className="card-info">
        <h4 className="card-title" title={title}>{title}</h4>
        {genres && genres.length > 0 && (
          <div className="card-genres">
            {genres.slice(0, 2).join(' - ')}
          </div>
        )}
      </div>
    </div>
  );
}
