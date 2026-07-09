export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../../lib/mongodb';
import { authOptions } from '../../../../lib/auth';

function csvCell(v: any): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers: string[], rows: any[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    const db = await getDb();
    const me = await db.collection('players').findOne({ discordId }, { projection: { staffLevel: 1 } });
    if (me?.staffLevel !== 'admin' && me?.staffLevel !== 'mod') return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const type = (new URL(req.url).searchParams.get('type') || 'players').toString();
    let csv = '';

    if (type === 'players') {
      const players = await db
        .collection('players')
        .find({}, { projection: { copsName: 1, accountId: 1, elo: 1, wins: 1, losses: 1, gamesPlayed: 1, staffLevel: 1, discordId: 1, createdAt: 1 } })
        .sort({ elo: -1 })
        .toArray();
      const headers = ['copsName', 'accountId', 'elo', 'wins', 'losses', 'gamesPlayed', 'staffLevel', 'discordId', 'createdAt'];
      const rows = players.map((p: any) => [
        p.copsName ?? '',
        p.accountId ?? '',
        p.elo ?? 1000,
        p.wins ?? 0,
        p.losses ?? 0,
        p.gamesPlayed ?? 0,
        p.staffLevel ?? '',
        p.discordId ?? '',
        p.createdAt ? new Date(p.createdAt).toISOString() : '',
      ]);
      csv = toCsv(headers, rows);
    } else if (type === 'matches') {
      const matches = await db
        .collection('matches')
        .find({}, { projection: { matchId: 1, status: 1, map: 1, teamA: 1, teamB: 1, winner: 1, createdAt: 1, completedAt: 1 } })
        .sort({ createdAt: -1 })
        .limit(5000)
        .toArray();
      const headers = ['matchId', 'status', 'map', 'teamA', 'teamB', 'winner', 'createdAt', 'completedAt'];
      const rows = matches.map((m: any) => [
        m.matchId ?? String(m._id),
        m.status ?? '',
        m.map ?? '',
        (m.teamA || []).map((p: any) => p.copsName || p.discordId || '').join('|'),
        (m.teamB || []).map((p: any) => p.copsName || p.discordId || '').join('|'),
        m.winner ?? '',
        m.createdAt ? new Date(m.createdAt).toISOString() : '',
        m.completedAt ? new Date(m.completedAt).toISOString() : '',
      ]);
      csv = toCsv(headers, rows);
    } else {
      return NextResponse.json({ error: 'Unknown export type' }, { status: 400 });
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
