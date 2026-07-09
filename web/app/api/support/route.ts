export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const SYSTEM = `You are "COPS Assistant", the friendly in-app support assistant for Exquisite COPS — a competitive Critical Ops matchmaking hub (like FACEIT, for the mobile game Critical Ops).

Help players with questions about how the hub works. Be concise, warm, and practical. Use short paragraphs. If you don't know something specific to this server (exact prize amounts, a person's ban status, a particular dispute), say so and point them to the staff team on the Discord server.

How the hub works:
- Players link their Discord account to take part. Their in-game name and rank show on their profile.
- Matchmaking: click "Start Searching Match" on the Hub to join the queue. When enough players are found, a match is created automatically.
- Captain draft: the two highest-rated players become captains and pick their teammates one by one. A coin flip decides who picks first. This happens on the match page on the website.
- Map veto: after the draft, the two captains ban maps one at a time from the pool (Raid, Plaza, Grounded, Soar, Port, Legacy, Village, Bureau, Canals, Castello) until one map is left — that's the map they play. A coin flip decides who bans first.
- Playing: a Discord channel is created with the in-game custom room name and password. The host creates the room; everyone joins. After the match, players post a screenshot and report the winner, and an admin confirms the result.
- ELO and ranks: winning raises your ELO, losing lowers it. Higher ELO means a higher rank. Profiles show stats, recent form, achievements, and a rating-history graph.
- Reporting players: on any match page, participants can use "Report a player" to flag cheating, toxic behaviour, AFK/leaving, or smurfing. Staff review these reports in the admin panel.
- Seasons: the hub runs competitive seasons with a leaderboard and rewards. At the end of a season the standings are saved and everyone's ELO is soft-reset for the next one.
- Notifications: when a match is ready, players get a Discord DM and an in-site banner with a link to the match.

For anything you cannot resolve (bans, match disputes, refunds, account problems, prize claims), tell the player to contact staff or admins on the Discord server. Never invent specific facts such as exact prize money, rules not listed above, or someone's account status. Keep replies short — a few sentences at most.`;

export async function POST(req: Request) {
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return NextResponse.json({
        reply: "Live support isn't set up yet. In the meantime, please ask the staff team on our Discord server.",
      });
    }

    const body = await req.json().catch(() => ({}));
    const raw = Array.isArray(body?.messages) ? body.messages : [];
    const messages = raw
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-16)
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, 1000) }));

    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return NextResponse.json({ error: 'No message' }, { status: 400 });
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.SUPPORT_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: SYSTEM,
        messages,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({
        reply: "I'm having trouble reaching support right now. Please try again, or ask staff on Discord.",
      });
    }

    const data = await res.json();
    const reply =
      (data?.content || [])
        .filter((b: any) => b?.type === 'text')
        .map((b: any) => b.text)
        .join('\n')
        .trim() || "Sorry, I didn't catch that — could you rephrase?";

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({
      reply: "Something went wrong on my side. Please try again, or reach out to staff on Discord.",
    });
  }
}
