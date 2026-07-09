export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';
import { notifyMentions } from '../../../lib/mentions';
import { activeSanction, sanctionMessage } from '../../../lib/sanctions';

const MAX_LEN = 1000;
const MAX_NAME = 40;
const LIMIT = 80;
const MAX_MEMBERS = 20;

function oid(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

async function myPlayer(db: any, myId: string) {
  return db.collection('players').findOne({ discordId: myId }, { projection: { copsName: 1, accountId: 1, avatar: 1, elo: 1 } });
}

// Resolve accountIds -> discordIds, keeping only accepted friends of `myId`.
async function friendDiscordIds(db: any, myId: string, accountIds: number[]): Promise<string[]> {
  if (accountIds.length === 0) return [];
  const players = await db.collection('players').find({ accountId: { $in: accountIds } }, { projection: { discordId: 1 } }).toArray();
  const ids = players.map((p: any) => p.discordId).filter(Boolean);
  if (ids.length === 0) return [];
  const fr = await db
    .collection('friendships')
    .find({ status: 'accepted', $or: [{ a: myId, b: { $in: ids } }, { b: myId, a: { $in: ids } }] })
    .toArray();
  const friendSet = new Set<string>();
  for (const f of fr) friendSet.add(f.a === myId ? f.b : f.a);
  return ids.filter((id: string) => friendSet.has(id));
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const db = await getDb();
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const countOnly = url.searchParams.get('count');

    const readsArr = await db.collection('groupReads').find({ userId: myId }).toArray();
    const reads = new Map<string, number>();
    for (const r of readsArr) reads.set(r.groupId, r.lastReadAt ? new Date(r.lastReadAt).getTime() : 0);

    // Unread total (sidebar badge)
    if (countOnly) {
      const myGroups = await db.collection('groups').find({ members: myId }, { projection: { _id: 1 } }).toArray();
      const gids = myGroups.map((g: any) => String(g._id));
      if (gids.length === 0) return NextResponse.json({ unread: 0 });
      const msgs = await db
        .collection('groupMessages')
        .find({ groupId: { $in: gids }, from: { $ne: myId } }, { projection: { groupId: 1, createdAt: 1 } })
        .sort({ createdAt: -1 })
        .limit(1500)
        .toArray();
      let unread = 0;
      for (const m of msgs) {
        const t = m.createdAt ? new Date(m.createdAt).getTime() : 0;
        if (t > (reads.get(m.groupId) || 0)) unread++;
      }
      return NextResponse.json({ unread });
    }

    // Single group thread
    if (id) {
      const objId = oid(id);
      if (!objId) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
      const g = await db.collection('groups').findOne({ _id: objId });
      if (!g || !(g.members || []).includes(myId)) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
      const gid = String(g._id);

      const members = await db
        .collection('players')
        .find({ discordId: { $in: g.members || [] } }, { projection: { discordId: 1, accountId: 1, copsName: 1, avatar: 1, elo: 1 } })
        .toArray();

      const raw = await db.collection('groupMessages').find({ groupId: gid }).sort({ createdAt: -1 }).limit(LIMIT).toArray();
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

      await db.collection('groupReads').updateOne({ groupId: gid, userId: myId }, { $set: { lastReadAt: new Date() } }, { upsert: true });

      return NextResponse.json({
        group: {
          id: gid,
          name: g.name ?? 'Group',
          isOwner: g.ownerId === myId,
          members: members.map((x: any) => ({
            accountId: x.accountId ?? null,
            copsName: x.copsName ?? 'Unknown',
            avatar: x.avatar ?? null,
            elo: x.elo ?? 1000,
            isOwner: x.discordId === g.ownerId,
          })),
        },
        messages,
      });
    }

    // Group list
    const groups = await db.collection('groups').find({ members: myId }).toArray();
    if (groups.length === 0) return NextResponse.json({ groups: [] });
    const gids = groups.map((g: any) => String(g._id));

    const lastAgg = await db
      .collection('groupMessages')
      .aggregate([
        { $match: { groupId: { $in: gids } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$groupId', text: { $first: '$text' }, createdAt: { $first: '$createdAt' }, from: { $first: '$from' }, fromName: { $first: '$fromName' } } },
      ])
      .toArray();
    const lastBy = new Map<string, any>();
    for (const l of lastAgg) lastBy.set(l._id, l);

    const incoming = await db
      .collection('groupMessages')
      .find({ groupId: { $in: gids }, from: { $ne: myId } }, { projection: { groupId: 1, createdAt: 1 } })
      .limit(2000)
      .toArray();
    const unreadBy = new Map<string, number>();
    for (const m of incoming) {
      const t = m.createdAt ? new Date(m.createdAt).getTime() : 0;
      if (t > (reads.get(m.groupId) || 0)) unreadBy.set(m.groupId, (unreadBy.get(m.groupId) || 0) + 1);
    }

    const allMemberIds = Array.from(new Set(groups.flatMap((g: any) => g.members || [])));
    const memPlayers = await db
      .collection('players')
      .find({ discordId: { $in: allMemberIds } }, { projection: { discordId: 1, avatar: 1, copsName: 1, elo: 1 } })
      .toArray();
    const memBy = new Map<string, any>();
    for (const p of memPlayers) memBy.set(p.discordId, p);

    const list = groups.map((g: any) => {
      const gid = String(g._id);
      const last = lastBy.get(gid);
      const avatars = (g.members || []).slice(0, 3).map((did: string) => {
        const p = memBy.get(did);
        return { avatar: p?.avatar ?? null, name: p?.copsName ?? '?', elo: p?.elo ?? 1000 };
      });
      return {
        id: gid,
        name: g.name ?? 'Group',
        memberCount: (g.members || []).length,
        avatars,
        lastText: last?.text ?? '',
        lastFrom: last?.fromName ?? '',
        lastFromMe: last ? last.from === myId : false,
        lastAt: last?.createdAt ?? null,
        unread: unreadBy.get(gid) || 0,
      };
    });
    list.sort((x: any, y: any) => {
      const tx = x.lastAt ? new Date(x.lastAt).getTime() : 0;
      const ty = y.lastAt ? new Date(y.lastAt).getTime() : 0;
      if (tx !== ty) return ty - tx;
      return (x.name || '').localeCompare(y.name || '');
    });

    return NextResponse.json({ groups: list });
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

    if (action === 'create') {
      const name = (body?.name || '').toString().trim().slice(0, MAX_NAME) || 'New group';
      const accs = Array.isArray(body?.members) ? body.members.map(Number).filter((n: number) => Number.isFinite(n)) : [];
      const memberIds = await friendDiscordIds(db, myId, accs);
      const members = Array.from(new Set([myId, ...memberIds])).slice(0, MAX_MEMBERS);
      if (members.length < 2) return NextResponse.json({ error: 'Add at least one friend' }, { status: 400 });
      const doc = { name, ownerId: myId, members, createdAt: new Date() };
      const r = await db.collection('groups').insertOne(doc);
      return NextResponse.json({ ok: true, id: String(r.insertedId) });
    }

    // Everything else needs a group I belong to
    const objId = oid((body?.groupId || '').toString());
    if (!objId) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    const g = await db.collection('groups').findOne({ _id: objId });
    if (!g || !(g.members || []).includes(myId)) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    const gid = String(g._id);
    const isOwner = g.ownerId === myId;

    if (action === 'send') {
      const text = (body?.text || '').toString().trim().slice(0, MAX_LEN);
      if (!text) return NextResponse.json({ error: 'Empty message' }, { status: 400 });
      const sanc = await activeSanction(db, myId, ['mute', 'ban']);
      if (sanc) return NextResponse.json({ error: sanctionMessage(sanc) }, { status: 403 });
      const doc = {
        groupId: gid,
        from: myId,
        fromName: me.copsName ?? 'Unknown',
        fromAccountId: me.accountId ?? null,
        fromAvatar: me.avatar ?? null,
        fromElo: me.elo ?? 1000,
        text,
        createdAt: new Date(),
      };
      const ins = await db.collection('groupMessages').insertOne(doc);
      await db.collection('groupReads').updateOne({ groupId: gid, userId: myId }, { $set: { lastReadAt: new Date() } }, { upsert: true });
      notifyMentions(db, text, { fromName: me.copsName ?? 'Someone', link: '/messages', scopeLabel: g.name || 'a group', excludeDiscordId: myId, allowedDiscordIds: g.members || [] });
      return NextResponse.json({ ok: true, id: String(ins.insertedId) });
    }

    if (action === 'read') {
      await db.collection('groupReads').updateOne({ groupId: gid, userId: myId }, { $set: { lastReadAt: new Date() } }, { upsert: true });
      return NextResponse.json({ ok: true });
    }

    if (action === 'rename') {
      if (!isOwner) return NextResponse.json({ error: 'Only the owner can rename' }, { status: 403 });
      const name = (body?.name || '').toString().trim().slice(0, MAX_NAME);
      if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
      await db.collection('groups').updateOne({ _id: g._id }, { $set: { name } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'addMembers') {
      if (!isOwner) return NextResponse.json({ error: 'Only the owner can add members' }, { status: 403 });
      const accs = Array.isArray(body?.members) ? body.members.map(Number).filter((n: number) => Number.isFinite(n)) : [];
      const toAdd = await friendDiscordIds(db, myId, accs);
      if (toAdd.length === 0) return NextResponse.json({ error: 'No valid friends to add' }, { status: 400 });
      const newMembers = Array.from(new Set([...(g.members || []), ...toAdd])).slice(0, MAX_MEMBERS);
      await db.collection('groups').updateOne({ _id: g._id }, { $set: { members: newMembers } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'removeMember') {
      if (!isOwner) return NextResponse.json({ error: 'Only the owner can remove members' }, { status: 403 });
      const acc = Number(body?.member);
      const target = await db.collection('players').findOne({ accountId: acc }, { projection: { discordId: 1 } });
      if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      if (target.discordId === myId) return NextResponse.json({ error: 'Use leave instead' }, { status: 400 });
      const newMembers = (g.members || []).filter((x: string) => x !== target.discordId);
      await db.collection('groups').updateOne({ _id: g._id }, { $set: { members: newMembers } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'leave') {
      const remaining = (g.members || []).filter((x: string) => x !== myId);
      if (remaining.length === 0) {
        await db.collection('groups').deleteOne({ _id: g._id });
        await db.collection('groupMessages').deleteMany({ groupId: gid });
        await db.collection('groupReads').deleteMany({ groupId: gid });
        return NextResponse.json({ ok: true, deleted: true });
      }
      const update: any = { members: remaining };
      if (isOwner) update.ownerId = remaining[0];
      await db.collection('groups').updateOne({ _id: g._id }, { $set: update });
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete') {
      if (!isOwner) return NextResponse.json({ error: 'Only the owner can delete' }, { status: 403 });
      await db.collection('groups').deleteOne({ _id: g._id });
      await db.collection('groupMessages').deleteMany({ groupId: gid });
      await db.collection('groupReads').deleteMany({ groupId: gid });
      return NextResponse.json({ ok: true, deleted: true });
    }

    return NextResponse.json({ error: 'Bad action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
