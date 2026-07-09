export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';
import { activeSanction, sanctionMessage } from '../../../lib/sanctions';

const MAX_LEN = 1000;
const LIMIT = 60;

function convOf(a: string, b: string) {
  return 'dm:' + [a, b].sort().join('_');
}

// Resolve a friend by accountId and confirm an accepted friendship with me.
async function resolveFriend(db: any, myId: string, accountId: any) {
  const acc = Number(accountId);
  if (!Number.isFinite(acc)) return { error: 'Bad user', status: 400 as const };
  const target = await db
    .collection('players')
    .findOne({ accountId: acc }, { projection: { discordId: 1, copsName: 1, avatar: 1, elo: 1, accountId: 1 } });
  if (!target?.discordId) return { error: 'User not found', status: 404 as const };
  if (target.discordId === myId) return { error: 'That is you', status: 400 as const };
  const fr = await db.collection('friendships').findOne({
    $or: [
      { a: myId, b: target.discordId },
      { a: target.discordId, b: myId },
    ],
    status: 'accepted',
  });
  if (!fr) return { error: 'You can only message friends', status: 403 as const };
  return { target };
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const db = await getDb();
    const url = new URL(req.url);
    const withAcc = url.searchParams.get('with');
    const countOnly = url.searchParams.get('count');

    // my per-conversation read markers
    const readsArr = await db.collection('dmReads').find({ userId: myId }).toArray();
    const reads = new Map<string, number>();
    for (const r of readsArr) reads.set(r.convId, r.lastReadAt ? new Date(r.lastReadAt).getTime() : 0);

    // --- lightweight unread total (for the sidebar badge) ---
    if (countOnly) {
      const incoming = await db
        .collection('dms')
        .find({ to: myId }, { projection: { convId: 1, createdAt: 1 } })
        .sort({ createdAt: -1 })
        .limit(500)
        .toArray();
      let unread = 0;
      for (const m of incoming) {
        const t = m.createdAt ? new Date(m.createdAt).getTime() : 0;
        if (t > (reads.get(m.convId) || 0)) unread++;
      }
      return NextResponse.json({ unread });
    }

    // --- a single thread ---
    if (withAcc) {
      const rf = await resolveFriend(db, myId, withAcc);
      if ('error' in rf) return NextResponse.json({ error: rf.error }, { status: rf.status });
      const convId = convOf(myId, rf.target.discordId);

      const raw = await db.collection('dms').find({ convId }).sort({ createdAt: -1 }).limit(LIMIT).toArray();
      const messages = raw.reverse().map((m: any) => ({
        id: String(m._id),
        fromMe: m.from === myId,
        fromName: m.fromName ?? 'Unknown',
        fromAccountId: m.fromAccountId ?? null,
        fromAvatar: m.fromAvatar ?? null,
        fromElo: m.fromElo ?? 1000,
        text: m.text ?? '',
        createdAt: m.createdAt ?? null,
      }));

      // mark this conversation read
      await db.collection('dmReads').updateOne({ convId, userId: myId }, { $set: { lastReadAt: new Date() } }, { upsert: true });

      return NextResponse.json({
        friend: {
          accountId: rf.target.accountId ?? null,
          copsName: rf.target.copsName ?? 'Unknown',
          avatar: rf.target.avatar ?? null,
          elo: rf.target.elo ?? 1000,
        },
        messages,
      });
    }

    // --- conversation list (all accepted friends) ---
    const fships = await db.collection('friendships').find({ $or: [{ a: myId }, { b: myId }], status: 'accepted' }).toArray();
    const friendIds: string[] = fships.map((f: any) => (f.a === myId ? f.b : f.a));
    if (friendIds.length === 0) return NextResponse.json({ conversations: [], unread: 0 });

    const players = await db
      .collection('players')
      .find({ discordId: { $in: friendIds } })
      .project({ discordId: 1, accountId: 1, copsName: 1, elo: 1, avatar: 1 })
      .toArray();
    const byDiscord = new Map<string, any>();
    for (const p of players) byDiscord.set(p.discordId, p);

    const convIds = friendIds.map((fid) => convOf(myId, fid));

    // last message per conversation
    const lastAgg = await db
      .collection('dms')
      .aggregate([
        { $match: { convId: { $in: convIds } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$convId', text: { $first: '$text' }, createdAt: { $first: '$createdAt' }, from: { $first: '$from' } } },
      ])
      .toArray();
    const lastByConv = new Map<string, any>();
    for (const l of lastAgg) lastByConv.set(l._id, l);

    // unread per conversation (messages to me newer than my read marker)
    const incoming = await db
      .collection('dms')
      .find({ convId: { $in: convIds }, to: myId }, { projection: { convId: 1, createdAt: 1 } })
      .limit(1000)
      .toArray();
    const unreadByConv = new Map<string, number>();
    for (const m of incoming) {
      const t = m.createdAt ? new Date(m.createdAt).getTime() : 0;
      if (t > (reads.get(m.convId) || 0)) unreadByConv.set(m.convId, (unreadByConv.get(m.convId) || 0) + 1);
    }

    let unreadTotal = 0;
    const conversations = friendIds.map((fid) => {
      const p = byDiscord.get(fid);
      const convId = convOf(myId, fid);
      const last = lastByConv.get(convId);
      const unread = unreadByConv.get(convId) || 0;
      unreadTotal += unread;
      return {
        accountId: p?.accountId ?? null,
        copsName: p?.copsName ?? 'Unknown',
        avatar: p?.avatar ?? null,
        elo: p?.elo ?? 1000,
        lastText: last?.text ?? '',
        lastFromMe: last ? last.from === myId : false,
        lastAt: last?.createdAt ?? null,
        unread,
      };
    });

    conversations.sort((x, y) => {
      const tx = x.lastAt ? new Date(x.lastAt).getTime() : 0;
      const ty = y.lastAt ? new Date(y.lastAt).getTime() : 0;
      if (tx !== ty) return ty - tx;
      return (x.copsName || '').localeCompare(y.copsName || '');
    });

    return NextResponse.json({ conversations, unread: unreadTotal });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const db = await getDb();
    const body = await req.json().catch(() => ({}));
    const action = (body?.action || '').toString();

    const me = await db.collection('players').findOne({ discordId: myId }, { projection: { copsName: 1, accountId: 1, avatar: 1, elo: 1 } });
    if (!me) return NextResponse.json({ error: 'Not linked' }, { status: 403 });

    if (action === 'send') {
      const rf = await resolveFriend(db, myId, body?.to);
      if ('error' in rf) return NextResponse.json({ error: rf.error }, { status: rf.status });
      const text = (body?.text || '').toString().trim().slice(0, MAX_LEN);
      if (!text) return NextResponse.json({ error: 'Empty message' }, { status: 400 });
      const sanc = await activeSanction(db, myId, ['mute', 'ban']);
      if (sanc) return NextResponse.json({ error: sanctionMessage(sanc) }, { status: 403 });

      const convId = convOf(myId, rf.target.discordId);
      const doc = {
        convId,
        from: myId,
        fromName: me.copsName ?? 'Unknown',
        fromAccountId: me.accountId ?? null,
        fromAvatar: me.avatar ?? null,
        fromElo: me.elo ?? 1000,
        to: rf.target.discordId,
        text,
        createdAt: new Date(),
      };
      const ins = await db.collection('dms').insertOne(doc);
      // sender has implicitly read up to now
      await db.collection('dmReads').updateOne({ convId, userId: myId }, { $set: { lastReadAt: new Date() } }, { upsert: true });

      return NextResponse.json({
        message: {
          id: String(ins.insertedId),
          fromMe: true,
          fromName: doc.fromName,
          fromAccountId: doc.fromAccountId,
          fromAvatar: doc.fromAvatar,
          fromElo: doc.fromElo,
          text,
          createdAt: doc.createdAt.toISOString(),
        },
      });
    }

    if (action === 'read') {
      const rf = await resolveFriend(db, myId, body?.with);
      if ('error' in rf) return NextResponse.json({ error: rf.error }, { status: rf.status });
      const convId = convOf(myId, rf.target.discordId);
      await db.collection('dmReads').updateOne({ convId, userId: myId }, { $set: { lastReadAt: new Date() } }, { upsert: true });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Bad action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
