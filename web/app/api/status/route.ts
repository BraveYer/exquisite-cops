export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';

const BOT_STALE_MS = 90000; // bot is "online" if it wrote a heartbeat in the last 90s

export async function GET() {
  const now = Date.now();
  let dbOk = false;
  let bot: { online: boolean; lastSeen: string | null; guilds: number | null; uptimeSec: number | null } = {
    online: false,
    lastSeen: null,
    guilds: null,
    uptimeSec: null,
  };

  try {
    const db = await getDb();
    // DB connectivity probe.
    await db.command({ ping: 1 });
    dbOk = true;

    const bs = await db.collection('botStatus').findOne({ _id: 'bot' as any });
    if (bs?.lastHeartbeat) {
      const ls = new Date(bs.lastHeartbeat).getTime();
      const startedMs = bs.startedAt ? new Date(bs.startedAt).getTime() : null;
      bot = {
        online: now - ls < BOT_STALE_MS,
        lastSeen: new Date(bs.lastHeartbeat).toISOString(),
        guilds: typeof bs.guilds === 'number' ? bs.guilds : null,
        uptimeSec: startedMs ? Math.max(0, Math.floor((now - startedMs) / 1000)) : null,
      };
    }
  } catch {
    /* dbOk stays false */
  }

  const components = {
    website: 'operational' as const,
    database: dbOk ? ('operational' as const) : ('down' as const),
    bot: bot.online ? ('operational' as const) : bot.lastSeen ? ('down' as const) : ('unknown' as const),
  };

  const allOk = components.database === 'operational' && components.bot === 'operational';
  const anyDown = components.database === 'down' || components.bot === 'down';

  return NextResponse.json({
    status: allOk ? 'operational' : anyDown ? 'degraded' : 'partial',
    components,
    bot,
    checkedAt: new Date().toISOString(),
  });
}
