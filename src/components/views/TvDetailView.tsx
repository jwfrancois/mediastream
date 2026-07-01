// TV Show detail — backdrop, plot, season selector, episode list.

'use client';

import { useState } from 'react';
import { useApi } from '@/lib/useApi';
import { useNav, useVideoPlayer } from '@/lib/store';
import { MediaBackdrop } from '@/components/media/MediaPoster';
import { MediaRow } from '@/components/media/MediaRow';
import { MediaCard } from '@/components/media/MediaCard';
import { RatingRing } from '@/components/media/RatingRing';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, ArrowLeft, Star, Calendar, Tv, CheckCircle2, Clock, Info } from 'lucide-react';
import { formatDurationShort, formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAmbientColor } from '@/lib/useAmbient';

interface TvDetailData {
  id: string;
  title: string;
  year: number | null;
  genre: string | null;
  plot: string | null;
  rating: number | null;
  posterColor: string | null;
  backdropColor: string | null;
  addedAt: string;
  seasons: Array<{
    id: string;
    seasonNumber: number;
    posterColor: string | null;
    episodes: Array<{
      id: string;
      episodeNumber: number;
      title: string;
      plot: string | null;
      duration: number | null;
      addedAt: string;
      progress: { position: number; duration: number | null; completed: boolean } | null;
    }>;
  }>;
  similar: any[];
}

