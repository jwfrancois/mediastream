// Filesystem scanner for media libraries (Plex/Jellyfin style)
// Walks configured directories and parses media files into the database.

import { promises as fs } from 'fs';
import path from 'path';
import { db } from '@/lib/db';

// Supported file extensions
export const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v', '.wmv', '.flv'];
export const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.wav', '.ogg', '.opus', '.aac', '.wma'];

export type LibraryType = 'MOVIE' | 'TV' | 'MUSIC' | 'PODCAST' | 'AUDIOBOOK';

export interface ScanResult {
  libraryId: string;
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
  durationMs: number;
}

// Walk a directory recursively and yield file paths matching the extension filter
async function* walkDir(
  root: string,
  extensions: string[],
  ignoreHidden = true,
): AsyncGenerator<string> {
  const exts = new Set(extensions.map((e) => e.toLowerCase()));
  const stack: string[] = [root];

  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: import('fs').Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (ignoreHidden && entry.name.startsWith('.')) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (exts.has(ext)) {
          yield fullPath;
        }
      }
    }
  }
}

// Parse "S01E05" or "1x05" or "Episode 5" patterns from a filename
export interface ParsedEpisode {
  season: number;
  episode: number;
}

export function parseEpisodeInfo(filename: string): ParsedEpisode | null {
  const base = path.basename(filename, path.extname(filename));
  // S01E05 / s01e05
  const m1 = base.match(/[Ss](\d{1,2})[Ee](\d{1,3})/);
  if (m1) return { season: parseInt(m1[1], 10), episode: parseInt(m1[2], 10) };
  // 1x05
  const m2 = base.match(/(\d{1,2})x(\d{1,3})/);
  if (m2) return { season: parseInt(m2[1], 10), episode: parseInt(m2[2], 10) };
  // Season 1 Episode 5
  const m3 = base.match(/[Ss]eason\s*(\d{1,2})[\s_-]*[Ee]pisode\s*(\d{1,3})/);
  if (m3) return { season: parseInt(m3[1], 10), episode: parseInt(m3[2], 10) };
  return null;
}

// Parse "Show Name - S01E05" -> "Show Name"
export function parseShowName(folderOrFile: string): string {
  const base = path.basename(folderOrFile, path.extname(folderOrFile));
  // Strip season/episode patterns
  return base
    .replace(/[._]/g, ' ')
    .replace(/[Ss]\d{1,2}[Ee]\d{1,3}.*$/, '')
    .replace(/\d{1,2}x\d{1,3}.*$/, '')
    .replace(/[Ss]eason\s*\d{1,2}.*$/, '')
    .trim()
    .replace(/\s*-\s*$/, '');
}

// Clean a movie title from its filename
export function cleanTitle(filename: string): string {
  const base = path.basename(filename, path.extname(filename));
  return base
    .replace(/[._]/g, ' ')
    .replace(/\(\d{4}\)/g, '')
    .replace(/\[\d{4}\]/g, '')
    .replace(/\b(480p|720p|1080p|2160p|4k|bluray|brrip|webrip|x264|x265|h264|h265|hevc|aac|dts)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Try to extract a year from a filename like "Movie Name (2023)" or "Movie.Name.2023"
export function parseYear(filename: string): number | null {
  const base = path.basename(filename);
  const m = base.match(/\((\d{4})\)|\.(\d{4})\.|^(\d{4})\s+-/);
  if (m) {
    const year = parseInt(m[1] || m[2] || m[3], 10);
    if (year > 1900 && year < 2100) return year;
  }
  return null;
}

// Sort title (lowercase, strip "The ", "A ", "An ")
export function makeSortTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, '')
    .trim();
}

// Get file size safely
async function getFileSize(filePath: string): Promise<number | null> {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch {
    return null;
  }
}

// Try to read media duration using ffprobe (best effort, non-fatal)
async function getDurationWithFfprobe(filePath: string): Promise<number | null> {
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const dur = parseFloat(stdout.trim());
    return isNaN(dur) ? null : Math.round(dur);
  } catch {
    return null;
  }
}

// Try to read ID3 / audio metadata using music-metadata
async function getAudioMetadata(filePath: string) {
  try {
    const mm = await import('music-metadata');
    const metadata = await mm.parseFile(filePath, { duration: false });
    return {
      title: metadata.common.title ?? null,
      artist: metadata.common.artist ?? null,
      album: metadata.common.album ?? null,
      albumArtist: metadata.common.albumartist ?? null,
      year: metadata.common.year ?? null,
      genre: metadata.common.genre?.[0] ?? null,
      trackNumber: metadata.common.track?.no ?? null,
      duration: metadata.format.duration ? Math.round(metadata.format.duration) : null,
    };
  } catch {
    return null;
  }
}

