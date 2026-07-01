// NowPlayingView — Roon-inspired immersive full-screen audio player.
// Opens as an overlay above the AudioPlayerBar. Features:
// - Large album art with ambient glow
// - Elegant typography (track title, artist, album)
// - Thin progress bar with time markers
// - Full transport controls (prev, play/pause, next, shuffle, repeat)
// - Volume control
// - Queue panel with drag-to-reorder (visual only)
// - "About this track" info panel (album description, artist bio)
// - Background ambient color from album art

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAudioPlayer, useLocalLibraries, useNav } from '@/lib/store';
import { formatDuration, isLocalId, streamUrl } from '@/lib/format';
import { putJson } from '@/lib/useApi';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  ListMusic, X, ChevronDown, Shuffle, Repeat, Mic2, Disc3,
  Clock, User, Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

export function NowPlayingView() {
  const {
    queue, currentIndex, isPlaying, nowPlayingOpen,
    playNow, next, prev, jumpTo, removeFromQueue, togglePlay, setPlaying,
    setNowPlayingOpen, clearQueue,
  } = useAudioPlayer();
  const navigate = useNav((s) => s.navigate);
  const getLocalItem = useLocalLibraries((s) => s.getLocalItem);

  const audioRef = useRef<HTMLAudioElement>(null);

  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [showQueue, setShowQueue] = useState(true);

  const current = queue[currentIndex];

  // Sync position/duration from the shared audio element in AudioPlayerBar
  // We listen to the same <audio> element that AudioPlayerBar controls.
  useEffect(() => {
    if (!nowPlayingOpen) return;
    // Find the audio element from the AudioPlayerBar (it's the only <audio> on the page)
    const audio = document.querySelector('audio');
    if (!audio) return;
    audioRef.current = audio;

    const onTime = () => setPosition(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onVol = () => { setVolume(audio.volume); setMuted(audio.muted); };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('volumechange', onVol);
    // Initialize state from the external audio element (legitimate sync from DOM)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPosition(audio.currentTime);
    setDuration(audio.duration || 0);
    setVolume(audio.volume);
    setMuted(audio.muted);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('volumechange', onVol);
    };
  }, [nowPlayingOpen, current?.id]);

  const progressPct = duration > 0 ? (position / duration) * 100 : 0;

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

  const handleEnded = useCallback(() => {
    if (repeat) {
      const audio = audioRef.current;
      if (audio) { audio.currentTime = 0; audio.play(); }
      return;
    }
    if (shuffle && queue.length > 1) {
      let nextIdx;
      do { nextIdx = Math.floor(Math.random() * queue.length); } while (nextIdx === currentIndex);
      jumpTo(nextIdx);
      return;
    }
    if (currentIndex + 1 < queue.length) next();
    else setPlaying(false);
  }, [repeat, shuffle, queue.length, currentIndex, next, jumpTo, setPlaying]);

  // Attach ended listener
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [handleEnded]);

  if (!nowPlayingOpen || !current) return null;

  const artworkColor = current.color || 'hsl(220, 30%, 30%)';

  // Look up local item for rich metadata
  const localItem = current.isLocal ? getLocalItem(current.id) : null;
  const albumDescription = localItem?.albumDescription;
  const artistBio = localItem?.artistBio;
  const podcastDescription = localItem?.podcastDescription;
  const authorBio = localItem?.authorBio;
  const bookSynopsis = localItem?.bookSynopsis;

  const isMusic = current.type === 'track';
  const isPodcast = current.type === 'podcast';
  const isAudiobook = current.type === 'audiobook';

  return (
    <div className="fixed inset-0 z-50 fade-in overflow-hidden">
      {/* Ambient background from album art */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 30% 20%, ${artworkColor} 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 80% 80%, hsl(0, 0%, 5%) 0%, transparent 50%),
            linear-gradient(180deg, hsl(0, 0%, 4%) 0%, hsl(0, 0%, 7%) 100%)
          `,
        }}
      />
      <div className="absolute inset-0 backdrop-blur-3xl" style={{ background: 'rgba(0,0,0,0.5)' }} />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between p-4 md:p-6">
          <div className="text-xs uppercase tracking-widest text-white/50 font-medium">
            {isMusic ? 'Now Playing' : isPodcast ? 'Now Listening' : 'Now Playing'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowQueue(!showQueue)}
              className={cn(
                'p-2 rounded-full transition glass',
                showQueue ? 'text-primary' : 'text-white/60 hover:text-white',
              )}
              aria-label="Toggle queue"
            >
              <ListMusic className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setNowPlayingOpen(false)}
              className="p-2 rounded-full glass text-white/60 hover:text-white transition"
              aria-label="Close"
            >
              <ChevronDown className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Main content: art + info / queue */}
        <div className="flex-1 flex flex-col lg:flex-row gap-6 px-4 md:px-8 pb-8 min-h-0 overflow-hidden">
          {/* Left: artwork + transport */}
          <div className={cn('flex flex-col items-center justify-center', showQueue ? 'lg:flex-1' : 'lg:max-w-2xl lg:mx-auto w-full')}>
            {/* Album art with glow */}
            <div className="relative w-full max-w-[360px] aspect-square mb-8">
              {/* Glow halo */}
              <div
                className="absolute -inset-8 rounded-full blur-3xl opacity-40"
                style={{ background: artworkColor }}
              />
              {/* Art */}
              <div
                className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl grain"
                style={{
                  background: `linear-gradient(145deg, ${artworkColor} 0%, hsl(0, 0%, 6%) 100%)`,
                }}
              >
                <div
                  className="absolute inset-0 opacity-40 mix-blend-soft-light"
                  style={{
                    background: `
                      radial-gradient(ellipse 60% 80% at 25% 15%, rgba(255,255,255,0.25) 0%, transparent 55%),
                      radial-gradient(ellipse 50% 60% at 80% 85%, rgba(0,0,0,0.5) 0%, transparent 60%)
                    `,
                  }}
                />
                {/* Type icon watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-15">
                  {isMusic ? <Disc3 className="w-24 h-24 text-white" /> :
                   isPodcast ? <Mic2 className="w-24 h-24 text-white" /> :
                   <ListMusic className="w-24 h-24 text-white" />}
                </div>
                {/* Title at bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="text-white font-bold text-lg line-clamp-2 drop-shadow-lg">{current.title}</div>
                  <div className="text-white/60 text-sm mt-0.5 line-clamp-1">{current.subtitle}</div>
                </div>
              </div>
            </div>

            {/* Track info */}
            <div className="text-center mb-6 w-full max-w-md">
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight line-clamp-2 mb-1">
                {current.title}
              </h1>
              <p className="text-white/60 text-base line-clamp-1">
                {current.subtitle}
              </p>
            </div>

            {/* Progress bar */}
            <div className="w-full max-w-md mb-4">
              <div
                className="h-1 bg-white/15 rounded-full cursor-pointer relative group"
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  seek(pct * duration);
                }}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-white rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg"
                  style={{ left: `calc(${progressPct}% - 6px)` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-xs text-white/50 font-mono">
                <span>{formatDuration(position)}</span>
                <span>{formatDuration(duration)}</span>
              </div>
            </div>

            {/* Transport controls */}
            <div className="flex items-center gap-6 mb-6">
              <button
                type="button"
                onClick={() => setShuffle(!shuffle)}
                className={cn('transition', shuffle ? 'text-primary' : 'text-white/50 hover:text-white')}
                aria-label="Shuffle"
              >
                <Shuffle className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={prev}
                disabled={currentIndex === 0}
                className="text-white hover:text-primary disabled:opacity-30 transition"
                aria-label="Previous"
              >
                <SkipBack className="w-7 h-7 fill-current" />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-2xl"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
              </button>
              <button
                type="button"
                onClick={() => { if (currentIndex + 1 < queue.length) next(); else if (repeat) jumpTo(0); }}
                disabled={currentIndex + 1 >= queue.length && !repeat}
                className="text-white hover:text-primary disabled:opacity-30 transition"
                aria-label="Next"
              >
                <SkipForward className="w-7 h-7 fill-current" />
              </button>
              <button
                type="button"
                onClick={() => setRepeat(!repeat)}
                className={cn('transition', repeat ? 'text-primary' : 'text-white/50 hover:text-white')}
                aria-label="Repeat"
              >
                <Repeat className="w-5 h-5" />
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3 w-full max-w-md">
              <button
                type="button"
                onClick={toggleMute}
                className="text-white/50 hover:text-white transition"
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
                  if (audio) { audio.volume = v; audio.muted = v === 0; }
                  setVolume(v); setMuted(v === 0);
                }}
                className="player-range flex-1"
                aria-label="Volume"
              />
            </div>
          </div>

          {/* Right: info panel + queue */}
          {showQueue && (
            <div className="lg:w-[400px] flex-shrink-0 flex flex-col gap-4 min-h-0 overflow-hidden">
              {/* Info panel */}
              {(albumDescription || artistBio || podcastDescription || authorBio || bookSynopsis) && (
                <div className="glass rounded-2xl p-5 max-h-[35%] overflow-y-auto">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2 flex items-center gap-1.5">
                    {isMusic ? <Disc3 className="w-3.5 h-3.5" /> : isPodcast ? <Mic2 className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                    About
                  </h3>
                  {albumDescription && (
                    <p className="text-sm text-white/70 leading-relaxed mb-3">{albumDescription}</p>
                  )}
                  {artistBio && (
                    <>
                      <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mt-3 mb-1">Artist</div>
                      <p className="text-sm text-white/70 leading-relaxed">{artistBio}</p>
                    </>
                  )}
                  {podcastDescription && (
                    <p className="text-sm text-white/70 leading-relaxed">{podcastDescription}</p>
                  )}
                  {bookSynopsis && (
                    <p className="text-sm text-white/70 leading-relaxed">{bookSynopsis}</p>
                  )}
                  {authorBio && (
                    <>
                      <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mt-3 mb-1">Author</div>
                      <p className="text-sm text-white/70 leading-relaxed">{authorBio}</p>
                    </>
                  )}
                </div>
              )}

              {/* Queue */}
              <div className="glass rounded-2xl p-3 flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between px-2 py-1 mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                    <ListMusic className="w-3.5 h-3.5" />
                    Up Next ({queue.length})
                  </h3>
                  <button
                    type="button"
                    onClick={clearQueue}
                    className="text-xs text-white/40 hover:text-white transition"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                  {queue.map((item, i) => {
                    const isCurrent = i === currentIndex;
                    return (
                      <div
                        key={`${item.id}-${i}`}
                        onClick={() => jumpTo(i)}
                        className={cn(
                          'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition',
                          isCurrent ? 'bg-primary/20 ring-1 ring-primary/30' : 'hover:bg-white/5',
                        )}
                      >
                        <div
                          className="w-10 h-10 rounded flex-shrink-0 flex items-center justify-center"
                          style={{ background: `linear-gradient(135deg, ${item.color ?? '#444'} 0%, #111 100%)` }}
                        >
                          {isCurrent && isPlaying ? (
                            <span className="flex items-end gap-0.5 h-4">
                              <span className="w-0.5 bg-primary pulse-dot" style={{ height: '60%' }} />
                              <span className="w-0.5 bg-primary pulse-dot" style={{ height: '100%', animationDelay: '0.2s' }} />
                              <span className="w-0.5 bg-primary pulse-dot" style={{ height: '40%', animationDelay: '0.4s' }} />
                            </span>
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current text-white/60" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={cn('text-sm font-medium truncate', isCurrent ? 'text-primary' : 'text-white/90')}>{item.title}</div>
                          <div className="text-xs text-white/40 truncate">{item.subtitle}</div>
                        </div>
                        {item.duration && (
                          <div className="text-xs text-white/40 font-mono">{formatDuration(item.duration)}</div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeFromQueue(i); }}
                          className="text-white/30 hover:text-destructive transition opacity-0 group-hover:opacity-100 p-1"
                          aria-label="Remove"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
