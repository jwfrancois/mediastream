// Global search API across all libraries
// GET /api/search?q=QUERY&limit=10

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '10', 10), 50);

  if (!q) {
    return NextResponse.json({
      movies: [], shows: [], albums: [], artists: [],
      podcasts: [], audiobooks: [], tracks: [],
    });
  }

  // Case-insensitive contains (SQLite is case-insensitive for ASCII by default)
  const term = q;

  const [
    movies, shows, albums, artists, podcasts, audiobooks, tracks,
  ] = await Promise.all([
    db.movie.findMany({
      where: { OR: [
        { title: { contains: term } },
        { director: { contains: term } },
        { genre: { contains: term } },
      ] },
      take: limit,
      select: { id: true, title: true, year: true, genre: true, posterColor: true, rating: true },
    }),
    db.tvShow.findMany({
      where: { OR: [
        { title: { contains: term } },
        { genre: { contains: term } },
      ] },
      take: limit,
      select: { id: true, title: true, year: true, genre: true, posterColor: true, rating: true },
    }),
    db.album.findMany({
      where: { OR: [
        { title: { contains: term } },
        { genre: { contains: term } },
      ] },
      take: limit,
      include: { artist: { select: { id: true, name: true } } },
    }),
    db.artist.findMany({
      where: { name: { contains: term } },
      take: limit,
      select: { id: true, name: true, imageColor: true },
    }),
    db.podcast.findMany({
      where: { OR: [
        { title: { contains: term } },
        { author: { contains: term } },
      ] },
      take: limit,
      select: { id: true, title: true, author: true, coverColor: true },
    }),
    db.audiobook.findMany({
      where: { OR: [
        { title: { contains: term } },
        { author: { contains: term } },
        { narrator: { contains: term } },
      ] },
      take: limit,
      select: { id: true, title: true, author: true, narrator: true, coverColor: true },
    }),
    db.track.findMany({
      where: { title: { contains: term } },
      take: limit,
      include: {
        album: { select: { id: true, title: true, coverColor: true } },
        artist: { select: { id: true, name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    movies,
    shows,
    albums: albums.map((a) => ({
      id: a.id, title: a.title, year: a.year, genre: a.genre,
      coverColor: a.coverColor, artist: a.artist,
    })),
    artists,
    podcasts,
    audiobooks,
    tracks: tracks.map((t) => ({
      id: t.id, title: t.title, duration: t.duration,
      album: t.album, artist: t.artist,
    })),
    totalResults:
      movies.length + shows.length + albums.length + artists.length +
      podcasts.length + audiobooks.length + tracks.length,
  });
}
