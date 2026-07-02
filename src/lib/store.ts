// Global app state: navigation, player queue, search overlay
'use client';

import { create } from 'zustand';
import type { LocalLibrary, LocalMediaItem, LocalLibraryType } from './local-library';

// ----------- Music Theme Preference -----------
// Toggle between Spotify and Roon design languages for music + podcasts.
// Spotify: green accent, vibrant gradients, big cards, "Made for You" feel
// Roon: gold accent, ambient aurora, dense metadata, immersive player

export type MusicTheme = 'spotify' | 'roon';

interface MusicThemeState {
  theme: MusicTheme;
  setTheme: (t: MusicTheme) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = 'mediastream-music-theme';

function loadThemeFromStorage(): MusicTheme {
  if (typeof localStorage === 'undefined') return 'roon';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'spotify' ? 'spotify' : 'roon';
  } catch {
    return 'roon';
  }
}

export const useMusicTheme = create<MusicThemeState>((set, get) => ({
  theme: loadThemeFromStorage(),
  setTheme: (t) => {
    set({ theme: t });
    try { localStorage.setItem(THEME_STORAGE_KEY, t); } catch { /* ignore */ }
    // Update the body class for CSS variable switching
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('theme-spotify', t === 'spotify');
      document.body.classList.toggle('theme-roon', t === 'roon');
    }
  },
  toggleTheme: () => {
    const next = get().theme === 'spotify' ? 'roon' : 'spotify';
    get().setTheme(next);
  },
}));

