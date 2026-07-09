export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';

export async function GET() {
  const started = Date.now();
  try {
    const db = await getDb();
    const players = await db.collection('players').countDocuments();
    return NextResponse.json({
      ok: true,
      database: db.databaseName,
      players,
      ms: Date.now() - started,
      hasUri: !!process.env.MONGODB_URI,
      dbEnv: process.env.MONGODB_DB || '(default: test)',
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        ms: Date.now() - started,
        errorName: e?.name || null,
        errorMessage: String(e?.message || e),
        stack: String(e?.stack || '').split('\n').slice(0, 6).join(' | '),
        hasUri: !!process.env.MONGODB_URI,
        dbEnv: process.env.MONGODB_DB || '(default: test)',
      },
      { status: 500 }
    );
  }
}
