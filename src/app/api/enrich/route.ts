// Metadata enrichment API
// POST /api/enrich
//
// Takes a batch of local media items and uses the z-ai-web-dev-sdk LLM to
// fill in rich metadata. Different media types get different prompts:
//   - MOVIE: plot, genre, year, director, cast, rating, collection grouping
//   - TV: show-level plot, genre, year, cast, rating
//   - MUSIC: album description/genre/year + artist bio/genre
//   - PODCAST: show description, host, genre
//   - AUDIOBOOK: synopsis, author bio, genre, year, rating

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

interface EnrichRequestItem {
  id: string;
  title: string;
  year?: number;
  showTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  album?: string;
  artist?: string;
  podcastTitle?: string;
  author?: string;
  narrator?: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !body.type || !Array.isArray(body.items)) {
    return NextResponse.json({ error: 'Missing "type" or "items" array' }, { status: 400 });
  }

  const { type, items } = body as { type: string; items: EnrichRequestItem[] };

  if (!['MOVIE', 'TV', 'AUDIOBOOK', 'MUSIC', 'PODCAST'].includes(type)) {
    return NextResponse.json({ error: `Invalid type: ${type}` }, { status: 400 });
  }

  if (items.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const batch = items.slice(0, 15);

  try {
    const zai = await ZAI.create();
    const systemPrompt = buildSystemPrompt(type);
    const userPrompt = buildUserPrompt(type, batch);

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    });

    const rawResponse = completion.choices[0]?.message?.content ?? '';
    const parsed = parseJsonResponse(rawResponse);

    if (!parsed || !Array.isArray(parsed.items)) {
      return NextResponse.json(
        { error: 'LLM returned malformed response', raw: rawResponse.slice(0, 500) },
        { status: 502 },
      );
    }

    // Validate and normalize — pass through all fields the LLM returns
    const enriched = parsed.items.map((item: any) => ({
      id: String(item.id ?? ''),
      title: String(item.title ?? ''),
      plot: item.plot ? String(item.plot) : undefined,
      genre: item.genre ? String(item.genre) : undefined,
      year: typeof item.year === 'number' ? item.year : undefined,
      director: item.director ? String(item.director) : undefined,
      cast: Array.isArray(item.cast) ? item.cast.map(String) : undefined,
      rating: typeof item.rating === 'number' ? Math.max(0, Math.min(10, item.rating)) : undefined,
      collection: item.collection ? String(item.collection) : undefined,
      collectionOrder: typeof item.collectionOrder === 'number' ? item.collectionOrder : undefined,
      // Music fields
      albumDescription: item.albumDescription ? String(item.albumDescription) : undefined,
      albumGenre: item.albumGenre ? String(item.albumGenre) : undefined,
      albumYear: typeof item.albumYear === 'number' ? item.albumYear : undefined,
      artistBio: item.artistBio ? String(item.artistBio) : undefined,
      artistGenre: item.artistGenre ? String(item.artistGenre) : undefined,
      // Podcast fields
      podcastDescription: item.podcastDescription ? String(item.podcastDescription) : undefined,
      podcastAuthor: item.podcastAuthor ? String(item.podcastAuthor) : undefined,
      podcastGenre: item.podcastGenre ? String(item.podcastGenre) : undefined,
      // Audiobook fields
      authorBio: item.authorBio ? String(item.authorBio) : undefined,
      bookSynopsis: item.bookSynopsis ? String(item.bookSynopsis) : undefined,
    }));

    return NextResponse.json({ items: enriched });
  } catch (e) {
    console.error('Enrichment failed:', e);
    return NextResponse.json(
      { error: 'Enrichment failed', details: (e as Error).message },
      { status: 500 },
    );
  }
}

