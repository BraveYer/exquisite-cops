export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';

const MAX_SIZE = 5;
const LIVE = ['ongoing', 'pending_review', 'disputed'];

function makeCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function shape(party: any, myId: string) {
  if (!party) return null;
  return {
    partyId: party.partyId,
    code: party.code,
    leaderId: party.leaderId,
    isLeader: party.leaderId === myId,
    queuing: !!party.queuing,
    maxSize: party.maxSize || MAX_SIZE,
    members: (party.members || []).map((m: any) => ({
      discordId: m.discordId,
      accountId: m.accountId ?? null,
      copsName: m.copsName ?? 'Unknown',
      elo: m.elo ?? 1000,
      avatar: m.avatar ?? null,
      isLeader: m.discordId === party.leaderId,
    })),
    invited: (party.invited || []).map((m: any) => ({
      accountId: m.accountId ?? null,
      copsName: m.copsName ?? 'Unknown',
      avatar: m.avatar ?? null,
    })),
  };
}

function shapeInvite(party: any) {
  if (!party) return null;
  const leader = (party.members || []).find((m: any) => m.discordId === party.leaderId);
  return {
    partyId: party.partyId,
    code: party.code,
    leaderName: leader?.copsName ?? 'Unknown',
    members: (party.members || []).length,
    maxSize: party.maxSize || MAX_SIZE,
  };
}

