export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';

// Returns the current player's active match (drafting / veto / live), if any.
// Used by the floating "your match is ready" banner. Never leaks discordId.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ matchId: null });

    const db = await getDb();
    const match = await db.collection('matches').findOne(
      {
        status: { $in: ['drafting', 'veto', 'ongoing', 'pending_review'] },
        $or: [
          { 'teamA.discordId': discordId },
          { 'teamB.discordId': discordId },
          { 'pool.discordId': discordId },
        ],
      },
      { sort: { createdAt: -1 }, projection: { matchId: 1, status: 1, _id: 0 } }
    );

    if (!match) return NextResponse.json({ matchId: null });
    return NextResponse.json({ matchId: match.matchId, status: match.status });
  } catch {
    return NextResponse.json({ matchId: null });
  }
}
