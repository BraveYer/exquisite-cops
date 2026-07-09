export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';
import { activeSanction, sanctionMessage } from '../../../lib/sanctions';
import { notifyMentions } from '../../../lib/mentions';

const STAFF = ['admin', 'mod'];
const MAX_TEXT = 1000;
const MAX_URL = 600;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;

    const db = await getDb();
    const docs = await db
      .collection('posts')
      .find({})
      .sort({ announcement: -1, createdAt: -1 })
      .limit(40)
      .toArray();

    const ids = docs.map((p: any) => p._id.toString());
    const counts = ids.length
      ? await db.collection('comments').aggregate([{ $match: { postId: { $in: ids } } }, { $group: { _id: '$postId', n: { $sum: 1 } } }]).toArray()
      : [];
    const countMap = new Map<any, any>(counts.map((c: any) => [c._id, c.n]));

    const posts = docs.map((p: any) => ({
      id: p._id.toString(),
      authorName: p.authorName ?? 'Unknown',
      authorAccountId: p.authorAccountId ?? null,
      authorAvatar: p.authorAvatar ?? null,
      authorElo: p.authorElo ?? null,
      text: p.text ?? '',
      mediaUrl: p.mediaUrl ?? null,
      announcement: !!p.announcement,
      likeCount: (p.likes || []).length,
      likedByMe: myId ? (p.likes || []).includes(myId) : false,
      commentCount: countMap.get(p._id.toString()) || 0,
      mine: !!myId && p.authorId === myId,
      createdAt: p.createdAt,
      poll: p.poll
        ? {
            options: (p.poll.options || []).map((o: any) => ({ text: o.text, votes: (o.voters || []).length, mine: myId ? (o.voters || []).includes(myId) : false })),
            totalVotes: (p.poll.options || []).reduce((s: number, o: any) => s + (o.voters || []).length, 0),
          }
        : null,
    }));

    return NextResponse.json({ posts });
  } catch {
    return NextResponse.json({ posts: [] });
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

    const me = await db.collection('players').findOne({ discordId: myId }, { projection: { copsName: 1, accountId: 1, avatar: 1, elo: 1, staffLevel: 1 } });
    if (!me) return NextResponse.json({ error: 'You are not registered yet. Use /link on Discord first.' }, { status: 400 });
    const isStaff = STAFF.includes(me.staffLevel);

    if (action === 'create') {
      const sanc = await activeSanction(db, myId, ['mute', 'ban']);
      if (sanc) return NextResponse.json({ error: sanctionMessage(sanc) }, { status: 403 });
      const text = (body?.text || '').toString().trim().slice(0, MAX_TEXT);
      let mediaUrl = (body?.mediaUrl || '').toString().trim().slice(0, MAX_URL);
      // allow absolute http(s) links (image/clip URLs) OR our own uploaded-image paths
      if (mediaUrl && !/^https?:\/\//i.test(mediaUrl) && !mediaUrl.startsWith('/api/uploads/')) mediaUrl = '';
      const announcement = isStaff && !!body?.announcement;

      // Optional poll: 2-4 non-empty options
      let poll: any = null;
      if (Array.isArray(body?.poll)) {
        const opts = body.poll.map((o: any) => (o || '').toString().trim().slice(0, 80)).filter((o: string) => o.length > 0).slice(0, 4);
        if (opts.length >= 2) poll = { options: opts.map((t: string) => ({ text: t, voters: [] })) };
      }

      if (!text && !mediaUrl && !poll) return NextResponse.json({ error: 'Write something or add a link' }, { status: 400 });

      const doc = {
        authorId: myId,
        authorName: me.copsName ?? 'Unknown',
        authorAccountId: me.accountId ?? null,
        authorAvatar: me.avatar ?? null,
        authorElo: me.elo ?? null,
        text,
        mediaUrl: mediaUrl || null,
        announcement,
        poll,
        likes: [],
        createdAt: new Date(),
      };
      const r = await db.collection('posts').insertOne(doc);
      notifyMentions(db, text, { fromName: me.copsName ?? 'Someone', link: '/feed', scopeLabel: 'a post', excludeDiscordId: myId });
      return NextResponse.json({ ok: true, id: r.insertedId.toString() });
    }

    if (action === 'like') {
      const id = (body?.id || '').toString();
      let oid: ObjectId;
      try {
        oid = new ObjectId(id);
      } catch {
        return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
      }
      const post = await db.collection('posts').findOne({ _id: oid }, { projection: { likes: 1 } });
      if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const liked = (post.likes || []).includes(myId);
      await db.collection('posts').updateOne({ _id: oid }, liked ? { $pull: { likes: myId } } as any : { $addToSet: { likes: myId } } as any);
      return NextResponse.json({ ok: true, liked: !liked });
    }

    if (action === 'vote') {
      const id = (body?.id || '').toString();
      const option = Number(body?.option);
      let oid: ObjectId;
      try {
        oid = new ObjectId(id);
      } catch {
        return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
      }
      const post = await db.collection('posts').findOne({ _id: oid }, { projection: { poll: 1 } });
      if (!post || !post.poll) return NextResponse.json({ error: 'Not a poll' }, { status: 404 });
      const opts = post.poll.options || [];
      if (!Number.isInteger(option) || option < 0 || option >= opts.length) return NextResponse.json({ error: 'Invalid option' }, { status: 400 });
      const already = (opts[option].voters || []).includes(myId);
      // Single choice: clear my vote from all options, then set it on the chosen one (unless toggling off).
      const newOptions = opts.map((o: any, i: number) => ({
        ...o,
        voters: (o.voters || []).filter((v: string) => v !== myId).concat(i === option && !already ? [myId] : []),
      }));
      await db.collection('posts').updateOne({ _id: oid }, { $set: { 'poll.options': newOptions } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete') {
      const id = (body?.id || '').toString();
      let oid: ObjectId;
      try {
        oid = new ObjectId(id);
      } catch {
        return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
      }
      const post = await db.collection('posts').findOne({ _id: oid }, { projection: { authorId: 1 } });
      if (!post) return NextResponse.json({ ok: true });
      if (post.authorId !== myId && !isStaff) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      await db.collection('posts').deleteOne({ _id: oid });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Bad action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
