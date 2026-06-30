// Audiobooks browser — grid of audiobooks with sort.

'use client';

import { useState } from 'react';
import { useApi } from '@/lib/useApi';
import { useNav, useAudioPlayer } from '@/lib/store';
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

  const { data, loading, error } = useApi<AudiobooksData>(`/api/audiobooks?sort=${sort}`, [sort]);

  return (
    <div className="px-4 md:px-8 py-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookHeadphones className="w-7 h-7 text-primary" />
            Audiobooks
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {data ? `${data.total} audiobook${data.total !== 1 ? 's' : ''} in your library` : 'Loading your audiobook library…'}
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

      {data && data.items.length === 0 && (
        <div className="text-center py-16">
          <BookHeadphones className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No audiobooks found in your library.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'settings' })}>
            Add an Audiobook Library
          </Button>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {data.items.map((a) => (
            <MediaCard
              key={a.id}
              title={a.title}
              subtitle={`by ${a.author ?? 'Unknown'}`}
              color={a.coverColor}
              duration={a.duration}
              year={a.year}
              onClick={() => navigate({ kind: 'audiobook', id: a.id })}
              onPlay={() => playAudio([{
                id: a.id, type: 'audiobook', title: a.title,
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
