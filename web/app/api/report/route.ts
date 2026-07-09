export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';

const REASONS = ['cheating', 'toxic', 'afk', 'smurf', 'other'];

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const matchId = (body?.matchId || '').toString();
    const reportedId = (body?.reportedId || '').toString();
    const reason = (body?.reason || '').toString();
    const note = (body?.note || '').toString().slice(0, 500);

    if (!matchId || !reportedId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    if (!REASONS.includes(reason)) return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
    if (reportedId === discordId) return NextResponse.json({ error: 'You cannot report yourself' }, { status: 400 });

    const db = await getDb();
    const match = await db.collection('matches').findOne({ matchId });
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    const everyone: any[] = [...(match.teamA || []), ...(match.teamB || []), ...(match.pool || [])];
    const reporter = everyone.find((p) => p.discordId === discordId);
    const reported = everyone.find((p) => p.discordId === reportedId);
    if (!reporter) return NextResponse.json({ error: 'You were not in this match' }, { status: 403 });
    if (!reported) return NextResponse.json({ error: 'That player was not in this match' }, { status: 400 });

    // One open report per reporter -> reported per match.
    const existing = await db.collection('playerReports').findOne({
      matchId,
      reporterDiscordId: discordId,
      reportedDiscordId: reportedId,
      status: 'open',
    });
    if (existing) return NextResponse.json({ ok: true, already: true });

    // Grab the reported player's accountId so staff can open their profile.
    const reportedPlayer = await db
      .collection('players')
      .findOne({ discordId: reportedId }, { projection: { accountId: 1, copsName: 1 } });

    await db.collection('playerReports').insertOne({
      matchId,
      reportedDiscordId: reportedId,
      reportedName: reported.copsName || reportedPlayer?.copsName || 'Unknown',
      reportedAccountId: reportedPlayer?.accountId ?? null,
      reporterDiscordId: discordId,
      reporterName: reporter.copsName || 'Unknown',
      reason,
      note,
      status: 'open',
      createdAt: new Date(),
      resolvedAt: null,
      resolvedBy: null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
