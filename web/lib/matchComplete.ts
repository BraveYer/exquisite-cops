import { Db } from 'mongodb';
import { applyMatchResult, EloPlayer } from './elo';

// EP awarded on match completion.
const WIN_EP = 100;
const LOSS_EP = 20;

// Completes a match and applies ELO ONCE. Safe against double-apply via an atomic flag flip.
export async function completeMatch(db: Db, matchId: string, winner: 'A' | 'B') {
  // Atomically claim the ELO application.
  const claim = await db.collection('matches').updateOne(
    { matchId, eloApplied: { $ne: true }, status: { $nin: ['cancelled', 'completed'] } },
    { $set: { eloApplied: true } }
  );

  if (claim.modifiedCount !== 1) {
    // Already applied / not eligible — return current state.
    return db.collection('matches').findOne({ matchId }, { projection: { _id: 0 } });
  }

  const match: any = await db.collection('matches').findOne({ matchId });
  if (!match) return null;

  const teamAIds: string[] = (match.teamA || []).map((p: any) => p.discordId);
  const teamBIds: string[] = (match.teamB || []).map((p: any) => p.discordId);
  const allIds = [...teamAIds, ...teamBIds];

  const players = await db.collection('players').find({ discordId: { $in: allIds } }).toArray();
  const byId = new Map<string, any>(players.map((p: any) => [p.discordId, p]));

  const toEloPlayers = (ids: string[]): EloPlayer[] =>
    ids.map((id) => {
      const p = byId.get(id);
      return { discordId: id, elo: p?.elo ?? 1000, gamesPlayed: p?.gamesPlayed ?? 0 };
    });

  const deltas = applyMatchResult(toEloPlayers(teamAIds), toEloPlayers(teamBIds), winner);

  const changes: any[] = [];
  for (const id of allIds) {
    const p = byId.get(id);
    const d = deltas[id] || { oldElo: p?.elo ?? 1000, newElo: p?.elo ?? 1000, delta: 0 };
    const won = teamAIds.includes(id) ? winner === 'A' : winner === 'B';
    const epEarned = won ? WIN_EP : LOSS_EP;

    await db.collection('players').updateOne(
      { discordId: id },
      { $set: { elo: d.newElo }, $inc: { gamesPlayed: 1, wins: won ? 1 : 0, losses: won ? 0 : 1 } }
    );
    await db.collection('economy').updateOne(
      { discordId: id },
      { $inc: { balance: epEarned }, $setOnInsert: { items: [], equipped: { frame: null, name: null, theme: null }, claims: {} } },
      { upsert: true }
    );

    changes.push({
      discordId: id,
      copsName: p?.copsName ?? null,
      oldElo: d.oldElo,
      newElo: d.newElo,
      delta: d.delta,
      won,
      epEarned,
    });
  }

  await db.collection('matches').updateOne(
    { matchId },
    { $set: { status: 'completed', winner, completedAt: new Date(), result: { winner, changes } } }
  );

  return db.collection('matches').findOne({ matchId }, { projection: { _id: 0 } });
}
