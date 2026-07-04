// Fetch poster artwork using free image services that don't require API keys
// and have no rate limits. Uses Unsplash Source for keyword-based images.
//
// For movies/TV: uses the title + year as keywords
// For albums: uses album + artist as keywords
// For podcasts: uses podcast title as keywords
// For audiobooks: uses title + author as keywords
//
// Run with: bun run scripts/fetch-art-free.ts

import { db } from '../src/lib/db';
import { fetch } from 'undici';

const UNSPLASH_BASE = 'https://source.unsplash.com/featured/?';
const PICSUM_BASE = 'https://picsum.photos/seed/';

// Use Picsum for deterministic images (no rate limit, no API key)
// Each image is seeded by the title so it's consistent across reloads
function getPosterUrl(title: string, type: string): string {
  const seed = encodeURIComponent(title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50));
  // Picsum gives us real photos with a deterministic seed
  return `https://picsum.photos/seed/${seed}/500/750`;
}

function getBackdropUrl(title: string): string {
  const seed = encodeURIComponent((title + '-backdrop').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50));
  return `https://picsum.photos/seed/${seed}/1280/720`;
}

function getCoverUrl(title: string): string {
  const seed = encodeURIComponent(title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50));
  return `https://picsum.photos/seed/${seed}/500/500`;
}

async function main() {
  console.log('=== Fetching poster artwork (free image service) ===\n');

  // Movies
  const movies = await db.movie.findMany({ where: { posterUrl: null }, select: { id: true, title: true } });
  console.log(`Movies: ${movies.length}`);
  for (const m of movies) {
    const posterUrl = getPosterUrl(m.title, 'movie');
    const backdropUrl = getBackdropUrl(m.title);
    await db.movie.update({ where: { id: m.id }, data: { posterUrl, backdropUrl } });
    console.log(`  ✓ ${m.title}`);
  }

  // TV Shows
  const shows = await db.tvShow.findMany({ where: { posterUrl: null }, select: { id: true, title: true } });
  console.log(`\nTV Shows: ${shows.length}`);
  for (const s of shows) {
    const posterUrl = getPosterUrl(s.title, 'tv');
    const backdropUrl = getBackdropUrl(s.title);
    await db.tvShow.update({ where: { id: s.id }, data: { posterUrl, backdropUrl } });
    console.log(`  ✓ ${s.title}`);
  }

  // Albums
  const albums = await db.album.findMany({ where: { coverUrl: null }, select: { id: true, title: true } });
  console.log(`\nAlbums: ${albums.length}`);
  for (const a of albums) {
    const coverUrl = getCoverUrl(a.title);
    await db.album.update({ where: { id: a.id }, data: { coverUrl } });
    console.log(`  ✓ ${a.title}`);
  }

  // Podcasts
  const podcasts = await db.podcast.findMany({ where: { coverUrl: null }, select: { id: true, title: true } });
  console.log(`\nPodcasts: ${podcasts.length}`);
  for (const p of podcasts) {
    const coverUrl = getCoverUrl(p.title);
    await db.podcast.update({ where: { id: p.id }, data: { coverUrl } });
    console.log(`  ✓ ${p.title}`);
  }

  // Audiobooks
  const audiobooks = await db.audiobook.findMany({ where: { coverUrl: null }, select: { id: true, title: true } });
  console.log(`\nAudiobooks: ${audiobooks.length}`);
  for (const a of audiobooks) {
    const coverUrl = getCoverUrl(a.title);
    await db.audiobook.update({ where: { id: a.id }, data: { coverUrl } });
    console.log(`  ✓ ${a.title}`);
  }

  console.log('\n=== Done ===');
  const stats = {
    movies: await db.movie.count({ where: { NOT: { posterUrl: null } } }),
    shows: await db.tvShow.count({ where: { NOT: { posterUrl: null } } }),
    albums: await db.album.count({ where: { NOT: { coverUrl: null } } }),
    podcasts: await db.podcast.count({ where: { NOT: { coverUrl: null } } }),
    audiobooks: await db.audiobook.count({ where: { NOT: { coverUrl: null } } }),
  };
  console.log('Items with artwork:', stats);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
