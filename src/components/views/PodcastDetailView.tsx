// Podcast detail — show info + episode list with play buttons.

'use client';

import { useApi } from '@/lib/useApi';
import { useNav, useAudioPlayer, type AudioQueueItem } from '@/lib/store';
import { MediaRow } from '@/components/media/MediaRow';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Pause, ArrowLeft, Clock, Calendar, Mic, CheckCircle2 } from 'lucide-react';
import { formatDurationShort, formatRelativeTime, formatDate } from '@/lib/format';

interface PodcastDetailData {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  genre: string | null;
  coverColor: string | null;
  addedAt: string;
  episodes: Array<{
    id: string;
    episodeNumber: number;
    title: string;
    description: string | null;
    pubDate: string | null;
    duration: number | null;
    progress: { position: number; duration: number | null; completed: boolean } | null;
  }>;
  otherPodcasts: any[];
}

export function PodcastDetailView({ id }: { id: string }) {
  const { data, loading, error } = useApi<PodcastDetailData>(`/api/podcasts/${id}`);
  const navigate = useNav((s) => s.navigate);
  const { playNow, queue, currentIndex, isPlaying, togglePlay } = useAudioPlayer();

  if (loading) return <PodcastSkeleton />;

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">{error || 'Podcast not found'}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'podcasts' })}>
          Back to Podcasts
        </Button>
      </div>
    );
  }

  const buildQueue = (): AudioQueueItem[] =>
    data.episodes.map((e) => ({
      id: e.id,
      type: 'podcast' as const,
      title: e.title,
      subtitle: data.title,
      duration: e.duration,
      color: data.coverColor,
      podcastId: data.id,
    }));

  const isThisPodcastPlaying = queue[currentIndex]?.podcastId === data.id;

  const playEpisode = (episodeIndex: number) => {
    if (isThisPodcastPlaying && currentIndex === episodeIndex) {
      togglePlay();
      return;
    }
    playNow(buildQueue(), episodeIndex);
  };

  const playLatest = () => {
    if (isThisPodcastPlaying) {
      togglePlay();
      return;
    }
    playNow(buildQueue(), 0); // episodes are ordered desc, so 0 is latest
  };

  return (
    <div className="pb-12 fade-up">
      {/* Header */}
      <div className="relative">
        <div
          className="absolute inset-0 h-[360px] opacity-60"
          style={{
            background: `linear-gradient(180deg, ${data.coverColor ?? '#333'} 0%, transparent 100%)`,
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ kind: 'podcasts' })}
          className="absolute top-4 left-4 z-10 text-white/80 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Podcasts
        </Button>
        <div className="relative px-4 md:px-8 pt-16 pb-8 flex flex-col md:flex-row gap-8 items-end">
          <div
            className="w-[200px] h-[200px] md:w-[220px] md:h-[220px] rounded-lg shadow-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${data.coverColor ?? '#444'} 0%, #111 100%)`,
            }}
          >
            <Mic className="w-16 h-16 text-white/40" />
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wider text-white/70 font-medium mb-2">Podcast</div>
            <h1 className="text-4xl md:text-6xl font-bold mb-3 text-white drop-shadow-lg">{data.title}</h1>
            {data.author && (
              <div className="text-sm text-white/80 mb-2">by {data.author}</div>
            )}
            <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
              {data.genre && <span className="px-2 py-0.5 rounded-full bg-white/15 text-xs">{data.genre}</span>}
              <span>• {data.episodes.length} episode{data.episodes.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Description + play button */}
      <div className="px-4 md:px-8 py-6 flex flex-col md:flex-row gap-6 items-start">
        <Button
          size="lg"
          onClick={playLatest}
          className="bg-primary hover:bg-primary/90 rounded-full"
        >
          {isThisPodcastPlaying && isPlaying
            ? <><Pause className="w-5 h-5 fill-current mr-2" /> Pause</>
            : <><Play className="w-5 h-5 fill-current mr-2" /> Play Latest</>}
        </Button>
        {data.description && (
          <p className="text-muted-foreground leading-relaxed flex-1 max-w-2xl">{data.description}</p>
        )}
      </div>

      {/* Episode list */}
      <div className="px-4 md:px-8 mt-4">
        <h2 className="text-xl font-bold mb-4">All Episodes</h2>
        <div className="space-y-2">
          {data.episodes.map((ep, i) => {
            const isCurrent = isThisPodcastPlaying && currentIndex === i;
            const isPlayingThis = isCurrent && isPlaying;
            const progressPct = ep.progress?.duration
              ? Math.min(100, Math.round((ep.progress.position / ep.progress.duration) * 100))
              : 0;
            return (
              <div
                key={ep.id}
                onClick={() => playEpisode(i)}
                className={`group flex gap-4 p-4 rounded-lg cursor-pointer transition border ${
                  isCurrent ? 'bg-card border-primary/40' : 'bg-card/50 hover:bg-card border-transparent hover:border-border'
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); playEpisode(i); }}
                  className="relative w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${data.coverColor ?? '#444'} 0%, #111 100%)`,
                  }}
                  aria-label={isPlayingThis ? 'Pause' : 'Play episode'}
                >
                  {isPlayingThis
                    ? <Pause className="w-5 h-5 text-white fill-current" />
                    : <Play className="w-5 h-5 text-white fill-current ml-0.5" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Episode {ep.episodeNumber}
                    </span>
                    {ep.pubDate && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        • <Calendar className="w-3 h-3" /> {formatDate(ep.pubDate)}
                      </span>
                    )}
                    {ep.duration && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        • <Clock className="w-3 h-3" /> {formatDurationShort(ep.duration)}
                      </span>
                    )}
                    {ep.progress?.completed && (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <h3 className={`font-semibold mb-1 line-clamp-1 ${isCurrent ? 'text-primary' : 'text-foreground'}`}>
                    {ep.title}
                  </h3>
                  {ep.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{ep.description}</p>
                  )}
                  {progressPct > 0 && progressPct < 100 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-card rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${progressPct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{progressPct}%</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Other podcasts by same author */}
      {data.otherPodcasts && data.otherPodcasts.length > 0 && data.author && (
        <div className="mt-12 px-4 md:px-8">
          <MediaRow title={`More by ${data.author}`}>
            {data.otherPodcasts.map((p) => (
              <div key={p.id} className="w-[160px] md:w-[180px] flex-shrink-0">
                <button
                  type="button"
                  onClick={() => navigate({ kind: 'podcast', id: p.id })}
                  className="group flex flex-col p-3 rounded-lg bg-card hover:bg-card/80 transition cursor-pointer text-left w-full"
                >
                  <div
                    className="aspect-square rounded-md mb-3 flex items-center justify-center shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${p.coverColor ?? '#444'} 0%, #111 100%)`,
                    }}
                  >
                    <Mic className="w-8 h-8 text-white/40" />
                  </div>
                  <div className="font-semibold text-sm line-clamp-2">{p.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {p._count.episodes} episodes
                  </div>
                </button>
              </div>
            ))}
          </MediaRow>
        </div>
      )}
    </div>
  );
}

function PodcastSkeleton() {
  return (
    <div>
      <Skeleton className="h-[300px] w-full" />
      <div className="px-8 -mt-16 relative">
        <div className="flex gap-8 items-end">
          <Skeleton className="w-[220px] h-[220px] rounded-lg" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
        <Skeleton className="h-12 w-40 rounded-full mt-6" />
        <div className="mt-8 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      </div>
    </div>
  );
}
