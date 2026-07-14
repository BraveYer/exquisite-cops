export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../../../lib/mongodb';
import { authOptions } from '../../../../../lib/auth';

export const COMMEND_TYPES: Record<string, string> = {
  aim: 'Great aim',
  igl: 'Shotcaller',
  team: 'Good teammate',
  clutch: 'Clutch',
};

async function loadContext(db: any, matchId: string, myId?: string) {
  const match = await db.collection('matches').findOne({ matchId }, { projection: { teamA: 1, teamB: 1, status: 1 } });
  if (!match) return null;
  const dids = [...(match.teamA || []), ...(match.teamB || [])].map((p: any) => p?.discordId).filter(Boolean);
  const amParticipant = !!myId && dids.includes(myId);
  return { match, dids, amParticipant, completed: match.status === 'completed' };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    const db = await getDb();
    const ctx = await loadContext(db, id, myId);
    if (!ctx) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    const all = await db.collection('commends').find({ matchId: id }).toArray();
    const mine: Record<string, string> = {};
    const counts: Record<string, number> = {}; // toDiscordId -> total commends received in this match
    for (const c of all as any[]) {
      if (c.fromId === myId && c.toId) mine[c.toId] = c.type;
      if (c.toId) counts[c.toId] = (counts[c.toId] || 0) + 1;
    }
    return NextResponse.json({
      types: COMMEND_TYPES,
      mine,
      counts,
      eligible: ctx.amParticipant && ctx.completed,
      completed: ctx.completed,
    });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    const db = await getDb();
    const ctx = await loadContext(db, id, myId);
    if (!ctx) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    if (!ctx.completed) return NextResponse.json({ error: 'Commends open after the match ends' }, { status: 400 });
    if (!ctx.amParticipant) return NextResponse.json({ error: 'Only players in this match can commend' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const toId = String(body?.toId || '');
    const type = String(body?.type || '');
    if (!ctx.dids.includes(toId)) return NextResponse.json({ error: 'That player was not in this match' }, { status: 400 });
    if (toId === myId) return NextResponse.json({ error: "You can't commend yourself" }, { status: 400 });
    if (!COMMEND_TYPES[type]) return NextResponse.json({ error: 'Invalid commend' }, { status: 400 });

    // Toggle: if the same commend already exists, remove it; otherwise set it (one per teammate per match).
    const existing = await db.collection('commends').findOne({ matchId: id, fromId: myId, toId });
    if (existing && existing.type === type) {
      await db.collection('commends').deleteOne({ matchId: id, fromId: myId, toId });
      return NextResponse.json({ ok: true, removed: true });
    }
    await db.collection('commends').updateOne(
      { matchId: id, fromId: myId, toId },
      { $set: { matchId: id, fromId: myId, toId, type, createdAt: new Date() } },
      { upsert: true }
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
