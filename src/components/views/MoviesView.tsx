// Movies browser — Netflix-style grid with genre filter and sort options.

'use client';

import { useState, useMemo } from 'react';
import { useApi } from '@/lib/useApi';
import { useNav, useVideoPlayer, useLocalLibraries } from '@/lib/store';
import { MediaCard } from '@/components/media/MediaCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Film } from 'lucide-react';

interface MoviesData {
  items: any[];
  total: number;
  genres: string[];
}

export function MoviesView() {
  const [genre, setGenre] = useState<string>('all');
  const [sort, setSort] = useState<string>('recent');
  const navigate = useNav((s) => s.navigate);
  const openVideo = useVideoPlayer((s) => s.openPlayer);
  const localItems = useLocalLibraries((s) => s.items);

  const url = `/api/movies?sort=${sort}${genre !== 'all' ? `&genre=${encodeURIComponent(genre)}` : ''}`;
  const { data, loading, error } = useApi<MoviesData>(url, [genre, sort]);

  // Merge local movie items with server items
  const localMovies = useMemo(() => localItems
    .filter((i) => i.mediaType === 'movie')
    .map((i) => ({
      id: i.id,
      title: i.title,
      year: i.year,
      genre: i.genre,
      rating: undefined as number | undefined,
      duration: i.duration,
      posterColor: i.color,
      backdropColor: i.color,
      plot: i.plot,
      addedAt: new Date(i.addedAt).toISOString(),
      isLocal: true,
    })), [localItems]);

  const allItems = [...(data?.items ?? []), ...localMovies];
  const allGenres = Array.from(new Set([
    ...(data?.genres ?? []),
    ...localMovies.map((m) => m.genre).filter(Boolean) as string[],
  ])).sort();

  return (
    <div className="px-4 md:px-8 py-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Film className="w-7 h-7 text-primary" />
            Movies
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {data ? `${data.total + localMovies.length} movie${(data.total + localMovies.length) !== 1 ? 's' : ''} in your library${localMovies.length > 0 ? ` (${localMovies.length} local)` : ''}` : 'Loading your movie library…'}
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
        <div className="text-center py-12 text-destructive">Failed to load movies: {error}</div>
      )}

      {allItems.length === 0 && !loading && (
        <div className="text-center py-16">
          <Film className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No movies found in your library.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'settings' })}>
            Add a Movie Library
          </Button>
        </div>
      )}

      {allItems.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {allItems.map((m: any) => (
            <MediaCard
              key={m.id}
              title={m.title}
              subtitle={`${m.year ?? ''} • ${m.genre ?? ''}${m.isLocal ? ' • Local' : ''}`.replace(/^ • | • $/g, '')}
              color={m.posterColor}
              rating={m.rating}
              year={m.year}
              duration={m.duration}
              onClick={() => m.isLocal ? openVideo({
                id: m.id, type: 'movie', title: m.title, isLocal: true,
                subtitle: [m.year, m.genre].filter(Boolean).join(' • '),
                duration: m.duration, color: m.backdropColor,
              }) : navigate({ kind: 'movie', id: m.id })}
              onPlay={() => openVideo({
                id: m.id, type: 'movie', title: m.title, isLocal: !!m.isLocal,
                subtitle: [m.year, m.genre].filter(Boolean).join(' • '),
                duration: m.duration, color: m.backdropColor,
              })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
