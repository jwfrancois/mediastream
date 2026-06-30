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
  adding: boolean;

  hydrate: () => Promise<void>;
  addLocalLibrary: (name: string, type: LocalLibraryType) => Promise<void>;
  scanLocalLibrary: (id: string) => Promise<{ added: number }>;
  removeLocalLibrary: (id: string) => Promise<void>;
  getLocalItem: (id: string) => LocalMediaItem | undefined;
  getLocalItemsByType: (mediaType: LocalMediaItem['mediaType']) => LocalMediaItem[];
}

export const useLocalLibraries = create<LocalLibraryState>((set, get) => ({
  libraries: [],
  items: [],
  loaded: false,
  scanning: null,
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
      return { added: result.added };
    } finally {
      set({ scanning: null });
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
