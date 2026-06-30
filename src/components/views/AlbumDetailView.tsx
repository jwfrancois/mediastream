// Album detail — Spotify-style with full track list and play-all.

'use client';

import { useApi } from '@/lib/useApi';
import { useNav, useAudioPlayer, type AudioQueueItem } from '@/lib/store';
import { MediaRow } from '@/components/media/MediaRow';
import { MediaCardSquare } from '@/components/media/MediaCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Pause, ArrowLeft, Clock, Plus, Heart } from 'lucide-react';
import { formatDuration, formatDurationShort } from '@/lib/format';
import { useAudioPlayer as useAudio } from '@/lib/store';
import { useEffect } from 'react';

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
  const { data, loading, error } = useApi<AlbumDetailData>(`/api/music/albums/${id}`);
  const navigate = useNav((s) => s.navigate);
  const { playNow, queue, currentIndex, isPlaying, togglePlay, addToQueue } = useAudioPlayer();

  if (loading) return <AlbumSkeleton />;

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">{error || 'Album not found'}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'music' })}>
          Back to Music
        </Button>
      </div>
    );
  }

  // Build queue items for all tracks
  const buildQueue = (startIndex = 0): AudioQueueItem[] => {
    return data.tracks.map((t) => ({
      id: t.id,
      type: 'track' as const,
      title: t.title,
      subtitle: data.artist?.name ?? 'Unknown Artist',
      duration: t.duration,
      color: data.coverColor,
      albumId: data.id,
    }));
  };

  // Check if this album is currently playing
  const currentTrack = queue[currentIndex];
  const isThisAlbumPlaying = currentTrack?.albumId === data.id;

  const playTrack = (trackIndex: number) => {
    if (isThisAlbumPlaying && currentIndex === trackIndex) {
      togglePlay();
      return;
    }
    playNow(buildQueue(), trackIndex);
  };

  const playAlbum = () => {
    if (isThisAlbumPlaying) {
      togglePlay();
      return;
    }
    playNow(buildQueue(), 0);
  };

  return (
    <div className="pb-12 fade-up">
      {/* Header with cover art + info */}
      <div className="relative">
        <div
          className="absolute inset-0 h-[400px] opacity-60"
          style={{
            background: `linear-gradient(180deg, ${data.coverColor ?? '#333'} 0%, transparent 100%)`,
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
        <div className="relative px-4 md:px-8 pt-16 pb-8 flex flex-col md:flex-row gap-8 items-end">
          <div
            className="w-[200px] h-[200px] md:w-[240px] md:h-[240px] rounded-lg shadow-2xl flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${data.coverColor ?? '#444'} 0%, #111 100%)`,
            }}
          >
            <div className="h-full flex items-end p-4 bg-gradient-to-t from-black/50 to-transparent">
              <div className="font-bold text-white text-xl drop-shadow">{data.title}</div>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wider text-white/70 font-medium mb-2">Album</div>
            <h1 className="text-4xl md:text-6xl font-bold mb-3 text-white drop-shadow-lg">{data.title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
              {data.artist && (
                <button
                  type="button"
                  onClick={() => navigate({ kind: 'artist', id: data.artist!.id })}
                  className="font-semibold hover:underline"
                >
                  {data.artist.name}
                </button>
              )}
              {data.year && <span>• {data.year}</span>}
              {data.genre && <span>• {data.genre}</span>}
              <span>• {data.tracks.length} song{data.tracks.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="px-4 md:px-8 py-6 flex items-center gap-4">
        <Button
          size="lg"
          onClick={playAlbum}
          className="bg-primary hover:bg-primary/90 rounded-full w-14 h-14 p-0"
          aria-label={isThisAlbumPlaying && isPlaying ? 'Pause' : 'Play album'}
        >
          {isThisAlbumPlaying && isPlaying
            ? <Pause className="w-6 h-6 fill-current" />
            : <Play className="w-6 h-6 fill-current ml-1" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => addToQueue(buildQueue())}
          aria-label="Add to queue"
        >
          <Plus className="w-6 h-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Like"
        >
          <Heart className="w-6 h-6" />
        </Button>
      </div>

      {/* Track list */}
      <div className="px-4 md:px-8">
        <div className="grid grid-cols-[40px_1fr_120px_40px] gap-3 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground border-b border-border mb-2">
          <div className="text-center">#</div>
          <div>Title</div>
          <div className="hidden md:block pl-4"><Clock className="w-3.5 h-3.5" /></div>
          <div></div>
        </div>
        {data.tracks.map((t, i) => {
          const isCurrent = isThisAlbumPlaying && currentIndex === i;
          const isPlayingThis = isCurrent && isPlaying;
          return (
            <div
              key={t.id}
              onClick={() => playTrack(i)}
              className={`group grid grid-cols-[40px_1fr_120px_40px] gap-3 px-3 py-2 rounded-md cursor-pointer transition items-center ${
                isCurrent ? 'bg-card' : 'hover:bg-card/60'
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
                <div className={`text-sm font-medium truncate ${isCurrent ? 'text-primary' : 'text-foreground'}`}>
                  {t.title}
                </div>
                <div className="text-xs text-muted-foreground truncate">{data.artist?.name}</div>
              </div>
              <div className="hidden md:block text-sm text-muted-foreground text-right">
                {t.duration ? formatDurationShort(t.duration) : '—'}
              </div>
              <div className="flex items-center justify-end">
                <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">⋯</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* More by this artist */}
      {data.otherAlbums && data.otherAlbums.length > 0 && data.artist && (
        <div className="mt-12 px-4 md:px-8">
          <MediaRow title={`More by ${data.artist.name}`}>
            {data.otherAlbums.map((a) => (
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
          <Skeleton className="w-[240px] h-[240px] rounded-lg" />
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
