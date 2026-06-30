// Video Player — full-screen overlay for movies and TV episodes.
// Custom controls: play/pause, seek, volume, fullscreen, skip intro/outro, next episode.
// Reports playback progress to /api/progress every 15 seconds.

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useVideoPlayer, useNav } from '@/lib/store';
import { streamUrl, formatDuration } from '@/lib/format';
import { putJson } from '@/lib/useApi';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, X, Settings as SettingsIcon, Rewind, FastForward,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PROGRESS_INTERVAL_MS = 15_000; // report progress every 15s

export function VideoPlayer() {
  const { current, open, closePlayer } = useVideoPlayer();
  const navigate = useNav((s) => s.navigate);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when a new video loads
  useEffect(() => {
    if (!open || !current) return;
    setPlaying(false);
    setDuration(current.duration ?? 0);
    setPosition(current.startPosition ?? 0);
    setError(null);
    setBuffering(true);
  }, [open, current?.id]);

  // Seek to start position when video metadata loads
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !current) return;

    const onLoadedMetadata = () => {
      setDuration(video.duration);
      if (current.startPosition && current.startPosition > 0) {
        try { video.currentTime = current.startPosition; } catch { /* ignore */ }
      }
      setBuffering(false);
      // Attempt autoplay
      video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    return () => video.removeEventListener('loadedmetadata', onLoadedMetadata);
  }, [current?.id]);

  // Periodically report progress
  useEffect(() => {
    if (!open || !current) return;
    const interval = setInterval(async () => {
      const video = videoRef.current;
      if (!video) return;
      try {
        await putJson(`/api/progress/${current.type.toUpperCase()}/${current.id}`, {
          position: Math.floor(video.currentTime),
          duration: video.duration ? Math.floor(video.duration) : current.duration,
        });
      } catch { /* ignore */ }
    }, PROGRESS_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [open, current?.id]);

  // Report progress on close/unmount
  const reportFinalProgress = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !current) return;
    try {
      await putJson(`/api/progress/${current.type.toUpperCase()}/${current.id}`, {
        position: Math.floor(video.currentTime),
        duration: video.duration ? Math.floor(video.duration) : current.duration,
      });
    } catch { /* ignore */ }
  }, [current]);

  // Auto-hide controls
  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  }, [playing]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    scheduleHideControls();
  }, [scheduleHideControls]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'ArrowRight':
          video.currentTime = Math.min(video.duration, video.currentTime + 10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume((v) => { const nv = Math.min(1, v + 0.1); video.volume = nv; return nv; });
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume((v) => { const nv = Math.max(0, v - 0.1); video.volume = nv; return nv; });
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          toggleMute();
          break;
        case 'Escape':
          if (!document.fullscreenElement) handleClose();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, playing]);

  // Listen for fullscreen change
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  if (!open || !current) return null;

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  };

  const seek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, time));
    setPosition(video.currentTime);
  };

  const skip = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    seek(video.currentTime + delta);
  };

  const handleClose = async () => {
    await reportFinalProgress();
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    closePlayer();
  };

  const progressPct = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center fade-in"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={streamUrl(current.type, current.id)}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        onPlay={() => { setPlaying(true); scheduleHideControls(); }}
        onPause={() => { setPlaying(false); setShowControls(true); }}
        onTimeUpdate={(e) => setPosition((e.target as HTMLVideoElement).currentTime)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onError={() => setError('Failed to load video. The file may be missing or in an unsupported format.')}
        onVolumeChange={(e) => {
          const v = (e.target as HTMLVideoElement);
          setVolume(v.volume);
          setMuted(v.muted);
        }}
        autoPlay
      />

      {/* Buffering spinner */}
      {buffering && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-white animate-spin" />
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-8">
          <p className="text-xl mb-2">Playback Error</p>
          <p className="text-white/70 mb-6 text-center max-w-md">{error}</p>
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2 bg-white text-black rounded-md font-medium hover:bg-white/90"
          >
            Close
          </button>
        </div>
      )}

      {/* Top gradient + close button */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-2 text-white hover:text-white/80 transition"
          >
            <X className="w-6 h-6" />
            <span className="text-sm font-medium">Close</span>
          </button>
          <div className="text-white text-sm font-medium">
            {current.title}
            {current.subtitle && <span className="text-white/60 ml-2">• {current.subtitle}</span>}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 px-4 pb-4 pt-16 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      >
        {/* Seek bar */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-white/80 font-mono w-12 text-right">
            {formatDuration(position)}
          </span>
          <div
            className="flex-1 h-1.5 bg-white/20 rounded-full cursor-pointer relative group"
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
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition pointer-events-none"
              style={{ left: `calc(${progressPct}% - 6px)` }}
            />
          </div>
          <span className="text-xs text-white/80 font-mono w-12">
            {formatDuration(duration)}
          </span>
        </div>

        {/* Buttons row */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => skip(-10)}
            className="text-white hover:text-white/80 transition"
            aria-label="Back 10 seconds"
          >
            <Rewind className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="text-white hover:text-white/80 transition"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current" />}
          </button>
          <button
            type="button"
            onClick={() => skip(10)}
            className="text-white hover:text-white/80 transition"
            aria-label="Forward 10 seconds"
          >
            <FastForward className="w-6 h-6" />
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2 group/vol">
            <button
              type="button"
              onClick={toggleMute}
              className="text-white hover:text-white/80 transition"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                const video = videoRef.current;
                if (video) {
                  video.volume = v;
                  video.muted = v === 0;
                }
                setVolume(v);
                setMuted(v === 0);
              }}
              className="player-range w-0 group-hover/vol:w-20 transition-all duration-200"
              aria-label="Volume"
            />
          </div>

          <div className="flex-1" />

          {/* Next episode button (only for episodes) */}
          {current.type === 'episode' && current.queue && current.queue.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const idx = current.queue!.findIndex((q) => q.id === current.id);
                const next = current.queue![idx + 1];
                if (next) {
                  reportFinalProgress();
                  useVideoPlayer.getState().openPlayer({
                    id: next.id,
                    type: next.type,
                    title: next.title,
                    subtitle: next.subtitle,
                    duration: next.duration,
                    color: next.color,
                    queue: next.queue,
                  });
                }
              }}
              className="text-white hover:text-white/80 transition flex items-center gap-1 text-sm"
            >
              Next <SkipForward className="w-5 h-5" />
            </button>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="text-white hover:text-white/80 transition"
            aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {fullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Center play/pause button when paused */}
      {!playing && !buffering && !error && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center"
          aria-label="Play"
        >
          <div className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
            <Play className="w-10 h-10 text-white fill-current ml-1" />
          </div>
        </button>
      )}
    </div>
  );
}
