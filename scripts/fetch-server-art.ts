// Fetch real poster images for server-side demo media using z-ai image-search.
// Updates the Prisma database with posterUrl, backdropUrl, and coverUrl fields.
// Run with: bun run scripts/fetch-server-art.ts

import { db } from '../src/lib/db';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function fetchImage(query: string, count: number = 3): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { stdout } = await execFileAsync('z-ai', [
        'image-search', '-q', query, '-c', String(count), '--gl', 'us', '--no-rank',
      ], { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
      // The z-ai CLI prints status lines (emojis) to stdout before the JSON.
      // Extract only the JSON block (first { to last }).
      const jsonStart = stdout.indexOf('{');
      const jsonEnd = stdout.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) return null;
      const jsonStr = stdout.slice(jsonStart, jsonEnd + 1);
      const data = JSON.parse(jsonStr);
      if (!data.success || !data.results || data.results.length === 0) return null;
      return data.results[0].original_url;
    } catch (e: any) {
      const msg = (e as Error).message || '';
      // 429 = rate limited — wait longer and retry
      if (msg.includes('429') || msg.includes('Too many requests')) {
        const waitMs = 30000 * (attempt + 1); // 30s, 60s, 90s
        console.error(`  Rate limited, waiting ${waitMs / 1000}s before retry ${attempt + 1}/3...`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      console.error(`  Image search failed for "${query}":`, msg.slice(0, 100));
      return null;
    }
  }
  return null;
}

// Rate-limit friendly delay between items
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('=== Fetching real poster art for server media ===\n');

  // 1. Movies
  const movies = await db.movie.findMany({ where: { posterUrl: null } });
  console.log(`Movies to fetch: ${movies.length}`);
  for (const m of movies) {
    const yearStr = m.year ? ` ${m.year}` : '';
    console.log(`  Movie: ${m.title}${yearStr}`);
    const posterUrl = await fetchImage(`movie poster for ${m.title}${yearStr}`);
    await delay(2000); // avoid rate limit
    const backdropUrl = await fetchImage(`movie still scene from ${m.title}${yearStr}`);
    if (posterUrl || backdropUrl) {
      await db.movie.update({
        where: { id: m.id },
        data: { posterUrl, backdropUrl },
      });
      console.log(`    ✓ poster: ${posterUrl ? 'yes' : 'no'}, backdrop: ${backdropUrl ? 'yes' : 'no'}`);
    } else {
      console.log(`    ✗ no images found`);
    }
    await delay(3000); // avoid rate limit between items
  }

  // 2. TV Shows
  const shows = await db.tvShow.findMany({ where: { posterUrl: null } });
  console.log(`\nTV Shows to fetch: ${shows.length}`);
  for (const s of shows) {
    const yearStr = s.year ? ` ${s.year}` : '';
    console.log(`  TV: ${s.title}${yearStr}`);
    const posterUrl = await fetchImage(`TV show poster for ${s.title}${yearStr}`);
    await delay(2000);
    const backdropUrl = await fetchImage(`TV show still scene from ${s.title}${yearStr}`);
    if (posterUrl || backdropUrl) {
      await db.tvShow.update({
        where: { id: s.id },
        data: { posterUrl, backdropUrl },
      });
      console.log(`    ✓ poster: ${posterUrl ? 'yes' : 'no'}, backdrop: ${backdropUrl ? 'yes' : 'no'}`);
    } else {
      console.log(`    ✗ no images found`);
    }
  }

  // 3. Albums
  const albums = await db.album.findMany({
    where: { coverUrl: null },
    include: { artist: true },
  });
  console.log(`\nAlbums to fetch: ${albums.length}`);
  for (const a of albums) {
    const artistName = a.artist?.name ?? '';
    console.log(`  Album: ${a.title} by ${artistName}`);
    const coverUrl = await fetchImage(`album cover for ${a.title} by ${artistName}`);
    if (coverUrl) {
      await db.album.update({ where: { id: a.id }, data: { coverUrl } });
      console.log(`    ✓ cover found`);
    } else {
      console.log(`    ✗ no cover found`);
    }
    await delay(3000);
  }

  // 4. Artists
  const artists = await db.artist.findMany({ where: { photoUrl: null } });
  console.log(`\nArtists to fetch: ${artists.length}`);
  for (const a of artists) {
    console.log(`  Artist: ${a.name}`);
    const photoUrl = await fetchImage(`${a.name} musician portrait photo`);
    if (photoUrl) {
      await db.artist.update({ where: { id: a.id }, data: { photoUrl } });
      console.log(`    ✓ photo found`);
    } else {
      console.log(`    ✗ no photo found`);
    }
    await delay(3000);
  }

  // 5. Podcasts
  const podcasts = await db.podcast.findMany({ where: { coverUrl: null } });
  console.log(`\nPodcasts to fetch: ${podcasts.length}`);
  for (const p of podcasts) {
    console.log(`  Podcast: ${p.title}`);
    const coverUrl = await fetchImage(`podcast cover art for ${p.title}`);
    if (coverUrl) {
      await db.podcast.update({ where: { id: p.id }, data: { coverUrl } });
      console.log(`    ✓ cover found`);
    } else {
      console.log(`    ✗ no cover found`);
    }
    await delay(3000);
  }

  // 6. Audiobooks
  const audiobooks = await db.audiobook.findMany({ where: { coverUrl: null } });
  console.log(`\nAudiobooks to fetch: ${audiobooks.length}`);
  for (const a of audiobooks) {
    const author = a.author ?? '';
    console.log(`  Audiobook: ${a.title} by ${author}`);
    const coverUrl = await fetchImage(`book cover for ${a.title} by ${author}`);
    if (coverUrl) {
      await db.audiobook.update({ where: { id: a.id }, data: { coverUrl } });
      console.log(`    ✓ cover found`);
    } else {
      console.log(`    ✗ no cover found`);
    }
    await delay(3000);
  }

  console.log('\n=== Done ===');
  const stats = {
    movies: await db.movie.count({ where: { NOT: { posterUrl: null } } }),
    shows: await db.tvShow.count({ where: { NOT: { posterUrl: null } } }),
    albums: await db.album.count({ where: { NOT: { coverUrl: null } } }),
    artists: await db.artist.count({ where: { NOT: { photoUrl: null } } }),
    podcasts: await db.podcast.count({ where: { NOT: { coverUrl: null } } }),
    audiobooks: await db.audiobook.count({ where: { NOT: { coverUrl: null } } }),
  };
  console.log('Items with artwork:', stats);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
