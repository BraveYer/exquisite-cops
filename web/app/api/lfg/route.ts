export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';

const TTL_MS = 48 * 3600000; // listings stay active for 48h
const MAX_TEXT = 200;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    const db = await getDb();
    const since = new Date(Date.now() - TTL_MS);
    const rows = await db.collection('lfg').find({ createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(60).toArray();
    const listings = rows.map((r: any) => ({
      accountId: r.accountId ?? null,
      copsName: r.copsName ?? 'Unknown',
      avatar: r.avatar ?? null,
      elo: r.elo ?? 1000,
      text: r.text ?? '',
      createdAt: r.createdAt ?? null,
      isMine: !!myId && r.discordId === myId,
    }));
    const mine = listings.find((l: any) => l.isMine) || null;
    return NextResponse.json({ listings, mine });
  } catch {
    return NextResponse.json({ listings: [], mine: null });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    const db = await getDb();
    const me = await db.collection('players').findOne({ discordId: myId }, { projection: { accountId: 1, copsName: 1, avatar: 1, elo: 1 } });
    if (!me) return NextResponse.json({ error: 'Not linked' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const text = (body?.text ?? '').toString().trim().slice(0, MAX_TEXT);
    if (text.length < 2) return NextResponse.json({ error: 'Write something first' }, { status: 400 });

    await db.collection('lfg').updateOne(
      { discordId: myId },
      { $set: { discordId: myId, accountId: me.accountId ?? null, copsName: me.copsName ?? 'Unknown', avatar: me.avatar ?? null, elo: me.elo ?? 1000, text, createdAt: new Date() } },
      { upsert: true }
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    const db = await getDb();
    await db.collection('lfg').deleteOne({ discordId: myId });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
