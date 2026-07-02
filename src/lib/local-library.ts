// Local Library — uses the File System Access API to scan a folder on the
// user's computer and play files directly from disk (no uploads).
//
// Browser support: Chrome, Edge, Opera, Brave (any Chromium browser).
// Firefox and Safari do NOT support showDirectoryPicker — we detect this
// and show a helpful message in the UI.
//
// Persistence: directory handles and file handles are stored in IndexedDB
// so they survive page reloads. Permission must be re-granted per session
// (browser security rule) — we prompt lazily when the user tries to access.

'use client';

// ---------- Types ----------

export type LocalLibraryType = 'MOVIE' | 'TV' | 'MUSIC' | 'PODCAST' | 'AUDIOBOOK';
export type LocalMediaType = 'movie' | 'episode' | 'track' | 'podcast-episode' | 'audiobook';

export interface LocalLibrary {
  id: string;
  name: string;
  type: LocalLibraryType;
  handle: FileSystemDirectoryHandle;
  lastScanAt: number;
  itemCount: number;
  permission: PermissionState;
}

export interface LocalMediaItem {
  id: string;
  libraryId: string;
  mediaType: LocalMediaType;
  title: string;
  year?: number;
  genre?: string;
  duration?: number;
  plot?: string;
  color: string;
  filePath: string;
  fileSize: number;
  addedAt: number;
  fileHandle: FileSystemFileHandle;
  // TV episode fields
  showTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  // Music track fields
  album?: string;
  artist?: string;
  trackNumber?: number;
  // Podcast fields
  podcastTitle?: string;
  description?: string;
  pubDate?: number;
  // Audiobook fields
  author?: string;
  narrator?: string;

  // Enrichment fields
  enriched?: boolean;
  rating?: number;
  director?: string;
  cast?: string[];
  collection?: string;
  collectionOrder?: number;
  backdropColor?: string;

  // Artwork URLs
  posterUrl?: string;
  backdropUrl?: string;
  castPhotos?: string[];
  artistPhotoUrl?: string;

  // Filmography / discography
  filmography?: Array<{ title: string; year?: number; role?: string }>;

  // Music enrichment
  albumDescription?: string;
  albumGenre?: string;
  albumYear?: number;
  artistBio?: string;
  artistGenre?: string;

  // Podcast enrichment
  podcastDescription?: string;
  podcastAuthor?: string;
  podcastGenre?: string;

  // Audiobook enrichment
  authorBio?: string;
  bookSynopsis?: string;
}

// ---------- File extension support ----------

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v', '.wmv', '.flv'];
const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.wav', '.ogg', '.opus', '.aac', '.wma'];
const VIDEO_EXT_SET = new Set(VIDEO_EXTENSIONS);
const AUDIO_EXT_SET = new Set(AUDIO_EXTENSIONS);

export function isVideoFile(name: string): boolean {
  const ext = '.' + name.split('.').pop()?.toLowerCase();
  return VIDEO_EXT_SET.has(ext);
}
export function isAudioFile(name: string): boolean {
  const ext = '.' + name.split('.').pop()?.toLowerCase();
  return AUDIO_EXT_SET.has(ext);
}

// ---------- Feature detection ----------

export function isLocalLibrarySupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';
}

// ---------- IndexedDB persistence ----------

