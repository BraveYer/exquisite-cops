export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../../lib/mongodb';
import { authOptions } from '../../../../lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ matchId: null });

    const db = await getDb();
    const match = await db.collection('matches').findOne({
      status: 'ongoing',
      $or: [{ 'teamA.discordId': discordId }, { 'teamB.discordId': discordId }],
    });

    return NextResponse.json({ matchId: match ? match.matchId : null });
  } catch (error) {
    return NextResponse.json({ matchId: null });
  }
}
