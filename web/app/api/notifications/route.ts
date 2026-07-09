export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.discordId as string | undefined;
    if (!userId) return NextResponse.json({ items: [], unread: 0 });

    const db = await getDb();

    // Stored notifications (transient events, e.g. "X accepted your request").
    const docs = await db
      .collection('notifications')
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray();
    const stored = docs.map((d: any) => ({
      id: d._id.toString(),
      type: d.type,
      title: d.title,
      body: d.body || '',
      link: d.link || null,
      read: !!d.read,
      createdAt: d.createdAt,
    }));

    // Derived from live state so pending requests/invites always show (even if seeded).
    const reqs = await db.collection('friendships').find({ b: userId, status: 'pending' }).toArray();
    const invParties = await db.collection('parties').find({ 'invited.discordId': userId }).toArray();

    const requesterIds = reqs.map((r: any) => r.a);
    const players = requesterIds.length
      ? await db.collection('players').find({ discordId: { $in: requesterIds } }).project({ discordId: 1, copsName: 1 }).toArray()
      : [];
    const nameById = new Map<any, any>(players.map((p: any) => [p.discordId, p.copsName || 'Someone']));

    const derived: any[] = [];
    for (const r of reqs) {
      derived.push({
        id: `friendreq:${r.a}`,
        type: 'friend_request',
        title: 'Friend request',
        body: `${nameById.get(r.a) || 'Someone'} wants to be friends`,
        link: '/friends',
        read: false,
        createdAt: r.createdAt || new Date(),
      });
    }
    for (const p of invParties) {
      const leader = (p.members || []).find((m: any) => m.discordId === p.leaderId);
      derived.push({
        id: `invite:${p.partyId}`,
        type: 'party_invite',
        title: 'Party invite',
        body: `${leader?.copsName || 'Someone'} invited you to their party`,
        link: '/',
        read: false,
        createdAt: p.createdAt || new Date(),
      });
    }

    // Club join requests (for clubs where I'm leader/officer)
    const staffMemberships = await db.collection('clanMembers').find({ discordId: userId, role: { $in: ['leader', 'officer'] } }).toArray();
    const staffClanIds = staffMemberships.map((m: any) => m.clanId);
    if (staffClanIds.length) {
      const apps = await db.collection('clanApplications').find({ clanId: { $in: staffClanIds } }).toArray();
      if (apps.length) {
        const objIds = staffClanIds
          .map((c: string) => {
            try {
              return new ObjectId(c);
            } catch {
              return null;
            }
          })
          .filter((x): x is ObjectId => x !== null);
        const clubs = await db.collection('clans').find({ _id: { $in: objIds } }).project({ tag: 1 }).toArray();
        const tagById = new Map<any, any>(clubs.map((c: any) => [String(c._id), c.tag]));
        for (const a of apps) {
          derived.push({
            id: `clubreq:${a.clanId}:${a.discordId}`,
            type: 'club_request',
            title: 'Club request',
            body: `${a.copsName || 'Someone'} requested to join [${tagById.get(a.clanId) || 'club'}]`,
            link: `/clans/${a.clanId}`,
            read: false,
            createdAt: a.createdAt || new Date(),
          });
        }
      }
    }

    // Club invites (for me as invitee)
    const myInvites = await db.collection('clanInvites').find({ discordId: userId }).toArray();
    if (myInvites.length) {
      const objIds = myInvites
        .map((i: any) => {
          try {
            return new ObjectId(i.clanId);
          } catch {
            return null;
          }
        })
        .filter((x): x is ObjectId => x !== null);
      const clubs = await db.collection('clans').find({ _id: { $in: objIds } }).project({ tag: 1, name: 1 }).toArray();
      const byId = new Map<any, any>(clubs.map((c: any) => [String(c._id), c]));
      for (const inv of myInvites) {
        const c = byId.get(inv.clanId);
        if (!c) continue;
        derived.push({
          id: `clubinv:${inv.clanId}`,
          type: 'club_invite',
          title: 'Club invite',
          body: `You've been invited to [${c.tag}] ${c.name}`,
          link: `/clans/${inv.clanId}`,
          read: false,
          createdAt: inv.createdAt || new Date(),
        });
      }
    }

    const items = [...derived, ...stored]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 40);
    const unread = derived.length + stored.filter((s: any) => !s.read).length;

    return NextResponse.json({ items, unread });
  } catch {
    return NextResponse.json({ items: [], unread: 0 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.discordId as string | undefined;
    if (!userId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = (body?.action || '').toString();
    const db = await getDb();

    if (action === 'readAll') {
      await db.collection('notifications').updateMany({ userId, read: false }, { $set: { read: true } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'read') {
      const id = (body?.id || '').toString();
      let oid: ObjectId;
      try {
        oid = new ObjectId(id);
      } catch {
        return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
      }
      await db.collection('notifications').updateOne({ _id: oid, userId }, { $set: { read: true } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'clear') {
      await db.collection('notifications').deleteMany({ userId });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Bad action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
