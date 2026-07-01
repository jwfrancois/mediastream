// Podcasts browser — adapts layout based on the music theme preference.

'use client';

import { useMemo } from 'react';
import { useApi } from '@/lib/useApi';
import { useNav, useAudioPlayer, useLocalLibraries, useMusicTheme } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Mic } from 'lucide-react';

interface PodcastsData {
  items: any[];
}

export function PodcastsView() {
  const { data, loading, error } = useApi<PodcastsData>('/api/podcasts');
  const navigate = useNav((s) => s.navigate);
  const playAudio = useAudioPlayer((s) => s.playNow);
  const localItems = useLocalLibraries((s) => s.items);
  const { theme } = useMusicTheme();
  const isSpotify = theme === 'spotify';

  // Group local podcast episodes by podcastTitle
  const localPodcasts = useMemo(() => {
    const map = new Map<string, { id: string; title: string; author?: string; coverColor: string; episodes: any[] }>();
    for (const i of localItems) {
      if (i.mediaType !== 'podcast-episode') continue;
      const key = i.podcastTitle || 'Unknown Podcast';
      if (!map.has(key)) {
        map.set(key, {
          id: 'local_podcast_' + key,
          title: key,
          coverColor: i.color,
          episodes: [],
        });
      }
      map.get(key)!.episodes.push(i);
    }
    return Array.from(map.values()).map((p) => ({
      id: p.id,
      title: p.title,
      author: p.author,
      description: undefined,
      genre: undefined,
      coverColor: p.coverColor,
      addedAt: new Date().toISOString(),
      episodeCount: p.episodes.length,
      isLocal: true,
      _localEpisodes: p.episodes,
    }));
  }, [localItems]);

  const allPodcasts = [...(data?.items ?? []), ...localPodcasts];

  const handlePlayLocal = (podcast: any) => {
    const eps = podcast._localEpisodes;
    if (!eps || eps.length === 0) return;
    // Sort by episode number desc (latest first) to match server behavior
    eps.sort((a: any, b: any) => (b.episodeNumber ?? 0) - (a.episodeNumber ?? 0));
    playAudio(eps.map((ep: any) => ({
      id: ep.id,
      type: 'podcast' as const,
      title: ep.title,
      subtitle: podcast.title,
      duration: ep.duration,
      color: podcast.coverColor,
      isLocal: true,
    })));
  };

  return (
    <div className="pb-12">
      {/* === Theme-aware header === */}
      {isSpotify ? (
        <div
          className="relative px-4 md:px-8 pt-10 pb-6 mb-6 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, hsl(145, 60%, 20%) 0%, hsl(145, 50%, 8%) 50%, var(--background) 100%)`,
          }}
        >
          <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{
            background: 'radial-gradient(ellipse 60% 80% at 25% 15%, rgba(255,255,255,0.25) 0%, transparent 55%)',
          }} />
          <div className="relative">
            <div className="text-xs uppercase tracking-widest text-[#1DB954] font-bold mb-1">Episodes for You</div>
            <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-2">Podcasts</h1>
            <p className="text-white/70 text-sm">
              {data ? `${data.items.length + localPodcasts.length} shows` : 'Loading…'}
            </p>
          </div>
        </div>
      ) : (
        <div className="px-4 md:px-8 py-6 mb-2">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Mic className="w-7 h-7 text-primary" />
            Podcasts
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {data ? `${data.items.length + localPodcasts.length} podcast${(data.items.length + localPodcasts.length) !== 1 ? 's' : ''}${localPodcasts.length > 0 ? ` (${localPodcasts.length} local)` : ''}` : 'Loading your podcast library…'}
          </p>
        </div>
      )}

      <div className={isSpotify ? 'px-4 md:px-8' : 'px-4 md:px-8'}>
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-md" />)}
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-destructive">Failed to load podcasts: {error}</div>
      )}

      {allPodcasts.length === 0 && !loading && (
        <div className="text-center py-16">
          <Mic className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No podcasts found in your library.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'settings' })}>
            Add a Podcast Library
          </Button>
        </div>
      )}

      {allPodcasts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {allPodcasts.map((p: any) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate({ kind: 'podcast', id: p.id })}
              className="group flex flex-col p-3 rounded-lg bg-card hover:bg-card/80 transition cursor-pointer text-left"
            >
              <div
                className="aspect-square rounded-md mb-3 flex items-center justify-center text-2xl font-bold text-white shadow-lg group-hover:scale-105 transition relative"
                style={{
                  background: `linear-gradient(135deg, ${p.coverColor ?? '#444'} 0%, #111 100%)`,
                }}
              >
                <Mic className="w-10 h-10 opacity-50" />
                {p.isLocal && (
                  <span className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-medium uppercase tracking-wider">Local</span>
                )}
              </div>
              <div className="font-semibold text-sm line-clamp-2">{p.title}</div>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.author}</div>
              <div className="text-xs text-muted-foreground/70 mt-1">
                {p.episodeCount} episode{p.episodeCount !== 1 ? 's' : ''}
              </div>
            </button>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
