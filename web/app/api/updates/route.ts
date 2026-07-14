export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';
import { logStaff } from '../../../lib/staffLog';

async function staff() {
  const session = await getServerSession(authOptions);
  const myId = (session?.user as any)?.discordId as string | undefined;
  if (!myId) return { ok: false as const };
  const db = await getDb();
  const me = await db.collection('players').findOne({ discordId: myId }, { projection: { staffLevel: 1, copsName: 1 } });
  return { ok: true as const, db, myId, me, isStaff: me?.staffLevel === 'admin' || me?.staffLevel === 'mod' };
}

export async function GET() {
  try {
    const db = await getDb();
    const rows = await db.collection('updates').find({}, { projection: { title: 1, body: 1, version: 1, createdAt: 1, byName: 1 } }).sort({ createdAt: -1 }).limit(50).toArray();
    const updates = rows.map((u: any) => ({
      id: String(u._id),
      title: u.title || '',
      body: u.body || '',
      version: u.version || '',
      byName: u.byName || 'Staff',
      createdAt: u.createdAt ?? null,
    }));
    const latest = updates[0]?.createdAt ? new Date(updates[0].createdAt).getTime() : 0;
    return NextResponse.json({ updates, latest });
  } catch {
    return NextResponse.json({ updates: [], latest: 0 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await staff();
    if (!ctx.ok) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    if (!ctx.isStaff) return NextResponse.json({ error: 'Staff only' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const title = (body?.title || '').toString().trim().slice(0, 120);
    const text = (body?.body || '').toString().trim().slice(0, 4000);
    const version = (body?.version || '').toString().trim().slice(0, 30);
    if (title.length < 2) return NextResponse.json({ error: 'Add a title' }, { status: 400 });
    if (text.length < 2) return NextResponse.json({ error: 'Add some details' }, { status: 400 });
    const r = await ctx.db.collection('updates').insertOne({ title, body: text, version, byId: ctx.myId, byName: ctx.me?.copsName || 'Staff', createdAt: new Date() });
    logStaff(ctx.db, { actorId: ctx.myId, actorName: ctx.me?.copsName, action: 'post update', details: version ? `${title} (${version})` : title });
    return NextResponse.json({ ok: true, id: String(r.insertedId) });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await staff();
    if (!ctx.ok) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    if (!ctx.isStaff) return NextResponse.json({ error: 'Staff only' }, { status: 403 });
    const id = (new URL(req.url).searchParams.get('id') || '').toString();
    let oid: ObjectId;
    try {
      oid = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }
    await ctx.db.collection('updates').deleteOne({ _id: oid });
    logStaff(ctx.db, { actorId: ctx.myId, actorName: ctx.me?.copsName, action: 'delete update', details: `#${id.slice(-6)}` });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
