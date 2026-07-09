export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await getDb();
    const match = await db.collection('matches').findOne(
      { matchId: id },
      { projection: { _id: 0 } }
    );
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    // Enrich each team/pool player with accountId + equipped name style (for cosmetics)
    const groups = [match.teamA, match.teamB, match.pool].filter(Array.isArray) as any[][];
    const dids = Array.from(new Set(groups.flat().map((p: any) => p?.discordId).filter(Boolean)));
    if (dids.length) {
      const players = await db
        .collection('players')
        .find({ discordId: { $in: dids } }, { projection: { discordId: 1, accountId: 1, cosmetics: 1 } })
        .toArray();
      const by = new Map<any, any>(players.map((p: any) => [p.discordId, p]));
      for (const g of groups) {
        for (const p of g) {
          const info = by.get(p?.discordId);
          if (info) {
            p.accountId = info.accountId ?? p.accountId ?? null;
            p.nameStyle = info.cosmetics?.name || null;
            p.frame = info.cosmetics?.frame || null;
          }
          const st = match.playerStats?.[p?.discordId];
          p.stats = st ? { k: st.k ?? 0, d: st.d ?? 0, a: st.a ?? 0 } : null;
        }
      }
    }

    return NextResponse.json(match);
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
