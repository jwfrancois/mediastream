// Audiobook detail — book info, narrator, description, play/resume button.

'use client';

import { useApi } from '@/lib/useApi';
import { useNav, useAudioPlayer } from '@/lib/store';
import { MediaBackdrop } from '@/components/media/MediaPoster';
import { MediaRow } from '@/components/media/MediaRow';
import { MediaCard } from '@/components/media/MediaCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Pause, ArrowLeft, Clock, Calendar, BookOpen, Mic2 } from 'lucide-react';
import { formatDurationShort, formatRelativeTime } from '@/lib/format';
import { useAudioPlayer as useAudio } from '@/lib/store';

interface AudiobookDetailData {
  id: string;
  title: string;
  author: string | null;
  narrator: string | null;
  description: string | null;
  genre: string | null;
  year: number | null;
  coverColor: string | null;
  duration: number | null;
  addedAt: string;
  library: { name: string };
  progress: { position: number; duration: number | null; completed: boolean; updatedAt: string } | null;
  more: any[];
}

export function AudiobookDetailView({ id }: { id: string }) {
  const { data, loading, error } = useApi<AudiobookDetailData>(`/api/audiobooks/${id}`);
  const navigate = useNav((s) => s.navigate);
  const { playNow, queue, currentIndex, isPlaying, togglePlay } = useAudioPlayer();

  if (loading) return <BookSkeleton />;

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">{error || 'Audiobook not found'}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'audiobooks' })}>
          Back to Audiobooks
        </Button>
      </div>
    );
  }

  const isThisBook = queue[currentIndex]?.id === data.id && queue[currentIndex]?.type === 'audiobook';
  const progressPct = data.progress?.duration
    ? Math.min(100, Math.round((data.progress.position / data.progress.duration) * 100))
    : 0;

  const handlePlay = () => {
    if (isThisBook) {
      togglePlay();
      return;
    }
    playNow([{
      id: data.id, type: 'audiobook', title: data.title,
      subtitle: data.author ?? 'Unknown Author',
      duration: data.duration, color: data.coverColor,
    }]);
  };

  // Chapter markers (synthetic — every 30 min) for navigation UI
  const chapterCount = data.duration ? Math.max(1, Math.floor(data.duration / 1800)) : 1;
  const currentChapter = data.progress?.position
    ? Math.min(chapterCount, Math.floor(data.progress.position / 1800) + 1)
    : 1;

  return (
    <div className="pb-12 fade-up">
      {/* Backdrop hero */}
      <div className="relative h-[40vh] min-h-[280px] mb-8">
        <MediaBackdrop
          title={data.title}
          color={data.coverColor}
          className="absolute inset-0 h-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ kind: 'audiobooks' })}
          className="absolute top-4 left-4 text-white/80 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Audiobooks
        </Button>
      </div>

      <div className="px-4 md:px-8 -mt-40 relative z-10">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Cover */}
          <div className="w-[200px] md:w-[240px] flex-shrink-0 mx-auto md:mx-0">
            <div
              className="aspect-[2/3] rounded-lg overflow-hidden shadow-2xl flex items-end"
              style={{
                background: `linear-gradient(135deg, ${data.coverColor ?? '#333'} 0%, #111 100%)`,
              }}
            >
              <div className="w-full p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="font-bold text-white text-lg drop-shadow line-clamp-3">{data.title}</div>
                {data.author && <div className="text-white/70 text-sm mt-1">by {data.author}</div>}
              </div>
            </div>
          </div>

          {/* Main info */}
          <div className="flex-1 max-w-3xl">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Audiobook</div>
            <h1 className="text-4xl md:text-5xl font-bold mb-3 drop-shadow-lg">{data.title}</h1>

            <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-muted-foreground">
              {data.author && (
                <span className="flex items-center gap-1">
                  <BookOpen className="w-4 h-4" /> {data.author}
                </span>
              )}
              {data.narrator && (
                <span className="flex items-center gap-1">
                  <Mic2 className="w-4 h-4" /> Narrated by {data.narrator}
                </span>
              )}
              {data.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" /> {formatDurationShort(data.duration)}
                </span>
              )}
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
            </div>

            {/* Play button */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Button
                size="lg"
                onClick={handlePlay}
                className="bg-primary hover:bg-primary/90"
              >
                {isThisBook && isPlaying
                  ? <><Pause className="w-5 h-5 fill-current mr-2" /> Pause</>
                  : <><Play className="w-5 h-5 fill-current mr-2" /> {data.progress && progressPct > 0 && progressPct < 95 ? `Resume (${progressPct}%)` : 'Start Listening'}</>}
              </Button>
            </div>

            {/* Progress */}
            {data.progress && progressPct > 0 && progressPct < 100 && (
              <div className="mb-6 p-4 rounded-lg bg-card border border-border">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>Chapter {currentChapter} of {chapterCount}</span>
                  <span>{Math.round(data.progress.position / 60)} min in • {formatRelativeTime(data.progress.updatedAt)}</span>
                </div>
                <div className="h-2 bg-background rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}

            {/* Description */}
            {data.description && (
              <p className="text-base text-foreground/85 leading-relaxed mb-6">{data.description}</p>
            )}

            {/* Chapter list (synthetic) */}
            <div>
              <h3 className="text-lg font-bold mb-3">Chapters</h3>
              <div className="space-y-1">
                {Array.from({ length: chapterCount }).map((_, i) => {
                  const chapNum = i + 1;
                  const chapStart = i * 1800;
                  const isCurrent = chapNum === currentChapter && data.progress;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-md transition cursor-pointer ${
                        isCurrent ? 'bg-primary/10 text-primary' : 'hover:bg-card text-foreground'
                      }`}
                      onClick={() => {
                        if (!isThisBook) {
                          playNow([{
                            id: data.id, type: 'audiobook', title: data.title,
                            subtitle: data.author ?? 'Unknown Author',
                            duration: data.duration, color: data.coverColor,
                          }]);
                        }
                        // Note: seeking to a specific chapter position is handled by the player
                        // via the position state. For simplicity we just play the book.
                      }}
                    >
                      <span className="text-sm font-medium w-12">Ch {chapNum}</span>
                      <span className="text-sm flex-1">
                        {data.title} — Part {chapNum}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDurationShort(chapStart)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* More by author */}
        {data.more && data.more.length > 0 && data.author && (
          <div className="mt-12">
            <MediaRow title={`More by ${data.author}`}>
              {data.more.map((a) => (
                <div key={a.id} className="w-[150px] md:w-[180px] flex-shrink-0">
                  <MediaCard
                    title={a.title}
                    subtitle={`by ${a.author}`}
                    color={a.coverColor}
                    duration={a.duration}
                    year={a.year}
                    onClick={() => navigate({ kind: 'audiobook', id: a.id })}
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

function BookSkeleton() {
  return (
    <div>
      <Skeleton className="h-[280px] w-full" />
      <div className="px-8 -mt-32 relative">
        <div className="flex gap-8">
          <Skeleton className="w-[240px] aspect-[2/3] flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-12 w-48 rounded-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
