// Audiobook detail API
// GET /api/audiobooks/[id]

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const audiobook = await db.audiobook.findUnique({
    where: { id },
    include: { library: { select: { name: true } } },
  });

  if (!audiobook) {
    return NextResponse.json({ error: 'Audiobook not found' }, { status: 404 });
  }

  const progress = await db.watchProgress.findUnique({
    where: { mediaType_mediaId: { mediaType: 'AUDIOBOOK', mediaId: id } },
  });

  // More by same author
  const more = audiobook.author
    ? await db.audiobook.findMany({
        where: { author: audiobook.author, NOT: { id: audiobook.id } },
        take: 6,
        orderBy: { year: 'desc' },
        select: {
          id: true, title: true, author: true, narrator: true,
          year: true, genre: true, coverColor: true, duration: true,
        },
      })
    : [];

  return NextResponse.json({
    ...audiobook,
    progress: progress ? {
      position: progress.position,
      duration: progress.duration,
      completed: progress.completed,
      updatedAt: progress.updatedAt,
    } : null,
    more,
  });
}
