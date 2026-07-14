export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/mongodb';

const WINDOW_MS = 25000; // a viewer counts as "live" if seen in the last 25s

// POST = heartbeat (I'm watching) + returns current live viewer count.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const viewerId = (body?.viewerId || '').toString().slice(0, 64);
    if (!viewerId) return NextResponse.json({ count: 0 });
    const db = await getDb();
    const now = Date.now();
    await db.collection('matchViewers').updateOne(
      { matchId: id, viewerId },
      { $set: { matchId: id, viewerId, lastSeen: new Date(now) } },
      { upsert: true }
    );
    const count = await db.collection('matchViewers').countDocuments({ matchId: id, lastSeen: { $gte: new Date(now - WINDOW_MS) } });
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

// GET = just the current live viewer count.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await getDb();
    const count = await db.collection('matchViewers').countDocuments({ matchId: id, lastSeen: { $gte: new Date(Date.now() - WINDOW_MS) } });
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
