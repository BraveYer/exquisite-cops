export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';
import { activeSanction, sanctionMessage } from '../../../lib/sanctions';
import { MAPS } from '../../../lib/maps';

export async function GET() {
  try {
    const db = await getDb();
    const queuePlayers = await db.collection('queue').find({}).toArray();
    return NextResponse.json({ count: queuePlayers.length, players: queuePlayers });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const db = await getDb();
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === 'join') {
      const player = await db.collection('players').findOne({ discordId });
      if (!player) {
        return NextResponse.json(
          { error: 'You are not registered yet. Use /link on Discord first.' },
          { status: 400 }
        );
      }
      if (!player.verified) {
        return NextResponse.json(
          { error: 'Verify your account first: change your in-game icon, then /verify on Discord.' },
          { status: 403 }
        );
      }

      // Dodge penalty cooldown
      if (player.dodgeUntil && new Date(player.dodgeUntil).getTime() > Date.now()) {
        const mins = Math.ceil((new Date(player.dodgeUntil).getTime() - Date.now()) / 60000);
        return NextResponse.json({ error: `You dodged a match — queue locked for ${mins} more minute${mins === 1 ? '' : 's'}.` }, { status: 403 });
      }

      // Can't queue while you're already in a live match.
      const activeMatch = await db.collection('matches').findOne({
        status: { $in: ['ongoing', 'pending_review', 'disputed'] },
        $or: [{ 'teamA.discordId': discordId }, { 'teamB.discordId': discordId }],
      });
      if (activeMatch) {
        return NextResponse.json(
          { error: 'You are already in a match — finish it before searching again.', matchId: activeMatch.matchId },
          { status: 409 }
        );
      }

      // Blocked while banned.
      const ban = await activeSanction(db, discordId, ['ban']);
      if (ban) return NextResponse.json({ error: sanctionMessage(ban) }, { status: 403 });

      const now = new Date();
      const mapPrefs = Array.isArray(body?.mapPrefs) ? body.mapPrefs.filter((m: any) => MAPS.includes(m)).slice(0, 7) : [];
      await db.collection('queue').updateOne(
        { discordId },
        {
          $set: {
            discordId,
            copsName: player.copsName ?? null,
            elo: player.elo ?? 1000,
            mapPrefs,
            lastSeen: now,
          },
          $setOnInsert: { joinedAt: now },
        },
        { upsert: true }
      );
    } else if (action === 'heartbeat') {
      // Keep-alive while searching: refresh lastSeen (no-op if not in queue).
      const ban = await activeSanction(db, discordId, ['ban']);
      if (ban) {
        await db.collection('queue').deleteOne({ discordId });
        return NextResponse.json({ error: sanctionMessage(ban) }, { status: 403 });
      }
      await db.collection('queue').updateOne({ discordId }, { $set: { lastSeen: new Date() } });
    } else if (action === 'leave') {
      await db.collection('queue').deleteOne({ discordId });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
