// TV Show detail API with seasons and episodes
// GET /api/tv/[id]

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const seasonParam = url.searchParams.get('season');

  const show = await db.tvShow.findUnique({
    where: { id },
    include: {
      library: { select: { name: true } },
      seasons: {
        orderBy: { seasonNumber: 'asc' },
        include: {
          episodes: {
            orderBy: { episodeNumber: 'asc' },
          },
        },
      },
    },
  });

  if (!show) {
    return NextResponse.json({ error: 'TV show not found' }, { status: 404 });
  }

  // Get progress for all episodes in one query
  const allEpisodeIds = show.seasons.flatMap((s) => s.episodes.map((e) => e.id));
  const progressRecords = await db.watchProgress.findMany({
    where: {
      mediaType: 'EPISODE',
      mediaId: { in: allEpisodeIds },
    },
  });
  const progressMap = new Map(progressRecords.map((p) => [p.mediaId, p]));

  // Get similar shows
  const similar = show.genre
    ? await db.tvShow.findMany({
        where: { genre: show.genre, NOT: { id: show.id } },
        take: 6,
        orderBy: { rating: 'desc' },
        select: {
          id: true, title: true, year: true, genre: true,
          rating: true, posterColor: true, plot: true, addedAt: true,
        },
      })
    : [];

  // If season param is provided, return only that season's episodes prominently
  let selectedSeason = null;
  if (seasonParam) {
    const seasonNum = parseInt(seasonParam, 10);
    selectedSeason = show.seasons.find((s) => s.seasonNumber === seasonNum) ?? null;
  }

  return NextResponse.json({
    ...show,
    seasons: show.seasons.map((s) => ({
      ...s,
      episodes: s.episodes.map((e) => {
        const p = progressMap.get(e.id);
        return {
          ...e,
          progress: p ? {
            position: p.position,
            duration: p.duration,
            completed: p.completed,
            updatedAt: p.updatedAt,
          } : null,
        };
      }),
    })),
    selectedSeason,
    similar,
  });
}
