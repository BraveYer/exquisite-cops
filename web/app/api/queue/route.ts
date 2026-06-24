import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import clientPromise from "../../../lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("test"); 
    const queuePlayers = await db.collection("queue").find({}).toArray();
    
    return NextResponse.json({ count: queuePlayers.length, players: queuePlayers });
  } catch (error) {
    return NextResponse.json({ error: "Eroare DB" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const client = await clientPromise;
    const db = client.db("test");
    const { action } = await req.json();

    if (action === "join") {
      await db.collection("queue").updateOne(
        { discordId: session.user.name },
        { $set: { discordId: session.user.name, joinedAt: new Date() } },
        { upsert: true }
      );
    } else if (action === "leave") {
      await db.collection("queue").deleteOne({ discordId: session.user.name });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Eroare DB" }, { status: 500 });
  }
} 