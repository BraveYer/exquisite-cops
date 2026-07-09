export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';

// Keep in sync with the hub's MATCH_SIZE / the bot's MAX_PLAYERS.
const MATCH_SIZE = 10;
const QUEUE_FRESH_MS = 120000;

export async function GET() {
  try {
    const db = await getDb();
    const now = Date.now();

    const [queueCount, recentMatches, queueDocs] = await Promise.all([
      db.collection('queue').countDocuments({ lastSeen: { $gte: new Date(now - QUEUE_FRESH_MS) } }),
      db.collection('matches').countDocuments({ createdAt: { $gte: new Date(now - 3600000) } }),
      db.collection('queue').find({ lastSeen: { $gte: new Date(now - QUEUE_FRESH_MS) } }, { projection: { mapPrefs: 1 } }).toArray(),
    ]);

    // Most-wanted map among players currently in queue
    const mapTally: Record<string, number> = {};
    for (const q of queueDocs as any[]) {
      for (const m of q.mapPrefs || []) mapTally[m] = (mapTally[m] || 0) + 1;
    }
    let topMap: { map: string; votes: number } | null = null;
    for (const [map, votes] of Object.entries(mapTally)) {
      if (!topMap || votes > topMap.votes) topMap = { map, votes };
    }

    const playersNeeded = Math.max(0, MATCH_SIZE - queueCount);

    let estimateSeconds: number | null = null;
    if (queueCount >= MATCH_SIZE) {
      estimateSeconds = 20; // enough players — forming now
    } else if (recentMatches > 0) {
      const avgGap = 3600 / recentMatches; // avg seconds between matches recently
      estimateSeconds = Math.round(avgGap * Math.max(0.15, playersNeeded / MATCH_SIZE));
      estimateSeconds = Math.min(1800, Math.max(20, estimateSeconds));
    } else {
      estimateSeconds = null; // not enough recent activity to estimate
    }

    return NextResponse.json({ queueCount, matchSize: MATCH_SIZE, playersNeeded, recentMatches, estimateSeconds, topMap });
  } catch {
    return NextResponse.json({ queueCount: 0, matchSize: MATCH_SIZE, playersNeeded: MATCH_SIZE, recentMatches: 0, estimateSeconds: null });
  }
}
