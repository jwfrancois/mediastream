// Upsert playback progress
// PUT /api/progress/[mediaType]/[mediaId]
// Body: { position: number, duration?: number, completed?: boolean }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const VALID_TYPES = ['MOVIE', 'EPISODE', 'TRACK', 'PODCAST_EPISODE', 'AUDIOBOOK'];

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ mediaType: string; mediaId: string }> },
) {
  const { mediaType, mediaId } = await params;

  if (!VALID_TYPES.includes(mediaType)) {
    return NextResponse.json({ error: 'Invalid mediaType' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.position !== 'number') {
    return NextResponse.json({ error: 'Missing "position" field' }, { status: 400 });
  }

  // Determine the total duration if not provided
  let duration = body.duration ?? null;
  if (duration == null) {
    switch (mediaType) {
      case 'MOVIE': duration = (await db.movie.findUnique({ where: { id: mediaId }, select: { duration: true } }))?.duration ?? null; break;
      case 'EPISODE': duration = (await db.episode.findUnique({ where: { id: mediaId }, select: { duration: true } }))?.duration ?? null; break;
      case 'TRACK': duration = (await db.track.findUnique({ where: { id: mediaId }, select: { duration: true } }))?.duration ?? null; break;
      case 'PODCAST_EPISODE': duration = (await db.podcastEpisode.findUnique({ where: { id: mediaId }, select: { duration: true } }))?.duration ?? null; break;
      case 'AUDIOBOOK': duration = (await db.audiobook.findUnique({ where: { id: mediaId }, select: { duration: true } }))?.duration ?? null; break;
    }
  }

  const completed = body.completed ?? (duration != null && body.position >= duration * 0.95);

  const progress = await db.watchProgress.upsert({
    where: { mediaType_mediaId: { mediaType, mediaId } },
    update: {
      position: body.position,
      duration,
      completed,
      updatedAt: new Date(),
    },
    create: {
      mediaType,
      mediaId,
      position: body.position,
      duration,
      completed,
    },
  });

  return NextResponse.json(progress);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ mediaType: string; mediaId: string }> },
) {
  const { mediaType, mediaId } = await params;
  try {
    await db.watchProgress.delete({
      where: { mediaType_mediaId: { mediaType, mediaId } },
    });
  } catch {
    // ignore not found
  }
  return NextResponse.json({ success: true });
}
