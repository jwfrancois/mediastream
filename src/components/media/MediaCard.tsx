// MediaCard — clickable card for browsing. Shows poster + hover overlay with quick actions.

'use client';

import { MediaPoster } from './MediaPoster';
import { Play, Star, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDurationShort, formatProgress } from '@/lib/format';

interface BaseCardProps {
  title: string;
  subtitle?: string;
  color?: string | null;
  onClick?: () => void;
  onPlay?: () => void;
  rating?: number | null;
  year?: number | null;
  duration?: number | null;
  progress?: { position: number; duration: number | null } | null;
  className?: string;
}

export function MediaCard({
  title, subtitle, color, onClick, onPlay, rating, year, duration, progress, className,
}: BaseCardProps) {
  return (
    <div
      className={cn(
        'group relative cursor-pointer rounded-md overflow-hidden bg-card transition-all duration-300',
        'hover:scale-[1.03] hover:z-10 hover:shadow-2xl hover:shadow-black/60',
        className,
      )}
      onClick={onClick}
    >
      <MediaPoster title={title} subtitle={subtitle} color={color} showTitle={false} aspect="portrait" />

      {/* Progress bar at bottom of poster */}
      {progress && progress.duration && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50 z-20">
          <div
            className="h-full bg-primary"
            style={{ width: `${Math.min(100, (progress.position / progress.duration) * 100)}%` }}
          />
        </div>
      )}

      {/* Hover overlay with quick actions */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
        <div className="font-semibold text-white text-sm leading-tight line-clamp-2 mb-1">
          {title}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/70 mb-2">
          {year && <span>{year}</span>}
          {duration && <span>• {formatDurationShort(duration)}</span>}
          {rating != null && (
            <span className="flex items-center gap-0.5 text-yellow-400">
              <Star className="w-3 h-3 fill-current" /> {rating.toFixed(1)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onPlay && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPlay(); }}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-black hover:bg-white/90 transition"
              aria-label={`Play ${title}`}
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </button>
          )}
          {onClick && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClick(); }}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-white hover:bg-white/30 transition border border-white/30"
              aria-label={`More info about ${title}`}
            >
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Title below poster (always visible) */}
      <div className="p-2">
        <div className="font-medium text-sm text-foreground line-clamp-1">{title}</div>
        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
          {subtitle || [year, duration ? formatDurationShort(duration) : null].filter(Boolean).join(' • ')}
        </div>
      </div>
    </div>
  );
}

// Wider landscape card (used for "Continue Watching" rail)
export function MediaCardLandscape({
  title, subtitle, color, onClick, onPlay, progress, aspect = '16/9', className,
}: BaseCardProps & { aspect?: string }) {
  return (
    <div
      className={cn(
        'group relative cursor-pointer rounded-md overflow-hidden bg-card transition-all duration-300',
        'hover:scale-[1.03] hover:z-10 hover:shadow-2xl hover:shadow-black/60',
        className,
      )}
      onClick={onClick}
      style={{ aspectRatio: aspect }}
    >
      <MediaPoster title="" subtitle="" color={color} showTitle={false} aspect="landscape" className="!aspect-auto h-full" />

      {/* Progress bar */}
      {progress && progress.duration && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50 z-20">
          <div
            className="h-full bg-primary"
            style={{ width: `${Math.min(100, (progress.position / progress.duration) * 100)}%` }}
          />
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
        <div className="font-semibold text-white text-sm leading-tight line-clamp-2 mb-1">{title}</div>
        {subtitle && <div className="text-xs text-white/70 line-clamp-1 mb-2">{subtitle}</div>}
        <div className="flex items-center gap-2">
          {onPlay && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPlay(); }}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white text-black hover:bg-white/90 transition"
              aria-label={`Play ${title}`}
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </button>
          )}
        </div>
      </div>

      {/* Always-visible bottom gradient with title */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
        <div className="font-medium text-white text-sm line-clamp-1">{title}</div>
        {subtitle && <div className="text-xs text-white/60 line-clamp-1 mt-0.5">{subtitle}</div>}
        {progress && progress.duration && (
          <div className="text-[10px] text-white/50 mt-0.5">
            {Math.round((progress.position / progress.duration) * 100)}% watched
          </div>
        )}
      </div>
    </div>
  );
}

// Square card (used for music albums / artists)
export function MediaCardSquare({
  title, subtitle, color, onClick, onPlay, className,
}: BaseCardProps) {
  return (
    <div
      className={cn(
        'group relative cursor-pointer rounded-md overflow-hidden bg-card transition-all duration-300',
        'hover:scale-[1.03] hover:z-10 hover:shadow-xl hover:shadow-black/40',
        className,
      )}
      onClick={onClick}
    >
      <MediaPoster title="" subtitle="" color={color} showTitle={false} aspect="square" />

      {/* Play button on hover */}
      {onPlay && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className="absolute right-3 bottom-12 flex items-center justify-center w-11 h-11 rounded-full bg-primary text-white opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 shadow-xl"
          aria-label={`Play ${title}`}
        >
          <Play className="w-5 h-5 fill-current ml-0.5" />
        </button>
      )}

      <div className="p-3">
        <div className="font-medium text-sm text-foreground line-clamp-1">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}