// Initialize the body class on first import (client-side)
if (typeof window !== 'undefined') {
  const t = loadThemeFromStorage();
  requestAnimationFrame(() => {
    document.body.classList.toggle('theme-spotify', t === 'spotify');
    document.body.classList.toggle('theme-roon', t === 'roon');
  });
}

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
  fetchingArt: string | null; // library id currently fetching artwork, or null
  adding: boolean;

  hydrate: () => Promise<void>;
  addLocalLibrary: (name: string, type: LocalLibraryType) => Promise<void>;
  scanLocalLibrary: (id: string) => Promise<{ added: number; skipped: number }>;
  enrichLibrary: (id: string, onProgress?: (done: number, total: number) => void) => Promise<{ enriched: number; failedBatches: number }>;
  fetchArt: (id: string, onProgress?: (done: number, total: number) => void) => Promise<{ fetched: number; failed: number }>;
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
  fetchingArt: null,
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

      // Deduplicate based on library type:
      // - TV: one request per show (showTitle)
      // - MUSIC: one request per album|artist pair
      // - PODCAST: one request per podcast show (podcastTitle)
      // - MOVIE/AUDIOBOOK: one request per item
      let itemsToEnrich: LocalMediaItem[];
      if (lib.type === 'TV') {
        const seen = new Set<string>();
        itemsToEnrich = allItems.filter((i) => {
          if (i.enriched) return false;
          const key = i.showTitle ?? i.title;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      } else if (lib.type === 'MUSIC') {
        const seen = new Set<string>();
        itemsToEnrich = allItems.filter((i) => {
          if (i.enriched) return false;
          const key = (i.album ?? '') + '|' + (i.artist ?? '');
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      } else if (lib.type === 'PODCAST') {
        const seen = new Set<string>();
        itemsToEnrich = allItems.filter((i) => {
          if (i.enriched) return false;
          const key = i.podcastTitle ?? i.title;
          if (seen.has(key)) return false;
          seen.add(key);
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

      // Process in small batches to keep each LLM call under the gateway
      // timeout. Larger batches (30+) cause 502 Bad Gateway errors because
      // the load balancer closes the connection before the LLM finishes
      // generating the full JSON response.
      const BATCH_SIZE = 8;
      let enrichedCount = 0;
      let done = 0;
      let failedBatches = 0;
      const total = itemsToEnrich.length;

      // Helper: process a single batch, with automatic split-and-retry on failure
      const processBatch = async (batchItems: LocalMediaItem[]): Promise<{ ok: boolean; enriched: number }> => {
        if (batchItems.length === 0) return { ok: true, enriched: 0 };
        const requestItems = batchItems.map((item) => ({
          id: item.id,
          title: item.title,
          year: item.year,
          showTitle: item.showTitle,
          seasonNumber: item.seasonNumber,
          episodeNumber: item.episodeNumber,
          album: item.album,
          artist: item.artist,
          podcastTitle: item.podcastTitle,
          author: item.author,
          narrator: item.narrator,
        }));

        try {
          // Fetch with client-side retry on 429 (client has no ALB timeout)
          let res: Response | null = null;
          for (let attempt = 0; attempt < 5; attempt++) {
            res = await fetch('/api/enrich', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: apiType, items: requestItems }),
            });
            if (res.ok) break;
            if (res.status === 429 && attempt < 4) {
              const waitMs = 15000 * (attempt + 1); // 15s, 30s, 45s, 60s
              console.warn(`Enrich rate-limited, waiting ${waitMs / 1000}s (attempt ${attempt + 1}/5)...`);
              await new Promise(r => setTimeout(r, waitMs));
              continue;
            }
            break; // non-429 error or retries exhausted
          }
          if (!res || !res.ok) {
            const errBody = res ? await res.text().catch(() => res.statusText) : 'no response';
            throw new Error(`Enrich API ${res?.status ?? 'unknown'}: ${errBody}`);
          }
          const data = await res.json() as { items: Array<any> };

          // Merge enrichment data into items and persist.
          // The merge strategy depends on library type:
          // - TV: apply show-level metadata to ALL episodes of the same show
          // - MUSIC: apply album+artist metadata to ALL tracks of the same album|artist
          // - PODCAST: apply show metadata to ALL episodes of the same podcast
          // - MOVIE/AUDIOBOOK: update each item directly
          if (lib.type === 'TV') {
            for (const enrichedItem of data.items) {
              const sourceItem = batchItems.find((b) => b.id === enrichedItem.id);
              if (!sourceItem) continue;
              const showName = sourceItem.showTitle ?? sourceItem.title;
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
                  backdropColor: ep.backdropColor ?? ll.colorFromString(showName + ' backdrop'),
                };
                await ll.updateLocalItem(updated);
              }
              enrichedCount += showEpisodes.length;
            }
          } else if (lib.type === 'MUSIC') {
            for (const enrichedItem of data.items) {
              const sourceItem = batchItems.find((b) => b.id === enrichedItem.id);
              if (!sourceItem) continue;
              const albumKey = (sourceItem.album ?? '') + '|' + (sourceItem.artist ?? '');
              // Apply to all tracks of this album|artist
              const albumTracks = get().items.filter(
                (it) => it.libraryId === id &&
                  (it.album ?? '') + '|' + (it.artist ?? '') === albumKey &&
                  it.mediaType === 'track',
              );
              for (const track of albumTracks) {
                const updated: LocalMediaItem = {
                  ...track,
                  enriched: true,
                  albumDescription: enrichedItem.albumDescription ?? track.albumDescription,
                  albumGenre: enrichedItem.albumGenre ?? track.albumGenre,
                  albumYear: enrichedItem.albumYear ?? track.albumYear,
                  artistBio: enrichedItem.artistBio ?? track.artistBio,
                  artistGenre: enrichedItem.artistGenre ?? track.artistGenre,
                  genre: enrichedItem.albumGenre ?? enrichedItem.artistGenre ?? track.genre,
                  year: enrichedItem.albumYear ?? track.year,
                  backdropColor: track.backdropColor ?? ll.colorFromString((sourceItem.album ?? '') + ' backdrop'),
                };
                await ll.updateLocalItem(updated);
              }
              enrichedCount += albumTracks.length;
            }
          } else if (lib.type === 'PODCAST') {
            for (const enrichedItem of data.items) {
              const sourceItem = batchItems.find((b) => b.id === enrichedItem.id);
              if (!sourceItem) continue;
              const podName = sourceItem.podcastTitle ?? sourceItem.title;
              const podEpisodes = get().items.filter(
                (it) => it.libraryId === id && (it.podcastTitle ?? it.title) === podName && it.mediaType === 'podcast-episode',
              );
              for (const ep of podEpisodes) {
                const updated: LocalMediaItem = {
                  ...ep,
                  enriched: true,
                  podcastDescription: enrichedItem.podcastDescription ?? ep.podcastDescription,
                  podcastAuthor: enrichedItem.podcastAuthor ?? ep.podcastAuthor,
                  podcastGenre: enrichedItem.podcastGenre ?? ep.podcastGenre,
                  genre: enrichedItem.podcastGenre ?? ep.genre,
                  backdropColor: ep.backdropColor ?? ll.colorFromString(podName + ' backdrop'),
                };
                await ll.updateLocalItem(updated);
              }
              enrichedCount += podEpisodes.length;
            }
          } else {
            // MOVIE / AUDIOBOOK — update each item directly with all fields
            const enrichedMap = new Map<string, any>(data.items.map((e: any) => [e.id, e]));
            for (const sourceItem of batchItems) {
              const enrichedItem = enrichedMap.get(sourceItem.id);
              if (!enrichedItem) continue;
              const updated: LocalMediaItem = {
                ...sourceItem,
                enriched: true,
                plot: enrichedItem.plot ?? enrichedItem.bookSynopsis ?? sourceItem.plot,
                genre: enrichedItem.genre ?? sourceItem.genre,
                year: enrichedItem.year ?? sourceItem.year,
                director: enrichedItem.director ?? sourceItem.director,
                cast: enrichedItem.cast ?? sourceItem.cast,
                rating: enrichedItem.rating ?? sourceItem.rating,
                collection: enrichedItem.collection ?? sourceItem.collection,
                collectionOrder: enrichedItem.collectionOrder ?? sourceItem.collectionOrder,
                authorBio: enrichedItem.authorBio ?? sourceItem.authorBio,
                bookSynopsis: enrichedItem.bookSynopsis ?? sourceItem.bookSynopsis,
                backdropColor: sourceItem.backdropColor ?? ll.colorFromString(sourceItem.title + ' backdrop'),
              };
              await ll.updateLocalItem(updated);
              enrichedCount++;
            }
          }

          // Refresh in-memory items
          const refreshedItems = await ll.loadLocalItems();
          set({ items: refreshedItems });
          return { ok: true, enriched: data.items.length };
        } catch (e: any) {
          const msg = (e as Error).message || '';
          // If rate-limited (429), wait and retry instead of splitting
          if (msg.includes('429') || msg.includes('Too many requests')) {
            if (batchItems.length > 2) {
              // Split and retry with delay — smaller batches are less likely to rate-limit
              await new Promise(r => setTimeout(r, 10000));
              const mid = Math.floor(batchItems.length / 2);
              const half1 = batchItems.slice(0, mid);
              const half2 = batchItems.slice(mid);
              const r1 = await processBatch(half1);
              const r2 = await processBatch(half2);
              return { ok: r1.ok && r2.ok, enriched: r1.enriched + r2.enriched };
            }
            // Small batch still rate-limited — wait longer and give up
            console.error(`Enrichment rate-limited (${batchItems.length} items):`, e);
            return { ok: false, enriched: 0 };
          }
          // If the batch has more than 2 items, split it in half and retry
          // each half — this handles 502/timeout errors on larger batches.
          if (batchItems.length > 2) {
            const mid = Math.floor(batchItems.length / 2);
            const half1 = batchItems.slice(0, mid);
            const half2 = batchItems.slice(mid);
            const r1 = await processBatch(half1);
            const r2 = await processBatch(half2);
            return { ok: r1.ok && r2.ok, enriched: r1.enriched + r2.enriched };
          }
          // Batch too small to split — give up on this batch
          console.error(`Enrichment batch failed (${batchItems.length} items):`, e);
          return { ok: false, enriched: 0 };
        }
      };

      for (let i = 0; i < itemsToEnrich.length; i += BATCH_SIZE) {
        const batch = itemsToEnrich.slice(i, i + BATCH_SIZE);
        const result = await processBatch(batch);
        if (!result.ok) failedBatches++;
        done += batch.length;
        onProgress?.(done, total);
        // Delay between batches to avoid rate-limiting the LLM API
        if (i + BATCH_SIZE < itemsToEnrich.length) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }

      return { enriched: enrichedCount, failedBatches };
    } finally {
      set({ enriching: null });
    }
  },

  fetchArt: async (id, onProgress) => {
    set({ fetchingArt: id });
    try {
      const ll = await import('./local-library');
      const lib = get().libraries.find((l) => l.id === id);
      if (!lib) throw new Error('Library not found');

      // Gather items that don't have artwork yet
      const allItems = get().items.filter((i) => i.libraryId === id);

      // Deduplicate based on library type (same as enrichment)
      let itemsToFetch: LocalMediaItem[];
      if (lib.type === 'TV') {
        const seen = new Set<string>();
        itemsToFetch = allItems.filter((i) => {
          if (i.posterUrl) return false;
          const key = i.showTitle ?? i.title;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      } else if (lib.type === 'MUSIC') {
        const seen = new Set<string>();
        itemsToFetch = allItems.filter((i) => {
          if (i.posterUrl) return false;
          const key = (i.album ?? '') + '|' + (i.artist ?? '');
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      } else if (lib.type === 'PODCAST') {
        const seen = new Set<string>();
        itemsToFetch = allItems.filter((i) => {
          if (i.posterUrl) return false;
          const key = i.podcastTitle ?? i.title;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      } else {
        itemsToFetch = allItems.filter((i) => !i.posterUrl);
      }

      if (itemsToFetch.length === 0) {
        return { fetched: 0, failed: 0 };
      }

      // Process ONE item at a time — image search is slow (30-90s per call)
      // and the server API also processes 1 at a time to stay under the
      // 60s gateway timeout. Each item does parallel image searches but
      // still takes 30-50s, so we send them one by one.
      const BATCH_SIZE = 1;
      let fetchedCount = 0;
      let failedCount = 0;
      let done = 0;
      const total = itemsToFetch.length;

      for (let i = 0; i < itemsToFetch.length; i += BATCH_SIZE) {
        const batch = itemsToFetch.slice(i, i + BATCH_SIZE);
        const requestItems = batch.map((item) => ({
          id: item.id,
          title: item.title,
          year: item.year,
          genre: item.genre,
          director: item.director,
          cast: item.cast,
          artist: item.artist,
          album: item.album,
          author: item.author,
          podcastTitle: item.podcastTitle,
          mediaType: item.mediaType,
        }));

        try {
          const res = await fetch('/api/fetch-art', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: lib.type, items: requestItems }),
          });
          if (!res.ok) {
            const errBody = await res.text().catch(() => res.statusText);
            throw new Error(`Fetch-art API ${res.status}: ${errBody}`);
          }
          const data = await res.json() as { items: Array<any> };
          const artMap = new Map<string, any>(data.items.map((e: any) => [e.id, e]));

          // Merge art URLs into items and persist
          // For TV/MUSIC/PODCAST, apply to all related items
          for (const sourceItem of batch) {
            const artItem = artMap.get(sourceItem.id);
            if (!artItem) { failedCount++; continue; }

            if (lib.type === 'TV') {
              const showName = sourceItem.showTitle ?? sourceItem.title;
              const showEpisodes = get().items.filter(
                (it) => it.libraryId === id && (it.showTitle ?? it.title) === showName,
              );
              for (const ep of showEpisodes) {
                const updated: LocalMediaItem = {
                  ...ep,
                  posterUrl: artItem.posterUrl ?? ep.posterUrl,
                  backdropUrl: artItem.backdropUrl ?? ep.backdropUrl,
                  castPhotos: artItem.castPhotos ?? ep.castPhotos,
                  filmography: artItem.filmography ?? ep.filmography,
                };
                await ll.updateLocalItem(updated);
              }
              fetchedCount += showEpisodes.length;
            } else if (lib.type === 'MUSIC') {
              const albumKey = (sourceItem.album ?? '') + '|' + (sourceItem.artist ?? '');
              const albumTracks = get().items.filter(
                (it) => it.libraryId === id &&
                  (it.album ?? '') + '|' + (it.artist ?? '') === albumKey &&
                  it.mediaType === 'track',
              );
              for (const track of albumTracks) {
                const updated: LocalMediaItem = {
                  ...track,
                  posterUrl: artItem.posterUrl ?? track.posterUrl,
                  artistPhotoUrl: artItem.artistPhotoUrl ?? track.artistPhotoUrl,
                  filmography: artItem.filmography ?? track.filmography,
                };
                await ll.updateLocalItem(updated);
              }
              fetchedCount += albumTracks.length;
            } else if (lib.type === 'PODCAST') {
              const podName = sourceItem.podcastTitle ?? sourceItem.title;
              const podEpisodes = get().items.filter(
                (it) => it.libraryId === id && (it.podcastTitle ?? it.title) === podName && it.mediaType === 'podcast-episode',
              );
              for (const ep of podEpisodes) {
                const updated: LocalMediaItem = {
                  ...ep,
                  posterUrl: artItem.posterUrl ?? ep.posterUrl,
                };
                await ll.updateLocalItem(updated);
              }
              fetchedCount += podEpisodes.length;
            } else {
              // Movie / Audiobook — update directly
              const updated: LocalMediaItem = {
                ...sourceItem,
                posterUrl: artItem.posterUrl ?? sourceItem.posterUrl,
                backdropUrl: artItem.backdropUrl ?? sourceItem.backdropUrl,
                castPhotos: artItem.castPhotos ?? sourceItem.castPhotos,
                artistPhotoUrl: artItem.artistPhotoUrl ?? sourceItem.artistPhotoUrl,
                filmography: artItem.filmography ?? sourceItem.filmography,
              };
              await ll.updateLocalItem(updated);
              fetchedCount++;
            }
          }

          // Refresh in-memory items
          const refreshedItems = await ll.loadLocalItems();
          set({ items: refreshedItems });
        } catch (e) {
          // Retry once — image search can be flaky
          console.warn(`Art fetch failed, retrying:`, e);
          try {
            const retryRes = await fetch('/api/fetch-art', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: lib.type, items: requestItems }),
            });
            if (retryRes.ok) {
              const retryData = await retryRes.json() as { items: Array<any> };
              const retryMap = new Map<string, any>(retryData.items.map((e: any) => [e.id, e]));
              for (const sourceItem of batch) {
                const artItem = retryMap.get(sourceItem.id);
                if (!artItem || (!artItem.posterUrl && !artItem.backdropUrl && !artItem.castPhotos)) continue;
                // Apply retry results (same merge logic as above)
                if (lib.type === 'TV') {
                  const showName = sourceItem.showTitle ?? sourceItem.title;
                  const showEpisodes = get().items.filter(
                    (it) => it.libraryId === id && (it.showTitle ?? it.title) === showName,
                  );
                  for (const ep of showEpisodes) {
                    await ll.updateLocalItem({
                      ...ep,
                      posterUrl: artItem.posterUrl ?? ep.posterUrl,
                      backdropUrl: artItem.backdropUrl ?? ep.backdropUrl,
                      castPhotos: artItem.castPhotos ?? ep.castPhotos,
                      filmography: artItem.filmography ?? ep.filmography,
                    });
                  }
                  fetchedCount += showEpisodes.length;
                } else if (lib.type === 'MUSIC') {
                  const albumKey = (sourceItem.album ?? '') + '|' + (sourceItem.artist ?? '');
                  const albumTracks = get().items.filter(
                    (it) => it.libraryId === id && (it.album ?? '') + '|' + (it.artist ?? '') === albumKey && it.mediaType === 'track',
                  );
                  for (const track of albumTracks) {
                    await ll.updateLocalItem({
                      ...track,
                      posterUrl: artItem.posterUrl ?? track.posterUrl,
                      artistPhotoUrl: artItem.artistPhotoUrl ?? track.artistPhotoUrl,
                      filmography: artItem.filmography ?? track.filmography,
                    });
                  }
                  fetchedCount += albumTracks.length;
                } else if (lib.type === 'PODCAST') {
                  const podName = sourceItem.podcastTitle ?? sourceItem.title;
                  const podEpisodes = get().items.filter(
                    (it) => it.libraryId === id && (it.podcastTitle ?? it.title) === podName && it.mediaType === 'podcast-episode',
                  );
                  for (const ep of podEpisodes) {
                    await ll.updateLocalItem({ ...ep, posterUrl: artItem.posterUrl ?? ep.posterUrl });
                  }
                  fetchedCount += podEpisodes.length;
                } else {
                  await ll.updateLocalItem({
                    ...sourceItem,
                    posterUrl: artItem.posterUrl ?? sourceItem.posterUrl,
                    backdropUrl: artItem.backdropUrl ?? sourceItem.backdropUrl,
                    castPhotos: artItem.castPhotos ?? sourceItem.castPhotos,
                    artistPhotoUrl: artItem.artistPhotoUrl ?? sourceItem.artistPhotoUrl,
                    filmography: artItem.filmography ?? sourceItem.filmography,
                  });
                  fetchedCount++;
                }
              }
              const refreshed = await ll.loadLocalItems();
              set({ items: refreshed });
            } else {
              throw e;
            }
          } catch (e2) {
            console.error(`Art fetch retry also failed:`, e2);
            failedCount += batch.length;
          }
        }

        done += batch.length;
        onProgress?.(done, total);
      }

      return { fetched: fetchedCount, failed: failedCount };
    } finally {
      set({ fetchingArt: null });
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
