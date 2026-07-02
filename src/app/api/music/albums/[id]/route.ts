// Album detail with full track list
// GET /api/music/albums/[id]

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const album = await db.album.findUnique({
    where: { id },
    include: {
      artist: true,
      tracks: {
        orderBy: { trackNumber: 'asc' },
      },
    },
  });

  if (!album) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 });
  }

  // Get track progress
  const trackIds = album.tracks.map((t) => t.id);
  const progressRecords = await db.watchProgress.findMany({
    where: { mediaType: 'TRACK', mediaId: { in: trackIds } },
  });
  const progressMap = new Map(progressRecords.map((p) => [p.mediaId, p]));

  // Other albums by the same artist
  const otherAlbums = album.artistId
    ? await db.album.findMany({
        where: { artistId: album.artistId, NOT: { id: album.id } },
        orderBy: { year: 'desc' },
        take: 6,
        include: { _count: { select: { tracks: true } } },
      })
    : [];

  return NextResponse.json({
    ...album,
    tracks: album.tracks.map((t) => {
      const p = progressMap.get(t.id);
      return {
        ...t,
        progress: p ? {
          position: p.position,
          duration: p.duration,
          completed: p.completed,
        } : null,
      };
    }),
    otherAlbums,
  });
}