function buildSystemPrompt(type: string): string {
  const jsonFormat = `Respond with ONLY valid JSON — no markdown fences, no commentary. Must be parseable by JSON.parse(). The format:
{
  "items": [ { ...fields... } ]
}`;

  switch (type) {
    case 'MOVIE':
      return `You are a film metadata expert. Given movie titles parsed from filenames, return accurate metadata. ${jsonFormat}
Each item: { "id", "title", "plot" (1-2 sentences), "genre", "year", "director", "cast" (array of 3-5 actors), "rating" (0-10), "collection" (franchise name or null), "collectionOrder" (1-based viewing order or null) }
Group sequels/franchises into collections (e.g. "Harry Potter Collection", "Star Wars Saga"). Set collection to null for standalone films.`;

    case 'TV':
      return `You are a TV metadata expert. Given episode entries (with showTitle), return show-level metadata. ${jsonFormat}
Each item: { "id", "title" (episode title), "plot" (episode summary), "genre", "year" (show's first year), "director", "cast" (array), "rating" (0-10) }
Provide plot at the episode level, but genre/year/cast/rating at the show level (same for all episodes of the same show).`;

    case 'MUSIC':
      return `You are a music metadata expert. Given album and artist names parsed from folder structure, return rich metadata. ${jsonFormat}
Each item: { "id", "title" (album or artist name), "albumDescription" (2-3 sentence review/description of the album's style and significance), "albumGenre", "albumYear", "artistBio" (3-4 sentence biography of the artist — their origin, style, career highlights), "artistGenre" }
If the input has both album and artist, provide both albumDescription and artistBio. If only artist is available, focus on artistBio. Be evocative and informative — write like a music journalist.`;

    case 'PODCAST':
      return `You are a podcast metadata expert. Given podcast show names, return rich show metadata. ${jsonFormat}
Each item: { "id", "title" (show name), "podcastDescription" (3-4 sentence description of the show's topic, format, and appeal), "podcastAuthor" (the host's name if known), "podcastGenre" }
Be descriptive and engaging — help the listener understand what the show is about and why they should listen.`;

    case 'AUDIOBOOK':
      return `You are a book metadata expert. Given audiobook titles and authors, return rich metadata. ${jsonFormat}
Each item: { "id", "title", "bookSynopsis" (3-4 sentence synopsis of the book's plot and themes), "genre", "year", "authorBio" (2-3 sentence biography of the author), "rating" (0-10, null if unknown) }
Be evocative — write like a book review. Include the book's significance and appeal.`;

    default:
      return `You are a metadata expert. ${jsonFormat}`;
  }
}

function buildUserPrompt(type: string, items: EnrichRequestItem[]): string {
  const label =
    type === 'MOVIE' ? 'movies' :
    type === 'TV' ? 'TV episodes' :
    type === 'MUSIC' ? 'albums/artists' :
    type === 'PODCAST' ? 'podcasts' :
    type === 'AUDIOBOOK' ? 'audiobooks' : 'items';

  const formatted = items.map((item, i) => {
    const parts = [`id: "${item.id}"`];
    if (type === 'MUSIC') {
      if (item.album) parts.push(`album: "${item.album}"`);
      if (item.artist) parts.push(`artist: "${item.artist}"`);
    } else if (type === 'PODCAST') {
      parts.push(`podcast: "${item.podcastTitle ?? item.title}"`);
    } else if (type === 'AUDIOBOOK') {
      parts.push(`title: "${item.title}"`);
      if (item.author) parts.push(`author: "${item.author}"`);
      if (item.narrator) parts.push(`narrator: "${item.narrator}"`);
    } else {
      parts.push(`title: "${item.title}"`);
      if (item.year) parts.push(`year: ${item.year}`);
      if (type === 'TV' && item.showTitle) {
        parts.push(`showTitle: "${item.showTitle}"`);
        parts.push(`season: ${item.seasonNumber ?? '?'}`);
        parts.push(`episode: ${item.episodeNumber ?? '?'}`);
      }
    }
    return `  ${i + 1}. { ${parts.join(', ')} }`;
  }).join('\n');

  return `Here are ${items.length} ${label} from a user's library. Return JSON metadata for each. Preserve the "id" field exactly.\n\n[\n${formatted}\n]`;
}

function parseJsonResponse(raw: string): { items: any[] } | null {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
