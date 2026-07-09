export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';

const sanitize = (team: any[]) =>
  (team || []).map((p: any) => ({
    copsName: p.copsName ?? 'Unknown',
    accountId: p.accountId ?? null,
    elo: p.elo ?? null,
    avatar: p.avatar ?? null,
  }));

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;

    const url = new URL(req.url);
    let scope = (url.searchParams.get('scope') || 'following').toLowerCase();
    if (!myId) scope = 'global'; // logged-out visitors only see global activity

    const db = await getDb();

    // Build the "circle": me + accepted friends.
    let circle: string[] = [];
    if (myId) {
      const fdocs = await db.collection('friendships').find({ status: 'accepted', $or: [{ a: myId }, { b: myId }] }).toArray();
      const friendIds = fdocs.map((f: any) => (f.a === myId ? f.b : f.a));
      circle = [myId, ...friendIds];
    }
    const circleSet = new Set(circle);

    // Matches.
    const matchFilter: any = { status: 'completed' };
    if (scope === 'following' && circle.length) {
      matchFilter.$or = [{ 'teamA.discordId': { $in: circle } }, { 'teamB.discordId': { $in: circle } }];
    }
    const rawMatches =
      scope === 'following' && !circle.length
        ? []
        : await db
            .collection('matches')
            .find(matchFilter)
            .sort({ completedAt: -1 })
            .limit(40)
            .project({ matchId: 1, map: 1, winner: 1, completedAt: 1, teamA: 1, teamB: 1, result: 1 })
            .toArray();

    const matchItems = rawMatches.map((m: any) => {
      const onA = (m.teamA || []).some((p: any) => p.discordId === myId);
      const onB = (m.teamB || []).some((p: any) => p.discordId === myId);
      const inMatch = onA || onB;
      let myResult: 'win' | 'loss' | null = null;
      let myDelta: number | null = null;
      if (inMatch) {
        myResult = m.winner === (onA ? 'A' : 'B') ? 'win' : 'loss';
        const change = (m.result?.changes || []).find((c: any) => c.discordId === myId);
        myDelta = change ? change.delta ?? null : null;
      }
      // Friends (not me) featured in this match.
      const friendNames = [...(m.teamA || []), ...(m.teamB || [])]
        .filter((p: any) => p.discordId !== myId && circleSet.has(p.discordId))
        .map((p: any) => p.copsName ?? 'Unknown');

      return {
        kind: 'match' as const,
        matchId: m.matchId,
        map: m.map ?? 'Unknown',
        winner: m.winner ?? null,
        at: m.completedAt ?? null,
        teamA: sanitize(m.teamA),
        teamB: sanitize(m.teamB),
        you: inMatch,
        myResult,
        myDelta,
        friendNames: [...new Set(friendNames)],
      };
    });

    // Friend events (only relevant to me).
    let friendItems: any[] = [];
    if (myId && scope !== 'global') {
      const accepted = await db
        .collection('friendships')
        .find({ status: 'accepted', $or: [{ a: myId }, { b: myId }], acceptedAt: { $ne: null } })
        .sort({ acceptedAt: -1 })
        .limit(10)
        .toArray();
      const otherIds = accepted.map((f: any) => (f.a === myId ? f.b : f.a));
      const players = otherIds.length
        ? await db.collection('players').find({ discordId: { $in: otherIds } }).project({ discordId: 1, copsName: 1, accountId: 1, avatar: 1 }).toArray()
        : [];
      const byId = new Map<any, any>(players.map((p: any) => [p.discordId, p]));
      friendItems = accepted.map((f: any) => {
        const other = f.a === myId ? f.b : f.a;
        const p = byId.get(other);
        return {
          kind: 'friend' as const,
          at: f.acceptedAt,
          name: p?.copsName ?? 'Someone',
          accountId: p?.accountId ?? null,
          avatar: p?.avatar ?? null,
        };
      });
    }

    const items = [...matchItems, ...friendItems]
      .filter((i) => i.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 30);

    return NextResponse.json({ items, scope });
  } catch {
    return NextResponse.json({ items: [], scope: 'global' });
  }
}
