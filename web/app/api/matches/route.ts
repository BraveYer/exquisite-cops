export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';

const sanitizeTeam = (team: any[]) =>
  (team || []).map((p: any) => ({
    copsName: p.copsName ?? 'Unknown',
    accountId: p.accountId ?? null,
    elo: p.elo ?? 1000,
    avatar: p.avatar ?? null,
  }));

export async function GET() {
  try {
    const db = await getDb();
    const raw = await db
      .collection('matches')
      .find({ status: 'completed' })
      .sort({ completedAt: -1 })
      .limit(30)
      .project({ matchId: 1, map: 1, winner: 1, completedAt: 1, teamA: 1, teamB: 1 })
      .toArray();

    const matches = raw.map((m: any) => ({
      matchId: m.matchId,
      map: m.map ?? 'Unknown',
      winner: m.winner ?? null, // 'A' | 'B'
      completedAt: m.completedAt ?? null,
      teamA: sanitizeTeam(m.teamA),
      teamB: sanitizeTeam(m.teamB),
    }));

    return NextResponse.json({ matches });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
