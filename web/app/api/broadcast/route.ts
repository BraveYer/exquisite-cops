export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';

const LEVELS = ['info', 'warning', 'success'];

export async function GET() {
  try {
    const db = await getDb();
    const b = await db.collection('settings').findOne({ _id: 'broadcast' as any });
    if (!b || !b.active || !b.text) return NextResponse.json({ broadcast: null });
    return NextResponse.json({
      broadcast: {
        id: b.updatedAt ? new Date(b.updatedAt).getTime() : 0,
        text: b.text,
        level: LEVELS.includes(b.level) ? b.level : 'info',
      },
    });
  } catch {
    return NextResponse.json({ broadcast: null });
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
    const text = (body?.text ?? '').toString().trim().slice(0, 240);
    const level = LEVELS.includes((body?.level || '').toString()) ? body.level : 'info';
    const active = !!body?.active;
    if (active && text.length < 2) return NextResponse.json({ error: 'Message is empty' }, { status: 400 });

    await db.collection('settings').updateOne(
      { _id: 'broadcast' as any },
      { $set: { text, level, active, updatedAt: new Date(), updatedBy: discordId } },
      { upsert: true }
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// Admin-only current value (for pre-filling the form)
export async function PUT() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    const db = await getDb();
    const me = await db.collection('players').findOne({ discordId }, { projection: { staffLevel: 1 } });
    if (me?.staffLevel !== 'admin' && me?.staffLevel !== 'mod') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
    const b = await db.collection('settings').findOne({ _id: 'broadcast' as any });
    return NextResponse.json({ text: b?.text ?? '', level: b?.level ?? 'info', active: !!b?.active });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
