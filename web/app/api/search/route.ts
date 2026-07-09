export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').toString().trim();
    if (q.length < 2) return NextResponse.json({ players: [], clubs: [], tournaments: [] });
    const db = await getDb();
    const rx = new RegExp(escapeRegex(q), 'i');

    const [players, clubs, tournaments] = await Promise.all([
      db
        .collection('players')
        .find({ copsName: rx, accountId: { $ne: null } }, { projection: { accountId: 1, copsName: 1, elo: 1, avatar: 1, cosmetics: 1 } })
        .limit(8)
        .toArray(),
      db
        .collection('clans')
        .find({ $or: [{ name: rx }, { tag: rx }] }, { projection: { name: 1, tag: 1, color: 1 } })
        .limit(6)
        .toArray(),
      db
        .collection('tournaments')
        .find({ name: rx }, { projection: { name: 1, status: 1 } })
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray(),
    ]);

    return NextResponse.json({
      players: players.map((p: any) => ({ accountId: p.accountId ?? null, copsName: p.copsName ?? 'Unknown', elo: p.elo ?? 1000, avatar: p.avatar ?? null, nameStyle: p.cosmetics?.name || null })),
      clubs: clubs.map((c: any) => ({ id: String(c._id), name: c.name, tag: c.tag, color: c.color ?? null })),
      tournaments: tournaments.map((t: any) => ({ id: String(t._id), name: t.name, status: t.status })),
    });
  } catch {
    return NextResponse.json({ players: [], clubs: [], tournaments: [] });
  }
}
