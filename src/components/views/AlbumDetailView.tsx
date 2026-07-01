// Album detail — Roon-inspired layout with full track list, album description,
// artist bio, and discography rail. Handles both server and local (browser) albums.

'use client';

import { useApi } from '@/lib/useApi';
import { useNav, useAudioPlayer, useLocalLibraries, type AudioQueueItem } from '@/lib/store';
import { MediaRow } from '@/components/media/MediaRow';
import { MediaCardSquare } from '@/components/media/MediaCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Play, Pause, ArrowLeft, Clock, Plus, Heart, Disc3, User, Calendar,
  Music, Shuffle, Share2,
} from 'lucide-react';
import { formatDuration, formatDurationShort, isLocalId } from '@/lib/format';
import { useAmbientColor } from '@/lib/useAmbient';
import { useMemo } from 'react';

interface AlbumDetailData {
  id: string;
  title: string;
  year: number | null;
  genre: string | null;
  coverColor: string | null;
  addedAt: string;
  artist: { id: string; name: string; imageColor: string | null; bio: string | null } | null;
  tracks: Array<{
    id: string;
    trackNumber: number;
    title: string;
    duration: number | null;
    progress: { position: number; duration: number | null; completed: boolean } | null;
  }>;
  otherAlbums: any[];
}

