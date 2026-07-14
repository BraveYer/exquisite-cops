export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ loggedIn: false });

    const db = await getDb();
    const [player, eco] = await Promise.all([
      db.collection('players').findOne({ discordId: myId }, { projection: { copsName: 1, gamesPlayed: 1, verified: 1 } }),
      db.collection('economy').findOne({ discordId: myId }, { projection: { items: 1, streak: 1 } }),
    ]);

    return NextResponse.json({
      loggedIn: true,
      linked: !!player?.copsName,
      verified: !!player?.verified,
      games: player?.gamesPlayed ?? 0,
      claimedDaily: (eco?.streak ?? 0) >= 1,
      ownsCosmetic: (eco?.items?.length ?? 0) > 0,
    });
  } catch {
    return NextResponse.json({ loggedIn: false });
  }
}
