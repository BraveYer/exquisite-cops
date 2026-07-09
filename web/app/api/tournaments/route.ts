export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';
import { notify } from '../../../lib/notify';
import { announceToDiscord, siteBase } from '../../../lib/discordWebhook';

const STAFF = ['admin', 'mod'];
const MAX_NAME = 48;
const MAX_DESC = 300;
const MAX_PRIZE = 120;
const SIZES = [4, 8, 16, 32];

function oid(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

type Ref = { accountId: number | null; copsName: string; avatar: string | null; elo: number } | null;
type Match = { id: string; a: Ref; b: Ref; winner: 'a' | 'b' | null };

function nextPow2(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(2, p);
}

// Standard bracket seed order (1-based) for `n` slots so #1 and #2 meet only in the final.
function seedOrder(n: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < n) {
    const sum = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(sum - s);
    }
    seeds = next;
  }
  return seeds;
}

function buildBracket(players: Ref[]): Match[][] {
  const size = nextPow2(players.length);
  const order = seedOrder(size);
  const slots: Ref[] = order.map((seed) => players[seed - 1] || null);

  const rounds: Match[][] = [];
  // Round 0
  const r0: Match[] = [];
  for (let k = 0; k < size / 2; k++) {
    const a = slots[2 * k];
    const b = slots[2 * k + 1];
    let winner: 'a' | 'b' | null = null;
    if (a && !b) winner = 'a';
    else if (b && !a) winner = 'b';
    r0.push({ id: `r0m${k}`, a, b, winner });
  }
  rounds.push(r0);
  // Empty later rounds
  let count = size / 2;
  let r = 1;
  while (count > 1) {
    count = count / 2;
    const round: Match[] = [];
    for (let m = 0; m < count; m++) round.push({ id: `r${r}m${m}`, a: null, b: null, winner: null });
    rounds.push(round);
    r++;
  }
  propagate(rounds);
  return rounds;
}

function isEmpty(m: Match) {
  return !m.a && !m.b;
}

// Forward pass: place decided winners into next round + auto-advance byes.
function propagate(rounds: Match[][]) {
  for (let r = 0; r < rounds.length - 1; r++) {
    const cur = rounds[r];
    const next = rounds[r + 1];
    for (let m = 0; m < next.length; m++) {
      const aFeeder = cur[2 * m];
      const bFeeder = cur[2 * m + 1];
      if (aFeeder && aFeeder.winner) next[m].a = aFeeder.winner === 'a' ? aFeeder.a : aFeeder.b;
      if (bFeeder && bFeeder.winner) next[m].b = bFeeder.winner === 'a' ? bFeeder.a : bFeeder.b;
      if (next[m].winner == null) {
        const aReady = !!next[m].a;
        const bReady = !!next[m].b;
        if (aReady && !bReady && bFeeder && isEmpty(bFeeder)) next[m].winner = 'a';
        else if (bReady && !aReady && aFeeder && isEmpty(aFeeder)) next[m].winner = 'b';
      }
    }
  }
}

