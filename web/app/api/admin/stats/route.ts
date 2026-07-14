export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../../lib/mongodb';
import { authOptions } from '../../../../lib/auth';

const SEARCH_STALE_MS = 120000;

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const db = await getDb();
    const me = await db.collection('players').findOne({ discordId }, { projection: { staffLevel: 1 } });
    const staffLevel = me?.staffLevel ?? null;
    if (staffLevel !== 'admin' && staffLevel !== 'mod') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const since7 = new Date(now.getTime() - 7 * 86400000);
    const since14 = new Date(now.getTime() - 14 * 86400000);
    const since30 = new Date(now.getTime() - 30 * 86400000);
    const searchCutoff = new Date(now.getTime() - SEARCH_STALE_MS);

    const [
      totalPlayers,
      verifiedPlayers,
      searchingNow,
      totalMatches,
      matchesToday,
      matchesWeek,
      totalTournaments,
      activeTournaments,
      totalClubs,
      ongoingMatches,
      newPlayersToday,
      newPlayersWeek,
    ] = await Promise.all([
      db.collection('players').countDocuments({}),
      db.collection('players').countDocuments({ verified: true }),
      db.collection('queue').countDocuments({ lastSeen: { $gte: searchCutoff } }),
      db.collection('matches').countDocuments({ status: 'completed' }),
      db.collection('matches').countDocuments({ status: 'completed', completedAt: { $gte: todayStart } }),
      db.collection('matches').countDocuments({ status: 'completed', completedAt: { $gte: since7 } }),
      db.collection('tournaments').countDocuments({}),
      db.collection('tournaments').countDocuments({ status: { $in: ['open', 'live'] } }),
      db.collection('clans').countDocuments({}),
      db.collection('matches').countDocuments({ status: { $in: ['ongoing', 'drafting', 'veto', 'pending_review'] } }),
      db.collection('players').countDocuments({ createdAt: { $gte: todayStart } }),
      db.collection('players').countDocuments({ createdAt: { $gte: since7 } }),
    ]);

    // Distinct active players (appeared in a completed match within the window)
    const activeRows = await db
      .collection('matches')
      .find({ status: 'completed', completedAt: { $gte: since30 } }, { projection: { teamA: 1, teamB: 1, completedAt: 1 } })
      .toArray();
    const set7 = new Set<string>();
    const set30 = new Set<string>();
    for (const m of activeRows) {
      const ids = [...(m.teamA || []), ...(m.teamB || [])].map((p: any) => p?.discordId).filter(Boolean);
      const t = m.completedAt ? new Date(m.completedAt).getTime() : 0;
      for (const id of ids) {
        set30.add(id);
        if (t >= since7.getTime()) set7.add(id);
      }
    }

    // Matches per day (last 14 days), gap-filled
    const perDayAgg = await db
      .collection('matches')
      .aggregate([
        { $match: { status: 'completed', completedAt: { $gte: since14 } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }, count: { $sum: 1 } } },
      ])
      .toArray();
    const byDay = new Map<string, number>();
    for (const r of perDayAgg) byDay.set(r._id, r.count);
    const perDay: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const k = dayKey(d);
      perDay.push({ date: k.slice(5), count: byDay.get(k) || 0 });
    }

    // DAU: distinct active players per day (last 14 days)
    const dauSets = new Map<string, Set<string>>();
    for (const m of activeRows) {
      if (!m.completedAt) continue;
      const k = dayKey(new Date(m.completedAt));
      const ids = [...(m.teamA || []), ...(m.teamB || [])].map((p: any) => p?.discordId).filter(Boolean);
      if (!dauSets.has(k)) dauSets.set(k, new Set());
      const set = dauSets.get(k)!;
      for (const id of ids) set.add(id);
    }
    const dauPerDay: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const k = dayKey(d);
      dauPerDay.push({ date: k.slice(5), count: dauSets.get(k)?.size || 0 });
    }

    // Top maps (last 30 days)
    const mapAgg = await db
      .collection('matches')
      .aggregate([
        { $match: { status: 'completed', completedAt: { $gte: since30 }, map: { $ne: null } } },
        { $group: { _id: '$map', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ])
      .toArray();
    const topMaps = mapAgg.map((m: any) => ({ map: m._id, count: m.count }));

    // Economy: total EP in circulation
    const epAgg = await db.collection('economy').aggregate([{ $group: { _id: null, total: { $sum: '$balance' }, wallets: { $sum: 1 } } }]).toArray();
    const totalEp = epAgg[0]?.total ?? 0;
    const wallets = epAgg[0]?.wallets ?? 0;

    return NextResponse.json({
      players: { total: totalPlayers, verified: verifiedPlayers, active7: set7.size, active30: set30.size, searchingNow, newToday: newPlayersToday, newWeek: newPlayersWeek },
      matches: { total: totalMatches, today: matchesToday, week: matchesWeek, ongoing: ongoingMatches, perDay },
      retention: { dauPerDay, wau: set7.size, mau: set30.size },
      tournaments: { total: totalTournaments, active: activeTournaments },
      clubs: { total: totalClubs },
      economy: { totalEp, wallets },
      topMaps,
    });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
