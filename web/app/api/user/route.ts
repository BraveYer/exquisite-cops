import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import clientPromise from "../../../lib/mongodb";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session || !session.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const client = await clientPromise;
    const db = client.db("test");
    
    // Căutăm jucătorul în colecția 'players'
    const player = await db.collection("players").findOne({ discordId: session.user.name });

    if (!player) return NextResponse.json({ elo: 1000, wins: 0, losses: 0 });
    
    return NextResponse.json({ elo: player.elo, wins: player.wins, losses: player.losses });
  } catch (error) {
    return NextResponse.json({ error: "DB Error" }, { status: 500 });
  }
}