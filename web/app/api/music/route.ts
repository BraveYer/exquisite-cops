export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const EXTS = ['.mp3', '.ogg', '.wav', '.m4a'];

export async function GET() {
  try {
    const dir = path.join(process.cwd(), 'public', 'music');
    let files: string[] = [];
    try {
      files = fs.readdirSync(dir);
    } catch {
      files = [];
    }

    const tracks = files
      .filter(f => EXTS.includes(path.extname(f).toLowerCase()))
      .sort()
      .map(f => ({
        src: `/music/${encodeURIComponent(f)}`,
        title: f.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || f,
      }));

    return NextResponse.json({ tracks });
  } catch (error) {
    return NextResponse.json({ tracks: [] });
  }
}
