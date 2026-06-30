// TopBar — search input, mobile nav, and quick actions.

'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, Menu } from 'lucide-react';
import { useNav, useSearch } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import {
  Home, Film, Tv, Music, Mic, BookHeadphones, Settings, Library,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Home', icon: Home, view: { kind: 'dashboard' as const } },
  { label: 'Movies', icon: Film, view: { kind: 'movies' as const } },
  { label: 'TV Shows', icon: Tv, view: { kind: 'tv' as const } },
  { label: 'Music', icon: Music, view: { kind: 'music' as const } },
  { label: 'Podcasts', icon: Mic, view: { kind: 'podcasts' as const } },
  { label: 'Audiobooks', icon: BookHeadphones, view: { kind: 'audiobooks' as const } },
];

export function TopBar() {
  const { view, navigate } = useNav();
  const [query, setQuery] = useState(view.kind === 'search' ? view.q : '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input when navigating to search view externally
  useEffect(() => {
    if (view.kind === 'search') {
      setQuery(view.q);
    }
  }, [view]);

  // Debounced search navigation
  useEffect(() => {
    if (view.kind !== 'search') return;
    if (query === view.q) return;
    const t = setTimeout(() => {
      navigate({ kind: 'search', q: query });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const openSearch = () => {
    if (view.kind !== 'search') {
      navigate({ kind: 'search', q: '' });
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center gap-3 px-4 md:px-6 py-3">
        {/* Mobile nav */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-sidebar border-sidebar-border">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Library className="w-4 h-4 text-primary-foreground" />
                </div>
                MediaStream
              </SheetTitle>
            </SheetHeader>
            <nav className="px-2 py-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => navigate(item.view)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition"
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => navigate({ kind: 'settings' })}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition"
              >
                <Settings className="w-5 h-5" />
                Settings
              </button>
            </nav>
          </SheetContent>
        </Sheet>

        {/* Search input */}
        <div className="flex-1 max-w-2xl relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            id="global-search-input"
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={openSearch}
            placeholder="Search movies, shows, music, podcasts, audiobooks…"
            className="w-full bg-card border border-border rounded-full pl-10 pr-10 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2 ml-auto">
          <div className="text-xs text-muted-foreground px-2">
            Press <kbd className="px-1 py-0.5 bg-card rounded text-[10px]">/</kbd> to search
          </div>
        </div>
      </div>
    </header>
  );
}
