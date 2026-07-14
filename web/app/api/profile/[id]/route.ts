export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getDb } from '../../../../lib/mongodb';
import { authOptions } from '../../../../lib/auth';

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
    const session = await getServerSession(authOptions);
    const viewerId = (session?.user as any)?.discordId as string | undefined;
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

    // Honor: commends received from other players.
    const commendDocs = await db.collection('commends').find({ toId: discordId }).toArray();
    const honorByType: Record<string, number> = {};
    for (const c of commendDocs as any[]) {
      if (c.type) honorByType[c.type] = (honorByType[c.type] || 0) + 1;
    }
    const honor = { total: commendDocs.length, byType: honorByType };

    // Head-to-head: the viewer's record against this player (opposite teams).
    let h2h: { wins: number; losses: number; games: number } | null = null;
    if (viewerId && viewerId !== discordId) {
      let vWins = 0;
      let vLosses = 0;
      let games = 0;
      for (const m of rawMatches) {
        const profileOnA = (m.teamA || []).some((p: any) => p.discordId === discordId);
        const profileTeam = profileOnA ? 'A' : 'B';
        const viewerOnA = (m.teamA || []).some((p: any) => p.discordId === viewerId);
        const viewerOnB = (m.teamB || []).some((p: any) => p.discordId === viewerId);
        const viewerTeam = viewerOnA ? 'A' : viewerOnB ? 'B' : null;
        if (viewerTeam && viewerTeam !== profileTeam) {
          games++;
          if (m.winner === viewerTeam) vWins++;
          else vLosses++;
        }
      }
      if (games > 0) h2h = { wins: vWins, losses: vLosses, games };
    }

    // Pinned highlight match.
    let highlight: { matchId: string; map: string; result: 'win' | 'loss'; date: string | null } | null = null;
    if (player.highlightMatchId) {
      const hm = await db.collection('matches').findOne(
        { matchId: player.highlightMatchId, status: 'completed' },
        { projection: { matchId: 1, map: 1, winner: 1, completedAt: 1, teamA: 1, teamB: 1 } }
      );
      if (hm) {
        const onA = (hm.teamA || []).some((p: any) => p.discordId === discordId);
        highlight = {
          matchId: hm.matchId,
          map: hm.map || 'Unknown',
          result: hm.winner === (onA ? 'A' : 'B') ? 'win' : 'loss',
          date: hm.completedAt ?? null,
        };
      }
    }

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

    // Highest ELO ever reached (from all recorded matches + current).
    let peakElo = currentElo;
    for (const m of rawMatches) {
      const change = (m.result?.changes || []).find((c: any) => c.discordId === discordId);
      if (change) {
        if (typeof change.newElo === 'number') peakElo = Math.max(peakElo, change.newElo);
        if (typeof change.oldElo === 'number') peakElo = Math.max(peakElo, change.oldElo);
      }
    }

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
    let worstMap: { map: string; winRate: number; games: number } | null = null;
    let mostPlayedMap: { map: string; games: number } | null = null;
    const mapBreakdown: { map: string; winRate: number; wins: number; games: number }[] = [];
    for (const [map, ms] of Object.entries(mapStats)) {
      const wr = ms.games > 0 ? Math.round((ms.wins / ms.games) * 100) : 0;
      mapBreakdown.push({ map, winRate: wr, wins: ms.wins, games: ms.games });
      if (!bestMap || wr > bestMap.winRate || (wr === bestMap.winRate && ms.games > bestMap.games)) {
        bestMap = { map, winRate: wr, games: ms.games };
      }
      // Worst map needs a few games to be meaningful.
      if (ms.games >= 3 && (!worstMap || wr < worstMap.winRate || (wr === worstMap.winRate && ms.games > worstMap.games))) {
        worstMap = { map, winRate: wr, games: ms.games };
      }
      if (!mostPlayedMap || ms.games > mostPlayedMap.games) {
        mostPlayedMap = { map, games: ms.games };
      }
    }
    mapBreakdown.sort((a, b) => b.games - a.games);
    // If only one map qualifies, best and worst would be identical — drop worst.
    if (worstMap && bestMap && worstMap.map === bestMap.map) worstMap = null;

    const stats = {
      totalMatches: results.length,
      currentStreak,
      currentStreakType,
      longestWinStreak,
      bestMap,
      worstMap,
      mostPlayedMap,
      mapBreakdown,
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
      honor,
      h2h,
      highlight,
      elo: player.elo ?? 1000,
      peakElo,
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
