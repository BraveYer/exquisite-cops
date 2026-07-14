export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { rateLimit } from '../../../lib/rateLimit';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';

const SCOPES = ['lobby', 'dm', 'group', 'club'];
export const EMOJIS = ['👍', '❤️', '😂', '🔥', '😮', '😢'];

// GET ?scope=X&ids=id1,id2 → { reactions: { [messageId]: { [emoji]: { count, mine } } } }
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    const url = new URL(req.url);
    const scope = (url.searchParams.get('scope') || '').toString();
    const idsParam = url.searchParams.get('ids');
    if (!SCOPES.includes(scope) || !idsParam) return NextResponse.json({ reactions: {} });
    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 200);
    if (ids.length === 0) return NextResponse.json({ reactions: {} });

    const db = await getDb();
    const docs = await db.collection('reactions').find({ scope, messageId: { $in: ids } }).toArray();
    const out: Record<string, Record<string, { count: number; mine: boolean }>> = {};
    for (const d of docs as any[]) {
      const users: string[] = d.users || [];
      if (users.length === 0) continue;
      if (!out[d.messageId]) out[d.messageId] = {};
      out[d.messageId][d.emoji] = { count: users.length, mine: !!myId && users.includes(myId) };
    }
    return NextResponse.json({ reactions: out });
  } catch {
    return NextResponse.json({ reactions: {} });
  }
}

// POST { scope, messageId, emoji } → toggle my reaction
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const scope = (body?.scope || '').toString();
    const messageId = (body?.messageId || '').toString();
    const emoji = (body?.emoji || '').toString();
    if (!SCOPES.includes(scope)) return NextResponse.json({ error: 'Bad scope' }, { status: 400 });
    if (!messageId) return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    if (!EMOJIS.includes(emoji)) return NextResponse.json({ error: 'Bad emoji' }, { status: 400 });
    const rl = rateLimit(`react:${myId}`, 15, 20000);
    if (!rl.ok) return NextResponse.json({ error: `Slow down — wait ${rl.retryAfter}s.` }, { status: 429 });

    const db = await getDb();
    const existing = await db.collection('reactions').findOne({ scope, messageId, emoji });
    const has = !!existing && (existing.users || []).includes(myId);
    if (has) {
      await db.collection('reactions').updateOne({ scope, messageId, emoji }, { $pull: { users: myId } } as any);
    } else {
      await db.collection('reactions').updateOne(
        { scope, messageId, emoji },
        { $addToSet: { users: myId }, $setOnInsert: { scope, messageId, emoji, createdAt: new Date() } },
        { upsert: true }
      );
    }
    return NextResponse.json({ ok: true, active: !has });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
