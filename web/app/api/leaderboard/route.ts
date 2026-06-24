import { NextResponse } from 'next/server';
import clientPromise from "../../../lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("test"); 
    
    // Căutăm toți jucătorii, îi sortăm după ELO (descrescător) și luăm primii 50
    const topPlayers = await db.collection("players")
      .find({})
      .sort({ elo: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json(topPlayers);
  } catch (error) {
    return NextResponse.json({ error: "Eroare DB" }, { status: 500 });
  }
}