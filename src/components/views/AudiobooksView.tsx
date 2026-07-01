// Audiobooks browser — supports three organization modes:
// - Grid (flat, sortable by recent/title/author)
// - By Author (grouped sections, A–Z)
// - By Title (grouped by first letter, A–Z)
// Inspired by Roon's library organization.

'use client';

import { useState, useMemo } from 'react';
import { useApi } from '@/lib/useApi';
import { useNav, useAudioPlayer, useLocalLibraries } from '@/lib/store';
import { MediaCard } from '@/components/media/MediaCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookHeadphones, LayoutGrid, User, Type } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudiobooksData {
  items: any[];
  total: number;
}

type ViewMode = 'grid' | 'by-author' | 'by-title';

export function AudiobooksView() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sort, setSort] = useState('recent');
  const navigate = useNav((s) => s.navigate);
  const playAudio = useAudioPlayer((s) => s.playNow);
  const localItems = useLocalLibraries((s) => s.items);

  const { data, loading, error } = useApi<AudiobooksData>(`/api/audiobooks?sort=${sort}`, [sort]);

  const localAudiobooks = useMemo(() => localItems
    .filter((i) => i.mediaType === 'audiobook')
    .map((i) => ({
      id: i.id,
      title: i.title,
      author: i.author,
      narrator: i.narrator,
      year: i.year,
      genre: i.genre,
      coverColor: i.color,
      duration: i.duration,
      description: i.plot,
      isLocal: true,
    })), [localItems]);

  const allItems = [...(data?.items ?? []), ...localAudiobooks];

  // Group by author
  const byAuthor = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of allItems) {
      const author = a.author ?? 'Unknown Author';
      const key = author;
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    // Sort each author's books by title
    for (const [author, books] of map) {
      books.sort((a, b) => a.title.localeCompare(b.title));
      map.set(author, books);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([author, books]) => ({ author, books, count: books.length }));
  }, [allItems]);

  // Group by first letter of title
  const byTitle = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of allItems) {
      const letter = (a.title?.charAt(0) ?? '#').toUpperCase();
      const key = /^[A-Z]$/.test(letter) ? letter : '#';
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    for (const [letter, books] of map) {
      books.sort((a, b) => a.title.localeCompare(b.title));
      map.set(letter, books);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b))
      .map(([letter, books]) => ({ letter, books, count: books.length }));
  }, [allItems]);

  const handlePlay = (a: any) => {
    playAudio([{
      id: a.id, type: 'audiobook', title: a.title, isLocal: !!a.isLocal,
      subtitle: a.author ?? 'Unknown Author',
      duration: a.duration, color: a.coverColor,
    }]);
  };

  return (
    <div className="px-4 md:px-8 py-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookHeadphones className="w-7 h-7 text-primary" />
            Audiobooks
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {data ? `${data.total + localAudiobooks.length} audiobook${(data.total + localAudiobooks.length) !== 1 ? 's' : ''}${localAudiobooks.length > 0 ? ` (${localAudiobooks.length} local)` : ''}` : 'Loading your audiobook library…'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-card border border-border">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition',
                viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('by-author')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition',
                viewMode === 'by-author' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
              title="Group by author"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">By Author</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('by-title')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition',
                viewMode === 'by-title' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
              title="Group by title"
            >
              <Type className="w-4 h-4" />
              <span className="hidden sm:inline">By Title</span>
            </button>
          </div>

          {/* Sort (only for grid mode) */}
          {viewMode === 'grid' && (
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[180px] bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recently Added</SelectItem>
                <SelectItem value="title">Title A → Z</SelectItem>
                <SelectItem value="author">Author A → Z</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-[2/3] rounded-md" />)}
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-destructive">Failed to load audiobooks: {error}</div>
      )}

      {allItems.length === 0 && !loading && (
        <div className="text-center py-16">
          <BookHeadphones className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No audiobooks found in your library.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'settings' })}>
            Add an Audiobook Library
          </Button>
        </div>
      )}

      {/* === Grid view === */}
      {viewMode === 'grid' && allItems.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 stagger">
          {allItems.map((a: any) => (
            <MediaCard
              key={a.id}
              title={a.title}
              subtitle={`by ${a.author ?? 'Unknown'}${a.isLocal ? ' • Local' : ''}`}
              color={a.coverColor}
              duration={a.duration}
              year={a.year}
              genre={a.genre}
              plot={a.description}
              badge={a.isLocal ? 'Local' : undefined}
              onClick={() => navigate({ kind: 'audiobook', id: a.id })}
              onPlay={() => handlePlay(a)}
            />
          ))}
        </div>
      )}

      {/* === By Author view === */}
      {viewMode === 'by-author' && byAuthor.length > 0 && (
        <div className="space-y-8">
          {byAuthor.map((group) => (
            <div key={group.author}>
              <div className="flex items-center gap-3 mb-4 sticky top-0 bg-background/80 backdrop-blur-md py-2 z-10">
                <div
                  className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white shadow-md"
                  style={{ background: `linear-gradient(135deg, hsl(${hashHue(group.author)}, 40%, 38%) 0%, hsl(0, 0%, 12%) 100%)` }}
                >
                  {group.author.charAt(0).toUpperCase()}
                </div>
                <h2 className="text-xl font-bold">{group.author}</h2>
                <span className="text-sm text-muted-foreground">{group.count} book{group.count !== 1 ? 's' : ''}</span>
                <div className="flex-1 h-px bg-border ml-2" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {group.books.map((a: any) => (
                  <MediaCard
                    key={a.id}
                    title={a.title}
                    subtitle={a.year ? String(a.year) : undefined}
                    color={a.coverColor}
                    duration={a.duration}
                    year={a.year}
                    genre={a.genre}
                    plot={a.description}
                    badge={a.isLocal ? 'Local' : undefined}
                    onClick={() => navigate({ kind: 'audiobook', id: a.id })}
                    onPlay={() => handlePlay(a)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* === By Title view === */}
      {viewMode === 'by-title' && byTitle.length > 0 && (
        <div className="space-y-8">
          {byTitle.map((group) => (
            <div key={group.letter}>
              <div className="flex items-center gap-3 mb-4 sticky top-0 bg-background/80 backdrop-blur-md py-2 z-10">
                <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center font-bold text-primary bg-primary/15 text-xl">
                  {group.letter}
                </div>
                <span className="text-sm text-muted-foreground">{group.count} book{group.count !== 1 ? 's' : ''}</span>
                <div className="flex-1 h-px bg-border ml-2" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {group.books.map((a: any) => (
                  <MediaCard
                    key={a.id}
                    title={a.title}
                    subtitle={`by ${a.author ?? 'Unknown'}`}
                    color={a.coverColor}
                    duration={a.duration}
                    year={a.year}
                    genre={a.genre}
                    plot={a.description}
                    badge={a.isLocal ? 'Local' : undefined}
                    onClick={() => navigate({ kind: 'audiobook', id: a.id })}
                    onPlay={() => handlePlay(a)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Deterministic hue from a string (for author avatar colors)
function hashHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}
