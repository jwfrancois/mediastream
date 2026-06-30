// AppShell — main layout wrapper with sidebar + top bar + content area + bottom audio bar.

'use client';

import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { AudioPlayerBar } from '@/components/player/AudioPlayerBar';
import { useAudioPlayer } from '@/lib/store';

export function AppShell({ children }: { children: React.ReactNode }) {
  const queueLength = useAudioPlayer((s) => s.queue.length);

  // Keyboard shortcut: spacebar to toggle audio play (when not in input)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === ' ' && useAudioPlayer.getState().queue.length > 0) {
        e.preventDefault();
        useAudioPlayer.getState().togglePlay();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0" id="main-scroll">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        {queueLength > 0 && <AudioPlayerBar />}
      </div>
    </div>
  );
}