// Generate a deterministic gradient color from a string (used when no poster/cover exists)
export function colorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 45%)`;
}

// ---------------- Library Scanners ----------------

async function scanMovieLibrary(libraryId: string, libraryPath: string): Promise<{ added: number; updated: number; skipped: number; errors: string[] }> {
  let added = 0, updated = 0, skipped = 0;
  const errors: string[] = [];

  // Get existing file paths to detect removed files
  const existingMovies = await db.movie.findMany({ where: { libraryId }, select: { id: true, filePath: true } });
  const existingPaths = new Set(existingMovies.map((m) => m.filePath));
  const seenPaths = new Set<string>();

  for await (const filePath of walkDir(libraryPath, VIDEO_EXTENSIONS)) {
    seenPaths.add(filePath);
    try {
      const title = cleanTitle(filePath);
      if (!title) { skipped++; continue; }
      const year = parseYear(filePath);
      const fileSize = await getFileSize(filePath);

      const existing = await db.movie.findFirst({ where: { libraryId, filePath } });
      if (existing) {
        // Update if file size changed
        if (fileSize && existing.fileSize !== fileSize) {
          await db.movie.update({ where: { id: existing.id }, data: { fileSize } });
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

      await db.movie.create({
        data: {
          libraryId,
          title,
          sortTitle: makeSortTitle(title),
          year,
          filePath,
          fileSize,
          posterColor: colorFromString(title),
          backdropColor: colorFromString(title + ' backdrop'),
        },
      });
      added++;
    } catch (e) {
      errors.push(`Movie ${filePath}: ${(e as Error).message}`);
    }
  }

  // Remove movies whose files no longer exist
  for (const movie of existingMovies) {
    if (!seenPaths.has(movie.filePath)) {
      await db.movie.delete({ where: { id: movie.id } }).catch(() => {});
    }
  }

  return { added, updated, skipped, errors };
}

async function scanTvLibrary(libraryId: string, libraryPath: string): Promise<{ added: number; updated: number; skipped: number; errors: string[] }> {
  let added = 0, updated = 0, skipped = 0;
  const errors: string[] = [];

  // Group episodes by show name -> season -> episode
  interface EpisodeFile { filePath: string; showName: string; season: number; episode: number; fileSize: number | null; }
  const shows = new Map<string, EpisodeFile[]>();

  for await (const filePath of walkDir(libraryPath, VIDEO_EXTENSIONS)) {
    const parsed = parseEpisodeInfo(filePath);
    if (!parsed) { skipped++; continue; }
    // Show name: prefer parent directory, fallback to filename parsing
    const parentDir = path.basename(path.dirname(filePath));
    const showName = parseShowName(parentDir) || parseShowName(filePath);
    if (!showName) { skipped++; continue; }

    const fileSize = await getFileSize(filePath);
    const list = shows.get(showName) ?? [];
    list.push({ filePath, showName, season: parsed.season, episode: parsed.episode, fileSize });
    shows.set(showName, list);
  }

  // Get existing shows to detect removals
  const existingShows = await db.tvShow.findMany({
    where: { libraryId },
    include: { seasons: { include: { episodes: true } } },
  });
  const seenShowTitles = new Set<string>();

  for (const [showName, episodes] of shows) {
    seenShowTitles.add(showName.toLowerCase());
    try {
      let show = await db.tvShow.findFirst({ where: { libraryId, title: showName } });
      if (!show) {
        show = await db.tvShow.create({
          data: {
            libraryId,
            title: showName,
            sortTitle: makeSortTitle(showName),
            year: episodes[0] ? parseYear(episodes[0].filePath) : null,
            posterColor: colorFromString(showName),
            backdropColor: colorFromString(showName + ' backdrop'),
          },
        });
        added++;
      } else {
        skipped++;
      }

      // Group by season
      const seasonMap = new Map<number, EpisodeFile[]>();
      for (const ep of episodes) {
        const list = seasonMap.get(ep.season) ?? [];
        list.push(ep);
        seasonMap.set(ep.season, list);
      }

      for (const [seasonNum, eps] of seasonMap) {
        let season = await db.season.findUnique({
          where: { tvShowId_seasonNumber: { tvShowId: show.id, seasonNumber: seasonNum } },
        });
        if (!season) {
          season = await db.season.create({
            data: { tvShowId: show.id, seasonNumber: seasonNum, posterColor: colorFromString(showName + ' S' + seasonNum) },
          });
        }

        for (const ep of eps) {
          const existing = await db.episode.findFirst({
            where: { seasonId: season.id, episodeNumber: ep.episode },
          });
          if (existing) {
            if (ep.fileSize && existing.fileSize !== ep.fileSize) {
              await db.episode.update({ where: { id: existing.id }, data: { fileSize: ep.fileSize, filePath: ep.filePath } });
              updated++;
            } else {
              skipped++;
            }
            continue;
          }
          const epTitle = cleanTitle(path.basename(ep.filePath, path.extname(ep.filePath)))
            .replace(new RegExp(`[Ss]0?${ep.season}[Ee]0?${ep.episode}`, 'g'), '')
            .replace(/^[\s\-_.]+/, '')
            .trim() || `Episode ${ep.episode}`;
          await db.episode.create({
            data: {
              seasonId: season.id,
              episodeNumber: ep.episode,
              title: epTitle,
              filePath: ep.filePath,
              fileSize: ep.fileSize,
            },
          });
          added++;
        }
      }
    } catch (e) {
      errors.push(`TV show ${showName}: ${(e as Error).message}`);
    }
  }

  // Remove shows no longer present
  for (const show of existingShows) {
    if (!seenShowTitles.has(show.title.toLowerCase())) {
      await db.tvShow.delete({ where: { id: show.id } }).catch(() => {});
    }
  }

  return { added, updated, skipped, errors };
}

async function scanMusicLibrary(libraryId: string, libraryPath: string): Promise<{ added: number; updated: number; skipped: number; errors: string[] }> {
  let added = 0, updated = 0, skipped = 0;
  const errors: string[] = [];

  for await (const filePath of walkDir(libraryPath, AUDIO_EXTENSIONS)) {
    try {
      const meta = await getAudioMetadata(filePath);
      const fileSize = await getFileSize(filePath);

      // Determine album title and artist
      const albumTitle = meta?.album || path.basename(path.dirname(filePath));
      const albumArtist = meta?.albumArtist || meta?.artist || 'Unknown Artist';
      const trackTitle = meta?.title || cleanTitle(filePath);
      const trackNo = meta?.trackNumber ?? 0;
      const year = meta?.year ?? null;
      const genre = meta?.genre ?? null;
      const duration = meta?.duration ?? await getDurationWithFfprobe(filePath);

      // Upsert artist
      let artist = await db.artist.findFirst({ where: { name: albumArtist } });
      if (!artist) {
        artist = await db.artist.create({
          data: { name: albumArtist, sortName: makeSortTitle(albumArtist), imageColor: colorFromString(albumArtist) },
        });
      }

      // Upsert album
      let album = await db.album.findFirst({ where: { libraryId, title: albumTitle, artistId: artist.id } });
      if (!album) {
        album = await db.album.create({
          data: {
            libraryId,
            artistId: artist.id,
            title: albumTitle,
            sortTitle: makeSortTitle(albumTitle),
            year,
            genre,
            coverColor: colorFromString(albumTitle + albumArtist),
          },
        });
        added++;
      } else {
        skipped++;
      }

      // Upsert track
      const existing = await db.track.findFirst({ where: { albumId: album.id, trackNumber: trackNo } });
      if (existing) {
        if (fileSize && existing.fileSize !== fileSize) {
          await db.track.update({
            where: { id: existing.id },
            data: { fileSize, filePath, duration, title: trackTitle, artistId: artist.id },
          });
          updated++;
        } else {
          skipped++;
        }
        continue;
      }
      await db.track.create({
        data: {
          albumId: album.id,
          artistId: artist.id,
          trackNumber: trackNo || 0,
          title: trackTitle,
          duration,
          filePath,
          fileSize,
        },
      });
      added++;
    } catch (e) {
      errors.push(`Music ${filePath}: ${(e as Error).message}`);
    }
  }
  return { added, updated, skipped, errors };
}

async function scanPodcastLibrary(libraryId: string, libraryPath: string): Promise<{ added: number; updated: number; skipped: number; errors: string[] }> {
  let added = 0, updated = 0, skipped = 0;
  const errors: string[] = [];

  // Group by podcast name (parent directory)
  const podcasts = new Map<string, { filePath: string; episodeNo: number; title: string; fileSize: number | null }[]>();

  for await (const filePath of walkDir(libraryPath, AUDIO_EXTENSIONS)) {
    const parentDir = path.basename(path.dirname(filePath));
    const podcastName = parseShowName(parentDir) || 'Unknown Podcast';
    const baseName = path.basename(filePath, path.extname(filePath));
    const epNoMatch = baseName.match(/(\d+)/);
    const epNo = epNoMatch ? parseInt(epNoMatch[1], 10) : 0;
    const title = cleanTitle(filePath);
    const fileSize = await getFileSize(filePath);

    const list = podcasts.get(podcastName) ?? [];
    list.push({ filePath, episodeNo, title, fileSize });
    podcasts.set(podcastName, list);
  }

  for (const [podcastName, episodes] of podcasts) {
    try {
      let podcast = await db.podcast.findFirst({ where: { libraryId, title: podcastName } });
      if (!podcast) {
        podcast = await db.podcast.create({
          data: {
            libraryId,
            title: podcastName,
            sortTitle: makeSortTitle(podcastName),
            coverColor: colorFromString(podcastName),
          },
        });
        added++;
      }

      // Sort episodes by number
      episodes.sort((a, b) => a.episodeNo - b.episodeNo);

      for (const ep of episodes) {
        const existing = await db.podcastEpisode.findFirst({
          where: { podcastId: podcast.id, episodeNumber: ep.episodeNo },
        });
        if (existing) {
          if (ep.fileSize && existing.fileSize !== ep.fileSize) {
            await db.podcastEpisode.update({
              where: { id: existing.id },
              data: { fileSize: ep.fileSize, filePath: ep.filePath },
            });
            updated++;
          } else {
            skipped++;
          }
          continue;
        }
        const duration = await getDurationWithFfprobe(ep.filePath);
        await db.podcastEpisode.create({
          data: {
            podcastId: podcast.id,
            episodeNumber: ep.episodeNo,
            title: ep.title,
            filePath: ep.filePath,
            fileSize: ep.fileSize,
            duration,
            pubDate: new Date(),
          },
        });
        added++;
      }
    } catch (e) {
      errors.push(`Podcast ${podcastName}: ${(e as Error).message}`);
    }
  }
  return { added, updated, skipped, errors };
}

async function scanAudiobookLibrary(libraryId: string, libraryPath: string): Promise<{ added: number; updated: number; skipped: number; errors: string[] }> {
  let added = 0, updated = 0, skipped = 0;
  const errors: string[] = [];

  for await (const filePath of walkDir(libraryPath, AUDIO_EXTENSIONS)) {
    try {
      const meta = await getAudioMetadata(filePath);
      const fileSize = await getFileSize(filePath);
      const title = meta?.title || cleanTitle(filePath);
      const author = meta?.artist || 'Unknown Author';
      const duration = meta?.duration ?? await getDurationWithFfprobe(filePath);

      const existing = await db.audiobook.findFirst({ where: { libraryId, filePath } });
      if (existing) {
        if (fileSize && existing.fileSize !== fileSize) {
          await db.audiobook.update({
            where: { id: existing.id },
            data: { fileSize, duration, title, author },
          });
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

      await db.audiobook.create({
        data: {
          libraryId,
          title,
          sortTitle: makeSortTitle(title),
          author,
          year: meta?.year ?? null,
          genre: meta?.genre ?? null,
          duration,
          filePath,
          fileSize,
          coverColor: colorFromString(title + author),
        },
      });
      added++;
    } catch (e) {
      errors.push(`Audiobook ${filePath}: ${(e as Error).message}`);
    }
  }
  return { added, updated, skipped, errors };
}

// ---------------- Main scan dispatcher ----------------

export async function scanLibrary(libraryId: string): Promise<ScanResult> {
  const start = Date.now();
  const library = await db.library.findUnique({ where: { id: libraryId } });
  if (!library) {
    return {
      libraryId,
      added: 0, updated: 0, skipped: 0, errors: ['Library not found'], durationMs: 0,
    };
  }

  let result: { added: number; updated: number; skipped: number; errors: string[] };
  switch (library.type as LibraryType) {
    case 'MOVIE':     result = await scanMovieLibrary(libraryId, library.path); break;
    case 'TV':        result = await scanTvLibrary(libraryId, library.path); break;
    case 'MUSIC':     result = await scanMusicLibrary(libraryId, library.path); break;
    case 'PODCAST':   result = await scanPodcastLibrary(libraryId, library.path); break;
    case 'AUDIOBOOK': result = await scanAudiobookLibrary(libraryId, library.path); break;
    default:
      result = { added: 0, updated: 0, skipped: 0, errors: [`Unknown library type: ${library.type}`] };
  }

  await db.library.update({ where: { id: libraryId }, data: { lastScanAt: new Date() } });

  return {
    libraryId,
    ...result,
    durationMs: Date.now() - start,
  };
}

// Scan all libraries (used for bulk rescans)
export async function scanAllLibraries(): Promise<ScanResult[]> {
  const libraries = await db.library.findMany({ select: { id: true } });
  const results: ScanResult[] = [];
  for (const lib of libraries) {
    results.push(await scanLibrary(lib.id));
  }
  return results;
}
