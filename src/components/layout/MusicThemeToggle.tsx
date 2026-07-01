// MusicThemeToggle — switches between Spotify and Roon design modes.
// Spotify: green accent, vibrant, "Made for You" feel
// Roon: gold accent, ambient, immersive audiophile feel

'use client';

import { useMusicTheme } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Music, Disc3 } from 'lucide-react';

export function MusicThemeToggle() {
  const { theme, setTheme } = useMusicTheme();

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-card border border-border">
      <button
        type="button"
        onClick={() => setTheme('spotify')}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition',
          theme === 'spotify'
            ? 'bg-[#1DB954] text-black font-bold'
            : 'text-muted-foreground hover:text-foreground',
        )}
        title="Spotify-style: green accent, vibrant, Made for You"
      >
        <Music className="w-4 h-4" />
        <span>Spotify</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme('roon')}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition',
          theme === 'roon'
            ? 'bg-[#eab308] text-black font-bold'
            : 'text-muted-foreground hover:text-foreground',
        )}
        title="Roon-style: gold accent, ambient, audiophile"
      >
        <Disc3 className="w-4 h-4" />
        <span>Roon</span>
      </button>
    </div>
  );
}
