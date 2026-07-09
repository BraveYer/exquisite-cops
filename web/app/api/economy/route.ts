export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';
import { COSMETICS, getCosmetic, getPack, MISSIONS, DAILY_BONUS, ACHIEVEMENTS, dailyReward, SUPPORTER } from '../../../lib/shop';
import { notify } from '../../../lib/notify';

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
function weekKey(d = new Date()) {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (dt.getUTCDay() + 6) % 7; // Monday = 0
  dt.setUTCDate(dt.getUTCDate() - dow);
  const y = dt.getUTCFullYear();
  const jan1 = Date.UTC(y, 0, 1);
  const week = Math.floor((dt.getTime() - jan1) / (7 * 86400000)) + 1;
  return `${y}-W${week}`;
}
function todayStart() {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}
function weekStart() {
  const n = new Date();
  const dt = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  const dow = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt;
}

async function ensureEconomy(db: any, discordId: string) {
  await db.collection('economy').updateOne(
    { discordId },
    { $setOnInsert: { discordId, balance: 0, items: [], equipped: { frame: null, name: null, theme: null }, claims: {} } },
    { upsert: true }
  );
  return db.collection('economy').findOne({ discordId });
}

async function computeActivity(db: any, discordId: string) {
  const ws = weekStart();
  const ts = todayStart().getTime();
  const matches = await db
    .collection('matches')
    .find({ status: 'completed', $or: [{ 'teamA.discordId': discordId }, { 'teamB.discordId': discordId }], completedAt: { $gte: ws } })
    .project({ teamA: 1, teamB: 1, winner: 1, completedAt: 1 })
    .limit(500)
    .toArray();
  let todayGames = 0;
  let todayWins = 0;
  let weekGames = 0;
  let weekWins = 0;
  for (const m of matches) {
    const onA = (m.teamA || []).some((p: any) => p.discordId === discordId);
    const team = onA ? 'A' : 'B';
    const win = m.winner === team;
    weekGames++;
    if (win) weekWins++;
    const t = m.completedAt ? new Date(m.completedAt).getTime() : 0;
    if (t >= ts) {
      todayGames++;
      if (win) todayWins++;
    }
  }
  return { todayGames, todayWins, weekGames, weekWins };
}

function missionState(act: any, claims: Record<string, string>) {
  const dk = dayKey();
  const wk = weekKey();
  return MISSIONS.map((mi) => {
    const value =
      mi.type === 'daily'
        ? mi.metric === 'wins'
          ? act.todayWins
          : act.todayGames
        : mi.metric === 'wins'
        ? act.weekWins
        : act.weekGames;
    const period = mi.type === 'daily' ? dk : wk;
    const claimed = claims[mi.id] === period;
    const progress = Math.min(value, mi.target);
    return { id: mi.id, type: mi.type, title: mi.title, target: mi.target, progress, reward: mi.reward, claimed, claimable: progress >= mi.target && !claimed };
  });
}

