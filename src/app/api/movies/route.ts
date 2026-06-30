// Movies browse API
// GET /api/movies?genre=X&sort=recent|title|rating&limit=50&offset=0

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const genre = url.searchParams.get('genre');
  const sort = url.searchParams.get('sort') ?? 'recent';
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 500);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  const where = genre ? { genre } : {};

  const orderBy =
    sort === 'title' ? { sortTitle: 'asc' as const } :
    sort === 'rating' ? { rating: 'desc' as const } :
    { addedAt: 'desc' as const };

  const [movies, total] = await Promise.all([
    db.movie.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      select: {
        id: true,
        title: true,
        year: true,
        genre: true,
        rating: true,
        duration: true,
        posterColor: true,
        backdropColor: true,
        plot: true,
        addedAt: true,
      },
    }),
    db.movie.count({ where }),
  ]);

  // Also return distinct genres for filter UI
  const genres = await db.movie.findMany({
    where: { NOT: { genre: null } },
    distinct: ['genre'],
    select: { genre: true },
  });

  return NextResponse.json({
    items: movies,
    total,
    genres: genres.map((g) => g.genre).filter(Boolean),
  });
}
