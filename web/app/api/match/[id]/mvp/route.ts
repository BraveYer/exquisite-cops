export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../../../lib/mongodb';
import { authOptions } from '../../../../../lib/auth';

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

    const votes = await db.collection('mvpVotes').find({ matchId: id }).toArray();
    const tally: Record<string, number> = {};
    let myVote: number | null = null;
    for (const v of votes as any[]) {
      if (v.votedForAccountId != null) tally[String(v.votedForAccountId)] = (tally[String(v.votedForAccountId)] || 0) + 1;
      if (v.voterId === myId) myVote = v.votedForAccountId ?? null;
    }
    let mvp: { accountId: number; count: number } | null = null;
    for (const [acc, count] of Object.entries(tally)) {
      if (!mvp || count > mvp.count) mvp = { accountId: Number(acc), count };
    }

    return NextResponse.json({
      votes: tally,
      totalVotes: votes.length,
      mvp,
      myVote,
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
    if (!ctx.completed) return NextResponse.json({ error: 'Voting opens after the match ends' }, { status: 400 });
    if (!ctx.amParticipant) return NextResponse.json({ error: 'Only players in this match can vote' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const votedFor = Number(body?.votedFor);
    if (!Number.isFinite(votedFor)) return NextResponse.json({ error: 'Invalid pick' }, { status: 400 });

    // Validate the pick is a participant (resolve accountIds from the team discordIds).
    const players = await db.collection('players').find({ discordId: { $in: ctx.dids } }, { projection: { accountId: 1 } }).toArray();
    const validAccts = new Set(players.map((p: any) => p.accountId).filter((a: any) => a != null));
    if (!validAccts.has(votedFor)) return NextResponse.json({ error: 'Pick must be a player in the match' }, { status: 400 });

    await db.collection('mvpVotes').updateOne(
      { matchId: id, voterId: myId },
      { $set: { votedForAccountId: votedFor, updatedAt: new Date() }, $setOnInsert: { matchId: id, voterId: myId, createdAt: new Date() } },
      { upsert: true }
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
