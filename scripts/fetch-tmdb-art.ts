// Fetch poster artwork using TMDB-style image URLs.
// Instead of using image-search (which is heavily rate-limited), this script
// uses the LLM to look up the TMDB poster path for each movie/show, then
// constructs the image URL directly from TMDB's CDN.
//
// TMDB image URL format:
//   https://image.tmdb.org/t/p/w500{poster_path}
//   https://image.tmdb.org/t/p/original{backdrop_path}
//
// Run with: bun run scripts/fetch-tmdb-art.ts

import { db } from '../src/lib/db';
import { callLLMWithRetry } from '../src/lib/llm-queue';

const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/original';

interface TMDBResult {
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  coverPath: string | null; // for albums/books
}

async function fetchTMDBPaths(titles: Array<{ id: string; title: string; year?: number | null; type: string }>): Promise<Map<string, { posterUrl?: string; backdropUrl?: string; coverUrl?: string }>> {
  const results = new Map<string, { posterUrl?: string; backdropUrl?: string; coverUrl?: string }>();

  // Process in batches of 8
  const BATCH = 8;
  for (let i = 0; i < titles.length; i += BATCH) {
    const batch = titles.slice(i, i + BATCH);
    const itemsList = batch.map((t, idx) => `${idx + 1}. id:"${t.id}" title:"${t.title}" year:${t.year ?? 'null'} type:${t.type}`).join('\n');

    const prompt = `For each of the following ${batch.length} media items, find the TMDB (The Movie Database) or Google Images poster path. Return ONLY a JSON array — no markdown, no commentary:

[
  { "id": "<id>", "posterPath": "/xxxxx.jpg" or null, "backdropPath": "/xxxxx.jpg" or null }
]

For movies and TV shows, use TMDB poster paths (they start with / and end with .jpg). For music albums, use the album cover image URL from the web (full URL). For audiobooks, use the book cover URL (full URL). For podcasts, use a relevant cover image URL (full URL).

Items:
${itemsList}

Return the JSON array now:`;

    try {
      const completion = await callLLMWithRetry(
        [
          { role: 'assistant', content: 'You are a media database expert. You know TMDB poster paths and album/book cover URLs. Return only valid JSON arrays.' },
          { role: 'user', content: prompt },
        ],
        undefined,
        2,
      );

      const raw = completion.choices[0]?.message?.content ?? '';
      // Extract JSON array
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) { console.warn('No JSON array in response'); continue; }
      const parsed = JSON.parse(match[0]) as Array<any>;

      for (const item of parsed) {
        const id = String(item.id ?? '');
        const entry: { posterUrl?: string; backdropUrl?: string; coverUrl?: string } = {};

        if (item.posterPath && typeof item.posterPath === 'string') {
          if (item.posterPath.startsWith('http')) {
            // Full URL (for albums/books/podcasts)
            entry.coverUrl = item.posterPath;
            entry.posterUrl = item.posterPath;
          } else if (item.posterPath.startsWith('/')) {
            // TMDB path
            entry.posterUrl = TMDB_IMG_BASE + item.posterPath;
          }
        }
        if (item.backdropPath && typeof item.backdropPath === 'string' && item.backdropPath.startsWith('/')) {
          entry.backdropUrl = TMDB_BACKDROP_BASE + item.backdropPath;
        }

        results.set(id, entry);
      }
    } catch (e) {
      console.error(`Batch failed:`, e);
    }

    // Delay between batches
    await new Promise(r => setTimeout(r, 3000));
  }

  return results;
}

async function main() {
  console.log('=== Fetching artwork via LLM + TMDB paths ===\n');

  // Collect all items needing artwork
  const movies = await db.movie.findMany({ where: { posterUrl: null }, select: { id: true, title: true, year: true } });
  const shows = await db.tvShow.findMany({ where: { posterUrl: null }, select: { id: true, title: true, year: true } });
  const albums = await db.album.findMany({ where: { coverUrl: null }, include: { artist: { select: { name: true } } } });
  const podcasts = await db.podcast.findMany({ where: { coverUrl: null }, select: { id: true, title: true } });
  const audiobooks = await db.audiobook.findMany({ where: { coverUrl: null }, select: { id: true, title: true, author: true } });

  console.log(`Movies: ${movies.length}, TV: ${shows.length}, Albums: ${albums.length}, Podcasts: ${podcasts.length}, Audiobooks: ${audiobooks.length}`);

  // Movies
  if (movies.length > 0) {
    console.log('\n--- Movies ---');
    const titles = movies.map(m => ({ id: m.id, title: m.title, year: m.year, type: 'movie' }));
    const artMap = await fetchTMDBPaths(titles);
    for (const m of movies) {
      const art = artMap.get(m.id);
      if (art?.posterUrl) {
        await db.movie.update({ where: { id: m.id }, data: { posterUrl: art.posterUrl, backdropUrl: art.backdropUrl } });
        console.log(`  ✓ ${m.title}`);
      } else {
        console.log(`  ✗ ${m.title} (no poster found)`);
      }
    }
  }

  // TV Shows
  if (shows.length > 0) {
    console.log('\n--- TV Shows ---');
    const titles = shows.map(s => ({ id: s.id, title: s.title, year: s.year, type: 'tv' }));
    const artMap = await fetchTMDBPaths(titles);
    for (const s of shows) {
      const art = artMap.get(s.id);
      if (art?.posterUrl) {
        await db.tvShow.update({ where: { id: s.id }, data: { posterUrl: art.posterUrl, backdropUrl: art.backdropUrl } });
        console.log(`  ✓ ${s.title}`);
      } else {
        console.log(`  ✗ ${s.title} (no poster found)`);
      }
    }
  }

  // Albums
  if (albums.length > 0) {
    console.log('\n--- Albums ---');
    const titles = albums.map(a => ({ id: a.id, title: `${a.title} by ${a.artist?.name ?? ''}`, year: undefined, type: 'album' }));
    const artMap = await fetchTMDBPaths(titles);
    for (const a of albums) {
      const art = artMap.get(a.id);
      if (art?.coverUrl) {
        await db.album.update({ where: { id: a.id }, data: { coverUrl: art.coverUrl } });
        console.log(`  ✓ ${a.title}`);
      } else {
        console.log(`  ✗ ${a.title} (no cover found)`);
      }
    }
  }

  // Podcasts
  if (podcasts.length > 0) {
    console.log('\n--- Podcasts ---');
    const titles = podcasts.map(p => ({ id: p.id, title: p.title, year: undefined, type: 'podcast' }));
    const artMap = await fetchTMDBPaths(titles);
    for (const p of podcasts) {
      const art = artMap.get(p.id);
      if (art?.coverUrl) {
        await db.podcast.update({ where: { id: p.id }, data: { coverUrl: art.coverUrl } });
        console.log(`  ✓ ${p.title}`);
      } else {
        console.log(`  ✗ ${p.title} (no cover found)`);
      }
    }
  }

  // Audiobooks
  if (audiobooks.length > 0) {
    console.log('\n--- Audiobooks ---');
    const titles = audiobooks.map(a => ({ id: a.id, title: `${a.title} by ${a.author ?? ''}`, year: undefined, type: 'book' }));
    const artMap = await fetchTMDBPaths(titles);
    for (const a of audiobooks) {
      const art = artMap.get(a.id);
      if (art?.coverUrl) {
        await db.audiobook.update({ where: { id: a.id }, data: { coverUrl: art.coverUrl } });
        console.log(`  ✓ ${a.title}`);
      } else {
        console.log(`  ✗ ${a.title} (no cover found)`);
      }
    }
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

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
