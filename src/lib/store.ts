// Global app state: navigation, player queue, search overlay
'use client';

import { create } from 'zustand';

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
  // For episodes: list of all episodes in the season for "next episode" support
  queue?: { id: string; type: 'movie' | 'episode'; title: string; subtitle?: string; duration?: number | null; color?: string | null }[];
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
