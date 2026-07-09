export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../../../lib/mongodb';
import { authOptions } from '../../../../../lib/auth';
import { MAP_POOL } from '../../../../../lib/maps';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const playerId = (body?.playerId || '').toString();
    if (!playerId) return NextResponse.json({ error: 'Missing playerId' }, { status: 400 });

    const db = await getDb();
    const match = await db.collection('matches').findOne({ matchId: id });
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    if (match.status !== 'drafting') return NextResponse.json({ error: 'Draft is not active' }, { status: 400 });

    const captainA = match.teamA?.[0]?.discordId;
    const captainB = match.teamB?.[0]?.discordId;
    const callerTeam = discordId === captainA ? 'A' : discordId === captainB ? 'B' : null;
    if (!callerTeam) return NextResponse.json({ error: 'Only the two captains can pick' }, { status: 403 });
    if (match.pickTurn !== callerTeam) return NextResponse.json({ error: 'Not your turn' }, { status: 403 });

    const picked = (match.pool || []).find((p: any) => p.discordId === playerId);
    if (!picked) return NextResponse.json({ error: 'Player not in the pool' }, { status: 400 });

    const teamField = callerTeam === 'A' ? 'teamA' : 'teamB';
    const otherTurn = callerTeam === 'A' ? 'B' : 'A';

    // Atomic, race-safe move: only applies if it is still this captain's turn
    // and the player is still available.
    const upd = await db.collection('matches').updateOne(
      { matchId: id, status: 'drafting', pickTurn: callerTeam, 'pool.discordId': playerId },
      {
        $pull: { pool: { discordId: playerId } },
        $push: { [teamField]: picked },
        $set: { pickTurn: otherTurn },
      } as any
    );
    if (upd.modifiedCount === 0) {
      return NextResponse.json({ error: 'Pick not applied — turn changed or player already taken' }, { status: 409 });
    }

    // When the pool empties, the draft is done — move to map veto.
    const after = await db.collection('matches').findOne({ matchId: id }, { projection: { pool: 1, status: 1 } });
    if (after && (after.pool || []).length === 0 && after.status === 'drafting') {
      await db.collection('matches').updateOne(
        { matchId: id, status: 'drafting' },
        {
          $set: {
            status: 'veto',
            mapPool: [...MAP_POOL],
            bannedMaps: [],
            vetoTurn: Math.random() < 0.5 ? 'A' : 'B',
            map: null,
          },
        }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
