// Gradient-based media poster — used because we don't ship real poster images.
// The poster is generated deterministically from the title so each media item
// gets a unique, attractive gradient. The title overlay makes it scannable.

'use client';

import { cn } from '@/lib/utils';

interface MediaPosterProps {
  title: string;
  subtitle?: string;
  color?: string | null;
  className?: string;
  aspect?: 'portrait' | 'landscape' | 'square';
  showTitle?: boolean;
  children?: React.ReactNode;
}

export function MediaPoster({
  title,
  subtitle,
  color,
  className,
  aspect = 'portrait',
  showTitle = true,
  children,
}: MediaPosterProps) {
  const aspectClass =
    aspect === 'portrait' ? 'aspect-[2/3]' :
    aspect === 'landscape' ? 'aspect-[16/9]' :
    'aspect-square';

  // Use the provided HSL color, or fall back to a gradient from the title
  const bg = color || 'hsl(220, 30%, 30%)';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md flex flex-col justify-end',
        aspectClass,
        className,
      )}
      style={{
        background: `linear-gradient(135deg, ${bg} 0%, hsl(0, 0%, 8%) 100%)`,
      }}
    >
      {/* Decorative geometric overlay for visual interest */}
      <div
        className="absolute inset-0 opacity-30 mix-blend-overlay"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(255,255,255,0.15) 0%, transparent 40%),
            radial-gradient(circle at 80% 70%, rgba(0,0,0,0.3) 0%, transparent 50%)
          `,
        }}
      />
      {/* Subtle grain / scanline texture */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)`,
        }}
      />

      {showTitle && (
        <div className="relative z-10 p-3 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
          <div className="font-semibold text-white text-sm leading-tight line-clamp-2 drop-shadow-md">
            {title}
          </div>
          {subtitle && (
            <div className="text-white/70 text-xs mt-0.5 line-clamp-1">
              {subtitle}
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  );
}

// Larger hero-style backdrop
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
      className={cn('relative overflow-hidden', className)}
      style={{
        background: `linear-gradient(120deg, ${bg} 0%, hsl(0, 0%, 5%) 70%, hsl(0, 0%, 0%) 100%)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-40 mix-blend-overlay"
        style={{
          backgroundImage: `
            radial-gradient(circle at 30% 40%, rgba(255,255,255,0.2) 0%, transparent 50%),
            radial-gradient(circle at 70% 60%, rgba(0,0,0,0.4) 0%, transparent 60%)
          `,
        }}
      />
      <div className="relative z-10 h-full flex flex-col justify-end p-8 md:p-12">
        <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-2xl">{title}</h1>
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
