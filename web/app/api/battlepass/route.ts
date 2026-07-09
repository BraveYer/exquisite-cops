export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';
import { BP_SEASON, BP_TIERS, XP_PER_TIER, MAX_TIER, PREMIUM_COST, XP_PER_GAME, XP_PER_WIN, tierFromXp } from '../../../lib/battlepass';

async function computeXp(db: any, myId: string) {
  const p = await db.collection('players').findOne({ discordId: myId }, { projection: { wins: 1, gamesPlayed: 1 } });
  const games = p?.gamesPlayed || 0;
  const wins = p?.wins || 0;
  const xp = games * XP_PER_GAME + wins * XP_PER_WIN;
  return { xp, tier: tierFromXp(xp) };
}

async function ensureBp(db: any, myId: string) {
  const bp = await db.collection('battlepass').findOne({ discordId: myId });
  if (!bp || bp.season !== BP_SEASON.id) {
    const fresh = { discordId: myId, season: BP_SEASON.id, premium: false, claimedFree: [] as number[], claimedPremium: [] as number[] };
    await db.collection('battlepass').updateOne({ discordId: myId }, { $set: fresh }, { upsert: true });
    return fresh;
  }
  return bp;
}

const ECO_DEFAULTS = { items: [], equipped: { frame: null, name: null, theme: null }, claims: {} };

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    const db = await getDb();
    const { xp, tier } = await computeXp(db, myId);
    const bp = await db.collection('battlepass').findOne({ discordId: myId });
    const fresh = !bp || bp.season !== BP_SEASON.id;
    const premium = fresh ? false : !!bp.premium;
    const claimedFree: number[] = fresh ? [] : bp.claimedFree || [];
    const claimedPremium: number[] = fresh ? [] : bp.claimedPremium || [];

    const tiers = BP_TIERS.map((t) => ({
      tier: t.tier,
      free: t.free,
      premium: t.premium,
      reached: tier >= t.tier,
      freeClaimed: claimedFree.includes(t.tier),
      premiumClaimed: claimedPremium.includes(t.tier),
      freeClaimable: tier >= t.tier && !claimedFree.includes(t.tier),
      premiumClaimable: premium && tier >= t.tier && !claimedPremium.includes(t.tier),
    }));

    return NextResponse.json({
      season: BP_SEASON,
      xp,
      tier,
      xpIntoTier: xp % XP_PER_TIER,
      xpPerTier: XP_PER_TIER,
      maxTier: MAX_TIER,
      premium,
      premiumCost: PREMIUM_COST,
      tiers,
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
    const body = await req.json().catch(() => ({}));
    const action = (body?.action || '').toString();
    const bp = await ensureBp(db, myId);
    const { tier: currentTier } = await computeXp(db, myId);

    if (action === 'unlockPremium') {
      if (bp.premium) return NextResponse.json({ error: 'Premium already unlocked' }, { status: 400 });
      const eco = await db.collection('economy').findOne({ discordId: myId }, { projection: { balance: 1 } });
      if ((eco?.balance || 0) < PREMIUM_COST) return NextResponse.json({ error: 'Not enough EP' }, { status: 400 });
      await db.collection('economy').updateOne({ discordId: myId }, { $inc: { balance: -PREMIUM_COST } });
      await db.collection('battlepass').updateOne({ discordId: myId }, { $set: { premium: true } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'claim') {
      const t = BP_TIERS.find((x) => x.tier === Number(body?.tier));
      const track = (body?.track || '').toString();
      if (!t || (track !== 'free' && track !== 'premium')) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
      if (currentTier < t.tier) return NextResponse.json({ error: 'Tier not reached' }, { status: 400 });
      if (track === 'premium' && !bp.premium) return NextResponse.json({ error: 'Premium locked' }, { status: 400 });
      const claimedArr: number[] = track === 'free' ? bp.claimedFree || [] : bp.claimedPremium || [];
      if (claimedArr.includes(t.tier)) return NextResponse.json({ error: 'Already claimed' }, { status: 400 });
      const reward = track === 'free' ? t.free : t.premium;
      if (reward.type === 'ep') {
        await db.collection('economy').updateOne({ discordId: myId }, { $inc: { balance: reward.amount || 0 }, $setOnInsert: ECO_DEFAULTS }, { upsert: true });
      } else if (reward.itemId) {
        await db.collection('economy').updateOne({ discordId: myId }, { $addToSet: { items: reward.itemId }, $setOnInsert: ECO_DEFAULTS }, { upsert: true });
      }
      const field = track === 'free' ? 'claimedFree' : 'claimedPremium';
      await db.collection('battlepass').updateOne({ discordId: myId }, { $addToSet: { [field]: t.tier } });
      return NextResponse.json({ ok: true, reward });
    }

    if (action === 'claimAll') {
      const claimedFree: number[] = bp.claimedFree || [];
      const claimedPremium: number[] = bp.claimedPremium || [];
      let epGain = 0;
      const itemsGain: string[] = [];
      const newFree: number[] = [];
      const newPremium: number[] = [];
      for (const t of BP_TIERS) {
        if (currentTier < t.tier) break;
        if (!claimedFree.includes(t.tier)) {
          if (t.free.type === 'ep') epGain += t.free.amount || 0;
          else if (t.free.itemId) itemsGain.push(t.free.itemId);
          newFree.push(t.tier);
        }
        if (bp.premium && !claimedPremium.includes(t.tier)) {
          if (t.premium.type === 'ep') epGain += t.premium.amount || 0;
          else if (t.premium.itemId) itemsGain.push(t.premium.itemId);
          newPremium.push(t.tier);
        }
      }
      if (newFree.length === 0 && newPremium.length === 0) return NextResponse.json({ error: 'Nothing to claim' }, { status: 400 });
      const update: any = { $setOnInsert: ECO_DEFAULTS };
      if (epGain > 0) update.$inc = { balance: epGain };
      if (itemsGain.length) update.$addToSet = { items: { $each: itemsGain } };
      await db.collection('economy').updateOne({ discordId: myId }, update, { upsert: true });
      const bpUpdate: any = {};
      if (newFree.length) bpUpdate.claimedFree = { $each: newFree };
      if (newPremium.length) bpUpdate.claimedPremium = { $each: newPremium };
      await db.collection('battlepass').updateOne({ discordId: myId }, { $addToSet: bpUpdate });
      return NextResponse.json({ ok: true, credited: epGain, items: itemsGain.length });
    }

    return NextResponse.json({ error: 'Bad action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
