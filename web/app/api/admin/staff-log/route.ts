export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../../lib/mongodb';
import { authOptions } from '../../../../lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    const db = await getDb();
    const me = await db.collection('players').findOne({ discordId: myId }, { projection: { staffLevel: 1 } });
    if (me?.staffLevel !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });

    const rows = await db.collection('staffLog').find({}).sort({ createdAt: -1 }).limit(100).toArray();
    const entries = rows.map((r: any) => ({
      id: String(r._id),
      actorName: r.actorName || 'Staff',
      action: r.action || '',
      targetName: r.targetName || null,
      target: r.target || null,
      details: r.details || null,
      createdAt: r.createdAt ?? null,
    }));
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
