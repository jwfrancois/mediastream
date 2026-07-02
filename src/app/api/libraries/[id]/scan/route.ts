// Trigger a library scan
// POST /api/libraries/[id]/scan

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scanLibrary } from '@/lib/scanner';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for scanning

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const library = await db.library.findUnique({ where: { id } });
  if (!library) {
    return NextResponse.json({ error: 'Library not found' }, { status: 404 });
  }

  try {
    const result = await scanLibrary(id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: 'Scan failed', details: (e as Error).message },
      { status: 500 },
    );
  }
}