async function getMine(db: any, discordId: string) {
  return db.collection('parties').findOne({ 'members.discordId': discordId });
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ party: null });
    const db = await getDb();
    const party = await getMine(db, discordId);
    const invites = party ? [] : await db.collection('parties').find({ 'invited.discordId': discordId }).toArray();
    return NextResponse.json({ party: shape(party, discordId), invites: invites.map(shapeInvite) });
  } catch {
    return NextResponse.json({ party: null });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const db = await getDb();
    const body = await req.json().catch(() => ({}));
    const action = (body?.action || '').toString();

    const me = await db.collection('players').findOne({ discordId });
    if (!me) return NextResponse.json({ error: 'You are not registered yet. Use /link on Discord first.' }, { status: 400 });
    const selfMember = { discordId, accountId: me.accountId ?? null, copsName: me.copsName ?? 'Unknown', elo: me.elo ?? 1000, avatar: me.avatar ?? null };

    const mine = await getMine(db, discordId);

    if (action === 'create') {
      if (mine) return NextResponse.json({ party: shape(mine, discordId) });
      let code = makeCode();
      for (let i = 0; i < 5; i++) {
        const clash = await db.collection('parties').findOne({ code });
        if (!clash) break;
        code = makeCode();
      }
      const party = {
        partyId: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).toString(),
        code,
        leaderId: discordId,
        members: [selfMember],
        maxSize: MAX_SIZE,
        queuing: false,
        createdAt: new Date(),
      };
      await db.collection('parties').insertOne(party);
      return NextResponse.json({ party: shape(party, discordId) });
    }

    if (action === 'join') {
      const code = (body?.code || '').toString().trim().toUpperCase();
      if (!code) return NextResponse.json({ error: 'Enter a party code' }, { status: 400 });
      if (mine) return NextResponse.json({ error: 'Leave your current party first' }, { status: 400 });
      const party = await db.collection('parties').findOne({ code });
      if (!party) return NextResponse.json({ error: 'No party with that code' }, { status: 404 });
      if ((party.members || []).length >= (party.maxSize || MAX_SIZE)) {
        return NextResponse.json({ error: 'That party is full' }, { status: 400 });
      }
      await db.collection('parties').updateOne(
        { partyId: party.partyId, [`members.${party.members.length}`]: { $exists: false } },
        { $push: { members: selfMember } } as any
      );
      const updated = await db.collection('parties').findOne({ partyId: party.partyId });
      return NextResponse.json({ party: shape(updated, discordId) });
    }

    if (action === 'leave') {
      if (!mine) return NextResponse.json({ party: null });
      await db.collection('queue').deleteOne({ discordId });
      const remaining = (mine.members || []).filter((m: any) => m.discordId !== discordId);
      if (remaining.length === 0) {
        await db.collection('parties').deleteOne({ partyId: mine.partyId });
      } else {
        const newLeader = mine.leaderId === discordId ? remaining[0].discordId : mine.leaderId;
        await db.collection('parties').updateOne(
          { partyId: mine.partyId },
          { $set: { members: remaining, leaderId: newLeader } }
        );
      }
      return NextResponse.json({ party: null });
    }

    if (action === 'kick') {
      if (!mine) return NextResponse.json({ error: 'No party' }, { status: 400 });
      if (mine.leaderId !== discordId) return NextResponse.json({ error: 'Only the leader can kick' }, { status: 403 });
      const targetId = (body?.targetId || '').toString();
      if (!targetId || targetId === discordId) return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
      await db.collection('queue').deleteOne({ discordId: targetId });
      const remaining = (mine.members || []).filter((m: any) => m.discordId !== targetId);
      await db.collection('parties').updateOne({ partyId: mine.partyId }, { $set: { members: remaining } });
      const updated = await db.collection('parties').findOne({ partyId: mine.partyId });
      return NextResponse.json({ party: shape(updated, discordId) });
    }

    if (action === 'queue' || action === 'unqueue') {
      if (!mine) return NextResponse.json({ error: 'No party' }, { status: 400 });
      if (mine.leaderId !== discordId) return NextResponse.json({ error: 'Only the leader can start the search' }, { status: 403 });
      const memberIds = (mine.members || []).map((m: any) => m.discordId);

      if (action === 'unqueue') {
        await db.collection('queue').deleteMany({ discordId: { $in: memberIds } });
        await db.collection('parties').updateOne({ partyId: mine.partyId }, { $set: { queuing: false } });
        return NextResponse.json({ party: shape({ ...mine, queuing: false }, discordId) });
      }

      // queue: guard — nobody can be in a live match
      const busy = await db.collection('matches').findOne({
        status: { $in: LIVE },
        $or: [{ 'teamA.discordId': { $in: memberIds } }, { 'teamB.discordId': { $in: memberIds } }],
      });
      if (busy) return NextResponse.json({ error: 'A party member is already in a live match' }, { status: 409 });

      const now = new Date();
      for (const m of mine.members || []) {
        await db.collection('queue').updateOne(
          { discordId: m.discordId },
          {
            $set: { discordId: m.discordId, copsName: m.copsName ?? null, elo: m.elo ?? 1000, partyId: mine.partyId, lastSeen: now },
            $setOnInsert: { joinedAt: now },
          },
          { upsert: true }
        );
      }
      await db.collection('parties').updateOne({ partyId: mine.partyId }, { $set: { queuing: true } });
      return NextResponse.json({ party: shape({ ...mine, queuing: true }, discordId) });
    }

    if (action === 'invite') {
      if (!mine) return NextResponse.json({ error: 'Create a party first' }, { status: 400 });
      if (mine.leaderId !== discordId) return NextResponse.json({ error: 'Only the leader can invite' }, { status: 403 });
      const targetPlayer = await db.collection('players').findOne({ accountId: Number(body?.target) }, { projection: { discordId: 1, copsName: 1, avatar: 1, accountId: 1 } });
      if (!targetPlayer?.discordId) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      const otherId = targetPlayer.discordId;
      if (otherId === discordId) return NextResponse.json({ error: 'That is you' }, { status: 400 });
      // Must be a friend.
      const friend = await db.collection('friendships').findOne({
        status: 'accepted',
        $or: [{ a: discordId, b: otherId }, { a: otherId, b: discordId }],
      });
      if (!friend) return NextResponse.json({ error: 'You can only invite friends' }, { status: 403 });
      if ((mine.members || []).some((m: any) => m.discordId === otherId)) return NextResponse.json({ party: shape(mine, discordId) });
      if ((mine.members || []).length + 1 > (mine.maxSize || MAX_SIZE)) return NextResponse.json({ error: 'Party is full' }, { status: 400 });
      if ((mine.invited || []).some((m: any) => m.discordId === otherId)) return NextResponse.json({ party: shape(mine, discordId) });
      await db.collection('parties').updateOne(
        { partyId: mine.partyId },
        { $push: { invited: { discordId: otherId, accountId: targetPlayer.accountId ?? null, copsName: targetPlayer.copsName ?? 'Unknown', avatar: targetPlayer.avatar ?? null } } } as any
      );
      const updated = await db.collection('parties').findOne({ partyId: mine.partyId });
      return NextResponse.json({ party: shape(updated, discordId) });
    }

    if (action === 'acceptInvite') {
      if (mine) return NextResponse.json({ error: 'Leave your current party first' }, { status: 400 });
      const partyId = (body?.partyId || '').toString();
      const party = await db.collection('parties').findOne({ partyId, 'invited.discordId': discordId });
      if (!party) return NextResponse.json({ error: 'Invite no longer available' }, { status: 404 });
      if ((party.members || []).length >= (party.maxSize || MAX_SIZE)) {
        await db.collection('parties').updateOne({ partyId }, { $pull: { invited: { discordId } } } as any);
        return NextResponse.json({ error: 'That party is full' }, { status: 400 });
      }
      await db.collection('parties').updateOne(
        { partyId },
        { $push: { members: selfMember }, $pull: { invited: { discordId } } } as any
      );
      const updated = await db.collection('parties').findOne({ partyId });
      return NextResponse.json({ party: shape(updated, discordId) });
    }

    if (action === 'declineInvite') {
      const partyId = (body?.partyId || '').toString();
      await db.collection('parties').updateOne({ partyId }, { $pull: { invited: { discordId } } } as any);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
