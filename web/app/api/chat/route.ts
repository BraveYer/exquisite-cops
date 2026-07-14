export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { censor } from '../../../lib/contentFilter';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';
import { notifyMentions } from '../../../lib/mentions';
import { activeSanction, sanctionMessage } from '../../../lib/sanctions';

const STAFF = ['admin', 'mod'];
const MAX_LEN = 500;
const LIMIT = 50;

type Resolved =
  | { ok: false; error: string; status: number }
  | { ok: true; db: any; player: any; discordId: string };

async function resolve(scope: string): Promise<Resolved> {
  const session = await getServerSession(authOptions);
  const discordId = (session?.user as any)?.discordId as string | undefined;
  if (!discordId) return { ok: false, error: 'Not logged in', status: 401 };

  const db = await getDb();
  const player = await db.collection('players').findOne({ discordId });
  if (!player) return { ok: false, error: 'Not linked', status: 403 };

  // Match-scoped chat: only the two players in that match, or staff.
  if (scope !== 'lobby') {
    const match = await db.collection('matches').findOne({ matchId: scope });
    if (!match) return { ok: false, error: 'Match not found', status: 404 };
    const inMatch = [...(match.teamA || []), ...(match.teamB || []), ...(match.pool || [])].some((p: any) => p.discordId === discordId);
    const isStaff = STAFF.includes(player.staffLevel);
    if (!inMatch && !isStaff) return { ok: false, error: 'Forbidden', status: 403 };
  }

  return { ok: true, db, player, discordId };
}

export async function GET(req: Request) {
  try {
    const scope = (new URL(req.url).searchParams.get('scope') || '').trim();
    if (!scope) return NextResponse.json({ error: 'Missing scope' }, { status: 400 });

    const r = await resolve(scope);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

    const raw = await r.db.collection('messages').find({ scope }).sort({ createdAt: -1 }).limit(LIMIT).toArray();
    const messages = raw.reverse().map((m: any) => ({
      id: String(m._id),
      authorName: m.authorName ?? 'Unknown',
      authorAccountId: m.authorAccountId ?? null,
      authorAvatar: m.authorAvatar ?? null,
      authorElo: m.authorElo ?? 1000,
      text: m.text ?? '',
      createdAt: m.createdAt ?? null,
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const scope = (body?.scope || '').toString().trim();
    const text = censor((body?.text || '').toString().trim().slice(0, MAX_LEN));
    if (!scope) return NextResponse.json({ error: 'Missing scope' }, { status: 400 });
    if (!text) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

    const r = await resolve(scope);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

    const silence = await activeSanction(r.db, r.discordId, ['mute', 'ban']);
    if (silence) return NextResponse.json({ error: sanctionMessage(silence) }, { status: 403 });

    const doc = {
      scope,
      authorName: r.player.copsName ?? 'Unknown',
      authorAccountId: r.player.accountId ?? null,
      authorAvatar: r.player.avatar ?? null,
      authorElo: r.player.elo ?? 1000,
      text,
      createdAt: new Date(),
    };

    const ins = await r.db.collection('messages').insertOne(doc);

    if (scope === 'lobby') {
      notifyMentions(r.db, text, { fromName: r.player.copsName ?? 'Someone', link: '/', scopeLabel: 'lobby chat', excludeDiscordId: r.discordId });
    }

    return NextResponse.json({
      message: { id: String(ins.insertedId), ...doc, createdAt: doc.createdAt.toISOString() },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
