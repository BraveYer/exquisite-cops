export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import clientPromise from "../../../../lib/mongodb";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session || !session.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const client = await clientPromise;
    const db = client.db("test");

    // Căutăm cel mai recent meci în care te afli tu
    const match = await db.collection("matches").findOne(
      { 
        $or: [
          { "teamA.name": session.user.name },
          { "teamB.name": session.user.name }
        ]
      },
      { sort: { createdAt: -1 } } // Îl ia pe ultimul generat!
    );

    if (match) {
      return NextResponse.json({ matchId: match.matchId });
    } else {
      return NextResponse.json({ matchId: null });
    }
  } catch (e) {
    return NextResponse.json({ error: "DB Error" }, { status: 500 });
  }
}