export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';

export async function GET() {
  try {
    const db = await getDb();
    const cutoff = new Date(Date.now() - 120000);
    const [players, matches, liveNow, season] = await Promise.all([
      db.collection('players').countDocuments({}),
      db.collection('matches').countDocuments({ status: 'completed' }),
      db.collection('queue').countDocuments({ lastSeen: { $gte: cutoff } }),
      db.collection('seasons').findOne({ status: 'active' }, { projection: { number: 1 } }),
    ]);
    return NextResponse.json({
      players,
      matches,
      liveNow,
      season: season?.number ?? null,
    });
  } catch (error) {
    return NextResponse.json({ players: 0, matches: 0, liveNow: 0, season: null });
  }
}
