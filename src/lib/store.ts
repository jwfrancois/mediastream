// Global app state: navigation, player queue, search overlay
'use client';

import { create } from 'zustand';
import type { LocalLibrary, LocalMediaItem, LocalLibraryType } from './local-library';

// ----------- Navigation -----------
export type ViewType =
  | { kind: 'dashboard' }
  | { kind: 'movies' }
  | { kind: 'movie'; id: string }
  | { kind: 'tv' }
  | { kind: 'show'; id: string; season?: number }
  | { kind: 'music' }
  | { kind: 'album'; id: string }
  | { kind: 'artist'; id: string }
  | { kind: 'podcasts' }
  | { kind: 'podcast'; id: string }
  | { kind: 'audiobooks' }
  | { kind: 'audiobook'; id: string }
  | { kind: 'search'; q: string }
  | { kind: 'settings' };

interface NavState {
  view: ViewType;
  history: ViewType[];
  forwardStack: ViewType[];
  navigate: (v: ViewType) => void;
  back: () => void;
  forward: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
}

export const useNav = create<NavState>((set, get) => ({
  view: { kind: 'dashboard' },
  history: [],
  forwardStack: [],
  navigate: (v) => {
    const { view, history } = get();
    set({
      view: v,
      history: [...history, view],
      forwardStack: [],
    });
    // Scroll the main content area back to top
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
      const main = document.getElementById('main-scroll');
      if (main) main.scrollTo({ top: 0, behavior: 'instant' });
    }
  },
  back: () => {
    const { history, view, forwardStack } = get();
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    set({
      view: prev,
      history: history.slice(0, -1),
      forwardStack: [...forwardStack, view],
    });
  },
  forward: () => {
    const { forwardStack, view, history } = get();
    if (forwardStack.length === 0) return;
    const next = forwardStack[forwardStack.length - 1];
    set({
      view: next,
      forwardStack: forwardStack.slice(0, -1),
      history: [...history, view],
    });
  },
  canGoBack: () => get().history.length > 0,
  canGoForward: () => get().forwardStack.length > 0,
}));

// ----------- Search overlay -----------
interface SearchState {
  open: boolean;
  query: string;
  setOpen: (open: boolean) => void;
  setQuery: (q: string) => void;
  toggle: () => void;
}
export const useSearch = create<SearchState>((set, get) => ({
  open: false,
  query: '',
  setOpen: (open) => set({ open }),
  setQuery: (q) => set({ query: q }),
  toggle: () => set({ open: !get().open }),
}));

// ----------- Audio Player -----------
// The audio player is a global bottom bar that plays a queue of audio items.
export type AudioItemType = 'track' | 'podcast' | 'audiobook';

export interface AudioQueueItem {
  id: string;
  type: AudioItemType;
  title: string;
  subtitle: string; // artist / podcast / author
  duration?: number | null;
  color?: string | null;
  // Whether this is a local (browser-side) media item — playback uses a blob URL
  isLocal?: boolean;
  // Context info for navigation
  albumId?: string;
  podcastId?: string;
  artwork?: { title: string; subtitle: string; color?: string | null };
}

interface AudioPlayerState {
  queue: AudioQueueItem[];
  currentIndex: number;
  isPlaying: boolean;
  // Open the full "now playing" view
  nowPlayingOpen: boolean;

  playNow: (items: AudioQueueItem[], index?: number) => void;
  addToQueue: (items: AudioQueueItem[]) => void;
  next: () => void;
  prev: () => void;
  jumpTo: (index: number) => void;
  removeFromQueue: (index: number) => void;
  setPlaying: (p: boolean) => void;
  togglePlay: () => void;
  setNowPlayingOpen: (open: boolean) => void;
  clearQueue: () => void;
}

export const useAudioPlayer = create<AudioPlayerState>((set, get) => ({
  queue: [],
  currentIndex: 0,
  isPlaying: false,
  nowPlayingOpen: false,

  playNow: (items, index = 0) => set({
    queue: items,
    currentIndex: index,
    isPlaying: true,
    nowPlayingOpen: false,
  }),
  addToQueue: (items) => set((s) => ({ queue: [...s.queue, ...items] })),
  next: () => {
    const { currentIndex, queue } = get();
    if (currentIndex + 1 < queue.length) {
      set({ currentIndex: currentIndex + 1, isPlaying: true });
    } else {
      set({ isPlaying: false });
    }
  },
  prev: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) set({ currentIndex: currentIndex - 1, isPlaying: true });
  },
  jumpTo: (index) => set({ currentIndex: index, isPlaying: true }),
  removeFromQueue: (index) => set((s) => {
    const newQueue = s.queue.filter((_, i) => i !== index);
    let newIndex = s.currentIndex;
    if (index < s.currentIndex) newIndex = s.currentIndex - 1;
    if (newQueue.length === 0) {
      return { queue: [], currentIndex: 0, isPlaying: false };
    }
    if (newIndex >= newQueue.length) newIndex = newQueue.length - 1;
    return { queue: newQueue, currentIndex: newIndex };
  }),
  setPlaying: (p) => set({ isPlaying: p }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setNowPlayingOpen: (open) => set({ nowPlayingOpen: open }),
  clearQueue: () => set({ queue: [], currentIndex: 0, isPlaying: false }),
}));

