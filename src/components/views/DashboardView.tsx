// Dashboard view — the home page with hero, continue watching, and recently added rails.

'use client';

import { useApi } from '@/lib/useApi';
import { useNav, useVideoPlayer, useAudioPlayer, type AudioQueueItem } from '@/lib/store';
import { MediaRow } from '@/components/media/MediaRow';
import { MediaCard, MediaCardLandscape, MediaCardSquare } from '@/components/media/MediaCard';
import { MediaBackdrop } from '@/components/media/MediaPoster';
import { Play, Info, ChevronRight, Film, Tv, Music, Mic, BookHeadphones, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDurationShort, formatProgress, streamUrl } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardData {
  hero: any;
  continueWatching: any[];
  recent: {
    movies: any[];
    shows: any[];
    albums: any[];
    podcasts: any[];
    audiobooks: any[];
  };
  stats: {
    movies: number;
    shows: number;
    episodes: number;
    albums: number;
    tracks: number;
    podcasts: number;
    podcastEpisodes: number;
    audiobooks: number;
    libraries: number;
  };
}

export function DashboardView() {
  const { data, loading, error } = useApi<DashboardData>('/api/dashboard');
  const navigate = useNav((s) => s.navigate);
  const openVideo = useVideoPlayer((s) => s.openPlayer);
  const playAudio = useAudioPlayer((s) => s.playNow);

  const handlePlayContinue = (item: any) => {
    const startPosition = item.position || 0;
    if (item.mediaType === 'MOVIE') {
      openVideo({
        id: item.media.id,
        type: 'movie',
        title: item.media.title,
        subtitle: [item.media.year, item.media.genre].filter(Boolean).join(' • '),
        duration: item.media.duration,
        startPosition,
        color: item.media.backdropColor,
      });
    } else if (item.mediaType === 'EPISODE') {
      openVideo({
        id: item.media.id,
        type: 'episode',
        title: item.media.title,
        subtitle: `${item.media.show.title} • S${item.media.seasonNumber}E${item.media.episodeNumber}`,
        duration: item.media.duration,
        startPosition,
        color: item.media.show.backdropColor,
      });
    } else if (item.mediaType === 'TRACK') {
      const queueItem: AudioQueueItem = {
        id: item.media.id,
        type: 'track',
        title: item.media.title,
        subtitle: item.media.album?.artist?.name ?? 'Unknown Artist',
        duration: item.media.duration,
        color: item.media.album?.coverColor,
        albumId: item.media.album?.id,
      };
      playAudio([queueItem]);
    } else if (item.mediaType === 'PODCAST_EPISODE') {
      const queueItem: AudioQueueItem = {
        id: item.media.id,
        type: 'podcast',
        title: item.media.title,
        subtitle: item.media.podcast?.title ?? 'Podcast',
        duration: item.media.duration,
        color: item.media.podcast?.coverColor,
        podcastId: item.media.podcast?.id,
      };
      playAudio([queueItem]);
    } else if (item.mediaType === 'AUDIOBOOK') {
      const queueItem: AudioQueueItem = {
        id: item.media.id,
        type: 'audiobook',
        title: item.media.title,
        subtitle: item.media.author ?? 'Unknown Author',
        duration: item.media.duration,
        color: item.media.coverColor,
      };
      playAudio([queueItem]);
    }
  };

  const handleOpenContinue = (item: any) => {
    if (item.mediaType === 'MOVIE') navigate({ kind: 'movie', id: item.media.id });
    else if (item.mediaType === 'EPISODE') navigate({ kind: 'show', id: item.media.show.id });
    else if (item.mediaType === 'TRACK') navigate({ kind: 'album', id: item.media.album.id });
    else if (item.mediaType === 'PODCAST_EPISODE') navigate({ kind: 'podcast', id: item.media.podcast.id });
    else if (item.mediaType === 'AUDIOBOOK') navigate({ kind: 'audiobook', id: item.media.id });
  };

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">Failed to load dashboard: {error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { hero, continueWatching, recent, stats } = data;

  return (
    <div className="pb-8">
      {/* Hero */}
      {hero && (
        <div className="relative h-[55vh] min-h-[400px] mb-8 fade-in">
          <MediaBackdrop
            title={hero.title}
            subtitle={hero.plot}
            color={hero.backdropColor}
            className="absolute inset-0 h-full"
          >
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <Button
                size="lg"
                onClick={() => {
                  if (hero.type === 'movie') {
                    openVideo({
                      id: hero.id,
                      type: 'movie',
                      title: hero.title,
                      subtitle: [hero.year, hero.genre].filter(Boolean).join(' • '),
                      duration: hero.duration,
                      color: hero.backdropColor,
                    });
                  } else {
                    navigate({ kind: 'show', id: hero.id });
                  }
                }}
                className="bg-white text-black hover:bg-white/90"
              >
                <Play className="w-5 h-5 fill-current mr-2" />
                Play
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => navigate(hero.type === 'movie' ? { kind: 'movie', id: hero.id } : { kind: 'show', id: hero.id })}
                className="bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm border border-white/20"
              >
                <Info className="w-5 h-5 mr-2" />
                More Info
              </Button>
            </div>
          </MediaBackdrop>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />
        </div>
      )}

      <div className="px-4 md:px-8 space-y-10">
        {/* Stats banner */}
        <div className="flex flex-wrap gap-3">
          <StatCard icon={Film} label="Movies" value={stats.movies} onClick={() => navigate({ kind: 'movies' })} />
          <StatCard icon={Tv} label="TV Shows" value={stats.shows} sub={`${stats.episodes} episodes`} onClick={() => navigate({ kind: 'tv' })} />
          <StatCard icon={Music} label="Albums" value={stats.albums} sub={`${stats.tracks} tracks`} onClick={() => navigate({ kind: 'music' })} />
          <StatCard icon={Mic} label="Podcasts" value={stats.podcasts} sub={`${stats.podcastEpisodes} episodes`} onClick={() => navigate({ kind: 'podcasts' })} />
          <StatCard icon={BookHeadphones} label="Audiobooks" value={stats.audiobooks} onClick={() => navigate({ kind: 'audiobooks' })} />
        </div>

        {/* Continue Watching */}
        {continueWatching.length > 0 && (
          <MediaRow title="Continue Watching">
            {continueWatching.map((item, i) => (
              <div key={`${item.mediaType}-${item.mediaId}-${i}`} className="w-[260px] md:w-[300px] flex-shrink-0">
                <MediaCardLandscape
                  title={
                    item.mediaType === 'EPISODE' ? `${item.media.show.title}` :
                    item.mediaType === 'TRACK' ? item.media.title :
                    item.mediaType === 'PODCAST_EPISODE' ? item.media.title :
                    item.mediaType === 'AUDIOBOOK' ? item.media.title :
                    item.media.title
                  }
                  subtitle={
                    item.mediaType === 'EPISODE' ? `S${item.media.seasonNumber} E${item.media.episodeNumber} • ${item.media.title}` :
                    item.mediaType === 'TRACK' ? `${item.media.album?.title} • ${item.media.album?.artist?.name}` :
                    item.mediaType === 'PODCAST_EPISODE' ? `${item.media.podcast?.title} • Ep ${item.media.episodeNumber}` :
                    item.mediaType === 'AUDIOBOOK' ? `by ${item.media.author}` :
                    `${item.media.year} • ${item.media.genre}`
                  }
                  color={
                    item.mediaType === 'EPISODE' ? item.media.show.backdropColor :
                    item.mediaType === 'TRACK' ? item.media.album?.coverColor :
                    item.mediaType === 'PODCAST_EPISODE' ? item.media.podcast?.coverColor :
                    item.media.backdropColor || item.media.coverColor
                  }
                  progress={{ position: item.position, duration: item.duration ?? item.media?.duration }}
                  onPlay={() => handlePlayContinue(item)}
                  onClick={() => handleOpenContinue(item)}
                />
              </div>
            ))}
          </MediaRow>
        )}

        {/* Recently Added Movies */}
        {recent.movies.length > 0 && (
          <MediaRow title="Recently Added Movies">
            {recent.movies.map((m) => (
              <div key={m.id} className="w-[150px] md:w-[180px] flex-shrink-0">
                <MediaCard
                  title={m.title}
                  subtitle={`${m.year} • ${m.genre}`}
                  color={m.posterColor}
                  rating={m.rating}
                  year={m.year}
                  duration={m.duration}
                  onClick={() => navigate({ kind: 'movie', id: m.id })}
                  onPlay={() => openVideo({
                    id: m.id, type: 'movie', title: m.title,
                    subtitle: `${m.year} • ${m.genre}`,
                    duration: m.duration, color: m.posterColor,
                  })}
                />
              </div>
            ))}
          </MediaRow>
        )}

        {/* Recently Added TV Shows */}
        {recent.shows.length > 0 && (
          <MediaRow title="Recently Added TV Shows">
            {recent.shows.map((s) => (
              <div key={s.id} className="w-[150px] md:w-[180px] flex-shrink-0">
                <MediaCard
                  title={s.title}
                  subtitle={`${s.seasonCount} season${s.seasonCount !== 1 ? 's' : ''} • ${s.episodeCount} episodes`}
                  color={s.posterColor}
                  rating={s.rating}
                  year={s.year}
                  onClick={() => navigate({ kind: 'show', id: s.id })}
                />
              </div>
            ))}
          </MediaRow>
        )}

        {/* Recently Added Albums */}
        {recent.albums.length > 0 && (
          <MediaRow title="Recently Added Albums">
            {recent.albums.map((a) => (
              <div key={a.id} className="w-[150px] md:w-[180px] flex-shrink-0">
                <MediaCardSquare
                  title={a.title}
                  subtitle={a.artist?.name}
                  color={a.coverColor}
                  onClick={() => navigate({ kind: 'album', id: a.id })}
                  onPlay={() => navigate({ kind: 'album', id: a.id })}
                />
              </div>
            ))}
          </MediaRow>
        )}

        {/* Recently Added Podcasts */}
        {recent.podcasts.length > 0 && (
          <MediaRow title="Recently Added Podcasts">
            {recent.podcasts.map((p) => (
              <div key={p.id} className="w-[150px] md:w-[180px] flex-shrink-0">
                <MediaCardSquare
                  title={p.title}
                  subtitle={p.author}
                  color={p.coverColor}
                  onClick={() => navigate({ kind: 'podcast', id: p.id })}
                />
              </div>
            ))}
          </MediaRow>
        )}

        {/* Recently Added Audiobooks */}
        {recent.audiobooks.length > 0 && (
          <MediaRow title="Recently Added Audiobooks">
            {recent.audiobooks.map((a) => (
              <div key={a.id} className="w-[150px] md:w-[180px] flex-shrink-0">
                <MediaCard
                  title={a.title}
                  subtitle={`by ${a.author}`}
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
              </div>
            ))}
          </MediaRow>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, sub, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number; sub?: string; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-card border border-border hover:border-primary/50 hover:bg-card/80 transition group text-left"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <div className="text-xl font-bold leading-none">{value.toLocaleString()}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}{sub ? ` • ${sub}` : ''}</div>
      </div>
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="px-4 md:px-8 py-8 space-y-8">
      <Skeleton className="h-[400px] w-full rounded-lg" />
      <div className="flex gap-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 flex-1 rounded-lg" />)}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, j) => <Skeleton key={j} className="w-[180px] h-[270px] rounded-md flex-shrink-0" />)}
          </div>
        </div>
      ))}
    </div>
  );
}
