export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../../../lib/mongodb';
import { authOptions } from '../../../../../lib/auth';

async function ctx(db: any, matchId: string, myId?: string) {
  const match = await db.collection('matches').findOne({ matchId }, { projection: { teamA: 1, teamB: 1, status: 1 } });
  if (!match) return null;
  const dids = [...(match.teamA || []), ...(match.teamB || [])].map((p: any) => p?.discordId).filter(Boolean);
  return { match, amParticipant: !!myId && dids.includes(myId), completed: match.status === 'completed' };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ isHighlight: false, eligible: false });
    const db = await getDb();
    const c = await ctx(db, id, myId);
    if (!c) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    const me = await db.collection('players').findOne({ discordId: myId }, { projection: { highlightMatchId: 1 } });
    return NextResponse.json({ isHighlight: me?.highlightMatchId === id, eligible: c.amParticipant && c.completed });
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
    const c = await ctx(db, id, myId);
    if (!c) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    if (!c.completed) return NextResponse.json({ error: 'Only completed matches' }, { status: 400 });
    if (!c.amParticipant) return NextResponse.json({ error: 'You were not in this match' }, { status: 403 });

    const me = await db.collection('players').findOne({ discordId: myId }, { projection: { highlightMatchId: 1 } });
    if (me?.highlightMatchId === id) {
      await db.collection('players').updateOne({ discordId: myId }, { $unset: { highlightMatchId: '' } });
      return NextResponse.json({ ok: true, isHighlight: false });
    }
    await db.collection('players').updateOne({ discordId: myId }, { $set: { highlightMatchId: id } });
    return NextResponse.json({ ok: true, isHighlight: true });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
