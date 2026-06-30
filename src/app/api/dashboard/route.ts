// Dashboard / Home page data API
// GET /api/dashboard
// Returns: hero item, continue watching, recently added per type

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Hero: highest-rated recent movie or TV show
  const heroMovie = await db.movie.findFirst({
    where: { rating: { gte: 8 } },
    orderBy: [{ addedAt: 'desc' }],
  });
  const heroShow = await db.tvShow.findFirst({
    where: { rating: { gte: 8.5 } },
    orderBy: [{ addedAt: 'desc' }],
  });

  // Pick the most recent between movie & show for hero
  let hero;
  if (heroMovie && heroShow) {
    hero = heroMovie.addedAt > heroShow.addedAt
      ? { type: 'movie', ...heroMovie }
      : { type: 'show', ...heroShow };
  } else {
    hero = heroMovie
      ? { type: 'movie', ...heroMovie }
      : heroShow
        ? { type: 'show', ...heroShow }
        : null;
  }

  // Continue watching (in-progress items, mixed types)
  const progressRecords = await db.watchProgress.findMany({
    where: { completed: false },
    orderBy: { updatedAt: 'desc' },
    take: 12,
  });

  const continueWatching = await Promise.all(
    progressRecords.map(async (p) => {
      let media: any = null;
      switch (p.mediaType) {
        case 'MOVIE':
          media = await db.movie.findUnique({
            where: { id: p.mediaId },
            select: { id: true, title: true, year: true, posterColor: true, backdropColor: true, duration: true, genre: true },
          });
          break;
        case 'EPISODE':
          const ep = await db.episode.findUnique({
            where: { id: p.mediaId },
            include: { season: { include: { tvShow: { select: { id: true, title: true, posterColor: true, backdropColor: true } } } } },
          });
          if (ep) media = {
            id: ep.id, title: ep.title, episodeNumber: ep.episodeNumber, duration: ep.duration,
            show: ep.season.tvShow, seasonNumber: ep.season.seasonNumber,
          };
          break;
        case 'TRACK':
          media = await db.track.findUnique({
            where: { id: p.mediaId },
            include: { album: { select: { id: true, title: true, coverColor: true, artist: { select: { id: true, name: true } } } } },
          });
          break;
        case 'PODCAST_EPISODE':
          media = await db.podcastEpisode.findUnique({
            where: { id: p.mediaId },
            include: { podcast: { select: { id: true, title: true, coverColor: true, author: true } } },
          });
          break;
        case 'AUDIOBOOK':
          media = await db.audiobook.findUnique({
            where: { id: p.mediaId },
            select: { id: true, title: true, author: true, narrator: true, coverColor: true, duration: true },
          });
          break;
      }
      if (!media) return null;
      return {
        mediaType: p.mediaType,
        mediaId: p.mediaId,
        position: p.position,
        duration: p.duration ?? media?.duration,
        updatedAt: p.updatedAt,
        media,
      };
    }),
  );

  // Recently added - separate sections per type
  const [
    recentMovies, recentShows, recentAlbums, recentPodcasts, recentAudiobooks,
  ] = await Promise.all([
    db.movie.findMany({
      orderBy: { addedAt: 'desc' }, take: 12,
      select: { id: true, title: true, year: true, genre: true, rating: true, posterColor: true, plot: true, addedAt: true, duration: true },
    }),
    db.tvShow.findMany({
      orderBy: { addedAt: 'desc' }, take: 12,
      include: { seasons: { include: { _count: { select: { episodes: true } } } } },
    }),
    db.album.findMany({
      orderBy: { addedAt: 'desc' }, take: 12,
      include: { artist: { select: { id: true, name: true } }, _count: { select: { tracks: true } } },
    }),
    db.podcast.findMany({
      orderBy: { addedAt: 'desc' }, take: 12,
      include: { _count: { select: { episodes: true } } },
    }),
    db.audiobook.findMany({
      orderBy: { addedAt: 'desc' }, take: 12,
      select: { id: true, title: true, author: true, narrator: true, year: true, genre: true, coverColor: true, duration: true, description: true },
    }),
  ]);

  // Stats
  const [
    movieCount, showCount, episodeCount, albumCount, trackCount,
    podcastCount, podcastEpisodeCount, audiobookCount, libraryCount,
  ] = await Promise.all([
    db.movie.count(),
    db.tvShow.count(),
    db.episode.count(),
    db.album.count(),
    db.track.count(),
    db.podcast.count(),
    db.podcastEpisode.count(),
    db.audiobook.count(),
    db.library.count(),
  ]);

  return NextResponse.json({
    hero,
    continueWatching: continueWatching.filter(Boolean),
    recent: {
      movies: recentMovies,
      shows: recentShows.map((s) => ({
        id: s.id, title: s.title, year: s.year, genre: s.genre, rating: s.rating,
        posterColor: s.posterColor, plot: s.plot, addedAt: s.addedAt,
        episodeCount: s.seasons.reduce((sum, season) => sum + season._count.episodes, 0),
        seasonCount: s.seasons.length,
      })),
      albums: recentAlbums.map((a) => ({
        id: a.id, title: a.title, year: a.year, genre: a.genre, coverColor: a.coverColor,
        addedAt: a.addedAt, artist: a.artist, trackCount: a._count.tracks,
      })),
      podcasts: recentPodcasts.map((p) => ({
        id: p.id, title: p.title, author: p.author, coverColor: p.coverColor,
        addedAt: p.addedAt, episodeCount: p._count.episodes,
      })),
      audiobooks: recentAudiobooks,
    },
    stats: {
      movies: movieCount,
      shows: showCount,
      episodes: episodeCount,
      albums: albumCount,
      tracks: trackCount,
      podcasts: podcastCount,
      podcastEpisodes: podcastEpisodeCount,
      audiobooks: audiobookCount,
      libraries: libraryCount,
    },
  });
}
