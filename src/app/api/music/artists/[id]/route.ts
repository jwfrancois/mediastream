// Artist detail with all their albums
// GET /api/music/artists/[id]

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const artist = await db.artist.findUnique({
    where: { id },
    include: {
      albums: {
        orderBy: { year: 'desc' },
        include: { _count: { select: { tracks: true } } },
      },
    },
  });

  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
  }

  return NextResponse.json(artist);
}
