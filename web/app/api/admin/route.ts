export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';

const STAFF = ['admin', 'mod'];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const db = await getDb();
    const me = await db.collection('players').findOne({ discordId });
    const myLevel = me?.staffLevel ?? null;
    if (!STAFF.includes(myLevel)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ----- Active matches (need attention) -----
    const rawActive = await db
      .collection('matches')
      .find({ status: { $in: ['ongoing', 'pending_review', 'disputed'] } })
      .sort({ _id: -1 })
      .limit(50)
      .toArray();

    const nameOf = (m: any, id: string) => {
      const all = [...(m.teamA || []), ...(m.teamB || [])];
      return all.find((p: any) => p.discordId === id)?.copsName || 'Unknown';
    };

    const active = rawActive.map((m: any) => ({
      matchId: m.matchId,
      map: m.map,
      status: m.status,
      disputed: m.status === 'disputed',
      teamA: (m.teamA || []).map((p: any) => p.copsName || 'Unknown'),
      teamB: (m.teamB || []).map((p: any) => p.copsName || 'Unknown'),
      roomName: m.roomName ?? null,
      roomPassword: m.roomPassword ?? null,
      reports: (m.reports || []).map((r: any) => ({ winner: r.winner, by: nameOf(m, r.discordId) })),
      createdAt: m._id?.getTimestamp ? m._id.getTimestamp().toISOString() : null,
    }));

    // ----- Recent results -----
    const rawRecent = await db
      .collection('matches')
      .find({ status: 'completed' })
      .sort({ completedAt: -1 })
      .limit(10)
      .toArray();

    const recent = rawRecent.map((m: any) => ({
      matchId: m.matchId,
      map: m.map,
      winner: m.winner ?? null,
      completedAt: m.completedAt ?? null,
      teamA: (m.teamA || []).map((p: any) => p.copsName || 'Unknown'),
      teamB: (m.teamB || []).map((p: any) => p.copsName || 'Unknown'),
    }));

    // ----- Staff roster (managed via Discord roles, mirrored here) -----
    const rawStaff = await db
      .collection('players')
      .find({ staffLevel: { $in: STAFF } })
      .project({ _id: 0, copsName: 1, accountId: 1, staffLevel: 1 })
      .toArray();

    const staff = rawStaff
      .map((p: any) => ({ copsName: p.copsName ?? 'Unknown', accountId: p.accountId ?? null, staffLevel: p.staffLevel }))
      .sort((a: any, b: any) => (a.staffLevel === b.staffLevel ? 0 : a.staffLevel === 'admin' ? -1 : 1));

    return NextResponse.json({ me: { staffLevel: myLevel }, active, recent, staff });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
