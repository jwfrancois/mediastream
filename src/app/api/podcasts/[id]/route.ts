// Podcast detail with all episodes
// GET /api/podcasts/[id]

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const podcast = await db.podcast.findUnique({
    where: { id },
    include: {
      episodes: {
        orderBy: { episodeNumber: 'desc' },
      },
    },
  });

  if (!podcast) {
    return NextResponse.json({ error: 'Podcast not found' }, { status: 404 });
  }

  // Get progress for all episodes
  const episodeIds = podcast.episodes.map((e) => e.id);
  const progressRecords = await db.watchProgress.findMany({
    where: { mediaType: 'PODCAST_EPISODE', mediaId: { in: episodeIds } },
  });
  const progressMap = new Map(progressRecords.map((p) => [p.mediaId, p]));

  // Other podcasts by the same author
  const otherPodcasts = podcast.author
    ? await db.podcast.findMany({
        where: { author: podcast.author, NOT: { id: podcast.id } },
        take: 4,
        include: { _count: { select: { episodes: true } } },
      })
    : [];

  return NextResponse.json({
    ...podcast,
    episodes: podcast.episodes.map((e) => {
      const p = progressMap.get(e.id);
      return {
        ...e,
        progress: p ? {
          position: p.position,
          duration: p.duration,
          completed: p.completed,
        } : null,
      };
    }),
    otherPodcasts,
  });
}
