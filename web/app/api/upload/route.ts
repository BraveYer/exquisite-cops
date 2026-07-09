export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../lib/mongodb';
import { authOptions } from '../../../lib/auth';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const OK_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const myId = (session?.user as any)?.discordId as string | undefined;
    if (!myId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file' }, { status: 400 });
    if (!OK_TYPES.includes(file.type)) return NextResponse.json({ error: 'Only PNG, JPG, GIF or WebP images' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image is too large (max 5MB)' }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const db = await getDb();
    const r = await db.collection('uploads').insertOne({
      contentType: file.type,
      data: buf,
      size: file.size,
      uploaderId: myId,
      createdAt: new Date(),
    });

    return NextResponse.json({ url: `/api/uploads/${r.insertedId.toString()}` });
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
