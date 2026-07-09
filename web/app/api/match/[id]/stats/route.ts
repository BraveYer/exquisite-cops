export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../../../lib/mongodb';
import { authOptions } from '../../../../../lib/auth';

function clampInt(v: any): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(999, n);
}

// Staff-only. Accepts a single player or a whole scoreboard batch.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    const db = await getDb();

    const me = await db.collection('players').findOne({ discordId: myId }, { projection: { staffLevel: 1 } });
    if (me?.staffLevel !== 'admin' && me?.staffLevel !== 'mod') return NextResponse.json({ error: 'Staff only' }, { status: 403 });

    const match = await db.collection('matches').findOne({ matchId: id }, { projection: { teamA: 1, teamB: 1, status: 1 } });
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    const dids = [...(match.teamA || []), ...(match.teamB || [])].map((p: any) => p?.discordId).filter(Boolean);

    const body = await req.json().catch(() => ({}));
    const updates: { t: string; k: number; d: number; a: number }[] = [];
    if (Array.isArray(body?.stats)) {
      for (const s of body.stats) {
        const t = (s?.discordId || '').toString();
        if (t && dids.includes(t)) updates.push({ t, k: clampInt(s?.k), d: clampInt(s?.d), a: clampInt(s?.a) });
      }
    } else {
      const t = (body?.targetDiscordId || '').toString();
      if (t && dids.includes(t)) updates.push({ t, k: clampInt(body?.k), d: clampInt(body?.d), a: clampInt(body?.a) });
    }
    if (updates.length === 0) return NextResponse.json({ error: 'No valid players to update' }, { status: 400 });

    const set: Record<string, any> = {};
    for (const u of updates) set[`playerStats.${u.t}`] = { k: u.k, d: u.d, a: u.a, by: myId, at: new Date() };
    await db.collection('matches').updateOne({ matchId: id }, { $set: set });
    return NextResponse.json({ ok: true, updated: updates.length });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
