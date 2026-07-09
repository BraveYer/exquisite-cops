export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../lib/mongodb';
import { authOptions } from '../../../../lib/auth';

const STAFF = ['admin', 'mod'];

async function requireStaff() {
  const session = await getServerSession(authOptions);
  const discordId = (session?.user as any)?.discordId as string | undefined;
  if (!discordId) return { error: 'Not logged in', status: 401 as const };
  const db = await getDb();
  const me = await db.collection('players').findOne({ discordId }, { projection: { staffLevel: 1, copsName: 1 } });
  if (!STAFF.includes(me?.staffLevel)) return { error: 'Forbidden', status: 403 as const };
  return { db, me };
}

export async function GET() {
  try {
    const auth = await requireStaff();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { db } = auth;

    const open = await db
      .collection('playerReports')
      .find({ status: 'open' })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    const reports = open.map((r: any) => ({
      id: r._id.toString(),
      matchId: r.matchId,
      reportedName: r.reportedName,
      reportedAccountId: r.reportedAccountId ?? null,
      reporterName: r.reporterName,
      reason: r.reason,
      note: r.note || '',
      createdAt: r.createdAt,
    }));

    const resolvedCount = await db.collection('playerReports').countDocuments({ status: { $in: ['resolved', 'dismissed'] } });

    return NextResponse.json({ reports, resolvedCount });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireStaff();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { db, me } = auth;

    const body = await req.json().catch(() => ({}));
    const id = (body?.id || '').toString();
    const action = (body?.action || '').toString();
    if (!id || (action !== 'resolve' && action !== 'dismiss')) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }

    let oid: ObjectId;
    try {
      oid = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    await db.collection('playerReports').updateOne(
      { _id: oid, status: 'open' },
      {
        $set: {
          status: action === 'resolve' ? 'resolved' : 'dismissed',
          resolvedAt: new Date(),
          resolvedBy: me?.copsName || 'Staff',
        },
      }
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
