export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import clientPromise from "../../../../lib/mongodb";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const client = await clientPromise;
    // Forțăm citirea din baza 'test'
    const db = client.db("test"); 
    
    const match = await db.collection("matches").findOne({ matchId: params.id });
    
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    
    return NextResponse.json(match);
  } catch (e) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}