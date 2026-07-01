// Audiobook detail — Roon-inspired with synopsis, chapter navigation, author bio, and narrator info.
// Handles both server and local (browser) audiobooks.

'use client';

import { useApi } from '@/lib/useApi';
import { useNav, useAudioPlayer, useLocalLibraries, type AudioQueueItem } from '@/lib/store';
import { MediaRow } from '@/components/media/MediaRow';
import { MediaCard } from '@/components/media/MediaCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Play, Pause, ArrowLeft, Clock, Calendar, BookOpen, Mic2, User, HardDrive,
  Award, Headphones, List,
} from 'lucide-react';
import { formatDurationShort, formatRelativeTime, isLocalId } from '@/lib/format';
import { useAmbientColor } from '@/lib/useAmbient';
import { useMemo } from 'react';

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
  const localItems = useLocalLibraries((s) => s.items);
  const isLocal = isLocalId(id);

  const localAudiobookData = useMemo(() => {
    if (!isLocal) return null;
    const item = localItems.find((i) => i.id === id && i.mediaType === 'audiobook');
    if (!item) return null;
    // Find more by same author
    const more = localItems
      .filter((i) => i.mediaType === 'audiobook' && (i.author ?? '') === (item.author ?? '') && i.id !== id)
      .map((i) => ({
        id: i.id, title: i.title, author: i.author, narrator: i.narrator,
        year: i.year, genre: i.genre, coverColor: i.color, duration: i.duration,
      }))
      .slice(0, 6);
    return {
      id: item.id,
      title: item.title,
      author: item.author ?? null,
      narrator: item.narrator ?? null,
      description: item.bookSynopsis ?? item.plot ?? null,
      genre: item.genre ?? null,
      year: item.year ?? null,
      coverColor: item.color,
      duration: item.duration ?? null,
      addedAt: new Date(item.addedAt).toISOString(),
      library: { name: 'Local' },
      progress: null,
      more,
      _authorBio: item.authorBio,
    } as any;
  }, [isLocal, id, localItems]);

  const { data: serverData, loading, error } = useApi<AudiobookDetailData>(isLocal ? null : `/api/audiobooks/${id}`);
  const data = isLocal ? localAudiobookData : serverData;

  useAmbientColor({ color: data?.coverColor });

  const navigate = useNav((s) => s.navigate);
  const { playNow, queue, currentIndex, isPlaying, togglePlay } = useAudioPlayer();

  if (!isLocal && loading) return <BookSkeleton />;
  if (!isLocal && (error || !serverData)) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">{error || 'Audiobook not found'}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'audiobooks' })}>Back to Audiobooks</Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Audiobook not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ kind: 'audiobooks' })}>Back to Audiobooks</Button>
      </div>
    );
  }

  const isThisBook = queue[currentIndex]?.id === data.id && queue[currentIndex]?.type === 'audiobook';
  const progressPct = data.progress?.duration
    ? Math.min(100, Math.round((data.progress.position / data.progress.duration) * 100))
    : 0;

  const handlePlay = () => {
    if (isThisBook) { togglePlay(); return; }
    playNow([{
      id: data.id, type: 'audiobook', title: data.title, isLocal: isLocal,
      subtitle: data.author ?? 'Unknown Author',
      duration: data.duration, color: data.coverColor,
    }]);
  };

  // Synthetic chapters (every 30 min)
  const chapterCount = data.duration ? Math.max(1, Math.floor(data.duration / 1800)) : 1;
  const currentChapter = data.progress?.position
    ? Math.min(chapterCount, Math.floor(data.progress.position / 1800) + 1)
    : 1;

  const authorBio = (data as any)._authorBio;

  return (
    <div className="pb-12 fade-up">
      {/* === Backdrop hero === */}
      <div className="relative h-[40vh] min-h-[280px] grain">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 30% 30%, ${data.coverColor ?? '#333'} 0%, transparent 70%),
              linear-gradient(120deg, hsl(0, 0%, 5%) 0%, hsl(0, 0%, 0%) 100%)
            `,
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ kind: 'audiobooks' })}
          className="absolute top-4 left-4 z-10 text-white/80 hover:text-white hover:bg-white/10 glass"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Audiobooks
        </Button>
      </div>

      {/* === Body === */}
      <div className="px-4 md:px-8 -mt-48 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_260px] gap-8">
          {/* Left: cover + play */}
          <div className="hidden md:block">
            <div
              className="aspect-[2/3] rounded-xl overflow-hidden shadow-2xl grain relative"
              style={{ background: `linear-gradient(145deg, ${data.coverColor ?? '#333'} 0%, #0a0a0a 100%)` }}
            >
              <div className="absolute inset-0 opacity-40 mix-blend-soft-light" style={{
                background: 'radial-gradient(ellipse 60% 80% at 25% 15%, rgba(255,255,255,0.25) 0%, transparent 55%)',
              }} />
              <div className="absolute inset-0 flex items-center justify-center opacity-15">
                <BookOpen className="w-20 h-20 text-white" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="font-bold text-white text-lg drop-shadow line-clamp-3">{data.title}</div>
                {data.author && <div className="text-white/60 text-sm mt-1">by {data.author}</div>}
              </div>
            </div>
            <Button
              onClick={handlePlay}
              className="w-full mt-3 bg-primary hover:bg-primary/90 rounded-full h-11"
            >
              {isThisBook && isPlaying ? <><Pause className="w-5 h-5 fill-current mr-2" /> Pause</> : <><Play className="w-5 h-5 fill-current mr-2" /> {data.progress && progressPct > 0 && progressPct < 95 ? `Resume ${progressPct}%` : 'Start Listening'}</>}
            </Button>
          </div>

          {/* Center: synopsis, chapters */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-white/15 text-white backdrop-blur-sm border border-white/20">Audiobook</span>
              {data.genre && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-primary/30 text-primary-foreground backdrop-blur-sm">{data.genre}</span>}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-lg mb-3">{data.title}</h1>

            {/* Meta strip */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              {data.author && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-sm text-white/85">
                  <User className="w-3.5 h-3.5" /> {data.author}
                </div>
              )}
              {data.narrator && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-sm text-white/85">
                  <Mic2 className="w-3.5 h-3.5" /> Narrated by {data.narrator}
                </div>
              )}
              {data.duration && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-sm text-white/85">
                  <Clock className="w-3.5 h-3.5" /> {formatDurationShort(data.duration)}
                </div>
              )}
              {data.year && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-sm text-white/85">
                  <Calendar className="w-3.5 h-3.5" /> {data.year}
                </div>
              )}
            </div>

            {/* Progress bar if started */}
            {data.progress && progressPct > 0 && progressPct < 100 && (
              <div className="mb-5 p-4 glass rounded-xl">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1.5"><Headphones className="w-3 h-3" /> Continue listening</span>
                  <span>Chapter {currentChapter} of {chapterCount} • {formatRelativeTime(data.progress.updatedAt)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}

            {/* Synopsis */}
            <div className="mb-8">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Synopsis</h2>
              {data.description ? (
                <p className="text-base text-foreground/90 leading-relaxed">{data.description}</p>
              ) : (
                <p className="text-muted-foreground italic">No synopsis available. Click "Enrich" in Settings to fetch metadata with AI.</p>
              )}
            </div>

            {/* Author bio */}
            {authorBio && (
              <div className="mb-8">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                  <User className="w-3.5 h-3.5" /> About the Author
                </h2>
                <p className="text-base text-foreground/80 leading-relaxed">{authorBio}</p>
              </div>
            )}

            {/* Chapters */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <List className="w-3.5 h-3.5" /> Chapters
              </h2>
              <div className="space-y-1">
                {Array.from({ length: chapterCount }).map((_, i) => {
                  const chapNum = i + 1;
                  const chapStart = i * 1800;
                  const isCurrent = chapNum === currentChapter && data.progress;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-lg transition cursor-pointer ${
                        isCurrent ? 'bg-primary/10 text-primary' : 'hover:bg-card text-foreground'
                      }`}
                      onClick={handlePlay}
                    >
                      <span className="text-sm font-medium w-12">Ch {chapNum}</span>
                      <span className="text-sm flex-1">{data.title} — Part {chapNum}</span>
                      <span className="text-xs text-muted-foreground font-mono">{formatDurationShort(chapStart)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: facts panel */}
          <div className="space-y-4">
            <div className="glass rounded-xl p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Award className="w-3.5 h-3.5" /> Details
              </h3>
              <dl className="space-y-2 text-sm">
                {data.author && <FactRow label="Author" value={data.author} />}
                {data.narrator && <FactRow label="Narrator" value={data.narrator} />}
                {data.year && <FactRow label="Published" value={String(data.year)} />}
                {data.genre && <FactRow label="Genre" value={data.genre} />}
                {data.duration && <FactRow label="Length" value={formatDurationShort(data.duration)} />}
                <FactRow label="Chapters" value={String(chapterCount)} />
                <FactRow label="Source" value={isLocal ? 'Local File' : 'Server'} />
              </dl>
            </div>
          </div>
        </div>

        {/* === More by author === */}
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
                    onPlay={() => playNow([{
                      id: a.id, type: 'audiobook', title: a.title, isLocal: isLocalId(a.id),
                      subtitle: a.author ?? 'Unknown Author', duration: a.duration, color: a.coverColor,
                    }])}
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

function BookSkeleton() {
  return (
    <div>
      <Skeleton className="h-[280px] w-full" />
      <div className="px-8 -mt-40 relative">
        <div className="grid grid-cols-[220px_1fr_260px] gap-8">
          <Skeleton className="aspect-[2/3] rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
