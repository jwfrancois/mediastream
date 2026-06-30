// Audio Player Bar — Spotify-style bottom bar for music, podcasts, and audiobooks.
// Plays a queue of audio items, with full transport controls and progress tracking.

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAudioPlayer, useNav, useLocalLibraries } from '@/lib/store';
import { streamUrl, formatDuration, isLocalId } from '@/lib/format';
import { putJson } from '@/lib/useApi';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  ListMusic, X, ChevronUp, ChevronDown, Shuffle, Repeat,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const PROGRESS_INTERVAL_MS = 15_000;
const STREAM_TYPE_MAP: Record<string, 'track' | 'podcast' | 'audiobook'> = {
  track: 'track',
  podcast: 'podcast',
  audiobook: 'audiobook',
};
const PROGRESS_MEDIA_TYPE_MAP: Record<string, string> = {
  track: 'TRACK',
  podcast: 'PODCAST_EPISODE',
  audiobook: 'AUDIOBOOK',
};

export function AudioPlayerBar() {
  const {
    queue, currentIndex, isPlaying, nowPlayingOpen,
    playNow, next, prev, jumpTo, removeFromQueue, togglePlay, setPlaying,
    setNowPlayingOpen, clearQueue,
  } = useAudioPlayer();
  const navigate = useNav((s) => s.navigate);
  const getLocalItem = useLocalLibraries((s) => s.getLocalItem);

  const audioRef = useRef<HTMLAudioElement>(null);
  const lastReportedItem = useRef<string | null>(null);

  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  const current = queue[currentIndex];

  // Reset position when track changes
  useEffect(() => {
    if (!current) return;
    setPosition(0);
    setDuration(current.duration ?? 0);
    setBuffering(true);
    lastReportedItem.current = null;
  }, [current?.id]);

  // Load + autoplay when current changes.
  // For server items: use the streaming API URL directly.
  // For local items: resolve a blob URL from the file handle.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;

    let cancelled = false;
    const loadAndPlay = (url: string) => {
      if (cancelled) return;
      audio.src = url;
      audio.load();
      audio.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    };

    if (current.isLocal && isLocalId(current.id)) {
      const localItem = getLocalItem(current.id);
      if (!localItem) {
        setPlaying(false);
        return;
      }
      import('@/lib/local-library').then((ll) => ll.getLocalBlobUrl(localItem))
        .then((url) => loadAndPlay(url))
        .catch(() => setPlaying(false));
    } else {
      loadAndPlay(streamUrl(STREAM_TYPE_MAP[current.type], current.id));
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.isLocal]);

  // Periodic progress reporting
  useEffect(() => {
    if (!current) return;
    const interval = setInterval(async () => {
      const audio = audioRef.current;
      if (!audio) return;
      // Skip server-side progress reporting for local items
      if (current.isLocal) return;
      try {
        await putJson(`/api/progress/${PROGRESS_MEDIA_TYPE_MAP[current.type]}/${current.id}`, {
          position: Math.floor(audio.currentTime),
          duration: audio.duration ? Math.floor(audio.duration) : current.duration,
        });
        lastReportedItem.current = current.id;
      } catch { /* ignore */ }
    }, PROGRESS_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [current?.id, current?.isLocal]);

  // Handle audio ending
  const handleEnded = useCallback(() => {
    if (repeat) {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play();
      }
      return;
    }
    if (shuffle && queue.length > 1) {
      let nextIdx;
      do { nextIdx = Math.floor(Math.random() * queue.length); } while (nextIdx === currentIndex);
      jumpTo(nextIdx);
      return;
    }
    if (currentIndex + 1 < queue.length) {
      next();
    } else {
      setPlaying(false);
    }
  }, [repeat, shuffle, queue.length, currentIndex, next, jumpTo, setPlaying]);

  const reportFinalProgress = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    // Skip server-side progress reporting for local items
    if (current.isLocal) return;
    try {
      await putJson(`/api/progress/${PROGRESS_MEDIA_TYPE_MAP[current.type]}/${current.id}`, {
        position: Math.floor(audio.currentTime),
        duration: audio.duration ? Math.floor(audio.duration) : current.duration,
      });
    } catch { /* ignore */ }
  }, [current]);

  const seek = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, time));
    setPosition(audio.currentTime);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  };

  if (!current) return null;

  const progressPct = duration > 0 ? (position / duration) * 100 : 0;
  const artworkColor = current.color || 'hsl(220, 30%, 30%)';

  return (
    <>
      <audio
        ref={audioRef}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setPosition((e.target as HTMLAudioElement).currentTime)}
        onLoadedMetadata={(e) => {
          setDuration((e.target as HTMLAudioElement).duration);
          setBuffering(false);
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onEnded={handleEnded}
        onVolumeChange={(e) => {
          const v = (e.target as HTMLAudioElement);
          setVolume(v.volume);
          setMuted(v.muted);
        }}
      />

      {/* Now Playing full-screen panel (above the bar) */}
      {nowPlayingOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-2xl fade-up" style={{ height: 'min(80vh, 600px)' }}>
          <div className="h-full flex flex-col md:flex-row">
            {/* Left: artwork + info */}
            <div className="md:w-1/3 p-6 flex flex-col items-center justify-center bg-gradient-to-br from-card to-background border-r border-border">
              <div
                className="w-48 h-48 md:w-64 md:h-64 rounded-lg shadow-2xl flex items-end p-4 mb-4"
                style={{
                  background: `linear-gradient(135deg, ${artworkColor} 0%, #111 100%)`,
                }}
              >
                <div className="font-bold text-white text-lg drop-shadow line-clamp-2">{current.title}</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">{current.title}</div>
                <div className="text-sm text-muted-foreground mt-1">{current.subtitle}</div>
              </div>
            </div>

            {/* Right: queue + controls */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-semibold flex items-center gap-2">
                  <ListMusic className="w-4 h-4" />
                  Up Next
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setNowPlayingOpen(false)}>
                  <ChevronDown className="w-5 h-5" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2">
                  {queue.map((item, i) => {
                    const isCurrent = i === currentIndex;
                    return (
                      <div
                        key={`${item.id}-${i}`}
                        onClick={() => jumpTo(i)}
                        className={cn(
                          'flex items-center gap-3 p-2 rounded-md cursor-pointer transition',
                          isCurrent ? 'bg-primary/10' : 'hover:bg-card',
                        )}
                      >
                        <div
                          className="w-10 h-10 rounded flex-shrink-0 flex items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, ${item.color ?? '#444'} 0%, #111 100%)`,
                          }}
                        >
                          {isCurrent && isPlaying ? (
                            <span className="flex items-end gap-0.5 h-4">
                              <span className="w-0.5 bg-primary pulse-dot" style={{ height: '60%' }} />
                              <span className="w-0.5 bg-primary pulse-dot" style={{ height: '100%', animationDelay: '0.2s' }} />
                              <span className="w-0.5 bg-primary pulse-dot" style={{ height: '40%', animationDelay: '0.4s' }} />
                            </span>
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current text-white/70" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={cn('text-sm font-medium truncate', isCurrent ? 'text-primary' : '')}>{item.title}</div>
                          <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                        </div>
                        {item.duration && (
                          <div className="text-xs text-muted-foreground">{formatDuration(item.duration)}</div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeFromQueue(i); }}
                          className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 p-1"
                          aria-label="Remove from queue"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                  {queue.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                      Queue is empty
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="p-3 border-t border-border flex justify-between items-center">
                <Button variant="ghost" size="sm" onClick={clearQueue} className="text-muted-foreground">
                  Clear queue
                </Button>
                <div className="text-xs text-muted-foreground">{queue.length} item{queue.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom player bar */}
      <div className="flex-shrink-0 bg-card border-t border-border px-3 md:px-4 py-2.5 z-30">
        <div className="flex items-center gap-3 md:gap-4 h-14">
          {/* Left: artwork + title */}
          <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-none md:w-[280px]">
            <button
              type="button"
              onClick={() => setNowPlayingOpen(!nowPlayingOpen)}
              className="relative w-12 h-12 rounded flex-shrink-0 flex items-end p-1.5"
              style={{
                background: `linear-gradient(135deg, ${artworkColor} 0%, #111 100%)`,
              }}
              aria-label="Open now playing"
            >
              <div className="text-[9px] font-bold text-white line-clamp-2 leading-tight drop-shadow">
                {current.title}
              </div>
              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition flex items-center justify-center rounded">
                <ChevronUp className="w-4 h-4 text-white" />
              </div>
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{current.title}</div>
              <div className="text-xs text-muted-foreground truncate">{current.subtitle}</div>
            </div>
            <button
              type="button"
              onClick={async () => { await reportFinalProgress(); clearQueue(); }}
              className="text-muted-foreground hover:text-foreground p-1 hidden md:block"
              aria-label="Close player"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Center: transport controls + seek bar */}
          <div className="flex-1 flex flex-col items-center gap-1 max-w-2xl mx-auto">
            <div className="flex items-center gap-2 md:gap-4">
              <button
                type="button"
                onClick={() => setShuffle(!shuffle)}
                className={cn(
                  'p-1 transition hidden md:block',
                  shuffle ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
                aria-label="Shuffle"
              >
                <Shuffle className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={prev}
                disabled={currentIndex === 0}
                className="text-foreground hover:text-primary disabled:opacity-30 disabled:hover:text-foreground transition"
                aria-label="Previous"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center hover:scale-105 transition"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {buffering ? (
                  <div className="w-4 h-4 rounded-full border-2 border-background/30 border-t-background animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (currentIndex + 1 < queue.length) next();
                  else if (repeat) jumpTo(0);
                }}
                disabled={currentIndex + 1 >= queue.length && !repeat}
                className="text-foreground hover:text-primary disabled:opacity-30 disabled:hover:text-foreground transition"
                aria-label="Next"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>
              <button
                type="button"
                onClick={() => setRepeat(!repeat)}
                className={cn(
                  'p-1 transition hidden md:block',
                  repeat ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
                aria-label="Repeat"
              >
                <Repeat className="w-4 h-4" />
              </button>
            </div>
            <div className="hidden md:flex items-center gap-2 w-full">
              <span className="text-[10px] text-muted-foreground font-mono w-9 text-right">
                {formatDuration(position)}
              </span>
              <div
                className="flex-1 h-1 bg-muted rounded-full cursor-pointer relative group"
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  seek(pct * duration);
                }}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-primary rounded-full"
                  style={{ width: `${progressPct}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-foreground rounded-full opacity-0 group-hover:opacity-100 transition pointer-events-none"
                  style={{ left: `calc(${progressPct}% - 6px)` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground font-mono w-9">
                {formatDuration(duration)}
              </span>
            </div>
          </div>

          {/* Right: volume + queue toggle (desktop only) */}
          <div className="hidden md:flex items-center gap-3 w-[280px] justify-end">
            <button
              type="button"
              onClick={() => setShowQueue(!showQueue)}
              className={cn(
                'p-1 transition',
                showQueue ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-label="Toggle queue"
            >
              <ListMusic className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1 group/vol">
              <button
                type="button"
                onClick={toggleMute}
                className="text-muted-foreground hover:text-foreground transition"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  const audio = audioRef.current;
                  if (audio) {
                    audio.volume = v;
                    audio.muted = v === 0;
                  }
                  setVolume(v);
                  setMuted(v === 0);
                }}
                className="player-range w-24"
                aria-label="Volume"
              />
            </div>
          </div>

          {/* Mobile seek bar (compact) */}
          <div className="md:hidden absolute bottom-0 left-0 right-0 h-0.5 bg-muted">
            <div className="h-full bg-primary" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>
    </>
  );
}
