// MediaCard — clickable card with an expanded hover info panel.
// On hover, the card lifts and reveals: rating ring, genre, year, duration,
// a plot snippet, cast preview, and quick action buttons (Play / More Info).
// This is the core "infotainment" browsing primitive.

'use client';

import { MediaPoster } from './MediaPoster';
import { RatingRing } from './RatingRing';
import { Play, Info, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDurationShort } from '@/lib/format';

interface BaseCardProps {
  title: string;
  subtitle?: string;
  color?: string | null;
  imageUrl?: string | null;
  onClick?: () => void;
  onPlay?: () => void;
  rating?: number | null;
  year?: number | null;
  duration?: number | null;
  genre?: string | null;
  plot?: string | null;
  cast?: string[];
  director?: string | null;
  progress?: { position: number; duration: number | null } | null;
  badge?: string;          // e.g. "Local", "4K", "New"
  className?: string;
}

export function MediaCard({
  title, subtitle, color, imageUrl, onClick, onPlay, rating, year, duration, genre, plot, cast, director, progress, badge, className,
}: BaseCardProps) {
  return (
    <div
      className={cn(
        'group relative cursor-pointer rounded-xl overflow-hidden bg-card card-lift',
        className,
      )}
      onClick={onClick}
    >
      <MediaPoster title={title} color={color} imageUrl={imageUrl} showTitle={false} aspect="portrait" />

      {/* Badge (top-left) */}
      {badge && (
        <div className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-primary/90 text-primary-foreground backdrop-blur-sm">
          {badge}
        </div>
      )}

      {/* Rating ring (top-right) — always visible if we have a rating */}
      {rating != null && (
        <div className="absolute top-2 right-2 z-20 glass rounded-full p-0.5">
          <RatingRing score={rating} size={32} />
        </div>
      )}

      {/* Progress bar at bottom of poster */}
      {progress && progress.duration && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60 z-20">
          <div
            className="h-full bg-primary"
            style={{ width: `${Math.min(100, (progress.position / progress.duration) * 100)}%` }}
          />
        </div>
      )}

      {/* === Expanded hover info panel === */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
        {/* Title */}
        <div className="font-bold text-white text-sm leading-tight line-clamp-2 mb-1.5 drop-shadow-lg">
          {title}
        </div>

        {/* Meta row: year • genre • duration */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/70 mb-1.5">
          {year && <span>{year}</span>}
          {genre && (
            <>
              <span className="text-white/30">•</span>
              <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/90">{genre}</span>
            </>
          )}
          {duration && (
            <>
              <span className="text-white/30">•</span>
              <span>{formatDurationShort(duration)}</span>
            </>
          )}
        </div>

        {/* Plot snippet */}
        {plot && (
          <p className="text-[11px] text-white/60 line-clamp-2 mb-2 leading-snug">
            {plot}
          </p>
        )}

        {/* Cast preview */}
        {cast && cast.length > 0 && (
          <div className="text-[10px] text-white/50 line-clamp-1 mb-2">
            <span className="text-white/40">Starring: </span>
            {cast.slice(0, 3).join(', ')}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {onPlay && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPlay(); }}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-black hover:bg-white/90 transition shadow-lg"
              aria-label={`Play ${title}`}
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </button>
          )}
          {onClick && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClick(); }}
              className="flex items-center justify-center w-8 h-8 rounded-full glass text-white hover:bg-white/25 transition"
              aria-label={`More info about ${title}`}
            >
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Title below poster (always visible) */}
      <div className="p-2.5">
        <div className="font-medium text-sm text-foreground line-clamp-1 leading-tight">{title}</div>
        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
          {subtitle || [year, genre, duration ? formatDurationShort(duration) : null].filter(Boolean).join(' • ')}
        </div>
      </div>
    </div>
  );
}

// Wider landscape card (used for "Continue Watching" rail)
export function MediaCardLandscape({
  title, subtitle, color, onClick, onPlay, progress, aspect = '16/9', className, badge, rating,
}: BaseCardProps & { aspect?: string }) {
  return (
    <div
      className={cn(
        'group relative cursor-pointer rounded-xl overflow-hidden bg-card card-lift',
        className,
      )}
      onClick={onClick}
      style={{ aspectRatio: aspect }}
    >
      <MediaPoster title="" color={color} imageUrl={imageUrl} showTitle={false} aspect="landscape" className="!aspect-auto h-full" />

      {/* Badge */}
      {badge && (
        <div className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-primary/90 text-primary-foreground backdrop-blur-sm">
          {badge}
        </div>
      )}

      {/* Progress bar */}
      {progress && progress.duration && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60 z-20">
          <div
            className="h-full bg-primary"
            style={{ width: `${Math.min(100, (progress.position / progress.duration) * 100)}%` }}
          />
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
        <div className="font-bold text-white text-base leading-tight line-clamp-2 mb-1">{title}</div>
        {subtitle && <div className="text-xs text-white/70 line-clamp-1 mb-2">{subtitle}</div>}
        <div className="flex items-center gap-2">
          {onPlay && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPlay(); }}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-white text-black hover:bg-white/90 transition shadow-xl"
              aria-label={`Play ${title}`}
            >
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </button>
          )}
          {onClick && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClick(); }}
              className="flex items-center justify-center w-10 h-10 rounded-full glass text-white hover:bg-white/25 transition"
              aria-label={`More info about ${title}`}
            >
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Always-visible bottom gradient with title */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
        <div className="font-semibold text-white text-sm line-clamp-1 drop-shadow">{title}</div>
        {subtitle && <div className="text-xs text-white/60 line-clamp-1 mt-0.5">{subtitle}</div>}
        {progress && progress.duration && (
          <div className="text-[10px] text-white/50 mt-1 flex items-center gap-1.5">
            <div className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden max-w-[80px]">
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, (progress.position / progress.duration) * 100)}%` }} />
            </div>
            <span>{Math.round((progress.position / progress.duration) * 100)}% watched</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Square card (used for music albums / artists)
export function MediaCardSquare({
  title, subtitle, color, onClick, onPlay, className, badge,
}: BaseCardProps) {
  return (
    <div
      className={cn(
        'group relative cursor-pointer rounded-xl overflow-hidden bg-card card-lift',
        className,
      )}
      onClick={onClick}
    >
      <MediaPoster title="" color={color} imageUrl={imageUrl} showTitle={false} aspect="square" />

      {badge && (
        <div className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-primary/90 text-primary-foreground backdrop-blur-sm">
          {badge}
        </div>
      )}

      {/* Play button on hover */}
      {onPlay && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className="absolute right-3 bottom-14 flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white opacity-0 group-hover:opacity-100 translate-y-3 group-hover:translate-y-0 transition-all duration-300 shadow-2xl"
          aria-label={`Play ${title}`}
        >
          <Play className="w-5 h-5 fill-current ml-0.5" />
        </button>
      )}

      <div className="p-3">
        <div className="font-semibold text-sm text-foreground line-clamp-1 leading-tight">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}