function championOf(rounds: Match[][]): Ref {
  const last = rounds[rounds.length - 1];
  if (last && last[0] && last[0].winner) return last[0].winner === 'a' ? last[0].a : last[0].b;
  return null;
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    const db = await getDb();
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (id) {
      const objId = oid(id);
      if (!objId) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
      const t = await db.collection('tournaments').findOne({ _id: objId });
      if (!t) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
      let myStaff: string | null = null;
      if (myId) {
        const me = await db.collection('players').findOne({ discordId: myId }, { projection: { staffLevel: 1 } });
        myStaff = me?.staffLevel || null;
      }
      const amOrganizer = !!myId && (t.organizerId === myId || (myStaff ? STAFF.includes(myStaff) : false));
      const joined = !!myId && (t.participants || []).some((p: any) => p.discordId === myId);
      return NextResponse.json({
        tournament: {
          id: String(t._id),
          name: t.name,
          description: t.description ?? '',
          prize: t.prize ?? '',
          size: t.size,
          status: t.status,
          participants: (t.participants || []).map((p: any) => ({ accountId: p.accountId ?? null, copsName: p.copsName ?? 'Unknown', avatar: p.avatar ?? null, elo: p.elo ?? 1000 })),
          bracket: t.bracket ?? null,
          champion: t.champion ?? null,
          createdAt: t.createdAt ?? null,
        },
        amOrganizer,
        joined,
      });
    }

    // Player tournament history
    const history = url.searchParams.get('history');
    if (history) {
      const accId = Number(history);
      if (!Number.isFinite(accId)) return NextResponse.json({ history: [], championships: 0, finals: 0, played: 0 });
      const mine = await db.collection('tournaments').find({ 'participants.accountId': accId }).sort({ createdAt: -1 }).limit(50).toArray();
      let championships = 0;
      let finals = 0;
      const hist = mine.map((t: any) => {
        let placement: 'champion' | 'finalist' | 'participated' | 'ongoing' = 'participated';
        if (t.status !== 'completed') {
          placement = 'ongoing';
        } else if (t.champion?.accountId === accId) {
          placement = 'champion';
          championships++;
          finals++;
        } else {
          const bracket = t.bracket || [];
          const final = bracket.length ? bracket[bracket.length - 1][0] : null;
          const inFinal = final && ((final.a && final.a.accountId === accId) || (final.b && final.b.accountId === accId));
          if (inFinal) {
            placement = 'finalist';
            finals++;
          }
        }
        return {
          id: String(t._id),
          name: t.name,
          size: t.size,
          status: t.status,
          placement,
          participantCount: (t.participants || []).length,
          createdAt: t.createdAt ?? null,
        };
      });
      return NextResponse.json({ history: hist, championships, finals, played: hist.length });
    }

    const all = await db.collection('tournaments').find({}).sort({ createdAt: -1 }).limit(60).toArray();
    const statusRank: any = { live: 0, open: 1, completed: 2 };
    const list = all
      .map((t: any) => ({
        id: String(t._id),
        name: t.name,
        prize: t.prize ?? '',
        size: t.size,
        status: t.status,
        participantCount: (t.participants || []).length,
        champion: t.champion ?? null,
        createdAt: t.createdAt ?? null,
      }))
      .sort((a: any, b: any) => (statusRank[a.status] - statusRank[b.status]) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ tournaments: list });
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
    const me = await db.collection('players').findOne({ discordId: myId }, { projection: { copsName: 1, accountId: 1, avatar: 1, elo: 1, staffLevel: 1 } });
    if (!me) return NextResponse.json({ error: 'Not linked' }, { status: 403 });
    const isStaff = STAFF.includes(me.staffLevel);
    const body = await req.json().catch(() => ({}));
    const action = (body?.action || '').toString();

    if (action === 'create') {
      if (!isStaff) return NextResponse.json({ error: 'Only staff can create tournaments' }, { status: 403 });
      const name = (body?.name || '').toString().trim().slice(0, MAX_NAME);
      const description = (body?.description || '').toString().trim().slice(0, MAX_DESC);
      const prize = (body?.prize || '').toString().trim().slice(0, MAX_PRIZE);
      const size = SIZES.includes(Number(body?.size)) ? Number(body?.size) : 8;
      if (name.length < 2) return NextResponse.json({ error: 'Name too short' }, { status: 400 });
      const doc = { name, description, prize, size, status: 'open', organizerId: myId, participants: [], bracket: null, champion: null, createdAt: new Date() };
      const r = await db.collection('tournaments').insertOne(doc);
      const base = siteBase();
      announceToDiscord({
        embeds: [
          {
            title: `🏆 New Tournament: ${name}`,
            description: [description, prize ? `**Prize:** ${prize}` : '', `**Size:** ${size} players · registration open`].filter(Boolean).join('\n'),
            color: 0x22d3ee,
            ...(base ? { url: `${base}/tournaments/${r.insertedId}` } : {}),
          },
        ],
      });
      return NextResponse.json({ ok: true, id: String(r.insertedId) });
    }

    const objId = oid((body?.id || '').toString());
    if (!objId) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    const t = await db.collection('tournaments').findOne({ _id: objId });
    if (!t) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    const tid = String(t._id);
    const canManage = t.organizerId === myId || isStaff;

    if (action === 'join') {
      if (t.status !== 'open') return NextResponse.json({ error: 'Registration is closed' }, { status: 400 });
      if ((t.participants || []).some((p: any) => p.discordId === myId)) return NextResponse.json({ error: 'Already registered' }, { status: 400 });
      if ((t.participants || []).length >= t.size) return NextResponse.json({ error: 'Tournament is full' }, { status: 400 });
      await db.collection('tournaments').updateOne(
        { _id: objId, status: 'open' },
        { $push: { participants: { discordId: myId, accountId: me.accountId ?? null, copsName: me.copsName ?? 'Unknown', avatar: me.avatar ?? null, elo: me.elo ?? 1000 } } } as any
      );
      return NextResponse.json({ ok: true });
    }

    if (action === 'leave') {
      if (t.status !== 'open') return NextResponse.json({ error: 'Registration is closed' }, { status: 400 });
      await db.collection('tournaments').updateOne({ _id: objId }, { $pull: { participants: { discordId: myId } } } as any);
      return NextResponse.json({ ok: true });
    }

    if (action === 'start') {
      if (!canManage) return NextResponse.json({ error: 'Only the organizer can start' }, { status: 403 });
      if (t.status !== 'open') return NextResponse.json({ error: 'Already started' }, { status: 400 });
      const parts = [...(t.participants || [])].sort((a: any, b: any) => (b.elo || 0) - (a.elo || 0)).slice(0, t.size);
      if (parts.length < 2) return NextResponse.json({ error: 'Need at least 2 players' }, { status: 400 });
      const refs: Ref[] = parts.map((p: any) => ({ accountId: p.accountId ?? null, copsName: p.copsName ?? 'Unknown', avatar: p.avatar ?? null, elo: p.elo ?? 1000 }));
      const bracket = buildBracket(refs);
      const champ = championOf(bracket);
      const status = champ ? 'completed' : 'live';
      await db.collection('tournaments').updateOne({ _id: objId }, { $set: { bracket, status, champion: champ, startedAt: new Date(), ...(champ ? { completedAt: new Date() } : {}) } });
      // Notify participants (best-effort)
      for (const p of parts) {
        if (p.discordId && p.discordId !== myId) {
          notify(db, p.discordId, { type: 'tournament_start', title: 'Tournament started', body: `${t.name} has begun — good luck!`, link: `/tournaments/${tid}` });
        }
      }
      const baseS = siteBase();
      announceToDiscord({ content: `⚔️ **${t.name}** has started — ${parts.length} players in the bracket!${baseS ? ` ${baseS}/tournaments/${tid}` : ''}` });
      return NextResponse.json({ ok: true });
    }

    if (action === 'report') {
      if (!canManage) return NextResponse.json({ error: 'Only the organizer can report results' }, { status: 403 });
      if (t.status !== 'live') return NextResponse.json({ error: 'Tournament is not live' }, { status: 400 });
      const matchId = (body?.matchId || '').toString();
      const side = (body?.winner || '').toString();
      if (side !== 'a' && side !== 'b') return NextResponse.json({ error: 'Invalid winner' }, { status: 400 });
      const bracket: Match[][] = t.bracket || [];
      let found: Match | null = null;
      for (const round of bracket) {
        for (const m of round) if (m.id === matchId) found = m;
      }
      if (!found) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
      if (!found.a || !found.b) return NextResponse.json({ error: 'Match is not ready' }, { status: 400 });
      if (found.winner) return NextResponse.json({ error: 'Result already reported' }, { status: 400 });
      found.winner = side;
      propagate(bracket);
      const champ = championOf(bracket);
      const status = champ ? 'completed' : 'live';
      await db.collection('tournaments').updateOne({ _id: objId }, { $set: { bracket, status, champion: champ, ...(champ ? { completedAt: new Date() } : {}) } });
      if (champ) {
        const baseR = siteBase();
        announceToDiscord({
          embeds: [
            {
              title: `👑 ${champ.copsName} wins ${t.name}!`,
              description: t.prize ? `Prize: **${t.prize}**` : 'Congratulations to the champion! 🎉',
              color: 0xf59e0b,
              ...(baseR ? { url: `${baseR}/tournaments/${tid}` } : {}),
            },
          ],
        });
      }
      return NextResponse.json({ ok: true, champion: champ });
    }

    if (action === 'delete') {
      if (!canManage) return NextResponse.json({ error: 'Only the organizer can delete' }, { status: 403 });
      await db.collection('tournaments').deleteOne({ _id: objId });
      return NextResponse.json({ ok: true, deleted: true });
    }

    return NextResponse.json({ error: 'Bad action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
