// Get all watch/playback progress entries (for Continue Watching rail)
// GET /api/progress

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type'); // optional filter: MOVIE | EPISODE | TRACK | PODCAST_EPISODE | AUDIOBOOK

  const where = type ? { mediaType: type, completed: false } : { completed: false };

  const progress = await db.watchProgress.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  // Hydrate with media info based on type
  const result = await Promise.all(
    progress.map(async (p) => {
      let media: any = null;
      switch (p.mediaType) {
        case 'MOVIE':
          media = await db.movie.findUnique({
            where: { id: p.mediaId },
            select: {
              id: true, title: true, year: true, genre: true,
              posterColor: true, backdropColor: true, duration: true,
            },
          });
          break;
        case 'EPISODE':
          media = await db.episode.findUnique({
            where: { id: p.mediaId },
            include: {
              season: { include: { tvShow: { select: {
                id: true, title: true, posterColor: true, backdropColor: true,
              } } } },
            },
          });
          if (media) {
            media = {
              id: media.id,
              title: media.title,
              episodeNumber: media.episodeNumber,
              duration: media.duration,
              show: media.season.tvShow,
              seasonNumber: media.season.seasonNumber,
            };
          }
          break;
        case 'TRACK':
          media = await db.track.findUnique({
            where: { id: p.mediaId },
            include: {
              album: { select: { id: true, title: true, coverColor: true, artist: { select: { id: true, name: true } } } },
            },
          });
          break;
        case 'PODCAST_EPISODE':
          media = await db.podcastEpisode.findUnique({
            where: { id: p.mediaId },
            include: {
              podcast: { select: { id: true, title: true, coverColor: true, author: true } },
            },
          });
          break;
        case 'AUDIOBOOK':
          media = await db.audiobook.findUnique({
            where: { id: p.mediaId },
            select: {
              id: true, title: true, author: true, narrator: true,
              coverColor: true, duration: true,
            },
          });
          break;
      }
      if (!media) return null;
      return {
        mediaType: p.mediaType,
        mediaId: p.mediaId,
        position: p.position,
        duration: p.duration,
        completed: p.completed,
        updatedAt: p.updatedAt,
        media,
      };
    }),
  );

  return NextResponse.json({
    items: result.filter(Boolean),
  });
}
