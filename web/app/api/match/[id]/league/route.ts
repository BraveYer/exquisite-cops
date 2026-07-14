export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../../../lib/mongodb';
import { authOptions } from '../../../../../lib/auth';
import { logStaff } from '../../../../../lib/staffLog';

async function isAdmin(db: any, myId?: string) {
  if (!myId) return null;
  const me = await db.collection('players').findOne({ discordId: myId }, { projection: { staffLevel: 1, copsName: 1 } });
  return me?.staffLevel === 'admin' ? me : null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    const db = await getDb();
    const match = await db.collection('matches').findOne({ matchId: id }, { projection: { proLeague: 1 } });
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    const admin = await isAdmin(db, myId);
    return NextResponse.json({ proLeague: !!match.proLeague, canToggle: !!admin });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    const db = await getDb();
    const admin = await isAdmin(db, myId);
    if (!admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    const match = await db.collection('matches').findOne({ matchId: id }, { projection: { proLeague: 1 } });
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    const next = !match.proLeague;
    await db.collection('matches').updateOne({ matchId: id }, { $set: { proLeague: next } });
    logStaff(db, { actorId: myId, actorName: admin.copsName, action: next ? 'add to Pro League' : 'remove from Pro League', details: `match #${id.slice(-6)}` });
    return NextResponse.json({ ok: true, proLeague: next });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
