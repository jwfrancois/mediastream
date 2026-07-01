// Podcast detail — Roon-inspired with show info, rich episode cards, and host bio.
// Handles both server and local (browser) podcasts.

'use client';

import { useApi } from '@/lib/useApi';
import { useNav, useAudioPlayer, useLocalLibraries, type AudioQueueItem } from '@/lib/store';
import { MediaRow } from '@/components/media/MediaRow';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Pause, ArrowLeft, Clock, Calendar, Mic, CheckCircle2, User, Headphones } from 'lucide-react';
import { formatDurationShort, formatRelativeTime, formatDate, isLocalId } from '@/lib/format';
import { useAmbientColor } from '@/lib/useAmbient';
import { useMemo } from 'react';

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
  const localItems = useLocalLibraries((s) => s.items);
  const isLocal = isLocalId(id) || id.startsWith('local_podcast_');

  const localPodcastData = useMemo(() => {
    if (!isLocal) return null;
    const podName = id.replace(/^local_podcast_/, '');
    const episodes = localItems
      .filter((i) => i.mediaType === 'podcast-episode' && (i.podcastTitle ?? '') === podName)
      .sort((a, b) => (b.episodeNumber ?? 0) - (a.episodeNumber ?? 0));
    if (episodes.length === 0) return null;
    const first = episodes[0];
    return {
      id,
      title: podName,
      author: first.podcastAuthor ?? null,
      description: first.podcastDescription ?? first.description ?? null,
      genre: first.podcastGenre ?? first.genre ?? null,
      coverColor: first.color,
      addedAt: new Date(first.addedAt).toISOString(),
      episodes: episodes.map((e) => ({
        id: e.id,
        episodeNumber: e.episodeNumber ?? 0,
        title: e.title,
        description: e.description ?? null,
        pubDate: e.pubDate ? new Date(e.pubDate).toISOString() : null,
        duration: e.duration ?? null,
        progress: null,
      })),
      otherPodcasts: [],
    } as PodcastDetailData;
  }, [isLocal, id, localItems]);

  const { data: serverData, loading, error } = useApi<PodcastDetailData>(isLocal ? null : `/api/podcasts/${id}`);
  const data = isLocal ? localPodcastData : serverData;

  useAmbientColor({ color: data?.coverColor });

  const navigate = useNav((s) => s.navigate);
  const { playNow, queue, currentIndex, isPlaying, togglePlay } = useAudioPlayer();

  if (!isLocal && loading) return <PodcastSkeleton />;
  if (!isLocal && (error || !serverData)) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">{error || 'Podcast not found'}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'podcasts' })}>Back to Podcasts</Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Podcast not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'podcasts' })}>Back to Podcasts</Button>
      </div>
    );
  }

  const buildQueue = (): AudioQueueItem[] =>
    data.episodes.map((e) => ({
      id: e.id,
      type: 'podcast',
      title: e.title,
      subtitle: data.title,
      duration: e.duration,
      color: data.coverColor,
      isLocal: isLocal || isLocalId(e.id),
    }));

  const isThisPodcastPlaying = queue[currentIndex]?.podcastId === data.id ||
    (isLocal && queue[currentIndex]?.subtitle === data.title);

  const playEpisode = (episodeIndex: number) => {
    if (isThisPodcastPlaying && currentIndex === episodeIndex) { togglePlay(); return; }
    playNow(buildQueue(), episodeIndex);
  };

  const playLatest = () => {
    if (isThisPodcastPlaying) { togglePlay(); return; }
    playNow(buildQueue(), 0);
  };

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
          onClick={() => navigate({ kind: 'podcasts' })}
          className="absolute top-4 left-4 z-10 text-white/80 hover:text-white hover:bg-white/10 glass"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Podcasts
        </Button>

        <div className="relative px-4 md:px-8 pt-16 pb-8 flex flex-col md:flex-row gap-8 items-end">
          {/* Podcast art */}
          <div
            className="w-[200px] h-[200px] md:w-[220px] md:h-[220px] rounded-2xl shadow-2xl flex-shrink-0 grain relative"
            style={{ background: `linear-gradient(145deg, ${data.coverColor ?? '#444'} 0%, #0a0a0a 100%)` }}
          >
            <div className="absolute inset-0 opacity-40 mix-blend-soft-light rounded-2xl" style={{
              background: 'radial-gradient(ellipse 60% 80% at 25% 15%, rgba(255,255,255,0.25) 0%, transparent 55%)',
            }} />
            <div className="absolute inset-0 flex items-center justify-center opacity-15">
              <Mic className="w-20 h-20 text-white" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent rounded-b-2xl">
              <div className="font-bold text-white text-lg drop-shadow line-clamp-2">{data.title}</div>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="text-xs uppercase tracking-widest text-white/50 font-medium mb-2">Podcast</div>
            <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight drop-shadow-lg mb-3">{data.title}</h1>
            {data.author && (
              <div className="text-lg text-white/70 flex items-center gap-2">
                <User className="w-4 h-4" /> {data.author}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-white/60">
              {data.genre && <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/80 text-xs">{data.genre}</span>}
              <span>{data.episodes.length} episode{data.episodes.length !== 1 ? 's' : ''}</span>
            </div>
            {data.description && (
              <p className="mt-4 text-white/70 max-w-2xl line-clamp-3 leading-relaxed">{data.description}</p>
            )}
            <Button
              size="lg"
              onClick={playLatest}
              className="mt-5 bg-primary hover:bg-primary/90 rounded-full px-8"
            >
              {isThisPodcastPlaying && isPlaying ? <><Pause className="w-5 h-5 fill-current mr-2" /> Pause</> : <><Play className="w-5 h-5 fill-current mr-2" /> Play Latest</>}
            </Button>
          </div>
        </div>
      </div>

      {/* === Episode list === */}
      <div className="px-4 md:px-8 mt-8">
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
                className={`group flex gap-4 p-4 rounded-xl cursor-pointer transition card-lift ${
                  isCurrent ? 'bg-primary/10 border border-primary/40' : 'bg-card/50 hover:bg-card border border-transparent hover:border-border'
                }`}
              >
                {/* Play button / thumbnail */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); playEpisode(i); }}
                  className="relative w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${data.coverColor ?? '#444'} 0%, #111 100%)` }}
                  aria-label={isPlayingThis ? 'Pause' : 'Play'}
                >
                  {isPlayingThis ? <Pause className="w-5 h-5 text-white fill-current" /> : <Play className="w-5 h-5 text-white fill-current ml-0.5" />}
                </button>

                {/* Episode info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-muted-foreground">Episode {ep.episodeNumber}</span>
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
                    {ep.progress?.completed && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
                  <h3 className={`font-semibold mb-1 line-clamp-1 ${isCurrent ? 'text-primary' : 'text-foreground'}`}>{ep.title}</h3>
                  {ep.description && <p className="text-sm text-muted-foreground line-clamp-2">{ep.description}</p>}
                  {progressPct > 0 && progressPct < 100 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-card rounded-full overflow-hidden max-w-[120px]">
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

      {/* === Other podcasts === */}
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
                  <div className="aspect-square rounded-md mb-2 flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${p.coverColor ?? '#444'} 0%, #111 100%)` }}>
                    <Mic className="w-8 h-8 text-white/40" />
                  </div>
                  <div className="font-semibold text-sm line-clamp-2">{p.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{p._count.episodes} episodes</div>
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
          <Skeleton className="w-[220px] h-[220px] rounded-2xl" />
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
