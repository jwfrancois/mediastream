// Artist detail — Roon-inspired with hero, biography, full discography grid, and stats.
// Handles both server and local (browser) artists.

'use client';

import { useApi } from '@/lib/useApi';
import { useNav, useAudioPlayer, useLocalLibraries, type AudioQueueItem } from '@/lib/store';
import { MediaCardSquare } from '@/components/media/MediaCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Play, Disc3, Music, Clock, User } from 'lucide-react';
import { isLocalId } from '@/lib/format';
import { useAmbientColor } from '@/lib/useAmbient';
import { useMemo } from 'react';

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
  const localItems = useLocalLibraries((s) => s.items);
  const isLocal = isLocalId(id) || id.startsWith('local_artist_');

  const localArtistData = useMemo(() => {
    if (!isLocal) return null;
    const artistName = id.replace(/^local_artist_/, '');
    const tracks = localItems.filter((i) => i.mediaType === 'track' && (i.artist ?? '') === artistName);
    if (tracks.length === 0) return null;
    const first = tracks[0];

    // Build albums
    const albumMap = new Map<string, { title: string; year: number | null; coverColor: string; trackCount: number }>();
    for (const t of tracks) {
      const albumName = t.album ?? 'Unknown Album';
      if (!albumMap.has(albumName)) {
        albumMap.set(albumName, {
          title: albumName,
          year: t.albumYear ?? null,
          coverColor: t.color,
          trackCount: 0,
        });
      }
      albumMap.get(albumName)!.trackCount++;
    }

    return {
      id,
      name: artistName,
      bio: first.artistBio ?? null,
      imageColor: first.color,
      albums: Array.from(albumMap.entries()).map(([name, info]) => ({
        id: 'local_album_' + name + '|' + artistName,
        title: name,
        year: info.year,
        genre: first.albumGenre ?? first.artistGenre ?? null,
        coverColor: info.coverColor,
        _count: { tracks: info.trackCount },
      })),
    } as ArtistDetailData;
  }, [isLocal, id, localItems]);

  const { data: serverData, loading, error } = useApi<ArtistDetailData>(isLocal ? null : `/api/music/artists/${id}`);
  const data = isLocal ? localArtistData : serverData;

  useAmbientColor({ color: data?.imageColor });

  const navigate = useNav((s) => s.navigate);
  const playNow = useAudioPlayer((s) => s.playNow);

  if (!isLocal && loading) return <ArtistSkeleton />;
  if (!isLocal && (error || !serverData)) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">{error || 'Artist not found'}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'music' })}>Back to Music</Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Artist not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'music' })}>Back to Music</Button>
      </div>
    );
  }

  const totalTracks = data.albums.reduce((sum, a) => sum + a._count.tracks, 0);

  // Play all tracks by this artist
  const playAll = () => {
    if (isLocal) {
      const artistName = data.name;
      const tracks = localItems
        .filter((i) => i.mediaType === 'track' && (i.artist ?? '') === artistName)
        .sort((a, b) => (a.album ?? '').localeCompare(b.album ?? '') || (a.trackNumber ?? 0) - (b.trackNumber ?? 0));
      const queue: AudioQueueItem[] = tracks.map((t) => ({
        id: t.id,
        type: 'track',
        title: t.title,
        subtitle: artistName,
        duration: t.duration,
        color: t.color,
        isLocal: true,
      }));
      playNow(queue, 0);
    }
  };

  return (
    <div className="pb-12 fade-up">
      {/* === Hero === */}
      <div className="relative h-[340px]">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${data.imageColor ?? '#444'} 0%, transparent 100%)`,
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ kind: 'music' })}
          className="absolute top-4 left-4 z-10 text-white/80 hover:text-white hover:bg-white/10 glass"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Music
        </Button>
        <div className="relative h-full flex flex-col items-center justify-center px-8 text-center">
          {/* Artist avatar */}
          <div
            className="w-32 h-32 md:w-40 md:h-40 rounded-full shadow-2xl flex items-center justify-center text-5xl md:text-6xl font-bold text-white mb-5 grain relative"
            style={{ background: `linear-gradient(135deg, ${data.imageColor ?? '#444'} 0%, #0a0a0a 100%)` }}
          >
            <div className="absolute inset-0 opacity-40 mix-blend-soft-light rounded-full" style={{
              background: 'radial-gradient(ellipse 60% 80% at 25% 15%, rgba(255,255,255,0.25) 0%, transparent 55%)',
            }} />
            <div className="absolute inset-0 flex items-center justify-center opacity-15">
              <User className="w-16 h-16 text-white" />
            </div>
            <span className="relative">{data.name.charAt(0).toUpperCase()}</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg mb-2">{data.name}</h1>
          <div className="flex items-center gap-4 text-sm text-white/70">
            <span className="flex items-center gap-1"><Disc3 className="w-4 h-4" /> {data.albums.length} album{data.albums.length !== 1 ? 's' : ''}</span>
            <span className="flex items-center gap-1"><Music className="w-4 h-4" /> {totalTracks} track{totalTracks !== 1 ? 's' : ''}</span>
          </div>
          {isLocal && (
            <Button
              size="lg"
              onClick={playAll}
              className="mt-6 bg-primary hover:bg-primary/90 rounded-full px-8"
            >
              <Play className="w-5 h-5 fill-current mr-2" /> Play All
            </Button>
          )}
        </div>
      </div>

      {/* === Biography === */}
      {data.bio && (
        <div className="px-4 md:px-8 mt-10 max-w-3xl">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Biography</h2>
          <p className="text-base text-foreground/80 leading-relaxed">{data.bio}</p>
        </div>
      )}

      {/* === Discography === */}
      <div className="px-4 md:px-8 mt-10">
        <h2 className="text-xl font-bold mb-4">Discography</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 stagger">
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
      <Skeleton className="h-[340px] w-full" />
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
