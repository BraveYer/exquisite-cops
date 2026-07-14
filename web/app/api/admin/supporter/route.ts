export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../../lib/mongodb';
import { authOptions } from '../../../../lib/auth';
import { notify } from '../../../../lib/notify';
import { logStaff } from '../../../../lib/staffLog';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    const db = await getDb();
    const me = await db.collection('players').findOne({ discordId: myId }, { projection: { staffLevel: 1, copsName: 1 } });
    if (me?.staffLevel !== 'admin' && me?.staffLevel !== 'mod') return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const accountId = Number(body?.accountId);
    const days = Math.floor(Number(body?.days));
    if (!Number.isFinite(accountId)) return NextResponse.json({ error: 'Invalid player' }, { status: 400 });
    if (!Number.isFinite(days) || days === 0) return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });

    const target = await db.collection('players').findOne({ accountId }, { projection: { discordId: 1, supporterUntil: 1, copsName: 1 } });
    if (!target) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    if (days < 0) {
      // Revoke supporter
      await db.collection('players').updateOne({ discordId: target.discordId }, { $unset: { supporterUntil: '' } });
      logStaff(db, { actorId: myId, actorName: me?.copsName, action: 'revoke supporter', target: String(accountId), targetName: target.copsName });
      return NextResponse.json({ ok: true, revoked: true });
    }

    const base = target.supporterUntil && new Date(target.supporterUntil).getTime() > Date.now() ? new Date(target.supporterUntil).getTime() : Date.now();
    const until = new Date(base + days * 86400000);
    await db.collection('players').updateOne({ discordId: target.discordId }, { $set: { supporterUntil: until } });
    logStaff(db, { actorId: myId, actorName: me?.copsName, action: 'grant supporter', target: String(accountId), targetName: target.copsName, details: `${days} days` });
    notify(db, target.discordId, { type: 'supporter', title: 'Supporter tier granted', body: `You've been given Supporter status for ${days} days. Thank you! \u2b50`, link: '/shop' });
    return NextResponse.json({ ok: true, supporterUntil: until });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