// ----------- Video Player -----------
// The video player opens as a full-screen overlay for movies/episodes.
export interface VideoPlayerItem {
  id: string;
  type: 'movie' | 'episode';
  title: string;
  subtitle?: string;
  duration?: number | null;
  startPosition?: number;
  color?: string | null;
  // Whether this is a local (browser-side) media item — playback uses a blob URL
  isLocal?: boolean;
  // For episodes: list of all episodes in the season for "next episode" support
  queue?: { id: string; type: 'movie' | 'episode'; title: string; subtitle?: string; duration?: number | null; color?: string | null; isLocal?: boolean }[];
}

interface VideoPlayerState {
  current: VideoPlayerItem | null;
  open: boolean;
  openPlayer: (item: VideoPlayerItem) => void;
  closePlayer: () => void;
}
export const useVideoPlayer = create<VideoPlayerState>((set) => ({
  current: null,
  open: false,
  openPlayer: (item) => set({ current: item, open: true }),
  closePlayer: () => set({ open: false, current: null }),
}));

// ----------- Toast helper (lightweight) -----------
// We use shadcn toaster via sonner, but expose a simple wrapper here.
export function toastSuccess(message: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message } }));
  }
}
export function toastError(message: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message } }));
  }
}

// ----------- Local Libraries (File System Access API) -----------
// State for libraries that live in the browser — scanned from the user's
// local filesystem via showDirectoryPicker(). Persistent across reloads
// via IndexedDB (see local-library.ts).

interface LocalLibraryState {
  libraries: LocalLibrary[];
  items: LocalMediaItem[];
  loaded: boolean; // true after initial hydration from IndexedDB
  scanning: string | null; // library id currently being scanned, or null
  enriching: string | null; // library id currently being enriched, or null
  adding: boolean;

  hydrate: () => Promise<void>;
  addLocalLibrary: (name: string, type: LocalLibraryType) => Promise<void>;
  scanLocalLibrary: (id: string) => Promise<{ added: number; skipped: number }>;
  enrichLibrary: (id: string, onProgress?: (done: number, total: number) => void) => Promise<{ enriched: number }>;
  removeLocalLibrary: (id: string) => Promise<void>;
  getLocalItem: (id: string) => LocalMediaItem | undefined;
  getLocalItemsByType: (mediaType: LocalMediaItem['mediaType']) => LocalMediaItem[];
}