export function TvDetailView({ id }: { id: string }) {
  const { data, loading, error } = useApi<TvDetailData>(`/api/tv/${id}`);
  const navigate = useNav((s) => s.navigate);
  const openVideo = useVideoPlayer((s) => s.openPlayer);

  const [selectedSeason, setSelectedSeason] = useState<number>(1);

  // Set ambient color to the show's palette
  useAmbientColor({ color: data?.backdropColor ?? data?.posterColor });

  if (loading) return <ShowSkeleton />;

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">{error || 'TV show not found'}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'tv' })}>
          Back to TV Shows
        </Button>
      </div>
    );
  }

  const season = data.seasons.find((s) => s.seasonNumber === selectedSeason) ?? data.seasons[0];
  const firstUnwatchedEp = season?.episodes.find((e) => !e.progress?.completed) ?? season?.episodes[0];

  return (
    <div className="pb-12 fade-up">
      {/* Backdrop hero */}
      <div className="relative h-[45vh] min-h-[320px] mb-8">
        <MediaBackdrop
          title={data.title}
          color={data.backdropColor}
          className="absolute inset-0 h-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ kind: 'tv' })}
          className="absolute top-4 left-4 text-white/80 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> TV Shows
        </Button>
      </div>

      <div className="px-4 md:px-8 -mt-32 relative z-10">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Side poster */}
          <div className="hidden md:block w-[220px] flex-shrink-0">
            <div
              className="aspect-[2/3] rounded-lg overflow-hidden shadow-2xl"
              style={{
                background: `linear-gradient(135deg, ${data.posterColor ?? '#333'} 0%, #111 100%)`,
              }}
            >
              <div className="h-full flex items-end p-4 bg-gradient-to-t from-black/70 to-transparent">
                <div className="font-bold text-white text-lg drop-shadow">{data.title}</div>
              </div>
            </div>
          </div>

          {/* Main info */}
          <div className="flex-1 max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-3 drop-shadow-lg">{data.title}</h1>

            <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-muted-foreground">
              {data.year && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> {data.year}
                </span>
              )}
              {data.genre && (
                <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-medium">
                  {data.genre}
                </span>
              )}
              {data.rating != null && (
                <span className="flex items-center gap-1 text-yellow-500">
                  <Star className="w-4 h-4 fill-current" /> {data.rating.toFixed(1)}
                </span>
              )}
              <span className="text-muted-foreground">
                {data.seasons.length} season{data.seasons.length !== 1 ? 's' : ''} •{' '}
                {data.seasons.reduce((sum, s) => sum + s.episodes.length, 0)} episodes
              </span>
            </div>

            {firstUnwatchedEp && (
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <Button
                  size="lg"
                  onClick={() => openVideo({
                    id: firstUnwatchedEp.id, type: 'episode',
                    title: firstUnwatchedEp.title,
                    subtitle: `${data.title} • S${season.seasonNumber}E${firstUnwatchedEp.episodeNumber}`,
                    duration: firstUnwatchedEp.duration,
                    startPosition: firstUnwatchedEp.progress?.position ?? 0,
                    color: data.backdropColor,
                  })}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Play className="w-5 h-5 fill-current mr-2" />
                  {firstUnwatchedEp.progress?.position ? 'Resume' : 'Play'} S{season.seasonNumber}:E{firstUnwatchedEp.episodeNumber}
                </Button>
              </div>
            )}

            {data.plot && (
              <p className="text-base text-foreground/85 leading-relaxed mb-6">{data.plot}</p>
            )}
          </div>
        </div>

        {/* Season selector + Episode list */}
        {season && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Episodes</h2>
              <Select value={String(selectedSeason)} onValueChange={(v) => setSelectedSeason(Number(v))}>
                <SelectTrigger className="w-[180px] bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.seasons.map((s) => (
                    <SelectItem key={s.id} value={String(s.seasonNumber)}>
                      Season {s.seasonNumber} ({s.episodes.length} episode{s.episodes.length !== 1 ? 's' : ''})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {season.episodes.map((ep) => {
                const progressPct = ep.progress?.duration
                  ? Math.min(100, Math.round((ep.progress.position / ep.progress.duration) * 100))
                  : 0;
                const isNextUp = ep.id === firstUnwatchedEp?.id;
                return (
                  <div
                    key={ep.id}
                    className={cn(
                      'group flex gap-4 p-3 rounded-xl transition cursor-pointer card-lift',
                      isNextUp
                        ? 'bg-primary/10 border border-primary/40 ring-1 ring-primary/20'
                        : 'bg-card/50 hover:bg-card border border-transparent hover:border-border',
                    )}
                    onClick={() => openVideo({
                      id: ep.id, type: 'episode',
                      title: ep.title,
                      subtitle: `${data.title} • S${season.seasonNumber}E${ep.episodeNumber}`,
                      duration: ep.duration,
                      startPosition: ep.progress?.position ?? 0,
                      color: data.backdropColor,
                    })}
                  >
                    {/* Episode number / thumbnail */}
                    <div
                      className="relative w-[140px] md:w-[200px] flex-shrink-0 aspect-video rounded-md overflow-hidden flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${season.posterColor ?? data.posterColor ?? '#333'} 0%, #111 100%)`,
                      }}
                    >
                      <span className="text-3xl font-bold text-white/30">{ep.episodeNumber}</span>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/50">
                        <Play className="w-10 h-10 text-white fill-current" />
                      </div>
                      {progressPct > 0 && progressPct < 100 && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                          <div className="h-full bg-primary" style={{ width: `${progressPct}%` }} />
                        </div>
                      )}
                      {ep.progress?.completed && (
                        <div className="absolute top-1 right-1">
                          <CheckCircle2 className="w-5 h-5 text-primary fill-primary/30" />
                        </div>
                      )}
                    </div>

                    {/* Episode info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          Episode {ep.episodeNumber}
                        </span>
                        {isNextUp && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                            Next Up
                          </span>
                        )}
                        {ep.duration && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatDurationShort(ep.duration)}
                          </span>
                        )}
                        {progressPct > 0 && progressPct < 100 && (
                          <span className="text-xs text-primary">{progressPct}% watched</span>
                        )}
                      </div>
                      <h3 className={cn('font-semibold line-clamp-1 mb-1', isNextUp ? 'text-primary' : 'text-foreground')}>{ep.title}</h3>
                      {ep.plot && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{ep.plot}</p>
                      )}
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Added {formatRelativeTime(ep.addedAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Similar shows */}
        {data.similar && data.similar.length > 0 && (
          <div className="mt-12">
            <MediaRow title="More Like This">
              {data.similar.map((s) => (
                <div key={s.id} className="w-[150px] md:w-[180px] flex-shrink-0">
                  <MediaCard
                    title={s.title}
                    subtitle={`${s.year ?? ''} • ${s.genre ?? ''}`}
                    color={s.posterColor}
                    rating={s.rating}
                    year={s.year}
                    onClick={() => navigate({ kind: 'show', id: s.id })}
                  />
                </div>
              ))}
            </MediaRow>
          </div>
        )}
      </div>
    </div>
  );
}

function ShowSkeleton() {
  return (
    <div>
      <Skeleton className="h-[320px] w-full" />
      <div className="px-8 -mt-24 relative">
        <div className="flex gap-8">
          <Skeleton className="w-[220px] aspect-[2/3] flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-12 w-48 rounded-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
        <Skeleton className="h-8 w-32 mt-8" />
        <div className="space-y-2 mt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
