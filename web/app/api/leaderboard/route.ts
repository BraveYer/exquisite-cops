export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../lib/mongodb';

export async function GET() {
  try {
    const db = await getDb();

    // discordId is fetched only to compute recent form — it is NEVER returned.
    const players = await db
      .collection('players')
      .find(
        {},
        { projection: { _id: 0, discordId: 1, accountId: 1, copsName: 1, elo: 1, wins: 1, losses: 1, gamesPlayed: 1, level: 1, avatar: 1, cosmetics: 1 } }
      )
      .sort({ elo: -1 })
      .limit(50)
      .toArray();

    const ids = players.map((p: any) => p.discordId).filter(Boolean);
    const idSet = new Set(ids);

    // Last 5 results per player, newest first.
    const formByDiscord = new Map<string, ('W' | 'L')[]>();
    if (ids.length > 0) {
      const recent = await db
        .collection('matches')
        .find({
          status: 'completed',
          $or: [{ 'teamA.discordId': { $in: ids } }, { 'teamB.discordId': { $in: ids } }],
        })
        .sort({ completedAt: -1 })
        .limit(500)
        .project({ teamA: 1, teamB: 1, winner: 1, completedAt: 1 })
        .toArray();

      for (const m of recent) {
        const onA = new Set((m.teamA || []).map((p: any) => p.discordId));
        const onB = new Set((m.teamB || []).map((p: any) => p.discordId));
        for (const id of [...onA, ...onB] as string[]) {
          if (!idSet.has(id)) continue;
          const arr = formByDiscord.get(id) || [];
          if (arr.length >= 5) continue;
          const team = onA.has(id) ? 'A' : 'B';
          arr.push(m.winner === team ? 'W' : 'L');
          formByDiscord.set(id, arr);
        }
      }
    }

    // Club tag per player (for the [TAG] chip)
    const clubByDiscord = new Map<string, any>();
    if (ids.length > 0) {
      const mems = await db.collection('clanMembers').find({ discordId: { $in: ids } }, { projection: { discordId: 1, clanId: 1 } }).toArray();
      const clanIds = [...new Set(mems.map((m: any) => m.clanId))];
      const objIds = clanIds
        .map((c: string) => {
          try {
            return new ObjectId(c);
          } catch {
            return null;
          }
        })
        .filter((x): x is ObjectId => x !== null);
      const clubs = objIds.length ? await db.collection('clans').find({ _id: { $in: objIds } }, { projection: { tag: 1, color: 1 } }).toArray() : [];
      const clubBy = new Map<any, any>(clubs.map((c: any) => [String(c._id), c]));
      for (const m of mems) {
        const c = clubBy.get(m.clanId);
        if (c) clubByDiscord.set(m.discordId, { id: m.clanId, tag: c.tag, color: c.color || null });
      }
    }

    const rows = players.map((p: any) => ({
      accountId: p.accountId ?? null,
      copsName: p.copsName ?? null,
      avatar: p.avatar ?? null,
      elo: p.elo ?? 1000,
      wins: p.wins ?? 0,
      losses: p.losses ?? 0,
      gamesPlayed: p.gamesPlayed ?? 0,
      level: p.level ?? 0,
      form: formByDiscord.get(p.discordId) || [],
      club: clubByDiscord.get(p.discordId) || null,
      nameStyle: p.cosmetics?.name || null,
      frame: p.cosmetics?.frame || null,
    }));

    return NextResponse.json({ players: rows });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
