// Fetch poster artwork using the LLM directly (bypassing the queue) to look up
// TMDB poster paths. The LLM knows TMDB paths for well-known movies/shows.
// Run with: bun run scripts/fetch-art-direct.ts

import { db } from '../src/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/original';

let zaiInstance: any = null;
async function getZai() {
  if (!zaiInstance) zaiInstance = await ZAI.create();
  return zaiInstance;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function llmCall(messages: Array<{ role: string; content: string }>, retries = 3): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const zai = await getZai();
      const completion = await zai.chat.completions.create({
        messages: messages as any,
        thinking: { type: 'disabled' },
      });
      return completion.choices[0]?.message?.content ?? '';
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('429') && attempt < retries) {
        const wait = 20000 * (attempt + 1);
        console.warn(`  Rate limited, waiting ${wait/1000}s...`);
        await delay(wait);
        continue;
      }
      throw e;
    }
  }
  throw new Error('LLM call failed');
}

async function processBatch(items: Array<{ id: string; title: string; year?: number | null; type: string }>): Promise<Map<string, { posterUrl?: string; backdropUrl?: string; coverUrl?: string }>> {
  const results = new Map<string, { posterUrl?: string; backdropUrl?: string; coverUrl?: string }>();
  const itemsList = items.map((t, i) => `${i+1}. id:"${t.id}" title:"${t.title}" year:${t.year ?? 'null'} type:${t.type}`).join('\n');

  const prompt = `For each media item below, provide the TMDB poster path (starts with / ends with .jpg) or a full image URL. Return ONLY a JSON array:
[{"id":"<id>","posterPath":"/xxx.jpg" or "https://..." or null,"backdropPath":"/xxx.jpg" or null}]

Items:
${itemsList}

For movies/TV: use TMDB paths. For albums/books/podcasts: use full image URLs. Return the array:`;

  try {
    const raw = await llmCall([
      { role: 'assistant', content: 'You are a media database expert. Return only valid JSON arrays.' },
      { role: 'user', content: prompt },
    ]);
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return results;
    const parsed = JSON.parse(match[0]) as any[];
    for (const item of parsed) {
      const id = String(item.id ?? '');
      const entry: any = {};
      if (item.posterPath && typeof item.posterPath === 'string') {
        if (item.posterPath.startsWith('http')) {
          entry.coverUrl = item.posterPath;
          entry.posterUrl = item.posterPath;
        } else if (item.posterPath.startsWith('/')) {
          entry.posterUrl = TMDB_IMG_BASE + item.posterPath;
        }
      }
      if (item.backdropPath && typeof item.backdropPath === 'string' && item.backdropPath.startsWith('/')) {
        entry.backdropUrl = TMDB_BACKDROP_BASE + item.backdropPath;
      }
      results.set(id, entry);
    }
  } catch (e) {
    console.error('  Batch failed:', e);
  }
  return results;
}

async function main() {
  console.log('=== Fetching artwork via LLM (direct) ===\n');

  const movies = await db.movie.findMany({ where: { posterUrl: null }, select: { id: true, title: true, year: true } });
  const shows = await db.tvShow.findMany({ where: { posterUrl: null }, select: { id: true, title: true, year: true } });
  const albums = await db.album.findMany({ where: { coverUrl: null }, include: { artist: { select: { name: true } } } });
  const podcasts = await db.podcast.findMany({ where: { coverUrl: null }, select: { id: true, title: true } });
  const audiobooks = await db.audiobook.findMany({ where: { coverUrl: null }, select: { id: true, title: true, author: true } });

  console.log(`Movies: ${movies.length}, TV: ${shows.length}, Albums: ${albums.length}, Podcasts: ${podcasts.length}, Audiobooks: ${audiobooks.length}`);

  // Movies — batch of 6
  if (movies.length > 0) {
    console.log('\n--- Movies ---');
    for (let i = 0; i < movies.length; i += 6) {
      const batch = movies.slice(i, i + 6);
      const titles = batch.map(m => ({ id: m.id, title: m.title, year: m.year, type: 'movie' }));
      const artMap = await processBatch(titles);
      for (const m of batch) {
        const art = artMap.get(m.id);
        if (art?.posterUrl) {
          await db.movie.update({ where: { id: m.id }, data: { posterUrl: art.posterUrl, backdropUrl: art.backdropUrl } });
          console.log(`  ✓ ${m.title}`);
        } else { console.log(`  ✗ ${m.title}`); }
      }
      await delay(5000);
    }
  }

  // TV Shows
  if (shows.length > 0) {
    console.log('\n--- TV Shows ---');
    const titles = shows.map(s => ({ id: s.id, title: s.title, year: s.year, type: 'tv' }));
    const artMap = await processBatch(titles);
    for (const s of shows) {
      const art = artMap.get(s.id);
      if (art?.posterUrl) {
        await db.tvShow.update({ where: { id: s.id }, data: { posterUrl: art.posterUrl, backdropUrl: art.backdropUrl } });
        console.log(`  ✓ ${s.title}`);
      } else { console.log(`  ✗ ${s.title}`); }
    }
  }

  // Albums
  if (albums.length > 0) {
    console.log('\n--- Albums ---');
    for (let i = 0; i < albums.length; i += 6) {
      const batch = albums.slice(i, i + 6);
      const titles = batch.map(a => ({ id: a.id, title: `${a.title} by ${a.artist?.name ?? ''}`, year: undefined, type: 'album' }));
      const artMap = await processBatch(titles);
      for (const a of batch) {
        const art = artMap.get(a.id);
        if (art?.coverUrl) {
          await db.album.update({ where: { id: a.id }, data: { coverUrl: art.coverUrl } });
          console.log(`  ✓ ${a.title}`);
        } else { console.log(`  ✗ ${a.title}`); }
      }
      await delay(5000);
    }
  }

  // Podcasts
  if (podcasts.length > 0) {
    console.log('\n--- Podcasts ---');
    const titles = podcasts.map(p => ({ id: p.id, title: p.title, year: undefined, type: 'podcast' }));
    const artMap = await processBatch(titles);
    for (const p of podcasts) {
      const art = artMap.get(p.id);
      if (art?.coverUrl) {
        await db.podcast.update({ where: { id: p.id }, data: { coverUrl: art.coverUrl } });
        console.log(`  ✓ ${p.title}`);
      } else { console.log(`  ✗ ${p.title}`); }
    }
  }

  // Audiobooks
  if (audiobooks.length > 0) {
    console.log('\n--- Audiobooks ---');
    for (let i = 0; i < audiobooks.length; i += 6) {
      const batch = audiobooks.slice(i, i + 6);
      const titles = batch.map(a => ({ id: a.id, title: `${a.title} by ${a.author ?? ''}`, year: undefined, type: 'book' }));
      const artMap = await processBatch(titles);
      for (const a of batch) {
        const art = artMap.get(a.id);
        if (art?.coverUrl) {
          await db.audiobook.update({ where: { id: a.id }, data: { coverUrl: art.coverUrl } });
          console.log(`  ✓ ${a.title}`);
        } else { console.log(`  ✗ ${a.title}`); }
      }
      await delay(5000);
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

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
