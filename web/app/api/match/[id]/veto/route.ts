export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../../../lib/mongodb';
import { authOptions } from '../../../../../lib/auth';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const map = (body?.map || '').toString();
    if (!map) return NextResponse.json({ error: 'Missing map' }, { status: 400 });

    const db = await getDb();
    const match = await db.collection('matches').findOne({ matchId: id });
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    if (match.status !== 'veto') return NextResponse.json({ error: 'Veto is not active' }, { status: 400 });

    const captainA = match.teamA?.[0]?.discordId;
    const captainB = match.teamB?.[0]?.discordId;
    const callerTeam = discordId === captainA ? 'A' : discordId === captainB ? 'B' : null;
    if (!callerTeam) return NextResponse.json({ error: 'Only the two captains can ban' }, { status: 403 });
    if (match.vetoTurn !== callerTeam) return NextResponse.json({ error: 'Not your turn' }, { status: 403 });

    const pool: string[] = match.mapPool || [];
    if (!pool.includes(map)) return NextResponse.json({ error: 'Map not available' }, { status: 400 });
    if (pool.length <= 1) return NextResponse.json({ error: 'Veto already complete' }, { status: 400 });

    const otherTurn = callerTeam === 'A' ? 'B' : 'A';

    // Atomic, race-safe ban: only applies if it is still this captain's turn
    // and the map is still in the pool.
    const upd = await db.collection('matches').updateOne(
      { matchId: id, status: 'veto', vetoTurn: callerTeam, mapPool: map },
      {
        $pull: { mapPool: map },
        $push: { bannedMaps: { map, by: callerTeam } },
        $set: { vetoTurn: otherTurn },
      } as any
    );
    if (upd.modifiedCount === 0) {
      return NextResponse.json({ error: 'Ban not applied — turn changed or map already banned' }, { status: 409 });
    }

    // When one map remains, the veto is done — lock the map and start the match.
    const after = await db.collection('matches').findOne(
      { matchId: id },
      { projection: { mapPool: 1, status: 1 } }
    );
    if (after && (after.mapPool || []).length === 1 && after.status === 'veto') {
      await db.collection('matches').updateOne(
        { matchId: id, status: 'veto' },
        { $set: { status: 'ongoing', map: (after.mapPool as string[])[0] } }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
