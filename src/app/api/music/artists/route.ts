// Artists browse API
// GET /api/music/artists

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const artists = await db.artist.findMany({
    orderBy: { sortName: 'asc' },
    include: {
      _count: { select: { albums: true, tracks: true } },
    },
  });

  return NextResponse.json({
    items: artists.map((a) => ({
      id: a.id,
      name: a.name,
      imageColor: a.imageColor,
      bio: a.bio,
      albumCount: a._count.albums,
      trackCount: a._count.tracks,
    })),
  });
}
