export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../../lib/mongodb';
import { authOptions } from '../../../../lib/auth';
import { DECAY } from '../../../../lib/decay';

const DAY = 86400000;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const discordId = (session?.user as any)?.discordId as string | undefined;
  if (!discordId) return { ok: false as const, status: 401 };
  const db = await getDb();
  const me = await db.collection('players').findOne({ discordId }, { projection: { staffLevel: 1 } });
  if (me?.staffLevel !== 'admin' && me?.staffLevel !== 'mod') return { ok: false as const, status: 403 };
  return { ok: true as const, db, discordId };
}

async function lastMatchMap(db: any) {
  const since = new Date(Date.now() - DECAY.lookbackDays * DAY);
  const agg = await db
    .collection('matches')
    .aggregate([
      { $match: { status: 'completed', completedAt: { $gte: since } } },
      { $project: { players: { $concatArrays: [{ $ifNull: ['$teamA', []] }, { $ifNull: ['$teamB', []] }] }, completedAt: 1 } },
      { $unwind: '$players' },
      { $group: { _id: '$players.discordId', last: { $max: '$completedAt' } } },
    ])
    .toArray();
  return new Map<string, string | number | Date>(agg.map((a: any) => [a._id, a.last]));
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'Not authorized' }, { status: auth.status });
  const db = auth.db;
  const now = Date.now();
  const lastBy = await lastMatchMap(db);
  const players = await db.collection('players').find({ elo: { $gt: DECAY.floor }, gamesPlayed: { $gte: DECAY.minGames } }, { projection: { discordId: 1, elo: 1, lastDecayAt: 1 } }).toArray();
  let eligible = 0;
  for (const p of players as any[]) {
    const last = lastBy.get(p.discordId);
    const inactiveMs = last ? now - new Date(last).getTime() : Infinity;
    if (inactiveMs < DECAY.graceDays * DAY) continue;
    const lastDecay = p.lastDecayAt ? new Date(p.lastDecayAt).getTime() : 0;
    if (lastDecay && now - lastDecay < 7 * DAY) continue;
    eligible++;
  }
  return NextResponse.json({ eligible, rankedPlayers: players.length, config: DECAY });
}

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'Not authorized' }, { status: auth.status });
  const db = auth.db;
  const now = Date.now();
  const lastBy = await lastMatchMap(db);
  const players = await db.collection('players').find({ elo: { $gt: DECAY.floor }, gamesPlayed: { $gte: DECAY.minGames } }, { projection: { discordId: 1, elo: 1, lastDecayAt: 1 } }).toArray();

  const ops: any[] = [];
  let decayed = 0;
  let eloRemoved = 0;
  for (const p of players as any[]) {
    const last = lastBy.get(p.discordId);
    const inactiveMs = last ? now - new Date(last).getTime() : Infinity;
    if (inactiveMs < DECAY.graceDays * DAY) {
      // Active again — reset decay tracking so it restarts cleanly next time.
      if (p.lastDecayAt) ops.push({ updateOne: { filter: { discordId: p.discordId }, update: { $unset: { lastDecayAt: '' } } } });
      continue;
    }
    const lastDecay = p.lastDecayAt ? new Date(p.lastDecayAt).getTime() : 0;
    if (lastDecay && now - lastDecay < 7 * DAY) continue; // decayed within the last week
    const newElo = Math.max(DECAY.floor, (p.elo || 1000) - DECAY.perWeek);
    if (newElo < p.elo) {
      ops.push({ updateOne: { filter: { discordId: p.discordId }, update: { $set: { elo: newElo, lastDecayAt: new Date() } } } });
      decayed++;
      eloRemoved += p.elo - newElo;
    }
  }
  if (ops.length) await db.collection('players').bulkWrite(ops, { ordered: false });
  return NextResponse.json({ ok: true, decayed, eloRemoved });
}
