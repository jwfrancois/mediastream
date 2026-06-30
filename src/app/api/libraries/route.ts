// Library configuration API
// GET  /api/libraries       - list all libraries
// POST /api/libraries       - create a new library

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const VALID_TYPES = ['MOVIE', 'TV', 'MUSIC', 'PODCAST', 'AUDIOBOOK'];

export async function GET() {
  const libraries = await db.library.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          movies: true,
          tvShows: true,
          albums: true,
          podcasts: true,
          audiobooks: true,
        },
      },
    },
  });

  // For each library, also count episodes and tracks (nested under shows/albums)
  const result = await Promise.all(libraries.map(async (lib) => {
    let itemCount = 0;
    let episodeCount = 0;
    switch (lib.type) {
      case 'MOVIE': itemCount = lib._count.movies; break;
      case 'TV':
        itemCount = lib._count.tvShows;
        episodeCount = await db.episode.count({
          where: { season: { tvShow: { libraryId: lib.id } } },
        });
        break;
      case 'MUSIC':
        itemCount = lib._count.albums;
        episodeCount = await db.track.count({
          where: { album: { libraryId: lib.id } },
        });
        break;
      case 'PODCAST':
        itemCount = lib._count.podcasts;
        episodeCount = await db.podcastEpisode.count({
          where: { podcast: { libraryId: lib.id } },
        });
        break;
      case 'AUDIOBOOK': itemCount = lib._count.audiobooks; break;
    }
    return {
      id: lib.id,
      name: lib.name,
      type: lib.type,
      path: lib.path,
      lastScanAt: lib.lastScanAt,
      itemCount,
      episodeCount,
    };
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !body.name || !body.type || !body.path) {
    return NextResponse.json({ error: 'Missing required fields: name, type, path' }, { status: 400 });
  }
  if (!VALID_TYPES.includes(body.type)) {
    return NextResponse.json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
  }

  const library = await db.library.create({
    data: { name: body.name, type: body.type, path: body.path },
  });

  return NextResponse.json(library, { status: 201 });
}
