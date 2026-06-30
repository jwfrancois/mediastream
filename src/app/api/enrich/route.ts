// Metadata enrichment API
// POST /api/enrich
//
// Takes a batch of local media items (titles + media type) and uses the
// z-ai-web-dev-sdk LLM to:
//   - Fill in missing metadata (plot, genre, year, director, cast, rating)
//   - Group movies that are part of the same franchise/sequel series into
//     collections (e.g. "Harry Potter Collection") with a viewing order
//
// This runs server-side because z-ai-web-dev-sdk is backend-only. The
// browser sends the titles; the server calls the LLM and returns enriched
// metadata. File contents never leave the browser.
//
// Request body:
//   { type: "MOVIE" | "TV" | "AUDIOBOOK", items: [{ id, title, year? }] }
// Response:
//   { items: [{ id, title, plot?, genre?, year?, director?, cast?, rating?,
//               collection?, collectionOrder? }] }

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // keep under gateway/ALB timeout

interface EnrichRequestItem {
  id: string;
  title: string;
  year?: number;
  showTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

interface EnrichResponseItem {
  id: string;
  title: string;
  plot?: string;
  genre?: string;
  year?: number;
  director?: string;
  cast?: string[];
  rating?: number;
  collection?: string;
  collectionOrder?: number;
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

  // Cap batch size server-side as a safety net
  const batch = items.slice(0, 15);

  try {
    const zai = await ZAI.create();

    // Build the prompt based on media type
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

    // Parse the JSON response (the LLM may wrap it in markdown fences)
    const parsed = parseJsonResponse(rawResponse);

    if (!parsed || !Array.isArray(parsed.items)) {
      return NextResponse.json(
        { error: 'LLM returned malformed response', raw: rawResponse.slice(0, 500) },
        { status: 502 },
      );
    }

    // Validate and normalize each item
    const enriched: EnrichResponseItem[] = parsed.items.map((item: any) => ({
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
  const base = `You are a media metadata expert. You are given a list of ${type === 'MOVIE' ? 'movies' : type === 'TV' ? 'TV show episodes' : type === 'AUDIOBOOK' ? 'audiobooks' : 'media items'} (parsed from filenames on a user's computer) and you must return accurate metadata for each one.

Respond with ONLY valid JSON — no markdown fences, no commentary, no preamble. The response must be parseable by JSON.parse().

The response format must be:
{
  "items": [
    {
      "id": "<the original id verbatim>",
      "title": "<cleaned-up proper title>",
      "plot": "<1-2 sentence plot summary>",
      "genre": "<primary genre>",
      "year": <number or null>,
      "director": "<director name or null>",
      "cast": ["<actor 1>", "<actor 2>", "<actor 3>"],
      "rating": <0-10 number or null>,
      "collection": "<franchise/collection name if part of a series, else null>",
      "collectionOrder": <1-based viewing order within the collection, or null>
    }
  ]
}`;

  const collectionGuidance = type === 'MOVIE'
    ? `\n\nIMPORTANT for collections: If a movie is part of a franchise, sequel series, or saga (e.g. Harry Potter, Lord of the Rings, Star Wars, Marvel, James Bond, Toy Story, The Godfather, Jurassic Park, etc.), set "collection" to a consistent collection name like "Harry Potter Collection" or "The Lord of the Rings Trilogy". Set "collectionOrder" to the chronological viewing order within that collection (1 = first installment). Movies that are NOT part of any franchise should have "collection": null and "collectionOrder": null. Be generous with collection grouping — even loosely connected sequels (e.g. "Die Hard 2", "Die Hard: With a Vengeance") belong to the same collection.`
    : '';

  const titleGuidance = type === 'TV'
    ? `\n\nFor TV episodes, "title" should be the episode's proper title. Use "showTitle" from the input to identify the show. Provide plot/genre/year/director/cast/rating at the SHOW level (same for all episodes of the same show).`
    : '';

  return base + collectionGuidance + titleGuidance + `\n\nIf you don't recognize a title, do your best to infer reasonable metadata from the title alone, and set "collection" to null. Never invent a collection for a standalone movie.`;
}

function buildUserPrompt(type: string, items: EnrichRequestItem[]): string {
  const formatted = items.map((item, i) => {
    const parts = [`id: "${item.id}"`, `title: "${item.title}"`];
    if (item.year) parts.push(`year: ${item.year}`);
    if (type === 'TV' && item.showTitle) {
      parts.push(`showTitle: "${item.showTitle}"`);
      parts.push(`season: ${item.seasonNumber ?? '?'}`);
      parts.push(`episode: ${item.episodeNumber ?? '?'}`);
    }
    return `  ${i + 1}. { ${parts.join(', ')} }`;
  }).join('\n');

  return `Here are ${items.length} ${type === 'MOVIE' ? 'movies' : type === 'TV' ? 'TV episodes' : type === 'AUDIOBOOK' ? 'audiobooks' : 'items'} scraped from filenames. Return the JSON metadata for each one. Preserve the "id" field exactly as given.\n\n[\n${formatted}\n]`;
}

// Extract JSON from a possibly-fenced LLM response
function parseJsonResponse(raw: string): { items: any[] } | null {
  let text = raw.trim();
  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }
  // Find the first { ... } block
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  const jsonStr = text.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}
