export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';

const LIVE_STATUSES = ['drafting', 'veto', 'ongoing', 'pending_review'];

export async function GET() {
  try {
    const db = await getDb();
    const rows = await db
      .collection('matches')
      .find({ status: { $in: LIVE_STATUSES }, proLeague: true })
      .sort({ createdAt: -1 })
      .limit(40)
      .project({ matchId: 1, map: 1, status: 1, teamA: 1, teamB: 1, createdAt: 1, startedAt: 1 })
      .toArray();

    const names = (arr: any[]) => (arr || []).map((p: any) => p?.copsName || 'Unknown').slice(0, 5);
    const matches = rows.map((m: any) => ({
      matchId: m.matchId,
      map: m.map || null,
      status: m.status,
      teamA: names(m.teamA),
      teamB: names(m.teamB),
      size: (m.teamA?.length || 0) + (m.teamB?.length || 0),
      startedAt: m.startedAt ?? m.createdAt ?? null,
    }));
    return NextResponse.json({ matches });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
