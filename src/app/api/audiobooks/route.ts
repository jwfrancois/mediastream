// Audiobooks browse API
// GET /api/audiobooks?sort=recent|title|author

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sort = url.searchParams.get('sort') ?? 'recent';
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 500);

  const orderBy =
    sort === 'title' ? { sortTitle: 'asc' as const } :
    sort === 'author' ? { author: 'asc' as const } :
    { addedAt: 'desc' as const };

  const [audiobooks, total] = await Promise.all([
    db.audiobook.findMany({
      orderBy,
      take: limit,
    }),
    db.audiobook.count(),
  ]);

  return NextResponse.json({
    items: audiobooks,
    total,
  });
}
