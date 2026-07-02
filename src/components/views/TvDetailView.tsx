// TV Show detail — seasons/episodes browser with rich metadata.
// Handles both server and local (browser) shows. Clicking a show navigates
// here; episodes play only when the user clicks them.

'use client';

import { useState, useMemo } from 'react';
import { useApi } from '@/lib/useApi';
import { useNav, useVideoPlayer, useLocalLibraries } from '@/lib/store';
import { MediaBackdrop } from '@/components/media/MediaPoster';
import { MediaRow } from '@/components/media/MediaRow';
import { MediaCard } from '@/components/media/MediaCard';
import { RatingRing } from '@/components/media/RatingRing';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, ArrowLeft, Star, Calendar, Tv, CheckCircle2, Clock, Info, Layers } from 'lucide-react';
import { formatDurationShort, formatRelativeTime, isLocalId } from '@/lib/format';
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
  const localItems = useLocalLibraries((s) => s.items);
  const isLocal = isLocalId(id) || id.startsWith('local_show_');

  // Build local show data from IndexedDB items
  const localShowData = useMemo<TvDetailData | null>(() => {
    if (!isLocal) return null;
    const showName = id.replace(/^local_show_/, '');
    const episodes = localItems.filter(
      (i) => i.mediaType === 'episode' && (i.showTitle ?? i.title) === showName,
    );
    if (episodes.length === 0) return null;
    const first = episodes[0];

    // Group by season
    const seasonMap = new Map<number, typeof episodes>();
    for (const ep of episodes) {
      const seasonNum = ep.seasonNumber ?? 1;
      const list = seasonMap.get(seasonNum) ?? [];
      list.push(ep);
      seasonMap.set(seasonNum, list);
    }

    const seasons = Array.from(seasonMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([seasonNum, eps]) => ({
        id: `local_season_${showName}_${seasonNum}`,
        seasonNumber: seasonNum,
        posterColor: first.color,
        episodes: eps
          .sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0))
          .map((ep) => ({
            id: ep.id,
            episodeNumber: ep.episodeNumber ?? 0,
            title: ep.title,
            plot: ep.plot ?? null,
            duration: ep.duration ?? null,
            addedAt: new Date(ep.addedAt).toISOString(),
            progress: null,
          })),
      }));

    return {
      id,
      title: showName,
      year: first.year ?? null,
      genre: first.genre ?? null,
      plot: first.plot ?? null,
      rating: first.rating ?? null,
      posterColor: first.color,
      backdropColor: first.backdropColor ?? first.color,
      addedAt: new Date(first.addedAt).toISOString(),
      seasons,
      similar: [],
    };
  }, [isLocal, id, localItems]);

  const { data: serverData, loading, error } = useApi<TvDetailData>(isLocal ? null : `/api/tv/${id}`);
  const data = isLocal ? localShowData : serverData;

  const navigate = useNav((s) => s.navigate);
  const openVideo = useVideoPlayer((s) => s.openPlayer);

  const [selectedSeason, setSelectedSeason] = useState<number>(1);

  // Set ambient color
  useAmbientColor({ color: data?.backdropColor ?? data?.posterColor });

  if (!isLocal && loading) return <ShowSkeleton />;

  if (!isLocal && (error || !serverData)) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">{error || 'TV show not found'}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'tv' })}>
          Back to TV Shows
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Show not found. Try scanning your TV library.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'tv' })}>
          Back to TV Shows
        </Button>
      </div>
    );
  }

  const season = data.seasons.find((s) => s.seasonNumber === selectedSeason) ?? data.seasons[0];

  // Build the episode queue for the current season (for "next episode" support in the player)
  const buildEpisodeQueue = (seasonData: typeof season) => {
    if (!seasonData) return [];
    return seasonData.episodes.map((ep) => ({
      id: ep.id,
      type: 'episode' as const,
      title: ep.title,
      subtitle: `${data.title} • S${seasonData.seasonNumber}E${ep.episodeNumber}`,
      duration: ep.duration,
      color: data.backdropColor,
      isLocal: isLocal || isLocalId(ep.id),
    }));
  };

  return (
    <div className="pb-12 fade-up">
      {/* === Backdrop hero === */}
      <div className="relative h-[50vh] min-h-[340px] grain">
        <MediaBackdrop title="" color={data.backdropColor ?? data.posterColor} className="absolute inset-0 h-full">
          <div className="flex flex-col justify-end h-full max-w-5xl px-4 md:px-8 pb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-white/15 text-white backdrop-blur-sm border border-white/20">TV Series</span>
              {data.genre && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-primary/30 text-primary-foreground backdrop-blur-sm">
                  {data.genre}
                </span>
              )}
              {isLocal && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-primary/80 text-primary-foreground backdrop-blur-sm">Local</span>
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
          onClick={() => navigate({ kind: 'tv' })}
          className="absolute top-4 left-4 text-white/80 hover:text-white hover:bg-white/10 glass z-10"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> TV Shows
        </Button>
      </div>

      {/* === Body === */}
      <div className="px-4 md:px-8 -mt-32 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_260px] gap-8">
          {/* Left: poster */}
          <div className="hidden md:block">
            <div
              className="aspect-[2/3] rounded-xl overflow-hidden shadow-2xl grain relative"
              style={{ background: `linear-gradient(145deg, ${data.posterColor ?? '#333'} 0%, #0a0a0a 100%)` }}
            >
              <div className="absolute inset-0 opacity-40 mix-blend-soft-light" style={{
                background: 'radial-gradient(ellipse 60% 80% at 25% 15%, rgba(255,255,255,0.25) 0%, transparent 55%)',
              }} />
              <div className="absolute inset-0 flex items-center justify-center opacity-15">
                <Tv className="w-20 h-20 text-white" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="font-bold text-white text-lg drop-shadow line-clamp-3">{data.title}</div>
              </div>
            </div>
          </div>

          {/* Center: synopsis + meta */}
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
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-sm text-white/85">
                  <Calendar className="w-3.5 h-3.5" /> {data.year}
                </div>
              )}
              {data.genre && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-sm text-white/85">
                  <Tv className="w-3.5 h-3.5" /> {data.genre}
                </div>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-sm text-white/85">
                <Layers className="w-3.5 h-3.5" /> {data.seasons.length} season{data.seasons.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Synopsis */}
            <div className="mb-8">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Synopsis</h2>
              {data.plot ? (
                <p className="text-base text-foreground/90 leading-relaxed">{data.plot}</p>
              ) : (
                <p className="text-muted-foreground italic">No synopsis available. Click "Enrich" in Settings to fetch metadata with AI.</p>
              )}
            </div>

            {/* Cast */}
            {data.seasons[0]?.episodes[0] && (data.seasons[0].episodes[0] as any).cast && (
              <div className="mb-8">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Cast</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {((data.seasons[0].episodes[0] as any).cast as string[]).slice(0, 6).map((actor, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-card/60 border border-border/50">
                      <div
                        className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white shadow-md text-sm"
                        style={{ background: `linear-gradient(135deg, hsl(${(i * 47) % 360}, 45%, 40%) 0%, hsl(0, 0%, 12%) 100%)` }}
                      >
                        {actor.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{actor}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: facts panel */}
          <div className="space-y-4">
            <div className="glass rounded-xl p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Info className="w-3.5 h-3.5" /> Series Info
              </h3>
              <dl className="space-y-2 text-sm">
                {data.year && <FactRow label="First Aired" value={String(data.year)} />}
                <FactRow label="Seasons" value={String(data.seasons.length)} />
                <FactRow label="Episodes" value={String(data.seasons.reduce((sum, s) => sum + s.episodes.length, 0))} />
                {data.genre && <FactRow label="Genre" value={data.genre} />}
                <FactRow label="Source" value={isLocal ? 'Local File' : 'Server'} />
              </dl>
            </div>
          </div>
        </div>

        {/* === Season selector + Episode list === */}
        {season && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Episodes
              </h2>
              {data.seasons.length > 1 && (
                <Select value={String(selectedSeason)} onValueChange={(v) => setSelectedSeason(Number(v))}>
                  <SelectTrigger className="w-[200px] bg-card">
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
              )}
            </div>

            {/* Season tabs (if multiple seasons) */}
            {data.seasons.length > 1 && (
              <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
                {data.seasons.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSeason(s.seasonNumber)}
                    className={cn(
                      'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition',
                      selectedSeason === s.seasonNumber
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-muted-foreground hover:text-foreground hover:bg-card/80',
                    )}
                  >
                    Season {s.seasonNumber}
                    <span className="ml-1.5 text-xs opacity-70">({s.episodes.length})</span>
                  </button>
                ))}
              </div>
            )}

            {/* Episode cards */}
            <div className="space-y-2">
              {season.episodes.map((ep, i) => {
                const progressPct = ep.progress?.duration
                  ? Math.min(100, Math.round((ep.progress.position / ep.progress.duration) * 100))
                  : 0;
                const episodeQueue = buildEpisodeQueue(season);
                return (
                  <div
                    key={ep.id}
                    className={cn(
                      'group flex gap-4 p-3 rounded-xl transition cursor-pointer card-lift',
                      'bg-card/50 hover:bg-card border border-transparent hover:border-border',
                    )}
                    onClick={() => openVideo({
                      id: ep.id,
                      type: 'episode',
                      title: ep.title,
                      subtitle: `${data.title} • S${season.seasonNumber}E${ep.episodeNumber}`,
                      duration: ep.duration,
                      startPosition: ep.progress?.position ?? 0,
                      color: data.backdropColor,
                      isLocal: isLocal || isLocalId(ep.id),
                      queue: episodeQueue,
                    })}
                  >
                    {/* Episode thumbnail */}
                    <div
                      className="relative w-[140px] md:w-[200px] flex-shrink-0 aspect-video rounded-md overflow-hidden flex items-center justify-center grain"
                      style={{
                        background: `linear-gradient(145deg, ${season.posterColor ?? data.posterColor ?? '#333'} 0%, #0a0a0a 100%)`,
                      }}
                    >
                      <span className="text-3xl font-bold text-white/25">{ep.episodeNumber}</span>
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
                        {ep.duration && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatDurationShort(ep.duration)}
                          </span>
                        )}
                        {progressPct > 0 && progressPct < 100 && (
                          <span className="text-xs text-primary">{progressPct}% watched</span>
                        )}
                      </div>
                      <h3 className="font-semibold text-foreground line-clamp-1 mb-1">{ep.title}</h3>
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

        {/* === Similar shows === */}
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
                    genre={s.genre}
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

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <dt className="text-muted-foreground text-xs whitespace-nowrap">{label}</dt>
      <dd className="font-medium text-right text-foreground/90 text-sm">{value}</dd>
    </div>
  );
}

function ShowSkeleton() {
  return (
    <div>
      <Skeleton className="h-[340px] w-full" />
      <div className="px-8 -mt-24 relative">
        <div className="grid grid-cols-[220px_1fr_260px] gap-8">
          <Skeleton className="aspect-[2/3] rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <Skeleton className="h-8 w-32 mt-8" />
        <div className="space-y-2 mt-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    </div>
  );
}