async function computeStats(db: any, myId: string) {
  const p = await db.collection('players').findOne({ discordId: myId }, { projection: { wins: 1, gamesPlayed: 1, elo: 1, accountId: 1 } });
  const inClub = await db.collection('clanMembers').findOne({ discordId: myId }, { projection: { _id: 1 } });
  let tournamentWins = 0;
  if (p?.accountId != null) tournamentWins = await db.collection('tournaments').countDocuments({ status: 'completed', 'champion.accountId': p.accountId });
  const friends = await db.collection('friendships').countDocuments({ $or: [{ a: myId }, { b: myId }], status: 'accepted' });
  const ecoDoc = await db.collection('economy').findOne({ discordId: myId }, { projection: { items: 1 } });
  const cosmetics = (ecoDoc?.items || []).length;
  return { wins: p?.wins || 0, games: p?.gamesPlayed || 0, elo: p?.elo || 1000, tournamentWins, inClub: inClub ? 1 : 0, friends, cosmetics };
}
function achValue(stats: any, kind: string) {
  return kind === 'wins' ? stats.wins : kind === 'games' ? stats.games : kind === 'elo' ? stats.elo : kind === 'tournamentWins' ? stats.tournamentWins : kind === 'inClub' ? stats.inClub : kind === 'friends' ? stats.friends : kind === 'cosmetics' ? stats.cosmetics : 0;
}
function achievementState(stats: any, claims: Record<string, string>) {
  return ACHIEVEMENTS.map((a) => {
    const value = achValue(stats, a.kind);
    const claimed = claims[a.id] === 'done';
    const progress = Math.min(value, a.target);
    return { id: a.id, title: a.title, desc: a.desc, target: a.target, progress, reward: a.reward, claimed, claimable: value >= a.target && !claimed };
  });
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    const db = await getDb();
    const url = new URL(req.url);
    const player = url.searchParams.get('player');

    // Public: batch name-style lookup for a list of accountIds (chats, leaderboard, draft…)
    const names = url.searchParams.get('names');
    if (names) {
      const ids = names.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)).slice(0, 120);
      if (ids.length === 0) return NextResponse.json({ styles: {}, frames: {} });
      const ps = await db.collection('players').find({ accountId: { $in: ids } }, { projection: { accountId: 1, cosmetics: 1 } }).toArray();
      const styles: Record<string, string | null> = {};
      const frames: Record<string, string | null> = {};
      for (const p of ps) {
        styles[String(p.accountId)] = p.cosmetics?.name || null;
        frames[String(p.accountId)] = p.cosmetics?.frame || null;
      }
      return NextResponse.json({ styles, frames });
    }

    // Public: a player's equipped cosmetics (for their profile)
    if (player) {
      const p = await db.collection('players').findOne({ accountId: Number(player) }, { projection: { discordId: 1 } });
      if (!p) return NextResponse.json({ equipped: { frame: null, name: null, theme: null } });
      const eco = await db.collection('economy').findOne({ discordId: p.discordId }, { projection: { equipped: 1 } });
      return NextResponse.json({ equipped: eco?.equipped || { frame: null, name: null, theme: null } });
    }

    if (!myId) return NextResponse.json({ balance: 0, items: [], equipped: { frame: null, name: null, theme: null }, missions: [], dailyClaimable: false });

    const eco = await ensureEconomy(db, myId);
    // Keep players.cosmetics in sync so the player's name style shows everywhere they appear.
    db.collection('players')
      .updateOne({ discordId: myId }, { $set: { cosmetics: { name: eco?.equipped?.name ?? null, frame: eco?.equipped?.frame ?? null, theme: eco?.equipped?.theme ?? null } } })
      .catch(() => {});
    const act = await computeActivity(db, myId);
    const claims = eco?.claims || {};
    const missions = missionState(act, claims);
    const stats = await computeStats(db, myId);
    const achievements = achievementState(stats, claims);
    const today = dayKey();
    const yesterday = dayKey(new Date(Date.now() - 86400000));
    const dailyClaimable = claims['daily_bonus'] !== today;
    const streak = eco?.dailyStreak || 0;
    const nextStreak = dailyClaimable ? (eco?.lastDailyDate === yesterday ? streak + 1 : 1) : streak;

    const meS = await db.collection('players').findOne({ discordId: myId }, { projection: { supporterUntil: 1, supporterClaimedMonth: 1 } });
    const supActive = !!meS?.supporterUntil && new Date(meS.supporterUntil).getTime() > Date.now();
    const monthKey = new Date().toISOString().slice(0, 7);
    const supporter = { active: supActive, until: meS?.supporterUntil ?? null, claimable: supActive && meS?.supporterClaimedMonth !== monthKey, costEp: SUPPORTER.costEp, monthlyEp: SUPPORTER.monthlyEp };

    return NextResponse.json({
      balance: eco?.balance ?? 0,
      items: eco?.items ?? [],
      equipped: eco?.equipped ?? { frame: null, name: null, theme: null },
      missions,
      achievements,
      dailyClaimable,
      streak,
      dailyBonus: DAILY_BONUS,
      nextDailyReward: dailyReward(nextStreak || 1),
      supporter,
    });
  } catch {
    return NextResponse.json({ balance: 0, items: [], equipped: { frame: null, name: null, theme: null }, missions: [], dailyClaimable: false });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    const db = await getDb();
    const eco = await ensureEconomy(db, myId);
    const body = await req.json().catch(() => ({}));
    const action = (body?.action || '').toString();

    if (action === 'buy') {
      const item = getCosmetic((body?.itemId || '').toString());
      if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      if ((eco.items || []).includes(item.id)) return NextResponse.json({ error: 'Already owned' }, { status: 400 });
      if ((eco.balance ?? 0) < item.price) return NextResponse.json({ error: 'Not enough EP' }, { status: 400 });
      await db.collection('economy').updateOne({ discordId: myId }, { $inc: { balance: -item.price }, $addToSet: { items: item.id } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'equip') {
      const item = getCosmetic((body?.itemId || '').toString());
      if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      if (!(eco.items || []).includes(item.id)) return NextResponse.json({ error: 'You do not own this' }, { status: 400 });
      await db.collection('economy').updateOne({ discordId: myId }, { $set: { [`equipped.${item.slot}`]: item.id } });
      await db.collection('players').updateOne({ discordId: myId }, { $set: { [`cosmetics.${item.slot}`]: item.id } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'unequip') {
      const slot = (body?.slot || '').toString();
      if (slot !== 'frame' && slot !== 'name' && slot !== 'theme') return NextResponse.json({ error: 'Bad slot' }, { status: 400 });
      await db.collection('economy').updateOne({ discordId: myId }, { $set: { [`equipped.${slot}`]: null } });
      await db.collection('players').updateOne({ discordId: myId }, { $set: { [`cosmetics.${slot}`]: null } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'claimDaily') {
      const today = dayKey();
      if ((eco.claims || {})['daily_bonus'] === today) return NextResponse.json({ error: 'Already claimed today' }, { status: 400 });
      const yesterday = dayKey(new Date(Date.now() - 86400000));
      const streak = eco?.lastDailyDate === yesterday ? (eco?.dailyStreak || 0) + 1 : 1;
      const reward = dailyReward(streak);
      await db.collection('economy').updateOne(
        { discordId: myId },
        { $inc: { balance: reward }, $set: { 'claims.daily_bonus': today, dailyStreak: streak, lastDailyDate: today } }
      );
      return NextResponse.json({ ok: true, reward, streak });
    }

    if (action === 'claimMission') {
      const mi = MISSIONS.find((m) => m.id === (body?.missionId || '').toString());
      if (!mi) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
      const act = await computeActivity(db, myId);
      const value = mi.type === 'daily' ? (mi.metric === 'wins' ? act.todayWins : act.todayGames) : mi.metric === 'wins' ? act.weekWins : act.weekGames;
      if (value < mi.target) return NextResponse.json({ error: 'Mission not complete yet' }, { status: 400 });
      const period = mi.type === 'daily' ? dayKey() : weekKey();
      if ((eco.claims || {})[mi.id] === period) return NextResponse.json({ error: 'Already claimed' }, { status: 400 });
      await db.collection('economy').updateOne({ discordId: myId }, { $inc: { balance: mi.reward }, $set: { [`claims.${mi.id}`]: period } });
      return NextResponse.json({ ok: true, reward: mi.reward });
    }

    if (action === 'claimAchievement') {
      const a = ACHIEVEMENTS.find((x) => x.id === (body?.achId || '').toString());
      if (!a) return NextResponse.json({ error: 'Achievement not found' }, { status: 404 });
      if ((eco.claims || {})[a.id] === 'done') return NextResponse.json({ error: 'Already claimed' }, { status: 400 });
      const stats = await computeStats(db, myId);
      const value = achValue(stats, a.kind);
      if (value < a.target) return NextResponse.json({ error: 'Not unlocked yet' }, { status: 400 });
      await db.collection('economy').updateOne({ discordId: myId }, { $inc: { balance: a.reward }, $set: { [`claims.${a.id}`]: 'done' } });
      return NextResponse.json({ ok: true, reward: a.reward });
    }

    if (action === 'buyPack') {
      // DEMO: credits EP directly. Gate this behind a real payment webhook before launch.
      const pack = getPack((body?.packId || '').toString());
      if (!pack) return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
      await db.collection('economy').updateOne({ discordId: myId }, { $inc: { balance: pack.ep } });
      return NextResponse.json({ ok: true, credited: pack.ep, demo: true });
    }

    if (action === 'gift') {
      const toAcc = Number(body?.to);
      const amount = Math.floor(Number(body?.amount));
      if (!Number.isFinite(toAcc) || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Invalid gift' }, { status: 400 });
      if (amount < 10) return NextResponse.json({ error: 'Minimum gift is 10 EP' }, { status: 400 });
      const recipient = await db.collection('players').findOne({ accountId: toAcc }, { projection: { discordId: 1, copsName: 1 } });
      if (!recipient) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      if (recipient.discordId === myId) return NextResponse.json({ error: "You can't gift yourself" }, { status: 400 });
      if ((eco.balance ?? 0) < amount) return NextResponse.json({ error: 'Not enough EP' }, { status: 400 });

      // Deduct from sender only if they still have the balance (guards against double-spend).
      const dec = await db.collection('economy').updateOne({ discordId: myId, balance: { $gte: amount } }, { $inc: { balance: -amount } });
      if (dec.modifiedCount === 0) return NextResponse.json({ error: 'Not enough EP' }, { status: 400 });
      await db.collection('economy').updateOne(
        { discordId: recipient.discordId },
        { $inc: { balance: amount }, $setOnInsert: { items: [], equipped: { frame: null, name: null, theme: null }, claims: {} } },
        { upsert: true }
      );
      notify(db, recipient.discordId, { type: 'ep_gift', title: 'You received EP', body: `${(await db.collection('players').findOne({ discordId: myId }, { projection: { copsName: 1 } }))?.copsName || 'A player'} sent you ${amount} EP`, link: '/shop' });
      return NextResponse.json({ ok: true, sent: amount });
    }

    if (action === 'giftCosmetic') {
      const toAcc = Number(body?.to);
      const cosmeticId = (body?.cosmeticId || '').toString();
      if (!Number.isFinite(toAcc)) return NextResponse.json({ error: 'Invalid recipient' }, { status: 400 });
      const cos = getCosmetic(cosmeticId);
      if (!cos) return NextResponse.json({ error: 'Cosmetic not found' }, { status: 404 });
      const recipient = await db.collection('players').findOne({ accountId: toAcc }, { projection: { discordId: 1 } });
      if (!recipient) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      if (recipient.discordId === myId) return NextResponse.json({ error: "You can't gift yourself" }, { status: 400 });
      const recipEco = await db.collection('economy').findOne({ discordId: recipient.discordId }, { projection: { items: 1 } });
      if ((recipEco?.items || []).includes(cosmeticId)) return NextResponse.json({ error: 'They already own that item' }, { status: 400 });
      if ((eco.balance ?? 0) < cos.price) return NextResponse.json({ error: 'Not enough EP' }, { status: 400 });

      const dec = await db.collection('economy').updateOne({ discordId: myId, balance: { $gte: cos.price } }, { $inc: { balance: -cos.price } });
      if (dec.modifiedCount === 0) return NextResponse.json({ error: 'Not enough EP' }, { status: 400 });
      await db.collection('economy').updateOne(
        { discordId: recipient.discordId },
        { $addToSet: { items: cosmeticId }, $setOnInsert: { balance: 0, equipped: { frame: null, name: null, theme: null }, claims: {} } },
        { upsert: true }
      );
      notify(db, recipient.discordId, { type: 'cosmetic_gift', title: 'You received a cosmetic', body: `${(await db.collection('players').findOne({ discordId: myId }, { projection: { copsName: 1 } }))?.copsName || 'A player'} gifted you "${cos.name}"`, link: '/shop' });
      return NextResponse.json({ ok: true, gifted: cos.name });
    }

    if (action === 'buySupporter') {
      if ((eco.balance ?? 0) < SUPPORTER.costEp) return NextResponse.json({ error: 'Not enough EP' }, { status: 400 });
      const dec = await db.collection('economy').updateOne({ discordId: myId, balance: { $gte: SUPPORTER.costEp } }, { $inc: { balance: -SUPPORTER.costEp } });
      if (dec.modifiedCount === 0) return NextResponse.json({ error: 'Not enough EP' }, { status: 400 });
      const p = await db.collection('players').findOne({ discordId: myId }, { projection: { supporterUntil: 1 } });
      const base = p?.supporterUntil && new Date(p.supporterUntil).getTime() > Date.now() ? new Date(p.supporterUntil).getTime() : Date.now();
      const until = new Date(base + SUPPORTER.days * 86400000);
      await db.collection('players').updateOne({ discordId: myId }, { $set: { supporterUntil: until } });
      return NextResponse.json({ ok: true, supporterUntil: until });
    }

    if (action === 'claimSupporter') {
      const p = await db.collection('players').findOne({ discordId: myId }, { projection: { supporterUntil: 1, supporterClaimedMonth: 1 } });
      const active = p?.supporterUntil && new Date(p.supporterUntil).getTime() > Date.now();
      if (!active) return NextResponse.json({ error: 'Supporter tier required' }, { status: 403 });
      const monthKey = new Date().toISOString().slice(0, 7);
      if (p?.supporterClaimedMonth === monthKey) return NextResponse.json({ error: 'Already claimed this month' }, { status: 400 });
      await db.collection('players').updateOne({ discordId: myId }, { $set: { supporterClaimedMonth: monthKey } });
      await db.collection('economy').updateOne({ discordId: myId }, { $inc: { balance: SUPPORTER.monthlyEp } });
      return NextResponse.json({ ok: true, credited: SUPPORTER.monthlyEp });
    }

    return NextResponse.json({ error: 'Bad action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
