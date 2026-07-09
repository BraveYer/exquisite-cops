export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';
import { notify } from '../../../lib/notify';

async function me() {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.discordId as string | undefined;
}

export async function GET() {
  try {
    const myId = await me();
    if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    const db = await getDb();

    const docs = await db.collection('friendships').find({ $or: [{ a: myId }, { b: myId }] }).toArray();

    const otherIds = new Set<string>();
    for (const d of docs) otherIds.add(d.a === myId ? d.b : d.a);

    const players = await db
      .collection('players')
      .find({ discordId: { $in: [...otherIds] } })
      .project({ discordId: 1, accountId: 1, copsName: 1, elo: 1, avatar: 1 })
      .toArray();
    const byId = new Map<any, any>(players.map((p: any) => [p.discordId, p]));
    const info = (id: string) => {
      const p = byId.get(id);
      return { accountId: p?.accountId ?? null, copsName: p?.copsName ?? 'Unknown', elo: p?.elo ?? 1000, avatar: p?.avatar ?? null };
    };

    const friends: any[] = [];
    const incoming: any[] = [];
    const outgoing: any[] = [];
    for (const d of docs) {
      const other = d.a === myId ? d.b : d.a;
      if (d.status === 'accepted') friends.push(info(other));
      else if (d.status === 'pending') {
        if (d.b === myId) incoming.push(info(other));
        else outgoing.push(info(other));
      }
    }
    friends.sort((x, y) => (y.elo || 0) - (x.elo || 0));

    return NextResponse.json({ friends, incoming, outgoing });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const myId = await me();
    if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = (body?.action || '').toString();
    const target = body?.target;
    if (!['request', 'accept', 'decline', 'cancel', 'remove'].includes(action)) {
      return NextResponse.json({ error: 'Bad action' }, { status: 400 });
    }

    const db = await getDb();
    const meDoc = await db.collection('players').findOne({ discordId: myId }, { projection: { copsName: 1, accountId: 1 } });
    const myName = meDoc?.copsName || 'Someone';
    const myAccountId = meDoc?.accountId ?? null;
    const targetPlayer = await db.collection('players').findOne({ accountId: Number(target) }, { projection: { discordId: 1 } });
    if (!targetPlayer?.discordId) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const otherId = targetPlayer.discordId;
    if (otherId === myId) return NextResponse.json({ error: 'That is you' }, { status: 400 });

    const pairFilter = { $or: [{ a: myId, b: otherId }, { a: otherId, b: myId }] };

    if (action === 'request') {
      const existing = await db.collection('friendships').findOne(pairFilter);
      if (existing) return NextResponse.json({ ok: true, already: true });
      await db.collection('friendships').insertOne({ a: myId, b: otherId, status: 'pending', createdAt: new Date(), acceptedAt: null });
    } else if (action === 'accept') {
      await db.collection('friendships').updateOne(
        { a: otherId, b: myId, status: 'pending' },
        { $set: { status: 'accepted', acceptedAt: new Date() } }
      );
      await notify(db, otherId, { type: 'friend_accept', title: 'Friend request accepted', body: `${myName} accepted your friend request`, link: myAccountId ? `/profile/${myAccountId}` : '/friends' });
    } else if (action === 'decline') {
      await db.collection('friendships').deleteOne({ a: otherId, b: myId, status: 'pending' });
    } else if (action === 'cancel') {
      await db.collection('friendships').deleteOne({ a: myId, b: otherId, status: 'pending' });
    } else if (action === 'remove') {
      await db.collection('friendships').deleteOne({ ...pairFilter, status: 'accepted' } as any);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
