export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';

export async function GET() {
  try {
    const db = await getDb();
    const active = await db.collection('seasons').findOne({ status: 'active' }, { projection: { _id: 0 } });
    const past = await db
      .collection('seasons')
      .find({ status: 'ended' }, { projection: { _id: 0 } })
      .sort({ number: -1 })
      .limit(10)
      .toArray();
    return NextResponse.json({ active: active ?? null, past });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
