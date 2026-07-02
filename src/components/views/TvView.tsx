// TV Shows browser — grid of shows with genre filter and sort.

'use client';

import { useState, useMemo } from 'react';
import { useApi } from '@/lib/useApi';
import { useNav, useLocalLibraries } from '@/lib/store';
import { MediaCard } from '@/components/media/MediaCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tv } from 'lucide-react';

interface TvData {
  items: any[];
  total: number;
  genres: string[];
}

export function TvView() {
  const [genre, setGenre] = useState<string>('all');
  const [sort, setSort] = useState<string>('recent');
  const navigate = useNav((s) => s.navigate);
  const localItems = useLocalLibraries((s) => s.items);

  const url = `/api/tv?sort=${sort}${genre !== 'all' ? `&genre=${encodeURIComponent(genre)}` : ''}`;
  const { data, loading, error } = useApi<TvData>(url, [genre, sort]);

  // Group local episodes into shows
  const localShows = useMemo(() => {
    const map = new Map<string, { title: string; color: string; episodes: any[]; seasons: Set<number> }>();
    for (const i of localItems) {
      if (i.mediaType !== 'episode') continue;
      const showName = i.showTitle || 'Unknown Show';
      if (!map.has(showName)) {
        map.set(showName, { title: showName, color: i.color, episodes: [], seasons: new Set() });
      }
      const s = map.get(showName)!;
      s.episodes.push(i);
      if (i.seasonNumber) s.seasons.add(i.seasonNumber);
    }
    return Array.from(map.values()).map((s) => ({
      id: 'local_show_' + s.title,
      title: s.title,
      year: undefined,
      genre: undefined,
      rating: undefined,
      posterColor: s.color,
      backdropColor: s.color,
      plot: undefined,
      addedAt: new Date().toISOString(),
      seasonCount: s.seasons.size,
      episodeCount: s.episodes.length,
      isLocal: true,
      _localEpisodes: s.episodes,
    }));
  }, [localItems]);

  const allItems = [...(data?.items ?? []), ...localShows];
  const allGenres = Array.from(new Set([
    ...(data?.genres ?? []),
    ...localShows.map((s) => s.genre).filter(Boolean) as string[],
  ])).sort();

  return (
    <div className="px-4 md:px-8 py-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Tv className="w-7 h-7 text-primary" />
            TV Shows
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {data ? `${data.total + localShows.length} show${(data.total + localShows.length) !== 1 ? 's' : ''}${localShows.length > 0 ? ` (${localShows.length} local)` : ''}` : 'Loading your TV library…'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={genre} onValueChange={setGenre}>
            <SelectTrigger className="w-[160px] bg-card">
              <SelectValue placeholder="All genres" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All genres</SelectItem>
              {allGenres.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[160px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recently Added</SelectItem>
              <SelectItem value="title">A → Z</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 18 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] rounded-md" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-destructive">Failed to load TV shows: {error}</div>
      )}

      {allItems.length === 0 && !loading && (
        <div className="text-center py-16">
          <Tv className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No TV shows found in your library.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'settings' })}>
            Add a TV Library
          </Button>
        </div>
      )}

      {allItems.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 stagger">
          {allItems.map((s: any) => (
            <MediaCard
              key={s.id}
              title={s.title}
              subtitle={`${s.seasonCount} season${s.seasonCount !== 1 ? 's' : ''} • ${s.episodeCount} episodes${s.isLocal ? ' • Local' : ''}`}
              color={s.posterColor}
              imageUrl={s.posterUrl}
              rating={s.rating}
              year={s.year}
              genre={s.genre}
              plot={s.plot}
              badge={s.isLocal ? 'Local' : undefined}
              onClick={() => navigate({ kind: 'show', id: s.id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
