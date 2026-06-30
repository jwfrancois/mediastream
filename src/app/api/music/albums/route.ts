// Albums browse API
// GET /api/music/albums?sort=recent|title|artist&limit=50

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sort = url.searchParams.get('sort') ?? 'recent';
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 500);
  const artistId = url.searchParams.get('artistId');

  const where = artistId ? { artistId } : {};

  const orderBy =
    sort === 'title' ? { sortTitle: 'asc' as const } :
    sort === 'artist' ? { artist: { sortName: 'asc' as const } } :
    { addedAt: 'desc' as const };

  const [albums, total] = await Promise.all([
    db.album.findMany({
      where,
      orderBy,
      take: limit,
      include: {
        artist: { select: { id: true, name: true, imageColor: true } },
        _count: { select: { tracks: true } },
      },
    }),
    db.album.count({ where }),
  ]);

  return NextResponse.json({
    items: albums.map((a) => ({
      id: a.id,
      title: a.title,
      year: a.year,
      genre: a.genre,
      coverColor: a.coverColor,
      addedAt: a.addedAt,
      artist: a.artist,
      trackCount: a._count.tracks,
    })),
    total,
  });
}
