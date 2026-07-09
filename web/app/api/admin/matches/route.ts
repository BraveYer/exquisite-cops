export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../../lib/mongodb';
import { authOptions } from '../../../../lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    const db = await getDb();
    const me = await db.collection('players').findOne({ discordId }, { projection: { staffLevel: 1 } });
    if (me?.staffLevel !== 'admin' && me?.staffLevel !== 'mod') return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const rows = await db
      .collection('matches')
      .find({ status: { $in: ['completed', 'ongoing', 'pending_review', 'disputed'] } }, { projection: { matchId: 1, map: 1, status: 1, teamA: 1, teamB: 1, playerStats: 1, winner: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(40)
      .toArray();

    const matches = rows.map((m: any) => {
      const build = (arr: any[], team: 'A' | 'B') =>
        (arr || []).map((p: any) => {
          const st = m.playerStats?.[p?.discordId];
          return {
            discordId: p?.discordId,
            copsName: p?.copsName || 'Unknown',
            team,
            stats: st ? { k: st.k ?? 0, d: st.d ?? 0, a: st.a ?? 0 } : null,
          };
        });
      const players = [...build(m.teamA, 'A'), ...build(m.teamB, 'B')].filter((p) => p.discordId);
      return {
        matchId: m.matchId,
        map: m.map || '',
        status: m.status,
        winner: m.winner ?? null,
        createdAt: m.createdAt ?? null,
        hasStats: players.some((p) => p.stats),
        players,
      };
    });

    return NextResponse.json({ matches });
  } catch {
    return NextResponse.json({ matches: [] });
  }
}
