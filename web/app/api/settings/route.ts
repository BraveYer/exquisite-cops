export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';
import { SOCIALS, normalizeUrl } from '../../../lib/socials';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const db = await getDb();
    const player = await db.collection('players').findOne({ discordId });
    if (!player) return NextResponse.json({ error: 'Not linked' }, { status: 404 });

    return NextResponse.json({ socials: player.socials ?? {} });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const discordId = (session?.user as any)?.discordId as string | undefined;
    if (!discordId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const incoming = (body?.socials ?? {}) as Record<string, string>;

    // Only accept known platforms; normalize and drop empties.
    const clean: Record<string, string> = {};
    for (const { key } of SOCIALS) {
      const url = normalizeUrl(incoming[key] ?? '');
      if (url) clean[key] = url;
    }

    const db = await getDb();
    const res = await db.collection('players').updateOne({ discordId }, { $set: { socials: clean } });
    if (res.matchedCount === 0) return NextResponse.json({ error: 'Not linked' }, { status: 404 });

    return NextResponse.json({ ok: true, socials: clean });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
