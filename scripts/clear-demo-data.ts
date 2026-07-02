// Clear all demo/mock data from the server database and delete generated
// demo media files. Leaves the database schema intact for any server-side
// libraries the user may add later. Does NOT touch browser-side local
// libraries (those live in IndexedDB in the user's browser).

import { promises as fs } from 'fs';
import path from 'path';
import { db } from '../src/lib/db';

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  console.log('=== Clearing demo data ===');

  // 1. Clear all database tables
  console.log('Clearing database tables...');
  await db.watchProgress.deleteMany();
  await db.track.deleteMany();
  await db.album.deleteMany();
  await db.artist.deleteMany();
  await db.podcastEpisode.deleteMany();
  await db.podcast.deleteMany();
  await db.audiobook.deleteMany();
  await db.episode.deleteMany();
  await db.season.deleteMany();
  await db.tvShow.deleteMany();
  await db.movie.deleteMany();
  await db.library.deleteMany();
  console.log('  Database cleared.');

  // 2. Delete generated demo media files
  const mediaRoot = path.resolve(process.cwd(), 'media');
  const audioDir = path.join(mediaRoot, 'audio');
  const videoDir = path.join(mediaRoot, 'video');

  if (await fileExists(audioDir)) {
    console.log(`Deleting ${audioDir}...`);
    await fs.rm(audioDir, { recursive: true, force: true });
  }
  if (await fileExists(videoDir)) {
    console.log(`Deleting ${videoDir}...`);
    await fs.rm(videoDir, { recursive: true, force: true });
  }

  // 3. Verify
  const counts = {
    movies: await db.movie.count(),
    tvShows: await db.tvShow.count(),
    episodes: await db.episode.count(),
    albums: await db.album.count(),
    tracks: await db.track.count(),
    podcasts: await db.podcast.count(),
    podcastEpisodes: await db.podcastEpisode.count(),
    audiobooks: await db.audiobook.count(),
    libraries: await db.library.count(),
  };
  console.log('=== Done. Remaining counts: ===');
  console.log(counts);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
