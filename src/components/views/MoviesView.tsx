// Movies browser — Netflix-style grid with genre filter, sort options, and
// Collections section (franchises/sequels grouped together).

'use client';

import { useState, useMemo } from 'react';
import { useApi } from '@/lib/useApi';
import { useNav, useVideoPlayer, useLocalLibraries } from '@/lib/store';
import { MediaCard } from '@/components/media/MediaCard';
import { MediaRow } from '@/components/media/MediaRow';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Film, FolderTree as CollectionIcon } from 'lucide-react';
import { formatDurationShort } from '@/lib/format';

interface MoviesData {
  items: any[];
  total: number;
  genres: string[];
}

interface LocalMovie {
  id: string;
  title: string;
  year?: number;
  genre?: string;
  rating?: number;
  duration?: number;
  posterColor: string;
  backdropColor: string;
  plot?: string;
  director?: string;
  cast?: string[];
  collection?: string;
  collectionOrder?: number;
  addedAt: string;
  isLocal: boolean;
}

export function MoviesView() {
  const [genre, setGenre] = useState<string>('all');
  const [sort, setSort] = useState<string>('recent');
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const navigate = useNav((s) => s.navigate);
  const openVideo = useVideoPlayer((s) => s.openPlayer);
  const localItems = useLocalLibraries((s) => s.items);

  const url = `/api/movies?sort=${sort}${genre !== 'all' ? `&genre=${encodeURIComponent(genre)}` : ''}`;
  const { data, loading, error } = useApi<MoviesData>(url, [genre, sort]);

  // Merge local movie items with server items
  const localMovies: LocalMovie[] = useMemo(() => localItems
    .filter((i) => i.mediaType === 'movie')
    .map((i) => ({
      id: i.id,
      title: i.title,
      year: i.year,
      genre: i.genre,
      rating: i.rating,
      duration: i.duration,
      posterColor: i.color,
      backdropColor: i.backdropColor ?? i.color,
      plot: i.plot,
      director: i.director,
      cast: i.cast,
      collection: i.collection,
      collectionOrder: i.collectionOrder,
      addedAt: new Date(i.addedAt).toISOString(),
      isLocal: true,
    })), [localItems]);

  const allItems: LocalMovie[] = [...(data?.items ?? []), ...localMovies];
  const allGenres = Array.from(new Set([
    ...(data?.genres ?? []),
    ...localMovies.map((m) => m.genre).filter(Boolean) as string[],
  ])).sort();

  // Build collections map (only from local movies that have a collection field)
  const collections = useMemo(() => {
    const map = new Map<string, LocalMovie[]>();
    for (const m of localMovies) {
      if (!m.collection) continue;
      const list = map.get(m.collection) ?? [];
      list.push(m);
      map.set(m.collection, list);
    }
    // Sort each collection by collectionOrder
    for (const [name, movies] of map) {
      movies.sort((a, b) => (a.collectionOrder ?? 999) - (b.collectionOrder ?? 999));
      map.set(name, movies);
    }
    return Array.from(map.entries())
      .map(([name, movies]) => ({ name, movies, count: movies.length }))
      .filter((c) => c.count >= 1)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [localMovies]);

  // If a collection is selected, show only those movies
  const displayedItems = selectedCollection
    ? allItems.filter((m) => m.collection === selectedCollection)
    : allItems;

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

      {selectedCollection && (
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedCollection(null)}>
            ← All Movies
          </Button>
          <h2 className="text-xl font-bold">{selectedCollection}</h2>
          <span className="text-sm text-muted-foreground">{displayedItems.length} film{displayedItems.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Collections rail — shown above the grid when not viewing a specific collection */}
      {!selectedCollection && collections.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <CollectionIcon className="w-5 h-5 text-primary" />
            Collections
          </h2>
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
            {collections.map((col) => {
              const firstMovie = col.movies[0];
              return (
                <button
                  key={col.name}
                  type="button"
                  onClick={() => setSelectedCollection(col.name)}
                  className="group relative w-[200px] md:w-[240px] flex-shrink-0 rounded-lg overflow-hidden cursor-pointer"
                  style={{
                    background: `linear-gradient(135deg, ${firstMovie?.backdropColor ?? '#333'} 0%, #111 100%)`,
                    aspectRatio: '16/9',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  <div className="absolute inset-0 p-4 flex flex-col justify-end">
                    <div className="font-bold text-white text-base leading-tight line-clamp-2 drop-shadow">
                      {col.name}
                    </div>
                    <div className="text-white/70 text-xs mt-1">
                      {col.count} film{col.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {/* Thumbnail strip of first 3 movie titles */}
                  <div className="absolute top-3 right-3 flex gap-1">
                    {col.movies.slice(0, 3).map((m, i) => (
                      <div
                        key={m.id}
                        className="w-2 h-2 rounded-full bg-white/60"
                        style={{ opacity: 1 - i * 0.25 }}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!selectedCollection && (
        <h2 className="text-lg font-bold mb-3">All Movies</h2>
      )}

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

      {displayedItems.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {displayedItems.map((m: LocalMovie) => (
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
