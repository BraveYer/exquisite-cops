export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../lib/mongodb';
import { authOptions } from '../../../../lib/auth';
import { notify } from '../../../../lib/notify';

const TYPES = ['warn', 'mute', 'ban', 'note'];

async function staffCtx() {
  const session = await getServerSession(authOptions);
  const myId = (session?.user as any)?.discordId as string | undefined;
  if (!myId) return { ok: false as const, status: 401 };
  const db = await getDb();
  const me = await db.collection('players').findOne({ discordId: myId }, { projection: { staffLevel: 1, copsName: 1 } });
  const isStaff = me?.staffLevel === 'admin' || me?.staffLevel === 'mod';
  return { ok: true as const, db, myId, me, isStaff };
}

export async function GET(req: Request) {
  try {
    const ctx = await staffCtx();
    if (!ctx.ok) return NextResponse.json({ canModerate: false, sanctions: [] });
    if (!ctx.isStaff) return NextResponse.json({ canModerate: false, sanctions: [] });
    const accountId = Number(new URL(req.url).searchParams.get('accountId'));
    if (!Number.isFinite(accountId)) return NextResponse.json({ canModerate: true, sanctions: [] });
    const rows = await ctx.db.collection('sanctions').find({ accountId }).sort({ createdAt: -1 }).limit(50).toArray();
    const now = Date.now();
    const sanctions = rows.map((s: any) => ({
      id: String(s._id),
      type: s.type,
      reason: s.reason || '',
      byName: s.byName || 'Staff',
      createdAt: s.createdAt ?? null,
      expiresAt: s.expiresAt ?? null,
      active: s.type !== 'warn' && s.type !== 'note' && (!s.expiresAt || new Date(s.expiresAt).getTime() > now),
    }));
    return NextResponse.json({ canModerate: true, sanctions });
  } catch {
    return NextResponse.json({ canModerate: false, sanctions: [] });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await staffCtx();
    if (!ctx.ok) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    if (!ctx.isStaff) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const accountId = Number(body?.accountId);
    const type = (body?.type || '').toString();
    const reason = (body?.reason || '').toString().trim().slice(0, 300);
    const durationHours = Number(body?.durationHours);
    if (!Number.isFinite(accountId)) return NextResponse.json({ error: 'Invalid player' }, { status: 400 });
    if (!TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    if (reason.length < 2) return NextResponse.json({ error: 'Add a reason' }, { status: 400 });

    const target = await ctx.db.collection('players').findOne({ accountId }, { projection: { discordId: 1 } });
    if (!target) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    const expiresAt = Number.isFinite(durationHours) && durationHours > 0 ? new Date(Date.now() + durationHours * 3600000) : null;
    await ctx.db.collection('sanctions').insertOne({
      accountId,
      discordId: target.discordId,
      type,
      reason,
      byId: ctx.myId,
      byName: ctx.me?.copsName || 'Staff',
      createdAt: new Date(),
      expiresAt,
    });

    if (type !== 'note' && target.discordId) {
      const label = type === 'ban' ? 'banned' : type === 'mute' ? 'muted' : 'warned';
      notify(ctx.db, target.discordId, { type: 'sanction', title: `You were ${label}`, body: reason, link: '' });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await staffCtx();
    if (!ctx.ok) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    if (!ctx.isStaff) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    const id = (new URL(req.url).searchParams.get('id') || '').toString();
    let oid: ObjectId;
    try {
      oid = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }
    await ctx.db.collection('sanctions').deleteOne({ _id: oid });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
