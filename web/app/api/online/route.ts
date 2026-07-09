export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';

const STALE_MS = 120000; // match the bot's queue heartbeat window

export async function GET() {
  try {
    const db = await getDb();
    const cutoff = new Date(Date.now() - STALE_MS);

    // Players actively searching = fresh queue entries (kept alive by heartbeat).
    const entries = await db.collection('queue').find({ lastSeen: { $gte: cutoff } }).toArray();
    const ids = entries.map((e: any) => e.discordId).filter(Boolean);
    if (ids.length === 0) return NextResponse.json({ players: [], count: 0 });

    // discordId is used only to join — it is NEVER returned to the client.
    const players = await db
      .collection('players')
      .find({ discordId: { $in: ids } })
      .project({ _id: 0, discordId: 1, copsName: 1, accountId: 1, elo: 1, avatar: 1 })
      .toArray();

    const out = players
      .map((p: any) => ({
        copsName: p.copsName ?? 'Unknown',
        accountId: p.accountId ?? null,
        elo: p.elo ?? 1000,
        avatar: p.avatar ?? null,
      }))
      .sort((a: any, b: any) => (b.elo ?? 0) - (a.elo ?? 0));

    return NextResponse.json({ players: out, count: out.length });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
