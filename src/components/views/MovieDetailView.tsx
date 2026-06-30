// Movie detail page — backdrop, plot, cast, play button, similar movies.

'use client';

import { useApi } from '@/lib/useApi';
import { useNav, useVideoPlayer } from '@/lib/store';
import { MediaBackdrop } from '@/components/media/MediaPoster';
import { MediaCard } from '@/components/media/MediaCard';
import { MediaRow } from '@/components/media/MediaRow';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, ArrowLeft, Star, Clock, Calendar, Film } from 'lucide-react';
import { formatDurationShort, formatRelativeTime } from '@/lib/format';

interface MovieDetailData {
  id: string;
  title: string;
  year: number | null;
  genre: string | null;
  director: string | null;
  cast: string[];
  plot: string | null;
  duration: number | null;
  rating: number | null;
  posterColor: string | null;
  backdropColor: string | null;
  addedAt: string;
  library: { name: string };
  progress: { position: number; duration: number | null; completed: boolean; updatedAt: string } | null;
  similar: any[];
}

export function MovieDetailView({ id }: { id: string }) {
  const { data, loading, error } = useApi<MovieDetailData>(`/api/movies/${id}`);
  const navigate = useNav((s) => s.navigate);
  const openVideo = useVideoPlayer((s) => s.openPlayer);

  if (loading) return <DetailSkeleton />;

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">{error || 'Movie not found'}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'movies' })}>
          Back to Movies
        </Button>
      </div>
    );
  }

  const progressPct = data.progress?.duration
    ? Math.min(100, Math.round((data.progress.position / data.progress.duration) * 100))
    : 0;

  return (
    <div className="pb-12 fade-up">
      {/* Backdrop hero */}
      <div className="relative h-[50vh] min-h-[350px] mb-8">
        <MediaBackdrop
          title={data.title}
          color={data.backdropColor}
          className="absolute inset-0 h-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ kind: 'movies' })}
          className="absolute top-4 left-4 text-white/80 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Movies
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

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-muted-foreground">
              {data.year && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> {data.year}
                </span>
              )}
              {data.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" /> {formatDurationShort(data.duration)}
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
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Button
                size="lg"
                onClick={() => openVideo({
                  id: data.id, type: 'movie', title: data.title,
                  subtitle: [data.year, data.genre].filter(Boolean).join(' • '),
                  duration: data.duration,
                  startPosition: data.progress?.position ?? 0,
                  color: data.backdropColor,
                })}
                className="bg-primary hover:bg-primary/90"
              >
                <Play className="w-5 h-5 fill-current mr-2" />
                {data.progress && progressPct > 0 && progressPct < 95 ? `Resume (${progressPct}%)` : 'Play'}
              </Button>
            </div>

            {/* Progress bar if started */}
            {data.progress && progressPct > 0 && progressPct < 100 && (
              <div className="mb-6">
                <div className="text-xs text-muted-foreground mb-1.5">
                  Last watched {formatRelativeTime(data.progress.updatedAt)} • {progressPct}% complete
                </div>
                <div className="h-1.5 bg-card rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}

            {/* Plot */}
            {data.plot && (
              <p className="text-base text-foreground/85 leading-relaxed mb-6">{data.plot}</p>
            )}

            {/* Cast & crew */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {data.director && (
                <div>
                  <div className="text-muted-foreground">Director</div>
                  <div className="font-medium">{data.director}</div>
                </div>
              )}
              {data.cast && data.cast.length > 0 && (
                <div>
                  <div className="text-muted-foreground">Cast</div>
                  <div className="font-medium">{data.cast.join(', ')}</div>
                </div>
              )}
              <div>
                <div className="text-muted-foreground">Library</div>
                <div className="font-medium">{data.library?.name ?? 'Movies'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Added</div>
                <div className="font-medium">{formatRelativeTime(data.addedAt)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Similar movies */}
        {data.similar && data.similar.length > 0 && (
          <div className="mt-12">
            <MediaRow title="More Like This">
              {data.similar.map((m) => (
                <div key={m.id} className="w-[150px] md:w-[180px] flex-shrink-0">
                  <MediaCard
                    title={m.title}
                    subtitle={`${m.year ?? ''} • ${m.genre ?? ''}`}
                    color={m.posterColor}
                    rating={m.rating}
                    year={m.year}
                    onClick={() => navigate({ kind: 'movie', id: m.id })}
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

function DetailSkeleton() {
  return (
    <div>
      <Skeleton className="h-[350px] w-full" />
      <div className="px-8 -mt-24 relative">
        <div className="flex gap-8">
          <Skeleton className="w-[220px] aspect-[2/3] flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-12 w-40 rounded-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}
