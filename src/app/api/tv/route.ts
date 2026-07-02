// TV Shows browse API
// GET /api/tv?genre=X&sort=recent|title|rating

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const genre = url.searchParams.get('genre');
  const sort = url.searchParams.get('sort') ?? 'recent';
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 500);

  const where = genre ? { genre } : {};

  const orderBy =
    sort === 'title' ? { sortTitle: 'asc' as const } :
    sort === 'rating' ? { rating: 'desc' as const } :
    { addedAt: 'desc' as const };

  const [shows, total] = await Promise.all([
    db.tvShow.findMany({
      where,
      orderBy,
      take: limit,
      include: {
        _count: { select: { seasons: true } },
        seasons: {
          include: { _count: { select: { episodes: true } } },
          orderBy: { seasonNumber: 'asc' },
        },
      },
    }),
    db.tvShow.count({ where }),
  ]);

  const genres = await db.tvShow.findMany({
    where: { NOT: { genre: null } },
    distinct: ['genre'],
    select: { genre: true },
  });

  const items = shows.map((s) => ({
    id: s.id,
    title: s.title,
    year: s.year,
    genre: s.genre,
    rating: s.rating,
    plot: s.plot,
    posterColor: s.posterColor,
    backdropColor: s.backdropColor,
    posterUrl: s.posterUrl,
    backdropUrl: s.backdropUrl,
    addedAt: s.addedAt,
    seasonCount: s._count.seasons,
    episodeCount: s.seasons.reduce((sum, season) => sum + season._count.episodes, 0),
  }));

  return NextResponse.json({
    items,
    total,
    genres: genres.map((g) => g.genre).filter(Boolean),
  });
}
