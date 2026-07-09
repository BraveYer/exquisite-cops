export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';
import { notify } from '../../../lib/notify';

const REFERRER_REWARD = 250; // EP for referring someone
const REFERRED_REWARD = 150; // EP welcome bonus for the new player

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    const db = await getDb();
    const me = await db.collection('players').findOne({ discordId: myId }, { projection: { accountId: 1 } });
    const referredCount = await db.collection('referrals').countDocuments({ referrerId: myId });
    const claimed = !!(await db.collection('referrals').findOne({ referredId: myId }, { projection: { _id: 1 } }));
    return NextResponse.json({
      code: me?.accountId ?? null,
      referredCount,
      earned: referredCount * REFERRER_REWARD,
      claimed,
      rewards: { referrer: REFERRER_REWARD, referred: REFERRED_REWARD },
    });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    const db = await getDb();
    const me = await db.collection('players').findOne({ discordId: myId }, { projection: { accountId: 1, verified: 1, copsName: 1 } });
    if (!me) return NextResponse.json({ error: 'You are not registered yet.' }, { status: 400 });
    if (!me.verified) return NextResponse.json({ error: 'Verify your account first, then claim a referral.' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const code = Number(body?.code);
    if (!Number.isFinite(code)) return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    if (code === me.accountId) return NextResponse.json({ error: "You can't refer yourself" }, { status: 400 });

    const referrer = await db.collection('players').findOne({ accountId: code }, { projection: { discordId: 1, copsName: 1 } });
    if (!referrer) return NextResponse.json({ error: 'No player with that code' }, { status: 404 });
    if (referrer.discordId === myId) return NextResponse.json({ error: "You can't refer yourself" }, { status: 400 });

    const already = await db.collection('referrals').findOne({ referredId: myId }, { projection: { _id: 1 } });
    if (already) return NextResponse.json({ error: 'You already used a referral code' }, { status: 400 });

    await db.collection('referrals').insertOne({
      referrerId: referrer.discordId,
      referredId: myId,
      referrerAccountId: code,
      referredAccountId: me.accountId ?? null,
      createdAt: new Date(),
    });

    const seed = { items: [], equipped: { frame: null, name: null, theme: null }, claims: {} };
    await db.collection('economy').updateOne({ discordId: referrer.discordId }, { $inc: { balance: REFERRER_REWARD }, $setOnInsert: seed }, { upsert: true });
    await db.collection('economy').updateOne({ discordId: myId }, { $inc: { balance: REFERRED_REWARD }, $setOnInsert: seed }, { upsert: true });

    notify(db, referrer.discordId, { type: 'referral', title: 'Referral reward', body: `${me.copsName || 'A new player'} joined with your code — +${REFERRER_REWARD} EP!`, link: '/shop' });
    return NextResponse.json({ ok: true, credited: REFERRED_REWARD });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
