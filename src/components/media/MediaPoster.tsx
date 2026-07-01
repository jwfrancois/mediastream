// Media poster — uses real images when available (from image search), falling
// back to a cinematic gradient derived from the title's color seed.
// Includes: directional lighting, film grain, vignette, and a shimmer sweep on hover.

'use client';

import { cn } from '@/lib/utils';
import { useState } from 'react';

interface MediaPosterProps {
  title: string;
  subtitle?: string;
  color?: string | null;
  imageUrl?: string | null;  // real poster/cover image URL (from image search)
  className?: string;
  aspect?: 'portrait' | 'landscape' | 'square';
  showTitle?: boolean;
  children?: React.ReactNode;
}

export function MediaPoster({
  title,
  subtitle,
  color,
  imageUrl,
  className,
  aspect = 'portrait',
  showTitle = true,
  children,
}: MediaPosterProps) {
  const aspectClass =
    aspect === 'portrait' ? 'aspect-[2/3]' :
    aspect === 'landscape' ? 'aspect-[16/9]' :
    'aspect-square';

  const bg = color || 'hsl(220, 30%, 30%)';
  const [imgError, setImgError] = useState(false);
  const hasImage = imageUrl && !imgError;

  return (
    <div
      className={cn(
        'group/poster relative overflow-hidden flex flex-col justify-end grain',
        aspectClass,
        className,
      )}
      style={hasImage ? undefined : {
        background: `linear-gradient(145deg, ${bg} 0%, hsl(0, 0%, 6%) 100%)`,
      }}
    >
      {/* Real image (if available) */}
      {hasImage && (
        <img
          src={imageUrl!}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      )}

      {/* Gradient overlays — only show when there's no real image */}
      {!hasImage && (
        <>
          {/* Directional lighting — simulates a key light from upper-left */}
          <div
            className="absolute inset-0 opacity-50 mix-blend-soft-light"
            style={{
              background: `
                radial-gradient(ellipse 60% 80% at 25% 15%, rgba(255,255,255,0.25) 0%, transparent 55%),
                radial-gradient(ellipse 50% 60% at 80% 85%, rgba(0,0,0,0.5) 0%, transparent 60%)
              `,
            }}
          />
          {/* Color wash — a subtle second hue blended in for richness */}
          <div
            className="absolute inset-0 opacity-25 mix-blend-color-dodge"
            style={{
              background: `radial-gradient(circle at 70% 30%, ${bg} 0%, transparent 70%)`,
            }}
          />
        </>
      )}

      {/* Vignette — always present for cinematic depth */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow: 'inset 0 0 60px 10px rgba(0,0,0,0.5)',
        }}
      />
      {/* Shimmer sweep on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover/poster:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)',
        }}
      />

      {showTitle && (
        <div className="relative z-10 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
          <div className="font-semibold text-white text-sm leading-tight line-clamp-2 drop-shadow-lg">
            {title}
          </div>
          {subtitle && (
            <div className="text-white/65 text-xs mt-0.5 line-clamp-1 drop-shadow">
              {subtitle}
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  );
}

// Larger hero-style backdrop — for detail pages and the dashboard hero
export function MediaBackdrop({
  title,
  subtitle,
  color,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  color?: string | null;
  className?: string;
  children?: React.ReactNode;
}) {
  const bg = color || 'hsl(220, 30%, 30%)';
  return (
    <div
      className={cn('relative overflow-hidden grain', className)}
      style={{
        background: `
          radial-gradient(ellipse 80% 60% at 30% 30%, ${bg} 0%, transparent 70%),
          linear-gradient(120deg, hsl(0, 0%, 5%) 0%, hsl(0, 0%, 0%) 100%)
        `,
      }}
    >
      {/* Drifting aurora layer */}
      <div
        className="absolute inset-0 opacity-50 aurora-drift mix-blend-screen"
        style={{
          background: `
            radial-gradient(circle at 40% 50%, ${bg} 0%, transparent 50%),
            radial-gradient(circle at 70% 40%, hsl(${hueShift(bg)}, 40%, 25%) 0%, transparent 45%)
          `,
        }}
      />
      {/* Directional light */}
      <div
        className="absolute inset-0 opacity-40 mix-blend-soft-light"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 50% 70% at 20% 30%, rgba(255,255,255,0.2) 0%, transparent 55%),
            radial-gradient(ellipse 60% 50% at 80% 80%, rgba(0,0,0,0.6) 0%, transparent 60%)
          `,
        }}
      />
      <div className="relative z-10 h-full flex flex-col justify-end p-8 md:p-12">
        {title && (
          <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-2xl tracking-tight">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="mt-3 text-base md:text-lg text-white/80 max-w-2xl line-clamp-2 drop-shadow-lg">
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

// Extract hue from an hsl string and shift it by 40 degrees
function hueShift(hsl: string): number {
  const m = hsl.match(/hsl\(\s*(\d+)/);
  if (!m) return 250;
  return (parseInt(m[1], 10) + 40) % 360;
}