export const useLocalLibraries = create<LocalLibraryState>((set, get) => ({
  libraries: [],
  items: [],
  loaded: false,
  scanning: null,
  enriching: null,
  adding: false,

  hydrate: async () => {
    if (get().loaded) return;
    try {
      const [libs, items] = await Promise.all([
        (await import('./local-library')).loadLocalLibraries(),
        (await import('./local-library')).loadLocalItems(),
      ]);
      set({ libraries: libs, items, loaded: true });
    } catch (e) {
      console.error('Failed to load local libraries:', e);
      set({ loaded: true });
    }
  },

  addLocalLibrary: async (name, type) => {
    set({ adding: true });
    try {
      const ll = await import('./local-library');
      const handle = await ll.pickDirectory();
      const lib = await ll.createLocalLibrary(name, type, handle);
      set((s) => ({ libraries: [...s.libraries, lib] }));
    } finally {
      set({ adding: false });
    }
  },

  scanLocalLibrary: async (id) => {
    set({ scanning: id });
    try {
      const ll = await import('./local-library');
      const lib = get().libraries.find((l) => l.id === id);
      if (!lib) throw new Error('Library not found');
      const result = await ll.scanLocalLibrary(lib);
      // Reload items from IndexedDB
      const items = await ll.loadLocalItems();
      // Update library metadata
      const updatedLib = { ...lib, lastScanAt: Date.now(), itemCount: result.added, permission: 'granted' as PermissionState };
      set((s) => ({
        items,
        libraries: s.libraries.map((l) => (l.id === id ? updatedLib : l)),
      }));
      return { added: result.added, skipped: result.skipped };
    } finally {
      set({ scanning: null });
    }
  },

  enrichLibrary: async (id, onProgress) => {
    set({ enriching: id });
    try {
      const ll = await import('./local-library');
      const lib = get().libraries.find((l) => l.id === id);
      if (!lib) throw new Error('Library not found');

      // Gather items for this library that haven't been enriched yet
      const allItems = get().items.filter((i) => i.libraryId === id);
      // For TV, deduplicate by showTitle so we only enrich each show once
      let itemsToEnrich: LocalMediaItem[];
      if (lib.type === 'TV') {
        const seenShows = new Set<string>();
        itemsToEnrich = allItems.filter((i) => {
          if (i.enriched) return false;
          const key = i.showTitle ?? i.title;
          if (seenShows.has(key)) return false;
          seenShows.add(key);
          return true;
        });
      } else {
        itemsToEnrich = allItems.filter((i) => !i.enriched);
      }

      if (itemsToEnrich.length === 0) {
        return { enriched: 0 };
      }

      // Map library type to the API's type parameter
      const apiType = lib.type; // MOVIE | TV | AUDIOBOOK | MUSIC | PODCAST

      // Process in batches of 30 to respect token limits
      const BATCH_SIZE = 30;
      let enrichedCount = 0;
      let done = 0;
      const total = itemsToEnrich.length;

      for (let i = 0; i < itemsToEnrich.length; i += BATCH_SIZE) {
        const batch = itemsToEnrich.slice(i, i + BATCH_SIZE);
        const requestItems = batch.map((item) => ({
          id: item.id,
          title: item.title,
          year: item.year,
          showTitle: item.showTitle,
          seasonNumber: item.seasonNumber,
          episodeNumber: item.episodeNumber,
        }));

        try {
          const res = await fetch('/api/enrich', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: apiType, items: requestItems }),
          });
          if (!res.ok) {
            const errBody = await res.text().catch(() => res.statusText);
            throw new Error(`Enrich API ${res.status}: ${errBody}`);
          }
          const data = await res.json() as { items: Array<any> };

          // Build a lookup of enriched data by id
          const enrichedMap = new Map<string, any>(data.items.map((e: any) => [e.id, e]));

          // Merge enrichment data into items and persist.
          // For TV: apply the show-level metadata to ALL episodes of that show.
          if (lib.type === 'TV') {
            for (const enrichedItem of data.items) {
              const sourceItem = batch.find((b) => b.id === enrichedItem.id);
              if (!sourceItem) continue;
              const showName = sourceItem.showTitle ?? sourceItem.title;
              // Find all episodes of this show in the full items list
              const showEpisodes = get().items.filter(
                (it) => it.libraryId === id && (it.showTitle ?? it.title) === showName,
              );
              for (const ep of showEpisodes) {
                const updated: LocalMediaItem = {
                  ...ep,
                  enriched: true,
                  plot: enrichedItem.plot ?? ep.plot,
                  genre: enrichedItem.genre ?? ep.genre,
                  year: enrichedItem.year ?? ep.year,
                  director: enrichedItem.director ?? ep.director,
                  cast: enrichedItem.cast ?? ep.cast,
                  rating: enrichedItem.rating ?? ep.rating,
                  collection: enrichedItem.collection ?? ep.collection,
                  collectionOrder: enrichedItem.collectionOrder ?? ep.collectionOrder,
                  backdropColor: ep.backdropColor ?? ll.colorFromString(showName + ' backdrop'),
                };
                await ll.updateLocalItem(updated);
              }
              enrichedCount += showEpisodes.length;
            }
          } else {
            // Movies / audiobooks / etc — update each item directly
            for (const sourceItem of batch) {
              const enrichedItem = enrichedMap.get(sourceItem.id);
              if (!enrichedItem) continue;
              const updated: LocalMediaItem = {
                ...sourceItem,
                enriched: true,
                plot: enrichedItem.plot ?? sourceItem.plot,
                genre: enrichedItem.genre ?? sourceItem.genre,
                year: enrichedItem.year ?? sourceItem.year,
                director: enrichedItem.director ?? sourceItem.director,
                cast: enrichedItem.cast ?? sourceItem.cast,
                rating: enrichedItem.rating ?? sourceItem.rating,
                collection: enrichedItem.collection ?? sourceItem.collection,
                collectionOrder: enrichedItem.collectionOrder ?? sourceItem.collectionOrder,
                backdropColor: sourceItem.backdropColor ?? ll.colorFromString(sourceItem.title + ' backdrop'),
              };
              await ll.updateLocalItem(updated);
              enrichedCount++;
            }
          }

          done += batch.length;
          onProgress?.(done, total);

          // Refresh the in-memory items from IndexedDB periodically
          const refreshedItems = await ll.loadLocalItems();
          set({ items: refreshedItems });
        } catch (e) {
          console.error(`Enrichment batch failed (items ${i}-${i + batch.length}):`, e);
          // Continue with next batch instead of failing entirely
          done += batch.length;
          onProgress?.(done, total);
        }
      }

      return { enriched: enrichedCount };
    } finally {
      set({ enriching: null });
    }
  },

  removeLocalLibrary: async (id) => {
    const ll = await import('./local-library');
    await ll.deleteLocalLibrary(id);
    set((s) => ({
      libraries: s.libraries.filter((l) => l.id !== id),
      items: s.items.filter((i) => i.libraryId !== id),
    }));
  },

  getLocalItem: (id) => get().items.find((i) => i.id === id),

  getLocalItemsByType: (mediaType) => get().items.filter((i) => i.mediaType === mediaType),
}));