export function AlbumDetailView({ id }: { id: string }) {
  // For local albums, load from the browser's IndexedDB store
  const localItems = useLocalLibraries((s) => s.items);
  const isLocal = isLocalId(id) || id.startsWith('local_album_');

  // Extract album key from local id
  const localAlbumData = useMemo(() => {
    if (!isLocal) return null;
    // The id is `local_album_AlbumName|ArtistName`
    const key = id.replace(/^local_album_/, '');
    const [albumName, artistName] = key.split('|');
    const tracks = localItems
      .filter((i) => i.mediaType === 'track' && (i.album ?? '') === albumName && (i.artist ?? '') === artistName)
      .sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0));
    if (tracks.length === 0) return null;
    const first = tracks[0];
    return {
      id,
      title: albumName,
      year: first.albumYear ?? first.year ?? null,
      genre: first.albumGenre ?? first.genre ?? null,
      coverColor: first.color,
      addedAt: new Date(first.addedAt).toISOString(),
      artist: { id: 'local_artist_' + artistName, name: artistName, imageColor: first.color, bio: first.artistBio ?? null },
      tracks: tracks.map((t) => ({
        id: t.id,
        trackNumber: t.trackNumber ?? 0,
        title: t.title,
        duration: t.duration ?? null,
        progress: null,
      })),
      otherAlbums: localItems
        .filter((i) => i.mediaType === 'track' && (i.artist ?? '') === artistName && (i.album ?? '') !== albumName)
        .map((i) => {
          const aKey = (i.album ?? '') + '|' + (i.artist ?? '');
          return { id: 'local_album_' + aKey, title: i.album, year: i.albumYear, coverColor: i.color, _key: aKey };
        })
        .filter((v, i, arr) => arr.findIndex((x) => x._key === v._key) === i)
        .slice(0, 8),
      _localTracks: tracks,
      _albumDescription: first.albumDescription,
      _artistBio: first.artistBio,
    } as any;
  }, [isLocal, id, localItems]);

  const { data: serverData, loading, error } = useApi<AlbumDetailData>(isLocal ? null : `/api/music/albums/${id}`);
  const data = isLocal ? localAlbumData : serverData;

  // Set ambient color
  useAmbientColor({ color: data?.coverColor });

  const navigate = useNav((s) => s.navigate);
  const { playNow, queue, currentIndex, isPlaying, togglePlay, addToQueue } = useAudioPlayer();

  if (!isLocal && loading) return <AlbumSkeleton />;
  if (!isLocal && (error || !serverData)) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">{error || 'Album not found'}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'music' })}>Back to Music</Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Album not found. Try scanning your music library.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'music' })}>Back to Music</Button>
      </div>
    );
  }

  const buildQueue = (startIndex = 0): AudioQueueItem[] =>
    data.tracks.map((t) => ({
      id: t.id,
      type: 'track',
      title: t.title,
      subtitle: data.artist?.name ?? 'Unknown Artist',
      duration: t.duration,
      color: data.coverColor,
      isLocal: isLocal || isLocalId(t.id),
    }));

  const currentTrack = queue[currentIndex];
  const isThisAlbumPlaying = currentTrack && data.tracks.some((t) => t.id === currentTrack.id);

  const playTrack = (trackIndex: number) => {
    if (isThisAlbumPlaying && currentIndex === trackIndex) { togglePlay(); return; }
    playNow(buildQueue(), trackIndex);
  };

  const playAlbum = () => {
    if (isThisAlbumPlaying) { togglePlay(); return; }
    playNow(buildQueue(), 0);
  };

  const totalDuration = data.tracks.reduce((sum, t) => sum + (t.duration ?? 0), 0);
  const albumDescription = (data as any)._albumDescription;
  const artistBio = (data as any)._artistBio ?? data.artist?.bio;

  return (
    <div className="pb-12 fade-up">
      {/* === Header === */}
      <div className="relative">
        <div
          className="absolute inset-0 h-[340px] opacity-50"
          style={{ background: `linear-gradient(180deg, ${data.coverColor ?? '#333'} 0%, transparent 100%)` }}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ kind: 'music' })}
          className="absolute top-4 left-4 z-10 text-white/80 hover:text-white hover:bg-white/10 glass"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Music
        </Button>

        <div className="relative px-4 md:px-8 pt-16 pb-8 flex flex-col md:flex-row gap-8 items-end">
          {/* Album art */}
          <div
            className="w-[200px] h-[200px] md:w-[240px] md:h-[240px] rounded-xl shadow-2xl flex-shrink-0 grain relative"
            style={{ background: `linear-gradient(145deg, ${data.coverColor ?? '#444'} 0%, #0a0a0a 100%)` }}
          >
            <div className="absolute inset-0 opacity-40 mix-blend-soft-light rounded-xl" style={{
              background: 'radial-gradient(ellipse 60% 80% at 25% 15%, rgba(255,255,255,0.25) 0%, transparent 55%)',
            }} />
            <div className="absolute inset-0 flex items-center justify-center opacity-15">
              <Disc3 className="w-20 h-20 text-white" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent rounded-b-xl">
              <div className="font-bold text-white text-xl drop-shadow">{data.title}</div>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="text-xs uppercase tracking-widest text-white/50 font-medium mb-2">Album</div>
            <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight drop-shadow-lg mb-3">{data.title}</h1>
            {data.artist && (
              <button
                type="button"
                onClick={() => navigate({ kind: 'artist', id: data.artist!.id })}
                className="text-lg text-white/70 hover:text-white hover:underline transition"
              >
                {data.artist.name}
              </button>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-white/60">
              {data.year && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {data.year}</span>}
              {data.genre && <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/80 text-xs">{data.genre}</span>}
              <span>{data.tracks.length} track{data.tracks.length !== 1 ? 's' : ''}</span>
              {totalDuration > 0 && <span>• {formatDurationShort(totalDuration)}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* === Action bar === */}
      <div className="px-4 md:px-8 py-6 flex items-center gap-4">
        <Button
          size="lg"
          onClick={playAlbum}
          className="bg-primary hover:bg-primary/90 rounded-full w-14 h-14 p-0 shadow-2xl"
        >
          {isThisAlbumPlaying && isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground" aria-label="Shuffle"
          onClick={() => { playNow(buildQueue(), 0); /* TODO: enable shuffle */ }}
        >
          <Shuffle className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground" aria-label="Add to queue"
          onClick={() => addToQueue(buildQueue())}
        >
          <Plus className="w-6 h-6" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground" aria-label="Like">
          <Heart className="w-6 h-6" />
        </Button>
      </div>

      {/* === Track list === */}
      <div className="px-4 md:px-8">
        <div className="grid grid-cols-[40px_1fr_120px] gap-3 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground border-b border-border mb-2">
          <div className="text-center">#</div>
          <div>Title</div>
          <div className="hidden md:block text-right"><Clock className="w-3.5 h-3.5 ml-auto" /></div>
        </div>
        {data.tracks.map((t, i) => {
          const isCurrent = isThisAlbumPlaying && queue[currentIndex]?.id === t.id;
          const isPlayingThis = isCurrent && isPlaying;
          return (
            <div
              key={t.id}
              onClick={() => playTrack(i)}
              className={`group grid grid-cols-[40px_1fr_120px] gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition items-center ${
                isCurrent ? 'bg-primary/10' : 'hover:bg-card/60'
              }`}
            >
              <div className="flex items-center justify-center text-sm text-muted-foreground">
                {isPlayingThis ? (
                  <span className="flex items-end gap-0.5 h-4">
                    <span className="w-0.5 bg-primary pulse-dot" style={{ height: '60%' }} />
                    <span className="w-0.5 bg-primary pulse-dot" style={{ height: '100%', animationDelay: '0.2s' }} />
                    <span className="w-0.5 bg-primary pulse-dot" style={{ height: '40%', animationDelay: '0.4s' }} />
                  </span>
                ) : (
                  <>
                    <span className="group-hover:hidden">{t.trackNumber}</span>
                    <Play className="w-3.5 h-3.5 fill-current hidden group-hover:block text-foreground" />
                  </>
                )}
              </div>
              <div className="min-w-0">
                <div className={`text-sm font-medium truncate ${isCurrent ? 'text-primary' : 'text-foreground'}`}>{t.title}</div>
                <div className="text-xs text-muted-foreground truncate">{data.artist?.name}</div>
              </div>
              <div className="hidden md:block text-sm text-muted-foreground text-right">
                {t.duration ? formatDuration(t.duration) : '—'}
              </div>
            </div>
          );
        })}
      </div>

      {/* === Album description === */}
      {albumDescription && (
        <div className="px-4 md:px-8 mt-10 max-w-3xl">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">About this album</h2>
          <p className="text-base text-foreground/80 leading-relaxed">{albumDescription}</p>
        </div>
      )}

      {/* === Artist bio === */}
      {artistBio && data.artist && (
        <div className="px-4 md:px-8 mt-8 max-w-3xl">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> About {data.artist.name}
          </h2>
          <p className="text-base text-foreground/80 leading-relaxed">{artistBio}</p>
          <Button variant="link" className="mt-2 p-0 h-auto" onClick={() => navigate({ kind: 'artist', id: data.artist!.id })}>
            View artist →
          </Button>
        </div>
      )}

      {/* === More by this artist === */}
      {data.otherAlbums && data.otherAlbums.length > 0 && data.artist && (
        <div className="mt-12">
          <MediaRow title={`More by ${data.artist.name}`}>
            {data.otherAlbums.map((a: any) => (
              <div key={a.id} className="w-[150px] md:w-[180px] flex-shrink-0">
                <MediaCardSquare
                  title={a.title}
                  subtitle={String(a.year ?? '')}
                  color={a.coverColor}
                  onClick={() => navigate({ kind: 'album', id: a.id })}
                />
              </div>
            ))}
          </MediaRow>
        </div>
      )}
    </div>
  );
}

function AlbumSkeleton() {
  return (
    <div>
      <Skeleton className="h-[300px] w-full" />
      <div className="px-8 -mt-20 relative">
        <div className="flex gap-8 items-end">
          <Skeleton className="w-[240px] h-[240px] rounded-xl" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-14 w-14 rounded-full mt-6" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </div>
    </div>
  );
}
