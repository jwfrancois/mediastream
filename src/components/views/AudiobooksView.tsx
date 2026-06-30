// Audiobooks browser — grid of audiobooks with sort.

'use client';

import { useState, useMemo } from 'react';
import { useApi } from '@/lib/useApi';
import { useNav, useAudioPlayer, useLocalLibraries } from '@/lib/store';
import { MediaCard } from '@/components/media/MediaCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookHeadphones } from 'lucide-react';

interface AudiobooksData {
  items: any[];
  total: number;
}

export function AudiobooksView() {
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
      narrator: undefined as string | undefined,
      year: i.year,
      genre: i.genre,
      coverColor: i.color,
      duration: i.duration,
      description: undefined as string | undefined,
      isLocal: true,
    })), [localItems]);

  const allItems = [...(data?.items ?? []), ...localAudiobooks];

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

      {allItems.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {allItems.map((a: any) => (
            <MediaCard
              key={a.id}
              title={a.title}
              subtitle={`by ${a.author ?? 'Unknown'}${a.isLocal ? ' • Local' : ''}`}
              color={a.coverColor}
              duration={a.duration}
              year={a.year}
              onClick={() => a.isLocal ? playAudio([{
                id: a.id, type: 'audiobook', title: a.title, isLocal: true,
                subtitle: a.author ?? 'Unknown Author',
                duration: a.duration, color: a.coverColor,
              }]) : navigate({ kind: 'audiobook', id: a.id })}
              onPlay={() => playAudio([{
                id: a.id, type: 'audiobook', title: a.title, isLocal: !!a.isLocal,
                subtitle: a.author ?? 'Unknown Author',
                duration: a.duration, color: a.coverColor,
              }])}
            />
          ))}
        </div>
      )}
    </div>
  );
}
