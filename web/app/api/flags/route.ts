export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';
import { FLAG_KEYS, mergeFlags } from '../../../lib/flags';

export async function GET() {
  try {
    const db = await getDb();
    const doc = await db.collection('settings').findOne({ _id: 'flags' as any });
    return NextResponse.json({ flags: mergeFlags(doc?.values || null) });
  } catch {
    return NextResponse.json({ flags: mergeFlags(null) });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    const db = await getDb();
    const me = await db.collection('players').findOne({ discordId }, { projection: { staffLevel: 1 } });
    if (me?.staffLevel !== 'admin' && me?.staffLevel !== 'mod') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const key = (body?.key || '').toString();
    if (!FLAG_KEYS.includes(key)) return NextResponse.json({ error: 'Unknown flag' }, { status: 400 });
    const value = !!body?.value;

    await db.collection('settings').updateOne(
      { _id: 'flags' as any },
      { $set: { [`values.${key}`]: value, updatedAt: new Date(), updatedBy: discordId } },
      { upsert: true }
    );
    const doc = await db.collection('settings').findOne({ _id: 'flags' as any });
    return NextResponse.json({ ok: true, flags: mergeFlags(doc?.values || null) });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
