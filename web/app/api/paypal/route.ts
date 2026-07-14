export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';
import { getPack, getBundle } from '../../../lib/shop';

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const SECRET = process.env.PAYPAL_SECRET || '';
const ENABLED = !!(CLIENT_ID && SECRET);
const BASE = process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const CURRENCY = process.env.PAYPAL_CURRENCY || 'USD';

async function accessToken(): Promise<string | null> {
  try {
    const auth = Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64');
    const r = await fetch(`${BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.access_token || null;
  } catch {
    return null;
  }
}

export async function GET() {
  // Public config so the client can load the PayPal SDK (client id is not secret).
  return NextResponse.json({ enabled: ENABLED, clientId: ENABLED ? CLIENT_ID : null, currency: CURRENCY });
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    if (!ENABLED) return NextResponse.json({ error: 'PayPal is not configured' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const action = (body?.action || '').toString();
    const pack = getPack((body?.packId || '').toString());
    const bundle = getBundle((body?.bundleId || '').toString());
    if (!pack && !bundle) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    // Unified product fields (EP pack or cosmetic bundle).
    const prodId = pack ? pack.id : bundle!.id;
    const prodUsd = pack ? pack.usd : bundle!.usd;
    const prodDesc = pack ? `${pack.ep} EP — Exquisite Cops` : `${bundle!.name} — Exquisite Cops`;

    const token = await accessToken();
    if (!token) return NextResponse.json({ error: 'PayPal auth failed' }, { status: 502 });

    if (action === 'create') {
      const r = await fetch(`${BASE}/v2/checkout/orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              custom_id: `${myId}:${prodId}`,
              description: prodDesc,
              amount: { currency_code: CURRENCY, value: prodUsd.toFixed(2) },
            },
          ],
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.id) return NextResponse.json({ error: 'Could not create order' }, { status: 502 });
      return NextResponse.json({ id: d.id });
    }

    if (action === 'capture') {
      const orderId = (body?.orderId || '').toString();
      if (!orderId) return NextResponse.json({ error: 'Missing order' }, { status: 400 });

      const db = await getDb();
      // Idempotency: if we've already credited this order, don't double-credit.
      const existing = await db.collection('paypalOrders').findOne({ orderId });
      if (existing) return NextResponse.json({ ok: true, already: true, credited: existing.ep });

      const r = await fetch(`${BASE}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const d = await r.json();
      if (!r.ok || d.status !== 'COMPLETED') return NextResponse.json({ error: 'Payment not completed' }, { status: 402 });

      // Verify the captured amount matches the product (guard against tampering).
      const cap = d?.purchase_units?.[0]?.payments?.captures?.[0];
      const paid = cap?.amount?.value;
      const currency = cap?.amount?.currency_code;
      if (paid !== prodUsd.toFixed(2) || currency !== CURRENCY) {
        return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
      }

      // Record first (unique orderId) to prevent race double-credit.
      try {
        await db.collection('paypalOrders').insertOne({ orderId, userId: myId, packId: prodId, kind: pack ? 'pack' : 'bundle', ep: pack ? pack.ep : 0, usd: prodUsd, capturedAt: new Date() });
      } catch {
        return NextResponse.json({ ok: true, already: true });
      }

      if (pack) {
        await db.collection('economy').updateOne(
          { discordId: myId },
          { $inc: { balance: pack.ep }, $setOnInsert: { items: [], equipped: { frame: null, name: null, theme: null }, claims: {} } },
          { upsert: true }
        );
        return NextResponse.json({ ok: true, credited: pack.ep });
      }

      // Bundle: grant all its cosmetics.
      await db.collection('economy').updateOne(
        { discordId: myId },
        { $addToSet: { items: { $each: bundle!.items } }, $setOnInsert: { balance: 0, equipped: { frame: null, name: null, theme: null }, claims: {} } } as any,
        { upsert: true }
      );
      return NextResponse.json({ ok: true, granted: bundle!.items });
    }

    return NextResponse.json({ error: 'Bad action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'PayPal error' }, { status: 500 });
  }
}
