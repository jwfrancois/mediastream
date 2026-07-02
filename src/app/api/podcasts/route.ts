// Podcasts browse API
// GET /api/podcasts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const podcasts = await db.podcast.findMany({
    orderBy: { sortTitle: 'asc' },
    include: {
      _count: { select: { episodes: true } },
      episodes: {
        orderBy: { episodeNumber: 'desc' },
        take: 1,
        select: { pubDate: true, addedAt: true },
      },
    },
  });

  return NextResponse.json({
    items: podcasts.map((p) => ({
      id: p.id,
      title: p.title,
      author: p.author,
      description: p.description,
      genre: p.genre,
      coverColor: p.coverColor,
      addedAt: p.addedAt,
      episodeCount: p._count.episodes,
      latestEpisodeDate: p.episodes[0]?.pubDate ?? p.episodes[0]?.addedAt ?? null,
    })),
  });
}
