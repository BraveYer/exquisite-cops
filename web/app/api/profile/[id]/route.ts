export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/mongodb';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const accountId = Number(id);
    if (!Number.isFinite(accountId)) {
      return NextResponse.json({ error: 'Invalid profile id' }, { status: 400 });
    }

    const db = await getDb();
    const player = await db.collection('players').findOne({ accountId });
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    const wins = player.wins ?? 0;
    const losses = player.losses ?? 0;
    const games = wins + losses;
    const winRate = games > 0 ? Math.round((wins / games) * 100) : 0;

    // discordId is used only to look up matches — it is NEVER returned to the client.
    const discordId = player.discordId;
    const rawMatches = await db
      .collection('matches')
      .find({
        status: 'completed',
        $or: [{ 'teamA.discordId': discordId }, { 'teamB.discordId': discordId }],
      })
      .sort({ completedAt: -1 })
      .limit(1000)
      .toArray();

    // Per-match result, newest first.
    const results = rawMatches.map((m: any) => {
      const onA = (m.teamA || []).some((p: any) => p.discordId === discordId);
      return { won: m.winner === (onA ? 'A' : 'B'), map: m.map || 'Unknown' };
    });

    // Aggregate K/D/A across matches that have staff-entered stats.
    let totalK = 0;
    let totalD = 0;
    let totalA = 0;
    let statMatches = 0;
    for (const m of rawMatches) {
      const st = m.playerStats?.[discordId];
      if (st) {
        totalK += st.k || 0;
        totalD += st.d || 0;
        totalA += st.a || 0;
        statMatches++;
      }
    }
    const kd = statMatches > 0
      ? {
          kills: totalK,
          deaths: totalD,
          assists: totalA,
          matches: statMatches,
          ratio: totalD > 0 ? Number((totalK / totalD).toFixed(2)) : totalK,
          avgKills: Number((totalK / statMatches).toFixed(1)),
        }
      : null;

    // Last 20 for the history list.
    const history = rawMatches.slice(0, 20).map((m: any) => {
      const onA = (m.teamA || []).some((p: any) => p.discordId === discordId);
      const won = m.winner === (onA ? 'A' : 'B');
      const change = (m.result?.changes || []).find((c: any) => c.discordId === discordId);
      return {
        matchId: m.matchId,
        map: m.map,
        completedAt: m.completedAt,
        result: won ? 'win' : 'loss',
        eloDelta: change ? change.delta : 0,
      };
    });

    // Reconstruct an ELO trend (last ~40 matches) by walking back from current ELO.
    const recent = rawMatches.slice(0, 40);
    const deltas = recent
      .map((m: any) => {
        const change = (m.result?.changes || []).find((c: any) => c.discordId === discordId);
        return change ? change.delta || 0 : 0;
      })
      .reverse(); // oldest first
    const currentElo = player.elo ?? 1000;
    let walk = currentElo;
    const eloAfter: number[] = new Array(deltas.length);
    for (let i = deltas.length - 1; i >= 0; i--) {
      eloAfter[i] = walk;
      walk = walk - deltas[i];
    }
    const eloSeries = deltas.length > 0 ? [walk, ...eloAfter] : [currentElo];

    // Current streak (from the most recent match).
    let currentStreak = 0;
    let currentStreakType: 'W' | 'L' | null = null;
    if (results.length) {
      currentStreakType = results[0].won ? 'W' : 'L';
      for (const r of results) {
        if ((r.won ? 'W' : 'L') === currentStreakType) currentStreak++;
        else break;
      }
    }

    // Longest win streak ever.
    let longestWinStreak = 0;
    let run = 0;
    for (const r of results) {
      if (r.won) { run++; longestWinStreak = Math.max(longestWinStreak, run); }
      else run = 0;
    }

    // Per-map stats -> best win rate + most played.
    const mapStats: Record<string, { wins: number; games: number }> = {};
    for (const r of results) {
      const ms = mapStats[r.map] || { wins: 0, games: 0 };
      ms.games++;
      if (r.won) ms.wins++;
      mapStats[r.map] = ms;
    }
    let bestMap: { map: string; winRate: number; games: number } | null = null;
    let mostPlayedMap: { map: string; games: number } | null = null;
    for (const [map, ms] of Object.entries(mapStats)) {
      const wr = ms.games > 0 ? Math.round((ms.wins / ms.games) * 100) : 0;
      if (!bestMap || wr > bestMap.winRate || (wr === bestMap.winRate && ms.games > bestMap.games)) {
        bestMap = { map, winRate: wr, games: ms.games };
      }
      if (!mostPlayedMap || ms.games > mostPlayedMap.games) {
        mostPlayedMap = { map, games: ms.games };
      }
    }

    const stats = {
      totalMatches: results.length,
      currentStreak,
      currentStreakType,
      longestWinStreak,
      bestMap,
      mostPlayedMap,
    };

    // Season medals: top-3 finishes in ended seasons (from season snapshots).
    const medalSeasons = await db
      .collection('seasons')
      .find(
        { status: 'ended', finalStandings: { $elemMatch: { accountId, rank: { $lte: 3 } } } },
        { projection: { _id: 0, number: 1, name: 1, finalStandings: 1 } }
      )
      .sort({ number: -1 })
      .toArray();
    const seasonMedals = medalSeasons
      .map((s: any) => {
        const entry = (s.finalStandings || []).find((e: any) => e.accountId === accountId);
        return entry ? { season: s.number, name: s.name, rank: entry.rank } : null;
      })
      .filter(Boolean);

    // Achievements — unlocked from the player's record.
    const totalMatches = results.length;
    const achievements = [
      { id: 'first_match', label: 'First Blood', desc: 'Play your first match', unlocked: totalMatches >= 1 },
      { id: 'wins_10', label: 'Contender', desc: 'Win 10 matches', unlocked: wins >= 10 },
      { id: 'wins_25', label: 'Veteran', desc: 'Win 25 matches', unlocked: wins >= 25 },
      { id: 'wins_50', label: 'Elite', desc: 'Win 50 matches', unlocked: wins >= 50 },
      { id: 'streak_5', label: 'On Fire', desc: 'Win 5 in a row', unlocked: longestWinStreak >= 5 },
      { id: 'streak_10', label: 'Unstoppable', desc: 'Win 10 in a row', unlocked: longestWinStreak >= 10 },
      { id: 'flawless', label: 'Flawless', desc: '100% win rate (10+ games)', unlocked: games >= 10 && winRate === 100 },
      { id: 'medalist', label: 'Medalist', desc: 'Finish top 3 in a season', unlocked: (seasonMedals?.length || 0) > 0 },
    ];

    return NextResponse.json({
      copsName: player.copsName ?? null,
      avatar: player.avatar ?? null,
      socials: player.socials ?? {},
      level: player.level ?? 0,
      verified: !!player.verified,
      supporter: !!player.supporterUntil && new Date(player.supporterUntil).getTime() > Date.now(),
      kd,
      elo: player.elo ?? 1000,
      wins,
      losses,
      gamesPlayed: player.gamesPlayed ?? games,
      winRate,
      history,
      stats,
      seasonMedals,
      achievements,
      eloSeries,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
