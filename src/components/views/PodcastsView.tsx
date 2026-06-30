// Podcasts browser — grid of podcast shows.

'use client';

import { useApi } from '@/lib/useApi';
import { useNav } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Mic } from 'lucide-react';

interface PodcastsData {
  items: any[];
}

export function PodcastsView() {
  const { data, loading, error } = useApi<PodcastsData>('/api/podcasts');
  const navigate = useNav((s) => s.navigate);

  return (
    <div className="px-4 md:px-8 py-6 pb-12">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Mic className="w-7 h-7 text-primary" />
          Podcasts
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {data ? `${data.items.length} podcast${data.items.length !== 1 ? 's' : ''} in your library` : 'Loading your podcast library…'}
        </p>
      </div>

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-md" />)}
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-destructive">Failed to load podcasts: {error}</div>
      )}

      {data && data.items.length === 0 && (
        <div className="text-center py-16">
          <Mic className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No podcasts found in your library.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'settings' })}>
            Add a Podcast Library
          </Button>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {data.items.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate({ kind: 'podcast', id: p.id })}
              className="group flex flex-col p-3 rounded-lg bg-card hover:bg-card/80 transition cursor-pointer text-left"
            >
              <div
                className="aspect-square rounded-md mb-3 flex items-center justify-center text-2xl font-bold text-white shadow-lg group-hover:scale-105 transition"
                style={{
                  background: `linear-gradient(135deg, ${p.coverColor ?? '#444'} 0%, #111 100%)`,
                }}
              >
                <Mic className="w-10 h-10 opacity-50" />
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
  );
}
