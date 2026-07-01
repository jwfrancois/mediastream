// Movie detail page — infotainment layout.
// Immersive backdrop hero + two-column body with: synopsis, cast grid, facts panel,
// tech specs, collection badge, and "More Like This" rail. The ambient aurora
// shifts to match the movie's palette.

'use client';

import { useApi } from '@/lib/useApi';
import { useNav, useVideoPlayer } from '@/lib/store';
import { MediaBackdrop } from '@/components/media/MediaPoster';
import { MediaCard } from '@/components/media/MediaCard';
import { MediaRow } from '@/components/media/MediaRow';
import { RatingRing } from '@/components/media/RatingRing';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Play, ArrowLeft, Star, Clock, Calendar, Film, Clapperboard, User, UserCircle2,
  HardDrive, FolderTree, Award, Plus, Share2,
} from 'lucide-react';
import { formatDurationShort, formatRelativeTime } from '@/lib/format';
import { useAmbientColor } from '@/lib/useAmbient';

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

  // Set ambient color to the movie's palette
  useAmbientColor({ color: data?.backdropColor ?? data?.posterColor });

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
      {/* === Immersive backdrop hero === */}
      <div className="relative h-[55vh] min-h-[380px] grain">
        <MediaBackdrop title="" color={data.backdropColor ?? data.posterColor} className="absolute inset-0 h-full">
          <div className="flex flex-col justify-end h-full max-w-5xl px-4 md:px-8 pb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-white/15 text-white backdrop-blur-sm border border-white/20">Film</span>
              {data.genre && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-primary/30 text-primary-foreground backdrop-blur-sm">
                  {data.genre}
                </span>
              )}
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight drop-shadow-2xl">
              {data.title}
            </h1>
          </div>
        </MediaBackdrop>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent pointer-events-none" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ kind: 'movies' })}
          className="absolute top-4 left-4 text-white/80 hover:text-white hover:bg-white/10 glass z-10"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Movies
        </Button>
      </div>

      {/* === Body: two-column infotainment layout === */}
      <div className="px-4 md:px-8 -mt-40 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr_280px] gap-8">
          {/* Left: poster card with quick actions */}
          <div className="hidden md:block">
            <div
              className="aspect-[2/3] rounded-xl overflow-hidden shadow-2xl grain relative"
              style={{ background: `linear-gradient(145deg, ${data.posterColor ?? '#333'} 0%, #0a0a0a 100%)` }}
            >
              <div className="h-full flex items-end p-4 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                <div className="font-bold text-white text-lg drop-shadow">{data.title}</div>
              </div>
            </div>
            {/* Quick action stack */}
            <div className="mt-3 space-y-2">
              <Button
                onClick={() => openVideo({
                  id: data.id, type: 'movie', title: data.title,
                  subtitle: [data.year, data.genre].filter(Boolean).join(' • '),
                  duration: data.duration,
                  startPosition: data.progress?.position ?? 0,
                  color: data.backdropColor,
                })}
                className="w-full bg-primary hover:bg-primary/90 rounded-full h-11"
              >
                <Play className="w-5 h-5 fill-current mr-2" />
                {data.progress && progressPct > 0 && progressPct < 95 ? `Resume ${progressPct}%` : 'Play'}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-full" size="sm">
                  <Plus className="w-4 h-4 mr-1" /> List
                </Button>
                <Button variant="outline" className="flex-1 rounded-full" size="sm">
                  <Share2 className="w-4 h-4 mr-1" /> Share
                </Button>
              </div>
            </div>
          </div>

          {/* Center: synopsis, cast, crew */}
          <div className="min-w-0">
            {/* Meta strip */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              {data.rating != null && (
                <div className="flex items-center gap-2 glass rounded-full px-3 py-1.5">
                  <RatingRing score={data.rating} size={36} />
                  <div className="text-xs">
                    <div className="text-white/90 font-bold leading-tight">User Score</div>
                    <div className="text-white/50 leading-tight">{data.rating.toFixed(1)}/10</div>
                  </div>
                </div>
              )}
              {data.year && (
                <MetaPill icon={Calendar} label={String(data.year)} />
              )}
              {data.duration && (
                <MetaPill icon={Clock} label={formatDurationShort(data.duration)} />
              )}
              {data.genre && (
                <MetaPill icon={Film} label={data.genre} />
              )}
            </div>

            {/* Progress bar if started */}
            {data.progress && progressPct > 0 && progressPct < 100 && (
              <div className="mb-5 p-4 glass rounded-xl">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1.5">
                    <Play className="w-3 h-3" />
                    Continue watching
                  </span>
                  <span>{Math.round(data.progress.position / 60)}m in • {formatRelativeTime(data.progress.updatedAt)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}

            {/* Synopsis */}
            <div className="mb-8">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Synopsis</h2>
              {data.plot ? (
                <p className="text-base text-foreground/90 leading-relaxed">{data.plot}</p>
              ) : (
                <p className="text-muted-foreground italic">No synopsis available. Click "Enrich" in Settings to fetch metadata with AI.</p>
              )}
            </div>

            {/* Cast grid */}
            {data.cast && data.cast.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Cast</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {data.cast.map((actor, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-card/60 hover:bg-card transition border border-border/50"
                    >
                      <div
                        className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white shadow-md"
                        style={{
                          background: `linear-gradient(135deg, hsl(${(i * 47) % 360}, 45%, 40%) 0%, hsl(0, 0%, 12%) 100%)`,
                        }}
                      >
                        {actor.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{actor}</div>
                        <div className="text-xs text-muted-foreground">Cast</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Director + crew */}
            {data.director && (
              <div className="mb-8">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Crew</h2>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-card/60 border border-border/50">
                  <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                    <Clapperboard className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{data.director}</div>
                    <div className="text-xs text-muted-foreground">Director</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: facts panel */}
          <div className="space-y-4">
            <div className="glass rounded-xl p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Award className="w-3.5 h-3.5" /> Facts
              </h3>
              <dl className="space-y-3 text-sm">
                <FactRow label="Status" value="Released" />
                {data.year && <FactRow label="Release Year" value={String(data.year)} />}
                {data.duration && <FactRow label="Runtime" value={formatDurationShort(data.duration)} />}
                {data.genre && <FactRow label="Genre" value={data.genre} />}
                {data.director && <FactRow label="Director" value={data.director} />}
                <FactRow label="Library" value={data.library?.name ?? 'Movies'} />
                <FactRow label="Added" value={formatRelativeTime(data.addedAt)} />
              </dl>
            </div>

            {/* Tech specs */}
            <div className="glass rounded-xl p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5" /> Tech Specs
              </h3>
              <dl className="space-y-2 text-sm">
                <FactRow label="Source" value="Local File" />
                <FactRow label="Quality" value="—" />
                <FactRow label="Audio" value="—" />
              </dl>
            </div>
          </div>
        </div>

        {/* === More Like This === */}
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
                    genre={m.genre}
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

function MetaPill({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-sm text-white/85">
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <dt className="text-muted-foreground text-xs whitespace-nowrap">{label}</dt>
      <dd className="font-medium text-right text-foreground/90 text-sm">{value}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div>
      <Skeleton className="h-[380px] w-full" />
      <div className="px-8 -mt-32 relative">
        <div className="grid grid-cols-[240px_1fr_280px] gap-8">
          <Skeleton className="aspect-[2/3] rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
