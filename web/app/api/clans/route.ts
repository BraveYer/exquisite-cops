export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';
import { clubXpFromWins, clubLevelFromXp } from '../../../lib/clubLevel';
import { notifyMentions } from '../../../lib/mentions';
import { getClubStyle } from '../../../lib/clubShop';
import { activeSanction, sanctionMessage } from '../../../lib/sanctions';

const MAX_NAME = 32;
const MIN_TAG = 2;
const MAX_TAG = 5;
const MAX_DESC = 300;
const MAX_MEMBERS = 50;

function oid(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}
function normTag(s: any) {
  return (s || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, MAX_TAG);
}
async function myPlayer(db: any, myId: string) {
  return db.collection('players').findOne({ discordId: myId }, { projection: { copsName: 1, accountId: 1, avatar: 1, elo: 1 } });
}

async function logClanEvent(db: any, clanId: string, type: string, actorName: string, targetName?: string | null) {
  try {
    await db.collection('clanEvents').insertOne({ clanId, type, actorName: actorName || 'Someone', targetName: targetName || null, createdAt: new Date() });
  } catch {
    /* ignore */
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    const db = await getDb();
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const q = url.searchParams.get('q');
    const player = url.searchParams.get('player');
    const mine = url.searchParams.get('me');

    // Clan tag for a given player (used by profile)
    if (player) {
      const p = await db.collection('players').findOne({ accountId: Number(player) }, { projection: { discordId: 1 } });
      if (!p) return NextResponse.json({ clan: null });
      const mem = await db.collection('clanMembers').findOne({ discordId: p.discordId });
      if (!mem) return NextResponse.json({ clan: null });
      const objId = oid(mem.clanId);
      const clan = objId ? await db.collection('clans').findOne({ _id: objId }) : null;
      if (!clan) return NextResponse.json({ clan: null });
      return NextResponse.json({ clan: { id: String(clan._id), name: clan.name, tag: clan.tag, role: mem.role, color: clan.color ?? null } });
    }

    // My clan summary
    if (mine) {
      if (!myId) return NextResponse.json({ clan: null });
      const mem = await db.collection('clanMembers').findOne({ discordId: myId });
      if (!mem) return NextResponse.json({ clan: null });
      const objId = oid(mem.clanId);
      const clan = objId ? await db.collection('clans').findOne({ _id: objId }) : null;
      if (!clan) return NextResponse.json({ clan: null });
      return NextResponse.json({ clan: { id: String(clan._id), name: clan.name, tag: clan.tag, role: mem.role, color: clan.color ?? null } });
    }

    // Club chat messages (members only)
    const chat = url.searchParams.get('chat');
    if (chat) {
      if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
      const objId = oid(chat);
      if (!objId) return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      const clan = await db.collection('clans').findOne({ _id: objId }, { projection: { _id: 1 } });
      if (!clan) return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      const cid = String(clan._id);
      const mem = await db.collection('clanMembers').findOne({ clanId: cid, discordId: myId });
      if (!mem) return NextResponse.json({ error: 'Members only' }, { status: 403 });
      const raw = await db.collection('clanMessages').find({ clanId: cid }).sort({ createdAt: -1 }).limit(80).toArray();
      const messages = raw.reverse().map((m: any) => ({
        id: String(m._id),
        fromMe: m.from === myId,
        fromName: m.fromName ?? 'Unknown',
        fromAccountId: m.fromAccountId ?? null,
        fromAvatar: m.fromAvatar ?? null,
        fromElo: m.fromElo ?? 1000,
        text: m.text ?? '',
        createdAt: m.createdAt ?? null,
      }));
      await db.collection('clanReads').updateOne({ clanId: cid, userId: myId }, { $set: { lastReadAt: new Date() } }, { upsert: true });
      return NextResponse.json({ messages });
    }

    // Clan detail
    if (id) {
      const objId = oid(id);
      if (!objId) return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      const clan = await db.collection('clans').findOne({ _id: objId });
      if (!clan) return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      const cid = String(clan._id);

      const members = await db.collection('clanMembers').find({ clanId: cid }).toArray();
      const memIds = members.map((m: any) => m.discordId);
      const players = await db
        .collection('players')
        .find({ discordId: { $in: memIds } }, { projection: { discordId: 1, accountId: 1, copsName: 1, avatar: 1, elo: 1, cosmetics: 1, wins: 1, losses: 1 } })
        .toArray();
      const pBy = new Map<string, any>();
      for (const p of players) pBy.set(p.discordId, p);
      const roleRank: any = { leader: 0, officer: 1, member: 2 };
      const roster = members
        .map((m: any) => {
          const p = pBy.get(m.discordId) || {};
          return {
            accountId: p.accountId ?? null,
            copsName: p.copsName ?? 'Unknown',
            avatar: p.avatar ?? null,
            elo: p.elo ?? 1000,
            wins: p.wins ?? 0,
            losses: p.losses ?? 0,
            nameStyle: p.cosmetics?.name || null,
            frame: p.cosmetics?.frame || null,
            role: m.role,
            joinedAt: m.joinedAt ?? null,
          };
        })
        .sort((a: any, b: any) => (roleRank[a.role] - roleRank[b.role]) || b.elo - a.elo);

      const myMem = myId ? members.find((m: any) => m.discordId === myId) : null;
      const myRole = myMem?.role || null;
      const iAmStaff = myRole === 'leader' || myRole === 'officer';

      let applied = false;
      if (myId && !myMem) applied = !!(await db.collection('clanApplications').findOne({ clanId: cid, discordId: myId }));

      let applications: any[] = [];
      if (iAmStaff) {
        const apps = await db.collection('clanApplications').find({ clanId: cid }).sort({ createdAt: 1 }).toArray();
        applications = apps.map((a: any) => ({
          accountId: a.accountId ?? null,
          copsName: a.copsName ?? 'Unknown',
          avatar: a.avatar ?? null,
          elo: a.elo ?? 1000,
          at: a.createdAt ?? null,
        }));
      }

      const myAnyClan = myId ? await db.collection('clanMembers').findOne({ discordId: myId }) : null;
      const avgElo = roster.length ? Math.round(roster.reduce((s: number, r: any) => s + (r.elo || 0), 0) / roster.length) : 0;
      const myInvite = myId && !myMem ? !!(await db.collection('clanInvites').findOne({ clanId: cid, discordId: myId })) : false;

      // Aggregate club stats
      const totalWins = roster.reduce((s: number, r: any) => s + (r.wins || 0), 0);
      const totalLosses = roster.reduce((s: number, r: any) => s + (r.losses || 0), 0);
      const totalGames = totalWins + totalLosses;
      const clubWinRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
      let best: any = null;
      for (const r of roster) {
        if (!best || (r.wins || 0) > (best.wins || 0) || ((r.wins || 0) === (best.wins || 0) && (r.elo || 0) > (best.elo || 0))) best = r;
      }
      const stats = {
        totalWins,
        totalLosses,
        totalGames,
        winRate: clubWinRate,
        bestMember: best ? { accountId: best.accountId, copsName: best.copsName, wins: best.wins || 0, elo: best.elo || 1000 } : null,
        ...(() => {
          const lvl = clubLevelFromXp(clubXpFromWins(totalWins));
          return { level: lvl.level, xp: lvl.totalXp, xpInLevel: lvl.xpInLevel, xpForNext: lvl.xpForNext, progress: lvl.progress };
        })(),
      };

      const events = (await db.collection('clanEvents').find({ clanId: cid }).sort({ createdAt: -1 }).limit(20).toArray()).map((e: any) => ({
        type: e.type,
        actorName: e.actorName,
        targetName: e.targetName ?? null,
        createdAt: e.createdAt ?? null,
      }));

      return NextResponse.json({
        clan: {
          id: cid,
          name: clan.name,
          tag: clan.tag,
          description: clan.description ?? '',
          color: clan.color ?? null,
          banner: clan.banner ?? null,
          announce: clan.announce ?? '',
          recruiting: clan.recruiting !== false,
          memberCount: members.length,
          avgElo,
          tagStyle: clan.tagStyle ?? null,
          createdAt: clan.createdAt ?? null,
        },
        stats,
        roster,
        myRole,
        applied,
        myInvite,
        inAnotherClan: !!myAnyClan && !myMem,
        applications,
        events,
        ownedStyles: clan.ownedStyles ?? [],
      });
    }

    // Browse / search
    const filter: any = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { tag: rx }];
    }
    const clans = await db.collection('clans').find(filter).limit(60).toArray();
    const cids = clans.map((c: any) => String(c._id));
    const mems = cids.length
      ? await db.collection('clanMembers').find({ clanId: { $in: cids } }, { projection: { clanId: 1, discordId: 1 } }).toArray()
      : [];
    const membersByClan = new Map<string, string[]>();
    for (const m of mems) {
      const a = membersByClan.get(m.clanId) || [];
      a.push(m.discordId);
      membersByClan.set(m.clanId, a);
    }
    const allMemIds = [...new Set(mems.map((m: any) => m.discordId))];
    const memPlayers = allMemIds.length
      ? await db.collection('players').find({ discordId: { $in: allMemIds } }, { projection: { discordId: 1, elo: 1, wins: 1 } }).toArray()
      : [];
    const statBy = new Map<string, any>();
    for (const p of memPlayers) statBy.set(p.discordId, p);
    const list = clans
      .map((c: any) => {
        const ids2 = membersByClan.get(String(c._id)) || [];
        let sumElo = 0;
        let wins = 0;
        let n = 0;
        for (const did of ids2) {
          const p = statBy.get(did);
          if (p) {
            sumElo += p.elo || 0;
            wins += p.wins || 0;
            n++;
          }
        }
        return {
          id: String(c._id),
          name: c.name,
          tag: c.tag,
          description: c.description ?? '',
          color: c.color ?? null,
          banner: c.banner ?? null,
          memberCount: ids2.length,
          avgElo: n ? Math.round(sumElo / n) : 0,
          totalWins: wins,
          level: clubLevelFromXp(clubXpFromWins(wins)).level,
          tagStyle: c.tagStyle ?? null,
          recruiting: c.recruiting !== false,
        };
      })
      .sort((a: any, b: any) => b.memberCount - a.memberCount || a.name.localeCompare(b.name));

    let myClan = null;
    if (myId) {
      const myMem = await db.collection('clanMembers').findOne({ discordId: myId });
      if (myMem) {
        const objId = oid(myMem.clanId);
        const c = objId ? await db.collection('clans').findOne({ _id: objId }) : null;
        if (c) myClan = { id: String(c._id), name: c.name, tag: c.tag, role: myMem.role, color: c.color ?? null };
      }
    }

    return NextResponse.json({ clans: list, myClan });
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
    const me = await myPlayer(db, myId);
    if (!me) return NextResponse.json({ error: 'Not linked' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const action = (body?.action || '').toString();

    const myMem = await db.collection('clanMembers').findOne({ discordId: myId });

    if (action === 'create') {
      if (myMem) return NextResponse.json({ error: 'You are already in a club' }, { status: 400 });
      const name = (body?.name || '').toString().trim().slice(0, MAX_NAME);
      const tag = normTag(body?.tag);
      const description = (body?.description || '').toString().trim().slice(0, MAX_DESC);
      if (name.length < 2) return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 });
      if (tag.length < MIN_TAG) return NextResponse.json({ error: 'Tag must be 2–5 letters or numbers' }, { status: 400 });
      const exists = await db.collection('clans').findOne({ tag });
      if (exists) return NextResponse.json({ error: 'That tag is already taken' }, { status: 409 });
      const r = await db.collection('clans').insertOne({ name, tag, description, ownerId: myId, createdAt: new Date() });
      const cid = String(r.insertedId);
      await db.collection('clanMembers').insertOne({ clanId: cid, discordId: myId, accountId: me.accountId ?? null, role: 'leader', joinedAt: new Date() });
      return NextResponse.json({ ok: true, id: cid });
    }

    if (action === 'apply') {
      if (myMem) return NextResponse.json({ error: 'You are already in a club' }, { status: 400 });
      const objId = oid((body?.clanId || '').toString());
      if (!objId) return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      const clan = await db.collection('clans').findOne({ _id: objId });
      if (!clan) return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      const cid = String(clan._id);
      const memberCount = await db.collection('clanMembers').countDocuments({ clanId: cid });
      if (memberCount >= MAX_MEMBERS) return NextResponse.json({ error: 'Club is full' }, { status: 400 });
      await db.collection('clanApplications').updateOne(
        { clanId: cid, discordId: myId },
        { $set: { accountId: me.accountId ?? null, copsName: me.copsName ?? 'Unknown', avatar: me.avatar ?? null, elo: me.elo ?? 1000, createdAt: new Date() } },
        { upsert: true }
      );
      return NextResponse.json({ ok: true });
    }

    if (action === 'cancelApply') {
      const objId = oid((body?.clanId || '').toString());
      if (!objId) return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      await db.collection('clanApplications').deleteOne({ clanId: String(objId), discordId: myId });
      return NextResponse.json({ ok: true });
    }

    if (action === 'acceptInvite') {
      if (myMem) return NextResponse.json({ error: 'You are already in a club' }, { status: 400 });
      const objId = oid((body?.clanId || '').toString());
      if (!objId) return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      const cidA = String(objId);
      const inv = await db.collection('clanInvites').findOne({ clanId: cidA, discordId: myId });
      if (!inv) return NextResponse.json({ error: 'No invite' }, { status: 404 });
      const clan = await db.collection('clans').findOne({ _id: objId });
      if (!clan) {
        await db.collection('clanInvites').deleteMany({ discordId: myId });
        return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      }
      const memberCount = await db.collection('clanMembers').countDocuments({ clanId: cidA });
      if (memberCount >= MAX_MEMBERS) return NextResponse.json({ error: 'Club is full' }, { status: 400 });
      await db.collection('clanMembers').insertOne({ clanId: cidA, discordId: myId, accountId: me.accountId ?? null, role: 'member', joinedAt: new Date() });
      await db.collection('clanInvites').deleteMany({ discordId: myId });
      await db.collection('clanApplications').deleteMany({ discordId: myId });
      logClanEvent(db, cidA, 'join', me.copsName ?? 'A player');
      return NextResponse.json({ ok: true, id: cidA });
    }

    if (action === 'declineInvite') {
      const objId = oid((body?.clanId || '').toString());
      if (!objId) return NextResponse.json({ error: 'Club not found' }, { status: 404 });
      await db.collection('clanInvites').deleteOne({ clanId: String(objId), discordId: myId });
      return NextResponse.json({ ok: true });
    }

    // Actions on a clan I belong to
    if (!myMem) return NextResponse.json({ error: 'You are not in a club' }, { status: 403 });
    const cid = myMem.clanId as string;
    const clanObjId = oid(cid);
    const iAmLeader = myMem.role === 'leader';
    const iAmStaff = myMem.role === 'leader' || myMem.role === 'officer';

    const targetMember = async (acc: any) => {
      const p = await db.collection('players').findOne({ accountId: Number(acc) }, { projection: { discordId: 1, accountId: 1, copsName: 1 } });
      if (!p) return null;
      const mem = await db.collection('clanMembers').findOne({ clanId: cid, discordId: p.discordId });
      return mem ? ({ ...mem, player: p } as any) : null;
    };

    if (action === 'approve' || action === 'decline') {
      if (!iAmStaff) return NextResponse.json({ error: 'No permission' }, { status: 403 });
      const p = await db.collection('players').findOne({ accountId: Number(body?.accountId) }, { projection: { discordId: 1, accountId: 1, copsName: 1 } });
      if (!p) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      const app = await db.collection('clanApplications').findOne({ clanId: cid, discordId: p.discordId });
      if (!app) return NextResponse.json({ error: 'No application' }, { status: 404 });
      await db.collection('clanApplications').deleteOne({ clanId: cid, discordId: p.discordId });
      if (action === 'approve') {
        const already = await db.collection('clanMembers').findOne({ discordId: p.discordId });
        if (already) return NextResponse.json({ error: 'User already joined a club' }, { status: 400 });
        const memberCount = await db.collection('clanMembers').countDocuments({ clanId: cid });
        if (memberCount >= MAX_MEMBERS) return NextResponse.json({ error: 'Club is full' }, { status: 400 });
        await db.collection('clanMembers').insertOne({ clanId: cid, discordId: p.discordId, accountId: p.accountId ?? null, role: 'member', joinedAt: new Date() });
        logClanEvent(db, cid, 'join', p.copsName ?? 'A player');
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'promote' || action === 'demote') {
      if (!iAmLeader) return NextResponse.json({ error: 'Only the leader can change roles' }, { status: 403 });
      const tm = await targetMember(body?.accountId);
      if (!tm) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      if (tm.role === 'leader') return NextResponse.json({ error: 'Cannot change the leader' }, { status: 400 });
      await db.collection('clanMembers').updateOne({ clanId: cid, discordId: tm.discordId }, { $set: { role: action === 'promote' ? 'officer' : 'member' } });
      logClanEvent(db, cid, action, me.copsName ?? 'A leader', tm.player?.copsName ?? 'A member');
      return NextResponse.json({ ok: true });
    }

    if (action === 'kick') {
      if (!iAmStaff) return NextResponse.json({ error: 'No permission' }, { status: 403 });
      const tm = await targetMember(body?.accountId);
      if (!tm) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      if (tm.discordId === myId) return NextResponse.json({ error: 'Use leave instead' }, { status: 400 });
      if (tm.role === 'leader') return NextResponse.json({ error: 'Cannot kick the leader' }, { status: 400 });
      if (myMem.role === 'officer' && tm.role === 'officer') return NextResponse.json({ error: 'Officers cannot kick other officers' }, { status: 403 });
      await db.collection('clanMembers').deleteOne({ clanId: cid, discordId: tm.discordId });
      logClanEvent(db, cid, 'kick', me.copsName ?? 'Staff', tm.player?.copsName ?? 'A member');
      return NextResponse.json({ ok: true });
    }

    if (action === 'transfer') {
      if (!iAmLeader) return NextResponse.json({ error: 'Only the leader can transfer leadership' }, { status: 403 });
      const tm = await targetMember(body?.accountId);
      if (!tm) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      if (tm.discordId === myId) return NextResponse.json({ error: 'You are already the leader' }, { status: 400 });
      await db.collection('clanMembers').updateOne({ clanId: cid, discordId: tm.discordId }, { $set: { role: 'leader' } });
      await db.collection('clanMembers').updateOne({ clanId: cid, discordId: myId }, { $set: { role: 'officer' } });
      if (clanObjId) await db.collection('clans').updateOne({ _id: clanObjId }, { $set: { ownerId: tm.discordId } });
      logClanEvent(db, cid, 'transfer', me.copsName ?? 'A leader', tm.player?.copsName ?? 'A member');
      return NextResponse.json({ ok: true });
    }

    if (action === 'edit') {
      if (!iAmStaff) return NextResponse.json({ error: 'No permission' }, { status: 403 });
      const set: any = {};
      if (typeof body?.name === 'string') {
        const n = body.name.trim().slice(0, MAX_NAME);
        if (n.length >= 2) set.name = n;
      }
      if (typeof body?.description === 'string') set.description = body.description.trim().slice(0, MAX_DESC);
      if (typeof body?.color === 'string') {
        const col = body.color.trim();
        set.color = /^#[0-9a-fA-F]{6}$/.test(col) ? col : null;
      }
      if (typeof body?.banner === 'string') {
        const b = body.banner.trim();
        set.banner = b === '' || /^https?:\/\//i.test(b) || b.startsWith('/api/uploads/') ? b || null : null;
      }
      if (typeof body?.announce === 'string') set.announce = body.announce.trim().slice(0, 300);
      if (typeof body?.recruiting === 'boolean') set.recruiting = body.recruiting;
      if (Object.keys(set).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
      if (clanObjId) await db.collection('clans').updateOne({ _id: clanObjId }, { $set: set });
      return NextResponse.json({ ok: true });
    }

    if (action === 'leave') {
      const remaining = await db.collection('clanMembers').find({ clanId: cid, discordId: { $ne: myId } }).toArray();
      await db.collection('clanMembers').deleteOne({ clanId: cid, discordId: myId });
      if (remaining.length === 0) {
        if (clanObjId) await db.collection('clans').deleteOne({ _id: clanObjId });
        await db.collection('clanApplications').deleteMany({ clanId: cid });
        await db.collection('clanMessages').deleteMany({ clanId: cid });
        await db.collection('clanReads').deleteMany({ clanId: cid });
        await db.collection('clanInvites').deleteMany({ clanId: cid });
        return NextResponse.json({ ok: true, disbanded: true });
      }
      if (iAmLeader) {
        const heir = remaining.find((m: any) => m.role === 'officer') || remaining[0];
        await db.collection('clanMembers').updateOne({ clanId: cid, discordId: heir.discordId }, { $set: { role: 'leader' } });
        if (clanObjId) await db.collection('clans').updateOne({ _id: clanObjId }, { $set: { ownerId: heir.discordId } });
      }
      logClanEvent(db, cid, 'leave', me.copsName ?? 'A member');
      return NextResponse.json({ ok: true });
    }

    if (action === 'chat') {
      const text = (body?.text || '').toString().trim().slice(0, 1000);
      if (!text) return NextResponse.json({ error: 'Empty message' }, { status: 400 });
      const sanc = await activeSanction(db, myId, ['mute', 'ban']);
      if (sanc) return NextResponse.json({ error: sanctionMessage(sanc) }, { status: 403 });
      const doc = {
        clanId: cid,
        from: myId,
        fromName: me.copsName ?? 'Unknown',
        fromAccountId: me.accountId ?? null,
        fromAvatar: me.avatar ?? null,
        fromElo: me.elo ?? 1000,
        text,
        createdAt: new Date(),
      };
      const ins = await db.collection('clanMessages').insertOne(doc);
      await db.collection('clanReads').updateOne({ clanId: cid, userId: myId }, { $set: { lastReadAt: new Date() } }, { upsert: true });
      const memberIds = (await db.collection('clanMembers').find({ clanId: cid }, { projection: { discordId: 1 } }).toArray()).map((m: any) => m.discordId);
      const clanDoc = clanObjId ? await db.collection('clans').findOne({ _id: clanObjId }, { projection: { tag: 1 } }) : null;
      notifyMentions(db, text, { fromName: me.copsName ?? 'Someone', link: `/clans/${cid}`, scopeLabel: clanDoc ? `[${clanDoc.tag}] chat` : 'club chat', excludeDiscordId: myId, allowedDiscordIds: memberIds });
      return NextResponse.json({ ok: true, id: String(ins.insertedId) });
    }

    if (action === 'invite') {
      if (!iAmStaff) return NextResponse.json({ error: 'Only leaders and officers can invite' }, { status: 403 });
      const acc = Number(body?.accountId);
      const p = await db.collection('players').findOne({ accountId: acc }, { projection: { discordId: 1 } });
      if (!p) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      if (p.discordId === myId) return NextResponse.json({ error: 'That is you' }, { status: 400 });
      const fr = await db.collection('friendships').findOne({ status: 'accepted', $or: [{ a: myId, b: p.discordId }, { a: p.discordId, b: myId }] });
      if (!fr) return NextResponse.json({ error: 'You can only invite friends' }, { status: 403 });
      const already = await db.collection('clanMembers').findOne({ discordId: p.discordId });
      if (already) return NextResponse.json({ error: already.clanId === cid ? 'Already a member' : 'Already in a club' }, { status: 400 });
      const memberCount = await db.collection('clanMembers').countDocuments({ clanId: cid });
      if (memberCount >= MAX_MEMBERS) return NextResponse.json({ error: 'Club is full' }, { status: 400 });
      await db.collection('clanInvites').updateOne({ clanId: cid, discordId: p.discordId }, { $set: { invitedBy: myId, createdAt: new Date() } }, { upsert: true });
      return NextResponse.json({ ok: true });
    }

    if (action === 'announce') {
      if (!iAmStaff) return NextResponse.json({ error: 'No permission' }, { status: 403 });
      const text = (body?.text || '').toString().trim().slice(0, 300);
      if (clanObjId) await db.collection('clans').updateOne({ _id: clanObjId }, { $set: { announce: text } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'disband') {
      if (!iAmLeader) return NextResponse.json({ error: 'Only the leader can disband the club' }, { status: 403 });
      if (clanObjId) await db.collection('clans').deleteOne({ _id: clanObjId });
      await db.collection('clanMembers').deleteMany({ clanId: cid });
      await db.collection('clanApplications').deleteMany({ clanId: cid });
      await db.collection('clanMessages').deleteMany({ clanId: cid });
      await db.collection('clanReads').deleteMany({ clanId: cid });
      await db.collection('clanInvites').deleteMany({ clanId: cid });
      return NextResponse.json({ ok: true, disbanded: true });
    }

    if (action === 'buyStyle') {
      if (!iAmLeader) return NextResponse.json({ error: 'Only the leader can buy club cosmetics' }, { status: 403 });
      const style = getClubStyle((body?.styleId || '').toString());
      if (!style) return NextResponse.json({ error: 'Style not found' }, { status: 404 });
      const clanDoc = clanObjId ? await db.collection('clans').findOne({ _id: clanObjId }, { projection: { ownedStyles: 1 } }) : null;
      if ((clanDoc?.ownedStyles || []).includes(style.id)) return NextResponse.json({ error: 'Already owned — just equip it' }, { status: 400 });
      const eco = await db.collection('economy').findOne({ discordId: myId }, { projection: { balance: 1 } });
      if ((eco?.balance ?? 0) < style.price) return NextResponse.json({ error: 'Not enough EP' }, { status: 400 });
      const dec = await db.collection('economy').updateOne({ discordId: myId, balance: { $gte: style.price } }, { $inc: { balance: -style.price } });
      if (dec.modifiedCount === 0) return NextResponse.json({ error: 'Not enough EP' }, { status: 400 });
      if (clanObjId) await db.collection('clans').updateOne({ _id: clanObjId }, { $addToSet: { ownedStyles: style.id }, $set: { tagStyle: style.id } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'setStyle') {
      if (!iAmLeader) return NextResponse.json({ error: 'Only the leader can change club cosmetics' }, { status: 403 });
      const styleId = body?.styleId ? body.styleId.toString() : null;
      const clanDoc = clanObjId ? await db.collection('clans').findOne({ _id: clanObjId }, { projection: { ownedStyles: 1 } }) : null;
      if (styleId && !(clanDoc?.ownedStyles || []).includes(styleId)) return NextResponse.json({ error: "You don't own that style" }, { status: 400 });
      if (clanObjId) await db.collection('clans').updateOne({ _id: clanObjId }, { $set: { tagStyle: styleId } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Bad action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
