export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../../lib/mongodb';
import { authOptions } from '../../../../lib/auth';

// Soft reset: compress everyone toward BASE so good players keep an edge but re-climb.
const BASE = 1000;
const FACTOR = 0.5;
const FLOOR = 100;
const SNAPSHOT_TOP = 100;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const db = await getDb();
    const me = await db.collection('players').findOne({ discordId });
    // Season management is admin-only (destructive — resets everyone's ELO).
    if (me?.staffLevel !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = (body?.action || '').toString();

    const active = await db.collection('seasons').findOne({ status: 'active' });

    if (action === 'start') {
      if (active) return NextResponse.json({ error: 'A season is already active — end it first' }, { status: 400 });
      const last = await db.collection('seasons').find({}).sort({ number: -1 }).limit(1).toArray();
      const number = (last[0]?.number ?? 0) + 1;
      const doc = {
        number,
        name: `Season ${number}`,
        status: 'active',
        startedAt: new Date(),
        endedAt: null,
        finalStandings: [] as any[],
      };
      await db.collection('seasons').insertOne(doc);
      return NextResponse.json({ ok: true, season: { ...doc } });
    }

    if (action === 'end') {
      if (!active) return NextResponse.json({ error: 'No active season to end' }, { status: 400 });

      // Snapshot the final standings (before the reset).
      const top = await db
        .collection('players')
        .find({}, { projection: { _id: 0, accountId: 1, copsName: 1, elo: 1 } })
        .sort({ elo: -1 })
        .limit(SNAPSHOT_TOP)
        .toArray();
      const finalStandings = top.map((p: any, i: number) => ({
        rank: i + 1,
        accountId: p.accountId ?? null,
        copsName: p.copsName ?? 'Unknown',
        elo: p.elo ?? BASE,
      }));

      await db.collection('seasons').updateOne(
        { _id: active._id },
        { $set: { status: 'ended', endedAt: new Date(), finalStandings } }
      );

      // Soft reset everyone's ELO toward BASE.
      await db.collection('players').updateMany({}, [
        {
          $set: {
            elo: {
              $max: [
                FLOOR,
                {
                  $round: [
                    { $add: [BASE, { $multiply: [{ $subtract: [{ $ifNull: ['$elo', BASE] }, BASE] }, FACTOR] }] },
                    0,
                  ],
                },
              ],
            },
          },
        },
      ]);

      return NextResponse.json({ ok: true, ended: active.number, standings: finalStandings.length });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
