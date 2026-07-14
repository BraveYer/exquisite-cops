export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';
import { notify } from '../../../lib/notify';
import { MAP_POOL } from '../../../lib/maps';
import { activeSanction } from '../../../lib/sanctions';

const PLAYER_PROJ = { discordId: 1, copsName: 1, elo: 1, avatar: 1, accountId: 1 };

function teamEntry(p: any) {
  return { discordId: p.discordId, copsName: p.copsName ?? null, elo: p.elo ?? 1000, avatar: p.avatar ?? null, accountId: p.accountId ?? null };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ incoming: [], outgoing: [] });
    const db = await getDb();
    const rows = await db.collection('challenges').find({ status: 'pending', $or: [{ targetId: myId }, { challengerId: myId }] }).sort({ createdAt: -1 }).toArray();
    const incoming = rows.filter((r: any) => r.targetId === myId).map((r: any) => ({ id: String(r._id), fromName: r.challengerName, fromAccountId: r.challengerAccountId, map: r.map, stake: r.stake || 0, createdAt: r.createdAt }));
    const outgoing = rows.filter((r: any) => r.challengerId === myId).map((r: any) => ({ id: String(r._id), toName: r.targetName, toAccountId: r.targetAccountId, map: r.map, stake: r.stake || 0, createdAt: r.createdAt }));
    return NextResponse.json({ incoming, outgoing });
  } catch {
    return NextResponse.json({ incoming: [], outgoing: [] });
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

    // ---- CREATE ----
    if (action === 'create') {
      const targetAccountId = Number(body?.targetAccountId);
      const map = (body?.map || '').toString();
      const stake = Math.max(0, Math.min(1000000, Math.floor(Number(body?.stake) || 0)));
      if (!Number.isFinite(targetAccountId)) return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
      if (!MAP_POOL.includes(map)) return NextResponse.json({ error: 'Pick a valid map' }, { status: 400 });

      const me = await db.collection('players').findOne({ discordId: myId }, { projection: PLAYER_PROJ });
      const target = await db.collection('players').findOne({ accountId: targetAccountId }, { projection: PLAYER_PROJ });
      if (!me?.copsName) return NextResponse.json({ error: 'Link your account first' }, { status: 400 });
      if (!target) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      if (target.discordId === myId) return NextResponse.json({ error: "You can't challenge yourself" }, { status: 400 });

      // Blocked if either is banned.
      const ban = await activeSanction(db, myId, ['ban']);
      if (ban) return NextResponse.json({ error: 'You are banned from matches' }, { status: 403 });

      // Must be able to cover the stake now (deducted from both on accept).
      if (stake > 0) {
        const myEco = await db.collection('economy').findOne({ discordId: myId }, { projection: { balance: 1 } });
        if ((myEco?.balance ?? 0) < stake) return NextResponse.json({ error: `You don't have ${stake} EP to stake` }, { status: 400 });
      }

      // One pending challenge between the two at a time.
      const existing = await db.collection('challenges').findOne({
        status: 'pending',
        $or: [
          { challengerId: myId, targetId: target.discordId },
          { challengerId: target.discordId, targetId: myId },
        ],
      });
      if (existing) return NextResponse.json({ error: 'There is already a pending challenge between you two' }, { status: 400 });

      const doc = {
        challengerId: myId,
        challengerName: me.copsName ?? null,
        challengerAccountId: me.accountId ?? null,
        targetId: target.discordId,
        targetName: target.copsName ?? null,
        targetAccountId: target.accountId ?? null,
        map,
        stake,
        status: 'pending',
        createdAt: new Date(),
      };
      const r = await db.collection('challenges').insertOne(doc);
      await notify(db, target.discordId, {
        type: 'challenge',
        title: `${me.copsName} challenged you to a 1v1`,
        body: stake > 0 ? `Map: ${map} · ${stake} EP stake — accept or decline` : `Map: ${map} — accept or decline`,
        link: '/challenges',
      });
      return NextResponse.json({ ok: true, id: String(r.insertedId) });
    }

    // Load a challenge by id for the mutating actions.
    let oid: ObjectId;
    try {
      oid = new ObjectId((body?.challengeId || '').toString());
    } catch {
      return NextResponse.json({ error: 'Invalid challenge' }, { status: 400 });
    }
    const ch = await db.collection('challenges').findOne({ _id: oid });
    if (!ch || ch.status !== 'pending') return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });

    // ---- ACCEPT (target only) ----
    if (action === 'accept') {
      if (ch.targetId !== myId) return NextResponse.json({ error: 'Not your challenge to accept' }, { status: 403 });

      const [a, b] = await Promise.all([
        db.collection('players').findOne({ discordId: ch.challengerId }, { projection: PLAYER_PROJ }),
        db.collection('players').findOne({ discordId: ch.targetId }, { projection: PLAYER_PROJ }),
      ]);
      if (!a || !b) return NextResponse.json({ error: 'Player missing' }, { status: 400 });

      const stake = Math.max(0, Math.floor(ch.stake || 0));
      if (stake > 0) {
        // Both players must still have the stake; deduct atomically (escrow).
        const takeA = await db.collection('economy').updateOne({ discordId: ch.challengerId, balance: { $gte: stake } }, { $inc: { balance: -stake } });
        if (takeA.modifiedCount !== 1) return NextResponse.json({ error: 'Challenger can no longer cover the stake' }, { status: 400 });
        const takeB = await db.collection('economy').updateOne({ discordId: ch.targetId, balance: { $gte: stake } }, { $inc: { balance: -stake } });
        if (takeB.modifiedCount !== 1) {
          // Refund the challenger if the target can't cover it.
          await db.collection('economy').updateOne({ discordId: ch.challengerId }, { $inc: { balance: stake } });
          return NextResponse.json({ error: `You don't have ${stake} EP to match the stake` }, { status: 400 });
        }
      }

      const matchId = (globalThis.crypto?.randomUUID?.() || `chal-${Date.now()}-${Math.random().toString(36).slice(2)}`).toString();
      await db.collection('matches').insertOne({
        matchId,
        map: ch.map,
        status: 'ongoing',
        isChallenge: true,
        stake,
        teamA: [teamEntry(a)],
        teamB: [teamEntry(b)],
        reports: [],
        createdAt: new Date(),
        startedAt: new Date(),
      });
      await db.collection('challenges').updateOne({ _id: oid }, { $set: { status: 'accepted', matchId } });
      await notify(db, ch.challengerId, {
        type: 'challenge',
        title: `${ch.targetName} accepted your 1v1`,
        body: stake > 0 ? `Map: ${ch.map} · ${stake * 2} EP pot — your match is ready` : `Map: ${ch.map} — your match is ready`,
        link: `/match/${matchId}`,
      });
      return NextResponse.json({ ok: true, matchId });
    }

    // ---- DECLINE (target only) ----
    if (action === 'decline') {
      if (ch.targetId !== myId) return NextResponse.json({ error: 'Not your challenge' }, { status: 403 });
      await db.collection('challenges').updateOne({ _id: oid }, { $set: { status: 'declined' } });
      await notify(db, ch.challengerId, { type: 'challenge', title: `${ch.targetName} declined your 1v1`, link: null });
      return NextResponse.json({ ok: true });
    }

    // ---- CANCEL (challenger only) ----
    if (action === 'cancel') {
      if (ch.challengerId !== myId) return NextResponse.json({ error: 'Not your challenge' }, { status: 403 });
      await db.collection('challenges').updateOne({ _id: oid }, { $set: { status: 'cancelled' } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
