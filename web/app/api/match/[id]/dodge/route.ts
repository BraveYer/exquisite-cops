export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../../../lib/mongodb';
import { authOptions } from '../../../../../lib/auth';
import { notify } from '../../../../../lib/notify';
import { dodgePenaltyMinutes, DODGE_DECAY_MS } from '../../../../../lib/antiDodge';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    const db = await getDb();

    const match = await db.collection('matches').findOne({ matchId: id }, { projection: { teamA: 1, teamB: 1, status: 1 } });
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    if (match.status !== 'drafting' && match.status !== 'veto') return NextResponse.json({ error: 'The match has already started — you can no longer leave without penalty from here.' }, { status: 400 });

    const dids = [...(match.teamA || []), ...(match.teamB || [])].map((p: any) => p?.discordId).filter(Boolean);
    if (!dids.includes(myId)) return NextResponse.json({ error: 'You are not in this match' }, { status: 403 });

    const now = Date.now();
    const me = await db.collection('players').findOne({ discordId: myId }, { projection: { dodgeCount: 1, lastDodgeAt: 1, copsName: 1 } });
    const recent = me?.lastDodgeAt && now - new Date(me.lastDodgeAt).getTime() < DODGE_DECAY_MS;
    const newCount = (recent ? me?.dodgeCount || 0 : 0) + 1;
    const penalty = dodgePenaltyMinutes(newCount);
    const dodgeUntil = new Date(now + penalty * 60000);

    await db.collection('players').updateOne(
      { discordId: myId },
      { $set: { dodgeCount: newCount, lastDodgeAt: new Date(), dodgeUntil } }
    );

    await db.collection('matches').updateOne(
      { matchId: id },
      { $set: { status: 'cancelled', cancelledBy: myId, cancelReason: 'dodge', cancelledAt: new Date() } }
    );

    // Let the others know
    for (const did of dids) {
      if (did !== myId) {
        notify(db, did, { type: 'match_cancelled', title: 'Match cancelled', body: `${me?.copsName || 'A player'} left during setup. You can requeue now.`, link: '/' });
      }
    }

    return NextResponse.json({ ok: true, penaltyMinutes: penalty });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
