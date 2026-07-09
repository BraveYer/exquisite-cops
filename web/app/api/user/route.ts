export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const db = await getDb();
    // Same query the debug route proved works: find by the session's Discord ID.
    const player = await db.collection('players').findOne({ discordId });

    if (!player) {
      return NextResponse.json({
        linked: false,
        elo: 1000,
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        winRate: 0,
        copsName: null,
        level: 0,
        verified: false,
      });
    }

    const wins = player.wins ?? 0;
    const losses = player.losses ?? 0;
    const games = wins + losses;
    const winRate = games > 0 ? Math.round((wins / games) * 100) : 0;

    // Capture the Discord avatar so public profiles can show it (write only when it changes).
    const sessionAvatar = (session?.user as any)?.image ?? null;
    if (sessionAvatar && player.avatar !== sessionAvatar) {
      await db.collection('players').updateOne({ discordId }, { $set: { avatar: sessionAvatar } });
    }

    return NextResponse.json({
      linked: true,
      accountId: player.accountId ?? null,
      staffLevel: player.staffLevel ?? null,
      elo: player.elo ?? 1000,
      wins,
      losses,
      gamesPlayed: player.gamesPlayed ?? games,
      winRate,
      copsName: player.copsName ?? null,
      level: player.level ?? 0,
      verified: player.verified ?? false,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
