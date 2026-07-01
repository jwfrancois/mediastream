// Artwork fetching API
// POST /api/fetch-art
//
// Takes a batch of media items and uses z-ai image-search to find real
// poster art, backdrops, cast photos, and artist photos. Also uses the
// LLM to generate filmographies/discographies for actors and artists.
//
// Request body:
//   { type: "MOVIE"|"TV"|"MUSIC"|"PODCAST"|"AUDIOBOOK",
//     items: [{ id, title, year?, genre?, director?, cast?, artist?, album?, author?, podcastTitle? }] }
// Response:
//   { items: [{ id, posterUrl?, backdropUrl?, castPhotos?, artistPhotoUrl?, filmography? }] }

import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import ZAI from 'z-ai-web-dev-sdk';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const execFileAsync = promisify(execFile);

interface FetchArtRequestItem {
  id: string;
  title: string;
  year?: number;
  genre?: string;
  director?: string;
  cast?: string[];
  artist?: string;
  album?: string;
  author?: string;
  podcastTitle?: string;
  mediaType?: string; // 'movie' | 'episode' | 'track' | 'podcast-episode' | 'audiobook'
}

interface FetchArtResponseItem {
  id: string;
  posterUrl?: string;
  backdropUrl?: string;
  castPhotos?: string[];
  artistPhotoUrl?: string;
  filmography?: Array<{ title: string; year?: number; role?: string }>;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !body.type || !Array.isArray(body.items)) {
    return NextResponse.json({ error: 'Missing "type" or "items" array' }, { status: 400 });
  }

  const { type, items } = body as { type: string; items: FetchArtRequestItem[] };

  if (items.length === 0) {
    return NextResponse.json({ items: [] });
  }

  // Process in small batches to avoid timeouts
  const batch = items.slice(0, 5);
  const results: FetchArtResponseItem[] = [];

  for (const item of batch) {
    try {
      const result = await fetchArtForItem(item, type);
      results.push(result);
    } catch (e) {
      console.error(`Art fetch failed for ${item.title}:`, e);
      results.push({ id: item.id });
    }
  }

  return NextResponse.json({ items: results });
}

async function fetchArtForItem(item: FetchArtRequestItem, type: string): Promise<FetchArtResponseItem> {
  const result: FetchArtResponseItem = { id: item.id };

  // Build the appropriate search queries based on media type
  const isMovie = type === 'MOVIE' || item.mediaType === 'movie';
  const isTV = type === 'TV' || item.mediaType === 'episode';
  const isMusic = type === 'MUSIC' || item.mediaType === 'track';
  const isPodcast = type === 'PODCAST' || item.mediaType === 'podcast-episode';
  const isAudiobook = type === 'AUDIOBOOK' || item.mediaType === 'audiobook';

  try {
    if (isMovie || isTV) {
      // Fetch poster
      const yearStr = item.year ? ` ${item.year}` : '';
      const posterQuery = `${isTV ? 'TV show' : 'movie'} poster for ${item.title}${yearStr}`;
      result.posterUrl = await fetchImage(posterQuery, 3);

      // Fetch backdrop
      const backdropQuery = `${isTV ? 'TV show' : 'movie'} still scene from ${item.title}${yearStr}`;
      result.backdropUrl = await fetchImage(backdropQuery, 2);

      // Fetch cast photos (up to 5)
      if (item.cast && item.cast.length > 0) {
        const castPhotos: string[] = [];
        for (const actor of item.cast.slice(0, 5)) {
          const photoUrl = await fetchImage(`${actor} actor portrait photo`, 2);
          if (photoUrl) castPhotos.push(photoUrl);
        }
        if (castPhotos.length > 0) result.castPhotos = castPhotos;
      }

      // Fetch filmography for the director
      if (item.director) {
        result.filmography = await fetchFilmography(item.director, 'Director');
      }
    } else if (isMusic) {
      // Fetch album cover
      const albumTitle = item.album || item.title;
      const artist = item.artist || '';
      const albumQuery = `album cover for ${albumTitle} by ${artist}`;
      result.posterUrl = await fetchImage(albumQuery, 3);

      // Fetch artist photo
      if (artist) {
        const artistQuery = `${artist} musician portrait photo`;
        result.artistPhotoUrl = await fetchImage(artistQuery, 2);
        // Fetch discography
        result.filmography = await fetchFilmography(artist, 'Artist');
      }
    } else if (isPodcast) {
      const podTitle = item.podcastTitle || item.title;
      result.posterUrl = await fetchImage(`podcast cover art for ${podTitle}`, 3);
    } else if (isAudiobook) {
      const author = item.author || '';
      const bookQuery = `book cover for ${item.title} by ${author}`;
      result.posterUrl = await fetchImage(bookQuery, 3);

      if (author) {
        result.artistPhotoUrl = await fetchImage(`${author} author portrait photo`, 2);
        result.filmography = await fetchFilmography(author, 'Author');
      }
    }
  } catch (e) {
    console.error(`Error fetching art for ${item.title}:`, e);
  }

  return result;
}

// Call z-ai image-search CLI and return the first result URL
async function fetchImage(query: string, count: number = 3): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('z-ai', [
      'image-search',
      '-q', query,
      '-c', String(count),
      '--gl', 'us',
      '--no-rank',
    ], { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });

    const data = JSON.parse(stdout);
    if (!data.success || !data.results || data.results.length === 0) {
      return null;
    }
    return data.results[0].original_url;
  } catch (e) {
    console.error(`Image search failed for "${query}":`, e);
    return null;
  }
}

// Use the LLM to generate a filmography or discography
async function fetchFilmography(name: string, role: string): Promise<Array<{ title: string; year?: number; role?: string }>> {
  try {
    const zai = await ZAI.create();
    const prompt = role === 'Artist'
      ? `List 5 notable albums by ${name}. Return ONLY a JSON array: [{"title":"album name","year":2020,"role":"Album"}]. No markdown, no commentary.`
      : role === 'Author'
      ? `List 5 notable books by ${name}. Return ONLY a JSON array: [{"title":"book title","year":2020,"role":"Book"}]. No markdown, no commentary.`
      : `List 5 notable films by ${name} (${role}). Return ONLY a JSON array: [{"title":"film title","year":2020,"role":"${role}"}]. No markdown, no commentary.`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: 'You are a media database expert. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      thinking: { type: 'disabled' },
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    // Extract JSON array from the response
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 8).map((item: any) => ({
      title: String(item.title ?? ''),
      year: typeof item.year === 'number' ? item.year : undefined,
      role: String(item.role ?? role),
    })).filter((item: any) => item.title);
  } catch (e) {
    console.error(`Filmography fetch failed for ${name}:`, e);
    return [];
  }
}
