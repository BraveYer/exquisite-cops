export const dynamic = 'force-dynamic';

import { ObjectId } from 'mongodb';
import { getDb } from '../../../../lib/mongodb';

// Robustly turn whatever MongoDB gives back (BSON Binary, Node Buffer, Uint8Array)
// into an exact-size Uint8Array so the bytes stream out cleanly.
function toBytes(raw: any): Uint8Array {
  if (!raw) return new Uint8Array(0);
  if (Buffer.isBuffer(raw)) return new Uint8Array(raw);
  if (raw instanceof Uint8Array) return new Uint8Array(raw);
  if (typeof raw.value === 'function') {
    try {
      const v = raw.value(true);
      if (v) return new Uint8Array(v);
    } catch {
      /* fall through */
    }
  }
  if (raw.buffer) return new Uint8Array(raw.buffer);
  try {
    return new Uint8Array(raw);
  } catch {
    return new Uint8Array(0);
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    let oid: ObjectId;
    try {
      oid = new ObjectId(id);
    } catch {
      return new Response('Not found', { status: 404 });
    }

    const db = await getDb();
    const doc = await db.collection('uploads').findOne({ _id: oid });
    if (!doc) return new Response('Not found', { status: 404 });

    const bytes = toBytes(doc.data);
    if (bytes.byteLength === 0) return new Response('Empty', { status: 404 });

    return new Response(bytes as any, {
      headers: {
        'Content-Type': doc.contentType || 'application/octet-stream',
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Error', { status: 500 });
  }
}
