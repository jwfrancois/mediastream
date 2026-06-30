// Artist detail — shows artist info and their discography.

'use client';

import { useApi } from '@/lib/useApi';
import { useNav, useAudioPlayer, type AudioQueueItem } from '@/lib/store';
import { MediaCardSquare } from '@/components/media/MediaCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, ArrowLeft } from 'lucide-react';

interface ArtistDetailData {
  id: string;
  name: string;
  bio: string | null;
  imageColor: string | null;
  albums: Array<{
    id: string;
    title: string;
    year: number | null;
    genre: string | null;
    coverColor: string | null;
    _count: { tracks: number };
  }>;
}

export function ArtistDetailView({ id }: { id: string }) {
  const { data, loading, error } = useApi<ArtistDetailData>(`/api/music/artists/${id}`);
  const navigate = useNav((s) => s.navigate);

  if (loading) return <ArtistSkeleton />;

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">{error || 'Artist not found'}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'music' })}>
          Back to Music
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-12 fade-up">
      {/* Header */}
      <div className="relative h-[320px]">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${data.imageColor ?? '#333'} 0%, transparent 100%)`,
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ kind: 'music' })}
          className="absolute top-4 left-4 z-10 text-white/80 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Music
        </Button>
        <div className="relative h-full flex flex-col items-center justify-center px-8 text-center">
          <div
            className="w-32 h-32 rounded-full shadow-2xl flex items-center justify-center text-5xl font-bold text-white mb-4"
            style={{
              background: `linear-gradient(135deg, ${data.imageColor ?? '#444'} 0%, #111 100%)`,
            }}
          >
            {data.name.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg mb-2">{data.name}</h1>
          <div className="text-sm text-white/80 uppercase tracking-wider font-medium">
            {data.albums.length} album{data.albums.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {data.bio && (
        <div className="px-4 md:px-8 mt-8 max-w-3xl">
          <h2 className="text-xl font-bold mb-2">About</h2>
          <p className="text-muted-foreground leading-relaxed">{data.bio}</p>
        </div>
      )}

      {/* Discography */}
      <div className="px-4 md:px-8 mt-8">
        <h2 className="text-xl font-bold mb-4">Discography</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {data.albums.map((a) => (
            <MediaCardSquare
              key={a.id}
              title={a.title}
              subtitle={`${a.year ?? ''} • ${a._count.tracks} track${a._count.tracks !== 1 ? 's' : ''}`}
              color={a.coverColor}
              onClick={() => navigate({ kind: 'album', id: a.id })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ArtistSkeleton() {
  return (
    <div>
      <Skeleton className="h-[320px] w-full" />
      <div className="px-8 mt-8">
        <Skeleton className="h-6 w-24 mb-2" />
        <Skeleton className="h-20 w-full max-w-3xl" />
        <Skeleton className="h-6 w-32 mt-8 mb-4" />
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-md" />)}
        </div>
      </div>
    </div>
  );
}
