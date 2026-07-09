export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';
import { activeSanction, sanctionMessage } from '../../../lib/sanctions';
import { notifyMentions } from '../../../lib/mentions';

const STAFF = ['admin', 'mod'];
const MAX = 500;

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;

    const url = new URL(req.url);
    const postId = (url.searchParams.get('postId') || '').toString();
    if (!postId) return NextResponse.json({ comments: [] });

    const db = await getDb();
    const docs = await db.collection('comments').find({ postId }).sort({ createdAt: 1 }).limit(200).toArray();
    const comments = docs.map((c: any) => ({
      id: c._id.toString(),
      authorName: c.authorName ?? 'Unknown',
      authorAccountId: c.authorAccountId ?? null,
      authorAvatar: c.authorAvatar ?? null,
      text: c.text ?? '',
      createdAt: c.createdAt,
      parentId: c.parentId ?? null,
      mine: !!myId && c.authorId === myId,
    }));
    return NextResponse.json({ comments });
  } catch {
    return NextResponse.json({ comments: [] });
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

    const me = await db.collection('players').findOne({ discordId: myId }, { projection: { copsName: 1, accountId: 1, avatar: 1, staffLevel: 1 } });
    if (!me) return NextResponse.json({ error: 'You are not registered yet. Use /link on Discord first.' }, { status: 400 });
    const isStaff = STAFF.includes(me.staffLevel);

    if (action === 'create') {
      const postId = (body?.postId || '').toString();
      const text = (body?.text || '').toString().trim().slice(0, MAX);
      if (!postId || !text) return NextResponse.json({ error: 'Empty comment' }, { status: 400 });
      const sanc = await activeSanction(db, myId, ['mute', 'ban']);
      if (sanc) return NextResponse.json({ error: sanctionMessage(sanc) }, { status: 403 });
      let poid: ObjectId;
      try {
        poid = new ObjectId(postId);
      } catch {
        return NextResponse.json({ error: 'Invalid post' }, { status: 400 });
      }
      const post = await db.collection('posts').findOne({ _id: poid }, { projection: { _id: 1 } });
      if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

      // Optional reply target (one level deep — a reply's parent is always a top-level comment).
      let parentId: string | null = null;
      if (body?.parentId) {
        const pid = body.parentId.toString();
        try {
          const parent = await db.collection('comments').findOne({ _id: new ObjectId(pid), postId }, { projection: { parentId: 1 } });
          if (parent) parentId = parent.parentId ? parent.parentId : pid;
        } catch {
          /* ignore invalid parent */
        }
      }

      const doc = {
        postId,
        authorId: myId,
        authorName: me.copsName ?? 'Unknown',
        authorAccountId: me.accountId ?? null,
        authorAvatar: me.avatar ?? null,
        text,
        parentId,
        createdAt: new Date(),
      };
      const r = await db.collection('comments').insertOne(doc);
      notifyMentions(db, text, { fromName: me.copsName ?? 'Someone', link: '/feed', scopeLabel: 'a comment', excludeDiscordId: myId });
      return NextResponse.json({ ok: true, id: r.insertedId.toString() });
    }

    if (action === 'delete') {
      const id = (body?.id || '').toString();
      let oid: ObjectId;
      try {
        oid = new ObjectId(id);
      } catch {
        return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
      }
      const c = await db.collection('comments').findOne({ _id: oid }, { projection: { authorId: 1 } });
      if (!c) return NextResponse.json({ ok: true });
      if (c.authorId !== myId && !isStaff) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      await db.collection('comments').deleteOne({ _id: oid });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Bad action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
