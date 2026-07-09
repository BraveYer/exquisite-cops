export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../../../lib/mongodb';
import { authOptions } from '../../../../../lib/auth';
import { completeMatch } from '../../../../../lib/matchComplete';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const winner = body?.winner;
    if (winner !== 'A' && winner !== 'B') {
      return NextResponse.json({ error: 'Invalid winner.' }, { status: 400 });
    }

    const db = await getDb();
    const match: any = await db.collection('matches').findOne({ matchId: id });
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    if (match.status !== 'ongoing') {
      return NextResponse.json({ error: `Match is already ${match.status}.` }, { status: 400 });
    }

    const teamAIds: string[] = (match.teamA || []).map((p: any) => p.discordId);
    const teamBIds: string[] = (match.teamB || []).map((p: any) => p.discordId);
    if (!teamAIds.includes(discordId) && !teamBIds.includes(discordId)) {
      return NextResponse.json({ error: 'You are not in this match.' }, { status: 403 });
    }

    const reports: any[] = Array.isArray(match.reports) ? match.reports : [];
    const updatedReports = [
      ...reports.filter((r) => r.discordId !== discordId),
      { discordId, winner, reportedAt: new Date() },
    ];
    await db.collection('matches').updateOne({ matchId: id }, { $set: { reports: updatedReports } });

    if (new Set(updatedReports.map((r) => r.winner)).size > 1) {
      await db.collection('matches').updateOne({ matchId: id }, { $set: { status: 'disputed' } });
      return NextResponse.json({ status: 'disputed' });
    }

    const total = teamAIds.length + teamBIds.length;
    const threshold = Math.ceil(total / 2);
    if (updatedReports.length >= threshold) {
      const completed = await completeMatch(db, id, winner);
      return NextResponse.json({ status: 'completed', match: completed });
    }

    return NextResponse.json({
      status: 'ongoing',
      reported: winner,
      have: updatedReports.length,
      need: threshold,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
