// Streaming API route with HTTP Range support.
// Used by the video and audio players to stream media from disk.
//
// Path: /api/stream/[type]/[id]
// type: movie | episode | track | podcast | audiobook
// id:   the media item id

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import path from 'path';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CONTENT_TYPES: Record<string, string> = {
  '.mp4':  'video/mp4',
  '.mkv':  'video/x-matroska',
  '.webm': 'video/webm',
  '.mov':  'video/quicktime',
  '.avi':  'video/x-msvideo',
  '.m4v':  'video/x-m4v',
  '.mp3':  'audio/mpeg',
  '.m4a':  'audio/mp4',
  '.aac':  'audio/aac',
  '.flac': 'audio/flac',
  '.wav':  'audio/wav',
  '.ogg':  'audio/ogg',
  '.opus': 'audio/opus',
};

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

async function getMediaFile(type: string, id: string): Promise<{ filePath: string; fileSize: number } | null> {
  switch (type) {
    case 'movie': {
      const m = await db.movie.findUnique({ where: { id }, select: { filePath: true, fileSize: true } });
      return m ? { filePath: m.filePath, fileSize: m.fileSize ?? 0 } : null;
    }
    case 'episode': {
      const e = await db.episode.findUnique({ where: { id }, select: { filePath: true, fileSize: true } });
      return e ? { filePath: e.filePath, fileSize: e.fileSize ?? 0 } : null;
    }
    case 'track': {
      const t = await db.track.findUnique({ where: { id }, select: { filePath: true, fileSize: true } });
      return t ? { filePath: t.filePath, fileSize: t.fileSize ?? 0 } : null;
    }
    case 'podcast': {
      const p = await db.podcastEpisode.findUnique({ where: { id }, select: { filePath: true, fileSize: true } });
      return p ? { filePath: p.filePath, fileSize: p.fileSize ?? 0 } : null;
    }
    case 'audiobook': {
      const a = await db.audiobook.findUnique({ where: { id }, select: { filePath: true, fileSize: true } });
      return a ? { filePath: a.filePath, fileSize: a.fileSize ?? 0 } : null;
    }
    default:
      return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;

  // Validate type early
  if (!['movie', 'episode', 'track', 'podcast', 'audiobook'].includes(type)) {
    return NextResponse.json({ error: 'Invalid media type' }, { status: 400 });
  }

  const media = await getMediaFile(type, id);
  if (!media) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 });
  }

  let stat;
  try {
    stat = await fs.stat(media.filePath);
  } catch {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
  }

  const fileSize = stat.size;
  const contentType = getContentType(media.filePath);

  // Parse the Range header for partial-content requests
  const rangeHeader = req.headers.get('range');

  // If no Range header, stream the entire file
  if (!rangeHeader) {
    const nodeStream = createReadStream(media.filePath);
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
        nodeStream.on('end', () => controller.close());
        nodeStream.on('error', (err: Error) => controller.error(err));
      },
      cancel() { nodeStream.destroy(); },
    });
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // Parse "bytes=start-end"
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!match) {
    return new NextResponse('Invalid Range', { status: 416 });
  }
  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  if (start >= fileSize || end >= fileSize || start > end) {
    return new NextResponse(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${fileSize}` },
    });
  }

  const chunkSize = end - start + 1;
  const nodeStream = createReadStream(media.filePath, { start, end });

  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (err: Error) => controller.error(err));
    },
    cancel() { nodeStream.destroy(); },
  });

  return new NextResponse(webStream, {
    status: 206,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(chunkSize),
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
