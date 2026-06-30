// Movie detail API
// GET /api/movies/[id]

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const movie = await db.movie.findUnique({
    where: { id },
    include: {
      library: { select: { name: true } },
    },
  });

  if (!movie) {
    return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
  }

  // Get progress if any
  const progress = await db.watchProgress.findUnique({
    where: { mediaType_mediaId: { mediaType: 'MOVIE', mediaId: id } },
  });

  // Get similar movies (same genre)
  const similar = movie.genre
    ? await db.movie.findMany({
        where: { genre: movie.genre, NOT: { id: movie.id } },
        take: 8,
        orderBy: { rating: 'desc' },
        select: {
          id: true, title: true, year: true, genre: true,
          rating: true, posterColor: true, plot: true, addedAt: true,
        },
      })
    : [];

  return NextResponse.json({
    ...movie,
    cast: movie.cast ? JSON.parse(movie.cast) : [],
    progress: progress ? {
      position: progress.position,
      duration: progress.duration,
      completed: progress.completed,
      updatedAt: progress.updatedAt,
    } : null,
    similar,
  });
}
