// Sidebar — primary navigation between media sections.

'use client';

import { useNav } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  Home, Film, Tv, Music, Mic, BookHeadphones, Search, Settings,
  Library, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useEffect } from 'react';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  view: Parameters<ReturnType<typeof useNav.getState>['navigate']>[0];
  match: (v: ReturnType<typeof useNav.getState>['view']) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', icon: Home, view: { kind: 'dashboard' }, match: (v) => v.kind === 'dashboard' },
  { label: 'Movies', icon: Film, view: { kind: 'movies' }, match: (v) => v.kind === 'movies' || v.kind === 'movie' },
  { label: 'TV Shows', icon: Tv, view: { kind: 'tv' }, match: (v) => v.kind === 'tv' || v.kind === 'show' },
  { label: 'Music', icon: Music, view: { kind: 'music' }, match: (v) => v.kind === 'music' || v.kind === 'album' || v.kind === 'artist' },
  { label: 'Podcasts', icon: Mic, view: { kind: 'podcasts' }, match: (v) => v.kind === 'podcasts' || v.kind === 'podcast' },
  { label: 'Audiobooks', icon: BookHeadphones, view: { kind: 'audiobooks' }, match: (v) => v.kind === 'audiobooks' || v.kind === 'audiobook' },
];

export function Sidebar() {
  const { view, navigate, back, forward, canGoBack, canGoForward } = useNav();

  // Listen for "/" to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.getElementById('global-search-input') as HTMLInputElement | null;
        searchInput?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <aside className="hidden md:flex w-60 flex-shrink-0 flex-col bg-sidebar border-r border-sidebar-border sticky top-0 h-screen">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
          <Library className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <div className="font-bold text-foreground leading-tight">MediaStream</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Self-Hosted</div>
        </div>
      </div>

      {/* Back/forward */}
      <div className="px-3 pb-2 flex gap-1">
        <button
          type="button"
          onClick={back}
          disabled={!canGoBack()}
          className="flex-1 flex items-center justify-center py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent disabled:opacity-30 disabled:hover:bg-transparent transition"
          aria-label="Go back"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={forward}
          disabled={!canGoForward()}
          className="flex-1 flex items-center justify-center py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent disabled:opacity-30 disabled:hover:bg-transparent transition"
          aria-label="Go forward"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.match(view);
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(item.view)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition',
                active
                  ? 'bg-sidebar-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50',
              )}
            >
              <Icon className={cn('w-5 h-5', active && 'text-primary')} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Bottom: Search + Settings */}
      <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
        <button
          type="button"
          onClick={() => navigate({ kind: 'search', q: '' })}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition',
            view.kind === 'search'
              ? 'bg-sidebar-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50',
          )}
        >
          <Search className="w-5 h-5" />
          Search
          <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-sidebar-accent text-muted-foreground">/</kbd>
        </button>
        <button
          type="button"
          onClick={() => navigate({ kind: 'settings' })}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition',
            view.kind === 'settings'
              ? 'bg-sidebar-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50',
          )}
        >
          <Settings className="w-5 h-5" />
          Settings
        </button>
      </div>
    </aside>
  );
}
