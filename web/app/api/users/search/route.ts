export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../../lib/mongodb';
import { authOptions } from '../../../../lib/auth';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ results: [] });

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    if (q.length < 2) return NextResponse.json({ results: [] });

    const db = await getDb();
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const players = await db
      .collection('players')
      .find({ copsName: { $regex: safe, $options: 'i' }, discordId: { $ne: myId } })
      .project({ accountId: 1, copsName: 1, elo: 1, avatar: 1 })
      .limit(8)
      .toArray();

    const results = players
      .filter((p: any) => p.accountId != null)
      .map((p: any) => ({ accountId: p.accountId, copsName: p.copsName ?? 'Unknown', elo: p.elo ?? 1000, avatar: p.avatar ?? null }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