const DB_NAME = 'mediastream-local';
const DB_VERSION = 1;
const STORE_LIBRARIES = 'libraries';
const STORE_ITEMS = 'items';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_LIBRARIES)) {
        db.createObjectStore(STORE_LIBRARIES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        const store = db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
        store.createIndex('libraryId', 'libraryId', { unique: false });
        store.createIndex('mediaType', 'mediaType', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut<T>(store: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function dbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result as T[]); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function dbDelete(store: string, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function dbClearByIndex(store: string, indexName: string, value: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const idx = tx.objectStore(store).index(indexName);
    const req = idx.openCursor(IDBKeyRange.only(value));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// ---------- Persisted library record ----------

interface LibraryRecord {
  id: string;
  name: string;
  type: LocalLibraryType;
  handle: FileSystemDirectoryHandle;
  lastScanAt: number;
  itemCount: number;
}

async function persistLibrary(rec: LibraryRecord): Promise<void> {
  await dbPut(STORE_LIBRARIES, rec);
}

async function loadAllLibraries(): Promise<LibraryRecord[]> {
  return dbGetAll<LibraryRecord>(STORE_LIBRARIES);
}

async function deleteLibrary(id: string): Promise<void> {
  await dbDelete(STORE_LIBRARIES, id);
  await dbClearByIndex(STORE_ITEMS, 'libraryId', id);
}

async function persistItem(item: LocalMediaItem): Promise<void> {
  await dbPut(STORE_ITEMS, item);
}

async function loadAllItems(): Promise<LocalMediaItem[]> {
  return dbGetAll<LocalMediaItem>(STORE_ITEMS);
}

// ---------- Permission management ----------

export async function queryPermission(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
  try {
    return await (handle as any).queryPermission({ mode: 'read' });
  } catch {
    return 'prompt';
  }
}

export async function requestPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const result = await (handle as any).requestPermission({ mode: 'read' });
    return result === 'granted';
  } catch {
    return false;
  }
}

// ---------- Directory picking ----------

export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!isLocalLibrarySupported()) {
    throw new Error('Your browser does not support local folder access. Please use Chrome, Edge, Opera, or Brave.');
  }
  return await (window as any).showDirectoryPicker({ mode: 'read' });
}

// ---------- Filename parsing ----------

export function parseEpisodeInfo(filename: string): { season: number; episode: number } | null {
  const base = filename.replace(/\.[^.]+$/, '');
  const m1 = base.match(/[Ss](\d{1,2})[Ee](\d{1,3})/);
  if (m1) return { season: parseInt(m1[1], 10), episode: parseInt(m1[2], 10) };
  const m2 = base.match(/(\d{1,2})x(\d{1,3})/);
  if (m2) return { season: parseInt(m2[1], 10), episode: parseInt(m2[2], 10) };
  const m3 = base.match(/[Ss]eason\s*(\d{1,2})[\s_-]*[Ee]pisode\s*(\d{1,3})/);
  if (m3) return { season: parseInt(m3[1], 10), episode: parseInt(m3[2], 10) };
  return null;
}

export function parseShowName(folderOrFile: string): string {
  const base = folderOrFile.replace(/\.[^.]+$/, '');
  return base
    .replace(/[._]/g, ' ')
    .replace(/[Ss]\d{1,2}[Ee]\d{1,3}.*$/, '')
    .replace(/\d{1,2}x\d{1,3}.*$/, '')
    .replace(/[Ss]eason\s*\d{1,2}.*$/, '')
    .trim()
    .replace(/\s*-\s*$/, '');
}

export function cleanTitle(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  return base
    .replace(/[._]/g, ' ')
    .replace(/\(\d{4}\)/g, '')
    .replace(/\[\d{4}\]/g, '')
    .replace(/\b(480p|720p|1080p|2160p|4k|bluray|brrip|webrip|x264|x265|h264|h265|hevc|aac|dts)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseYear(filename: string): number | null {
  const m = filename.match(/\((\d{4})\)|\.(\d{4})\.|^(\d{4})\s+-/);
  if (m) {
    const year = parseInt(m[1] || m[2] || m[3], 10);
    if (year > 1900 && year < 2100) return year;
  }
  return null;
}

export function makeSortTitle(title: string): string {
  return title.toLowerCase().replace(/^(the|a|an)\s+/, '').trim();
}

export function colorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 45%)`;
}

// ---------- Scanner ----------

export interface ScanProgress {
  scanned: number;
  added: number;
}

export interface ScanResult {
  libraryId: string;
  added: number;
  total: number;
  skipped: number;
  durationMs: number;
}

async function* walkDirectory(
  handle: FileSystemDirectoryHandle,
  pathPrefix = '',
): AsyncGenerator<{ name: string; path: string; handle: FileSystemFileHandle }, void, unknown> {
  let entries: any[] = [];
  try {
    for await (const entry of (handle as any).values()) {
      entries.push(entry);
    }
  } catch (e) {
    console.warn(`Could not list directory "${pathPrefix || handle.name}":`, e);
    return;
  }

  for (const entry of entries) {
    try {
      if (entry.kind === 'directory') {
        yield* walkDirectory(entry, pathPrefix + entry.name + '/');
      } else if (entry.kind === 'file') {
        yield { name: entry.name, path: pathPrefix + entry.name, handle: entry as FileSystemFileHandle };
      }
    } catch (e) {
      console.warn(`Could not access entry "${pathPrefix + entry.name}":`, e);
      continue;
    }
  }
}

async function getFileSize(fileHandle: FileSystemFileHandle): Promise<number> {
  try {
    const file = await fileHandle.getFile();
    return file.size;
  } catch {
    return 0;
  }
}

function genId(): string {
  return 'local_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

export async function scanLocalLibrary(
  library: LocalLibrary,
  onProgress?: (p: ScanProgress) => void,
): Promise<ScanResult> {
  const start = Date.now();
  const granted = await requestPermission(library.handle);
  if (!granted) {
    throw new Error('Permission denied. Please grant access to the folder.');
  }

  await dbClearByIndex(STORE_ITEMS, 'libraryId', library.id);

  const files: { name: string; path: string; handle: FileSystemFileHandle; size: number }[] = [];
  let skipped = 0;
  try {
    for await (const entry of walkDirectory(library.handle)) {
      try {
        if (library.type === 'MUSIC' || library.type === 'PODCAST' || library.type === 'AUDIOBOOK') {
          if (isAudioFile(entry.name)) {
            const size = await getFileSize(entry.handle);
            files.push({ ...entry, size });
          }
        } else {
          if (isVideoFile(entry.name)) {
            const size = await getFileSize(entry.handle);
            files.push({ ...entry, size });
          }
        }
      } catch (e) {
        console.warn(`Skipping file "${entry.path}":`, e);
        skipped++;
      }
    }
  } catch (e) {
    console.warn(`Directory walk was interrupted for "${library.name}":`, e);
  }

  let added = 0;
  const now = Date.now();

  switch (library.type) {
    case 'MOVIE':
      for (const f of files) {
        const title = cleanTitle(f.name);
        if (!title) continue;
        const item: LocalMediaItem = {
          id: genId(),
          libraryId: library.id,
          mediaType: 'movie',
          title,
          year: parseYear(f.name) ?? undefined,
          color: colorFromString(title),
          filePath: f.path,
          fileSize: f.size,
          addedAt: now,
          fileHandle: f.handle,
        };
        await persistItem(item);
        added++;
        onProgress?.({ scanned: files.length, added });
      }
      break;

    case 'TV': {
      const shows = new Map<string, { name: string; path: string; handle: FileSystemFileHandle; size: number; season?: number; episode?: number }[]>();
      for (const f of files) {
        const parsed = parseEpisodeInfo(f.name);
        if (!parsed) continue;
        const topDir = f.path.split('/')[0];
        const showName = parseShowName(topDir) || parseShowName(f.name);
        if (!showName) continue;
        const list = shows.get(showName) ?? [];
        list.push({ ...f, name: f.name, path: f.path, handle: f.handle, size: f.size, season: parsed.season, episode: parsed.episode });
        shows.set(showName, list);
      }
      for (const [showName, eps] of shows) {
        for (const ep of eps) {
          const epTitle = cleanTitle(ep.name)
            .replace(new RegExp(`[Ss]0?${ep.season}[Ee]0?${ep.episode}`, 'g'), '')
            .replace(/^[\s\-_.]+/, '')
            .trim() || `Episode ${ep.episode}`;
          const item: LocalMediaItem = {
            id: genId(),
            libraryId: library.id,
            mediaType: 'episode',
            title: epTitle,
            showTitle: showName,
            seasonNumber: ep.season,
            episodeNumber: ep.episode,
            color: colorFromString(showName),
            filePath: ep.path,
            fileSize: ep.size,
            addedAt: now,
            fileHandle: ep.handle,
          };
          await persistItem(item);
          added++;
          onProgress?.({ scanned: files.length, added });
        }
      }
      break;
    }

    case 'MUSIC':
      for (const f of files) {
        const parts = f.path.split('/');
        const fileName = parts[parts.length - 1];
        const albumDir = parts.length > 1 ? parts[parts.length - 2] : 'Unknown Album';
        const artistDir = parts.length > 2 ? parts[parts.length - 3] : 'Unknown Artist';
        const trackMatch = fileName.match(/^(\d{1,2})[\s._-]+/);
        const trackNumber = trackMatch ? parseInt(trackMatch[1], 10) : 0;
        const title = cleanTitle(fileName) || fileName.replace(/\.[^.]+$/, '');
        const item: LocalMediaItem = {
          id: genId(),
          libraryId: library.id,
          mediaType: 'track',
          title,
          album: albumDir,
          artist: artistDir,
          trackNumber,
          color: colorFromString(albumDir + artistDir),
          filePath: f.path,
          fileSize: f.size,
          addedAt: now,
          fileHandle: f.handle,
        };
        await persistItem(item);
        added++;
        onProgress?.({ scanned: files.length, added });
      }
      break;

    case 'PODCAST':
      for (const f of files) {
        const parts = f.path.split('/');
        const fileName = parts[parts.length - 1];
        const podcastDir = parts.length > 1 ? parts[parts.length - 2] : 'Unknown Podcast';
        const epMatch = fileName.match(/(\d+)/);
        const epNumber = epMatch ? parseInt(epMatch[1], 10) : 0;
        const title = cleanTitle(fileName) || fileName.replace(/\.[^.]+$/, '');
        const item: LocalMediaItem = {
          id: genId(),
          libraryId: library.id,
          mediaType: 'podcast-episode',
          title,
          podcastTitle: podcastDir,
          episodeNumber: epNumber,
          color: colorFromString(podcastDir),
          filePath: f.path,
          fileSize: f.size,
          addedAt: now,
          pubDate: now,
          fileHandle: f.handle,
        };
        await persistItem(item);
        added++;
        onProgress?.({ scanned: files.length, added });
      }
      break;

    case 'AUDIOBOOK':
      for (const f of files) {
        const title = cleanTitle(f.name) || f.name.replace(/\.[^.]+$/, '');
        const parts = f.path.split('/');
        const authorDir = parts.length > 1 ? parts[parts.length - 2] : 'Unknown Author';
        const item: LocalMediaItem = {
          id: genId(),
          libraryId: library.id,
          mediaType: 'audiobook',
          title,
          author: authorDir,
          color: colorFromString(title + authorDir),
          filePath: f.path,
          fileSize: f.size,
          addedAt: now,
          fileHandle: f.handle,
        };
        await persistItem(item);
        added++;
        onProgress?.({ scanned: files.length, added });
      }
      break;
  }

  const rec: LibraryRecord = {
    id: library.id,
    name: library.name,
    type: library.type,
    handle: library.handle,
    lastScanAt: now,
    itemCount: added,
  };
  await persistLibrary(rec);

  return {
    libraryId: library.id,
    added,
    total: added,
    skipped,
    durationMs: Date.now() - start,
  };
}

// ---------- Loading / initialization ----------

export async function loadLocalLibraries(): Promise<LocalLibrary[]> {
  const recs = await loadAllLibraries();
  const libs: LocalLibrary[] = [];
  for (const rec of recs) {
    const permission = await queryPermission(rec.handle);
    libs.push({
      id: rec.id,
      name: rec.name,
      type: rec.type,
      handle: rec.handle,
      lastScanAt: rec.lastScanAt,
      itemCount: rec.itemCount,
      permission,
    });
  }
  return libs;
}

export async function loadLocalItems(): Promise<LocalMediaItem[]> {
  return loadAllItems();
}

export async function updateLocalItem(item: LocalMediaItem): Promise<void> {
  await persistItem(item);
}

export async function createLocalLibrary(
  name: string,
  type: LocalLibraryType,
  handle: FileSystemDirectoryHandle,
): Promise<LocalLibrary> {
  const id = genId();
  const rec: LibraryRecord = {
    id,
    name,
    type,
    handle,
    lastScanAt: 0,
    itemCount: 0,
  };
  await persistLibrary(rec);
  return {
    id,
    name,
    type,
    handle,
    lastScanAt: 0,
    itemCount: 0,
    permission: 'granted',
  };
}

export async function deleteLocalLibrary(id: string): Promise<void> {
  await deleteLibrary(id);
}

// ---------- Playback ----------

const objectUrlCache = new Map<string, string>();

export async function getLocalBlobUrl(item: LocalMediaItem): Promise<string> {
  const cached = objectUrlCache.get(item.id);
  if (cached) return cached;

  let file: File;
  try {
    file = await item.fileHandle.getFile();
  } catch (e: any) {
    objectUrlCache.delete(item.id);
    if (e?.name === 'NotFoundError') {
      throw new Error(`File not found on disk — it may have been moved or deleted. Try re-scanning the library.`);
    }
    if (e?.name === 'NotAllowedError') {
      throw new Error(`Permission denied — re-grant folder access and try again.`);
    }
    throw new Error(`Could not read file: ${e?.message || e}`);
  }
  const url = URL.createObjectURL(file);
  objectUrlCache.set(item.id, url);
  return url;
}

export function revokeLocalBlobUrl(itemId: string): void {
  const url = objectUrlCache.get(itemId);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrlCache.delete(itemId);
  }
}

export function clearAllBlobUrls(): void {
  for (const url of objectUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  objectUrlCache.clear();
}
